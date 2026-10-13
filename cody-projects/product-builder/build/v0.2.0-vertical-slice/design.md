# Version Design Document : v0.2.0-vertical-slice
Technical implementation and design guide for the upcoming version.

## 1. Features Summary
_Overview of features included in this version._

Milestone **M1**, on the critical path. **Goal: the ugliest complete Sidequest loop running on real Qloo data**, then real persistence and guest sessions underneath it.

> Taste (demo crew) → Route → Qloo corridor scan → per-traveler scores → naive itinerary → slider simulation → Scout finds a candidate → **SIDE QUEST AVAILABLE** → accept → complete (sample photo, rating) → XP + journal entry.

The design is based on the Qloo spike (209, done; see `docs/qloo-findings.md`). Build order is strict: **slice first (201–208 + 210), persistence second (211–212).**

| ID | Feature | Outcome when done |
|----|---------|-------------------|
| 209 | Qloo spike | ✅ Done. Polygons and `filter.entities` confirmed; quota is 5 req/s and 10k/month. |
| 210 | Real Qloo client + quota guard | Live calls with throttle, retries, timeouts, quota tracking and a file cache for development, so dev doesn't burn quota. |
| 201 | Demo crew | Two travelers with **real, user-chosen Qloo entity IDs** for their favorites, committed as a small config file. |
| 202 | Corridor geometry | Route → drive-time segments → 15 km buffered, simplified WKT polygons; progress-along-route helpers. |
| 203 | Corridor scan | Per segment × bucket (food & drink, experiences) Qloo queries with curated tags, exclusions, chain filter, `is_closed` filter → candidate pool. |
| 204 | Naive group scoring | Per-traveler `filter.entities` scores → percentile calibration → soft-min group fit → "Your Vibe %". |
| 205 | Ugly itinerary | Days split by distance; top candidates per day, ordered along the route; list + map pins. |
| 206 | Slider simulation | A slider moves the car marker along the route; shows current progress and the next stop. |
| 207 | Scout trigger | Pure function: an unused candidate in the upcoming window that is unusually strong locally → Side Quest offer. |
| 208 | Side Quest loop | Offer card → accept/skip → complete (sample photo, 1–5 rating) → XP awarded → journal entry. |
| 211 | Persistence | Prisma schema on **local Supabase Postgres**; the slice's trip, candidates, quests, journal and XP are saved; Qloo cache in Postgres. |
| 212 | Guest sessions | Supabase anonymous sign-in via `@supabase/ssr` + Next 16 `proxy`; every row owned by the auth user ID. |

**Explicitly ugly in this version:** no design polish, no onboarding (fixed demo crew), naive day splits (overnight heuristic is v0.3.0), template explanations (LLM is v0.3.0), no agent yet.

## 2. Technical Architecture Overview
_High-level technical structure that supports all features in this version._

```
/dev/slice (client page: map + list + slider + quest card + journal)
   │ POST /api/dev/slice/plan      → runs pipeline, returns Trip JSON (cached)
   │ POST /api/dev/slice/scout     → Scout check at a progress point
   │ POST /api/dev/slice/quest/:id → accept | skip | complete
   ▼
src/services/sliceTrip.ts   (orchestration; network allowed)
   ├─ adapters/mapbox      directions (full geometry)
   ├─ domain/geo           segmentCorridor(), progress helpers           (pure)
   ├─ services/corridorScan → adapters/qloo (Real + throttle + cache)     (network)
   ├─ domain/quality       chain filter, closed/excluded filters         (pure)
   ├─ domain/scoring       calibrate(), groupFit(), vibePct()            (pure, naive)
   ├─ domain/itinerary     naiveDays()                                   (pure)
   ├─ domain/scout         findSideQuest()                               (pure)
   └─ domain/xp            xpFor()                                       (pure)
   ▼
v0.2.0 first half: in-memory/JSON results → second half: Prisma → local Supabase Postgres
```

- **New layer `src/services/`:** orchestration that may call adapters, keeping `src/domain` pure. (v0.3.0's agent tools will wrap these services.)
- **Dev-only routes** live under `/api/dev/*` and `/dev/*`. They are the slice harness, replaced by product screens in v0.4.0. They stay deployable but unlinked.
- **Production on Vercel keeps `QLOO_MODE=mock` and no database** until a hosted Supabase project exists (see Open Questions). The slice is developed locally against real Qloo + local Supabase.

## 3. Implementation Notes
_Shared technical considerations across all features in this version._

### 210: Real Qloo client + quota guard
- **`RealQlooClient`** implements `search`, `insights` and `tags` with `fetch`, the `X-Api-Key` header and a 10 s timeout. The existing `params.ts` builds the URLs.
- **Throttle:** a token bucket at **4 req/s** shared by all calls in the process; concurrency ≤ 4.
- **Retries:** on 429 / 5xx / network errors, retry 2× with backoff (500 ms, 1500 ms + jitter). A 4xx other than 429 is not retried.
- **Quota tracking:** read `x-month-ratelimit-remaining` from every response and keep the latest value. Expose it in `/api/health`. **Guard:** when remaining drops below `QLOO_QUOTA_RESERVE` (default 1,000), live calls fail with a `QlooError("quota_reserve")` unless the caller passes `{ allowReserve: true }` (demo seeding only).
- **Normalizer updates from the spike:** entities use singular `type` plus `subtype` (search uses `types[]`); tags use `id` from `/v2/tags` and `tag_id` on entities; capture `query.distance`; capture the useful `properties` (`description`, `short_description`, `specialty_dishes`, `keywords`, `good_for`, `price_level`, `business_rating`, `is_closed`, `hours`, `image(s)`).
- **Dev cache:** a `FileCacheStore` writing to `.qloo-cache/` (**gitignored**: raw Qloo data never goes into the public repo). `QLOO_CACHE=file|memory|postgres` (default `file` in development, `memory` elsewhere until 211 adds `postgres`). `QLOO_MODE=record` becomes an alias for `real` with the file cache.
- **Call counter:** each request logs `{endpoint, ms, cached, remaining}` at debug level. The slice reports **calls used per plan**.

### 201: Demo crew
- `src/config/demoCrew.ts` holds two travelers. Each has a name, a color, and **3–4 favorites as `{ qlooId, name, type }`** plus taste tags. Only IDs and names are committed, never response bodies.
- **Favorites are chosen by you** from real `/search` results (spike S5 showed auto-picking gets small places wrong). A one-off script `scripts/pick-favorites.ts` runs searches and prints candidates with type and city for you to choose from.
- Proposed crew (matching the brief):
  - **Traveler 1 ("Matt")**: Vietnamese + Mexican food, cars, scenic drives, outdoors → e.g. *Guelaguetza Restaurant*, a Little Saigon pho spot, *Ford v Ferrari*, *Joshua Tree National Park*.
  - **Traveler 2 ("Alex")**: art, coffee, vintage, hiking, indie music → *Phoebe Bridgers*, *Blue Bottle Coffee*, *Patagonia*, plus an art or film pick.

### 202: Corridor geometry (`src/domain/geo/corridor.ts`)
- **Segments by drive time,** not distance: cut the full-resolution route every **~2.5 h of driving** (time is proportional to distance along the line, using the route's average speed). Anaheim → Denver (15.9 h) gives ~7 segments. Each segment is buffered **15 km** (`steps: 4`) and simplified to **≤ 40 vertices** (adaptive tolerance), then formatted as lon-first WKT via `polygonWkt`.
- **Helpers:** `alongKm(route, point)`, `pointAt(route, km)` (sim marker), `progressFraction`, `segmentFor(km)`.
- Overlapping buffers at segment joints are fine; candidates are de-duplicated by entity ID.

### 203: Corridor scan (`src/services/corridorScan.ts`)
- **Per segment × 2 buckets** (food & drink; experiences). Each is one Insights call with:
  - `filter.type=urn:entity:place`, `filter.location=<segment WKT>`
  - `signal.interests.entities=<union of all travelers' favorites>`
  - `filter.tags=<curated bucket tags>` (validated against `/v2/tags` once, stored in `src/config/buckets.ts`)
  - `filter.exclude.tags=<casino, hotel (outside lodging), gas station, fast food, …>` (validated IDs)
  - `diversify.by=properties.geocode.city`, `diversify.take=3`, `take=15`, `feature.explainability=true`
- **Post-filters (pure, `src/domain/quality`):** drop `is_closed`, drop chains (a curated list of ~100 national chain names, matched on normalized name), de-duplicate.
- **Budget for Anaheim → Denver:** 7 segments × 2 buckets = **14 scan calls**.

### 204: Naive group scoring (`src/domain/scoring`)
- **Per-traveler scores:** one `filter.entities` call per traveler with all candidate IDs (batched ≤ 100 IDs per call; ~3.7 KB URL) and only that traveler's favorites as signals. **Budget: ~2 calls per traveler** → **~4 calls for 2 travelers.** Total **≈ 18 calls per trip** (≤ 20 target ✅).
- **Calibration:** `c_i` = percentile rank of the traveler's affinity within this trip's pool (affinities are compressed at ~0.71–0.92, per S7).
- **Group fit** `G` = power mean of `c_i` with p = −2. **Your Vibe %** = `round(100·G)`, capped at 99. "Especially for" = travelers with `c_i ≥ 0.85` clearly above the others.
- Full scoring (delight, overlap, fairness, detours) comes in v0.3.0 (302–303). The function signatures are designed now so they extend without rewriting.

### 205: Naive itinerary (`src/domain/itinerary/naive.ts`)
- Split the route into `days` equal-distance chunks (default 4 for the demo). Per day, take the top 3–4 candidates by `G`, at most 2 from the same bucket, then order them by `alongKm`. Detour = cheap estimate (`estimateDetourMin`).
- **Side Quest pool** = candidates *not* planned.

### 206: Slider simulation (`/dev/slice`)
- A client page with the RouteMap (stops as numbered pins), the day list, and a range slider over route km. The marker moves with `pointAt`. A "next stop" readout. Buttons: ▶ auto-advance (plays at a fixed speed) and "skip to next stop".
- Fixes the RouteMap fit-bounds race noted in v0.1.0.

### 207: Scout trigger (`src/domain/scout`)
- `findSideQuest(pool, progressKm, opts)`: candidates from the unused pool with `alongKm ∈ [progress + 5, progress + 80] km` and detour ≤ 25 min. Local baseline = median and MAD of `G` among pool candidates within ±100 km. Fire when `z ≥ 2.0` and `G ≥ 0.85`, with a cooldown (no new offer within 150 km of the last one). Returns at most one quest with a template title from its bucket and subtype ("🌮 The Taco Detour").
- **Pure, with no Qloo calls,** because the pool is computed at plan time.

### 208: Side Quest loop + XP + journal
- The offer card shows the name, Your Vibe %, per-traveler %, a template "why" (top contributing favorites + tags + description snippet), detour and XP. Accept → the marker jumps to the place ("jump to arrival"). Complete → a sample photo picker (3 bundled images in `/public/samples`) + 1–5 rating → XP → journal entry appended.
- **XP (`src/domain/xp`):** base 100 for a Side Quest, + `round(50·(G−0.8)/0.2)` for match strength, + 2 per detour minute (cap 50). Planned-stop check-ins: 50 + match bonus. A pure, tested function.
- In the first half of the version, quest and journal state lives in the page's state plus `localStorage`. **211 moves it to the database.**

### 211: Persistence (Prisma → local Supabase Postgres)
- **Local Supabase** via the Supabase CLI (`supabase init`, `supabase start`, Docker), with Postgres on `localhost:54322`. `DATABASE_URL` / `DIRECT_URL` in `.env.local`.
- **Prisma** (latest stable 7.x; avoid release candidates). Models for this version: `User`, `Traveler`, `TasteSignal`, `Trip`, `TripTraveler`, `TripDay`, `Candidate`, `Stop`, `SideQuest`, `JournalEntry`, `XpEvent`, `QlooCache`. (`AgentRun`/`AgentEvent` arrive in v0.3.0.) JSON columns for scores, explainability and properties. Every user-owned table has `ownerUserId` / `userId`.
- **`PostgresCacheStore`** implements `CacheStore` (key, method, params, response, fetchedAt, TTL 7 days).
- The slice routes save the planned trip and quests; reloading `/dev/slice?trip=<id>` restores state.

### 212: Guest sessions (Supabase anonymous)
- `@supabase/ssr` server and browser clients; **`src/proxy.ts`** (Next 16's replacement for `middleware`) refreshes the session cookie. A first visit with no session triggers `signInAnonymously()` in a route handler, which sets the cookie. Read the bundled Next docs on `proxy` before implementing.
- `getCurrentUser()` in `supabase` mode returns `{ id: auth.uid, isAnonymous }` and upserts a `User` row. Ownership is checked on every trip, quest and journal query.
- `SESSION_MODE=supabase` locally; production stays `dev` until hosted Supabase exists.

### Testing in this version
- **Unit (Vitest):** corridor segmentation (segment count, vertex budget, lon-first WKT, coverage of the whole route), chain filter, calibration + power mean + vibe %, naive day split, Scout trigger (fires on an outlier, respects the window/cooldown/detour cap, no repeats), XP rules, throttle (≤ 4/s), retry policy, quota guard, normalizer with **synthetic** examples shaped like the observed responses.
- **Integration (manual, budgeted):** one live Anaheim → Denver plan with the call count printed (target ≤ 20), then replayed from the file cache with 0 calls.
- **Quality check:** print the planned stops and Side Quest candidates for the demo crew and review them for genericness (casinos, chains) before calling the slice done.

## 4. Other Technical Considerations
_Shared any other technical information that might be relevant to building this version._

- **Quota budget for this version:** about **300 calls** (spike ~25, favorites picking ~20, slice iterations ~10 plans × ~18 calls, tag validation ~20). Re-plans are served from the file cache unless inputs change.
- **Raw Qloo data stays out of git:** `.qloo-cache/` and any recordings are gitignored. Unit tests use small synthetic fixtures.
- **Production impact:** none for this version. Vercel still serves the mock and the dev pages. `/api/health` adds `qloo.monthRemaining` when known.
- **Schedule:** M1 was due Oct 12; we are starting Oct 13. **Target: v0.2.0 done by Oct 15** (slice by end of Oct 14; persistence and sessions Oct 15). That pushes the later milestones by about 3 days. The likely consequence is that most of the M5 bonus scope gets cut, which is exactly what the cut order exists for. M6 (Oct 27–29) stays protected.
- **Free tier:** local Supabase costs nothing. A hosted Supabase project (free tier) is only needed when persistence must work on Vercel.

## 5. Open Questions
_Unresolved technical or product questions affecting this version._

1. **Demo crew favorites:** are you OK choosing the 3–4 favorites per traveler from real search results (I'll show a short list of candidates)? And keep the names "Matt" and "Alex"? *Proposed: yes; you pick from the list.*
2. **Hosted Supabase timing:** create the free hosted project at the end of v0.2.0 (so the deployed app persists data) or wait until v0.3.0's demo seeding? *Proposed: end of v0.3.0. Production stays mock-only until then.*
3. **Prisma version:** npm's `latest` tag currently points to an 8.0 release candidate. *Proposed: pin the latest stable 7.x.*
4. **Quota increase:** did you post in Qloo's Discord? It affects how freely we can re-plan during v0.3.0 tuning.
