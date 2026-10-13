# Version Design Document : v0.2.0-vertical-slice
Technical implementation and design guide for the upcoming version.

> **Revision 2 (Oct 12):** updated after a senior QA review of the docs (findings QA-1 to QA-16). Changes are marked **[QA-n]**.

## 1. Features Summary
_Overview of features included in this version._

Milestone **M1**, on the critical path. **Goal: the ugliest complete Sidequest loop running on real Qloo data**, then real persistence and guest sessions underneath it.

> Taste (demo crew) → Route → Qloo corridor scan → per-traveler scores → naive itinerary → slider simulation → Scout finds a candidate → **SIDE QUEST AVAILABLE** → accept → complete (sample photo, rating) → XP + journal entry.

The design is based on the Qloo spike (209, done; see `docs/qloo-findings.md`). Build order is strict: **foundations fixes (1.0) → slice (201–208 + 210) → persistence (211) → sessions (212).**

| ID | Feature | Outcome when done |
|----|---------|-------------------|
| 209 | Qloo spike | ✅ Done. Polygons and `filter.entities` confirmed; quota is 5 req/s and 10k/month. |
| — | Foundations fixes **[QA-1, QA-8]** | Env, interface and config changes the rest of the version depends on; dev routes and the proxy gated so production can't break or spend quota. |
| 210 | Real Qloo client + quota guard | Live calls with throttle, retries, timeouts, quota tracking that never fails open, a call meter for each request, and a file cache for development. |
| 201 | Demo crew | Two travelers with **real, user-chosen Qloo entity IDs** for their favorites, committed as a small config file. |
| 202 | Corridor geometry | Route → drive-time segments → 15 km buffered, simplified WKT polygons; progress-along-route helpers. |
| 203 | Corridor scan | Per segment × bucket (food & drink, experiences) Qloo queries with curated tags, exclusions, chain filter, `is_closed` filter → candidate pool. |
| 204 | Naive group scoring | Per-traveler `filter.entities` scores → percentile calibration → soft-min group fit → "Your Vibe %". |
| 205 | Ugly itinerary | Days split by distance; up to 4 stops per day above a quality floor, ordered along the route; list + map pins. |
| 206 | Slider simulation | A slider moves the car marker along the route; shows current progress and the next stop. |
| 207 | Scout trigger | Pure function: an unused candidate in the upcoming window that is unusually strong locally → Side Quest offer. **Must actually fire on the demo route [QA-5].** |
| 208 | Side Quest loop | Offer card → accept/skip → complete (sample photo, 1–5 rating) → XP awarded → journal entry. |
| 211 | Persistence | Prisma schema on **local Supabase Postgres**, with **RLS enabled deny-all [QA-2]**; trip, candidates, quests, journal and XP are saved; Qloo cache in Postgres. |
| 212 | Guest sessions | Supabase anonymous users, **created lazily on first write [QA-10]**, cookie refreshed by Next 16 `proxy`; every row owned by the auth user ID. |

**Explicitly ugly in this version:** no design polish, no onboarding (fixed demo crew), naive day splits (overnight heuristic is v0.3.0), template explanations (LLM is v0.3.0), no agent yet.

## 2. Technical Architecture Overview
_High-level technical structure that supports all features in this version._

```
/dev/slice (client page: map + list + slider + quest card + journal)
   │  POST /api/dev/slice/plan → runs the pipeline, returns the full Trip (stops + Side Quest pool)
   │  Scout + XP run in the browser (pure functions) until persistence lands [QA-11]
   │  From 211: POST /api/dev/slice/quest/:id → accept | skip | complete (persisted)
   ▼
src/services/sliceTrip.ts   (orchestration; network allowed; takes a per-request CallMeter [QA-16])
   ├─ adapters/mapbox      directions (full geometry)
   ├─ domain/geo           segmentCorridor(), progress helpers, estimateDetourMin (moved here) [QA-15]
   ├─ services/corridorScan → adapters/qloo (Real + throttle + quota guard + cache)
   ├─ domain/quality       chain filter, closed/excluded filters
   ├─ domain/scoring       calibrate(), groupFit(), vibePct(), especiallyFor()
   ├─ domain/itinerary     naiveDays()
   ├─ domain/scout         findSideQuest()
   ├─ domain/explain       templateWhy()
   └─ domain/xp            xpFor()
   ▼
Phases 1–5: Trip returned to the client and kept in page state + localStorage
Phase 6+:   Prisma → local Supabase Postgres (RLS deny-all; Prisma connects as the table owner)
```

- **New layer `src/services/`:** orchestration that may call adapters, keeping `src/domain` pure. `estimateDetourMin` moves from `adapters/mapbox` to `domain/geo` (the adapter re-exports it), so the domain never imports an adapter **[QA-15]**.
- **Dev routes are gated [QA-1]:** `/dev/*` and `/api/dev/*` return **404 unless `DEV_ROUTES=true`**. The flag defaults to on in development and off in production. This stops the public site from exposing a quota-spending endpoint or routes that need a database production doesn't have.
- **Production on Vercel keeps `QLOO_MODE=mock`, `SESSION_MODE=dev` and no database** until hosted Supabase exists (end of v0.3.0). The slice is developed locally against real Qloo + local Supabase.

## 3. Implementation Notes
_Shared technical considerations across all features in this version._

### Foundations fixes (task 1.0) [QA-1, QA-8, QA-9]
- **Env schema additions:** `QLOO_CACHE` (`file|memory|postgres`), `QLOO_QUOTA_RESERVE` (default 1000), `QLOO_UNKNOWN_QUOTA_BUDGET` (default 25), `DEV_ROUTES` (boolean; default `true` unless `NODE_ENV=production`), `DATABASE_URL`, `DIRECT_URL` (optional until 211). Update `.env.example`.
- **`superRefine` rejects `QLOO_CACHE=file` when running on Vercel** (`VERCEL=1`). `FileCacheStore` also falls back to memory if a write fails (read-only filesystem) **[QA-9]**.
- **`.gitignore` adds `.qloo-cache/`.**
- **Interface changes:** `QlooClient` methods take an optional `RequestOptions { allowReserve?: boolean; meter?: CallMeter; signal?: AbortSignal }`. `QlooError` gains a `code` (`quota_reserve | rate_limited | http | timeout | network | invalid_response`). `CacheStore.set` gains optional metadata `{ method, params }` so the Postgres store can keep them.
- **Dev-route gate** helper (`assertDevRoutes()` → `notFound()` / a 404 Response). Tests for both states.

### 210: Real Qloo client + quota guard [QA-3]
- **`RealQlooClient`** implements `search`, `insights` and `tags` with `fetch`, the `X-Api-Key` header and a 10 s timeout. The existing `params.ts` builds the URLs.
- **Throttle:** a token bucket at **4 req/s**, concurrency ≤ 4. *(Plan said concurrency 6; the observed limit is 5 req/s, so 4 leaves headroom. See Deviations.)*
- **Rate-limit detection:** treat **HTTP 429 *or* a body containing `"error_msg":"Rate limit exceeded"`** (any status) as `rate_limited`. Retry after 1 s, up to 2 times. The first live call in task 1.0b records the actual status code in the findings doc.
- **Retries:** network errors and timeouts are retried 2× with backoff + jitter. **5xx is retried at most once** (S3's 500 was deterministic). Other 4xx are never retried.
- **Quota tracking** (header **`x-month-ratelimit-remaining`**, confirmed in the spike) is stored in memory **and persisted** (`.qloo-cache/quota.json` in development; the `QlooCache`/settings table after 211).
  - **Guard:** below `QLOO_QUOTA_RESERVE`, live calls fail with `QlooError(code: "quota_reserve")` unless `allowReserve: true` (demo seeding only).
  - **Unknown remaining is not a free pass:** until a header has been seen, at most `QLOO_UNKNOWN_QUOTA_BUDGET` calls are allowed per process before failing closed.
  - `/api/health` reports `qloo.monthRemaining` and its age.
- **Per-request `CallMeter`** counts `{endpoint, ms, cached, remaining}` for one plan, so concurrent plans never mix counts **[QA-16]**.
- **Normalizer re-scope [QA-15]:** `type`/`types` and `tag_id`/`id` already work. Remaining work: capture `query.distance` and the useful `properties` (description, short_description, specialty_dishes, keywords, good_for, price_level, business_rating, is_closed, hours, images), and make the mock emit them.
- **Dev cache:** `FileCacheStore` in gitignored `.qloo-cache/`. Default `QLOO_CACHE=file` in development, `memory` elsewhere until 211 adds `postgres`. `QLOO_MODE=record` = `real` + file cache. **It no longer writes committed fixtures**, because raw Qloo data stays out of the public repo (see Deviations).

### 201: Demo crew
- `src/config/demoCrew.ts`: "Matt" and "Alex", each with a color, **4 favorites `{ qlooId, name, type }`** chosen by you from real `/search` results, and **`tasteTags`**: validated *place* tags describing their interests. Only IDs, names and tag IDs are committed. *(Favorites' own tags turned out to be cross-domain descriptors, e.g. Wikipedia categories, that never overlap with place tags, so "why" overlap uses `tasteTags`. These play the role onboarding's vibe cards will later.)*
- **Chosen favorites:** Matt: Phở 79 (Westminster), Guelaguetza Restaurant, *Ford v Ferrari*, Joshua Tree National Park. Alex: Phoebe Bridgers, Blue Bottle Coffee, The Broad, Patagonia.
- `scripts/pick-favorites.ts` prints candidates with type, city and ID. It costs about 10–15 calls and needs the quota guard **[QA-15]**.

### 202: Corridor geometry (`src/domain/geo/corridor.ts`)
- **Segments every ~2.5 h of driving** (time ∝ distance along the line, using the route's average speed) → Anaheim → Denver ≈ 7 segments. Buffer **15 km** (`steps: 4`), simplify to **≤ 40 vertices** (adaptive tolerance), lon-first WKT via `polygonWkt`. *(The plan said 60–90 min segments; 2.5 h halves the call count. See Deviations.)*
- **Helpers:** `alongKm`, `pointAt`, `progressFraction`, `segmentFor`, `estimateDetourMin` (moved here).

### 203: Corridor scan (`src/services/corridorScan.ts`)
- **Per segment × 2 buckets** (food & drink; experiences). One Insights call each:
  - `filter.type=urn:entity:place`, `filter.location=<segment WKT>`
  - `signal.interests.entities=<union of all travelers' favorites>`
  - `filter.tags=<curated bucket tags>` and `filter.exclude.tags=<casino, hotel, gas station, fast food…>` (both validated, stored in `src/config/buckets.ts`)
  - `diversify.by=properties.geocode.city`, `diversify.take=3`, **`take=15`**, `feature.explainability=true`
- **Post-filters run before scoring [QA-6]:** drop `is_closed`, chains (a curated list of ~100 names, normalized matching) and duplicates.
- **Budget:** 7 × 2 = **14 scan calls**.

### 204: Naive group scoring (`src/domain/scoring`)
- **Per-traveler scores:** one `filter.entities` call per traveler with only that traveler's favorites as signals, **`take` = batch size**.
- **Batch size (verified in task 1.7):** Qloo caps `take` at 50, so batches are **≤ 50 IDs** (a 50-ID batch was verified: 2.0 KB URL, all 50 returned).
- **Scoring cap:** only the **top 100 candidates** by group-query affinity (after post-filters) are scored per traveler → **2 batches × 2 travelers = 4 calls**. Lower-ranked candidates are dropped; they would rarely make the itinerary or the Side Quest pool.
- **Total:** 14 scan calls (`take=15`) + 4 scoring calls ≈ **18 calls per trip** (≤ 20 ✅).
- **Calibration (local, see Deviations):** `c_i` = percentile rank of traveler *i*'s affinity among candidates within **±200 km** along the route (at least the 10 nearest). Affinities are compressed at ~0.71–0.92.
- **Group fit** `G` = power mean of `c_i` with p = −2. **Your Vibe %** = `round(100·G)`, capped at 99.
- **"Especially for" [QA-16]:** traveler *i* if `c_i ≥ 0.85` **and** `c_i` is at least **0.10 above every other traveler's score**.
- Full scoring (delight, overlap, fairness, exact detours) comes in v0.3.0 (302–303).

### 205: Naive itinerary (`src/domain/itinerary/naive.ts`) [QA-5, QA-16]
- Split the route into `days` equal-distance chunks (demo: 4). Per day: candidates with `G ≥ 0.60` **and estimated detour ≤ 10 min**, ranked by `G`. Take **up to 4, at least 2 if 2 qualify, at most 2 per bucket**, ordered by `alongKm`.
- **Side Quest pool** = all candidates not planned. Planned stops prefer short detours, while Side Quests allow 5–25 min detours ("you're 11 minutes away"), so the strongest slightly-off-route places are left for the Scout instead of being used up by the itinerary.

### 206: Slider simulation (`/dev/slice`)
- A client page with the RouteMap (numbered stop pins), the day list and a range slider over route km. The marker moves with `pointAt`. A "next stop" readout, ▶ auto-advance, and "skip to next stop".
- Fixes the RouteMap fit-bounds race (fit when map loaded **and** route present).
- **`?trip=` (Phase 6) is read inside a `<Suspense>` boundary**, as `cacheComponents` requires **[QA-16]**.

### 207: Scout trigger (`src/domain/scout`) [QA-5]
- **Inputs:** the unused pool, progress km, last offer km, offers today.
- **Window:** candidates with `alongKm ∈ [progress + 5, progress + 80] km` and estimated detour 5–25 min.
- **Robust z-score:** `z = (G − median) / max(1.4826·MAD, 0.03)`. The baseline is pool candidates within ±150 km. If fewer than **8** are in that range, fall back to the whole trip's pool.
- **Fire** when `z ≥ 1.5` and `G ≥ 0.80`. Cooldown: no new offer within 150 km of the last one. **Cap: 2 offers per day.** Returns at most one quest (the highest z) with a template title from its bucket/subtype ("🌮 The Taco Detour").
- **Acceptance:** at the default thresholds, **at least 2 offers fire on Anaheim → Denver** for the demo crew. Task 5.7 prints the z distribution so the thresholds can be tuned from data.
- Pure; no Qloo calls at simulation time.

### 208: Side Quest loop + XP + journal
- **Template "why" [QA-12]:** built from per-traveler `c_i` ("94% Your Vibe · Matt 96 · Alex 91"), **tag overlap** between the place's tags and each traveler's `tasteTags` ("Alex: indie, art"), and a description or specialty-dish snippet. Explainability credit is used only to break ties (S2 found it too flat with many signals).
- **XP (`src/domain/xp`) [QA-14]:** Side Quest = 100 + `clamp(round(50·(G−0.8)/0.2), 0, 50)` + `min(2·detourMin, 50)`. Planned check-in = 50 + the same clamped match bonus.
- **Before 211:** Scout, quest state, XP and journal run in the browser (page state + localStorage). **From 211:** quest actions go through `POST /api/dev/slice/quest/:id` and are persisted.
- **Sample photos:** 3 images in `/public/samples` that are **CC0 or generated**, with sources recorded in `public/samples/CREDITS.md` **[QA-16]**.

### 211: Persistence (Prisma → local Supabase Postgres)
- **Preconditions:** Docker Desktop running, Supabase CLI installed (both verified on this machine) **[QA-15]**. `supabase init` + `supabase start`; Postgres on `localhost:54322`.
- **Prisma: latest stable 7.x**, including its configuration changes (`prisma.config.ts`, driver adapter for Postgres). Read Prisma 7's docs before setup.
- **Models:** `User`, `Traveler`, `TasteSignal`, `Trip`, `TripTraveler`, `TripDay`, `Candidate`, `Stop`, `SideQuest`, `JournalEntry`, `XpEvent`, `QlooCache`, `AppState` (holds the persisted quota). `AgentRun`/`AgentEvent` move to v0.3.0 (see Deviations).
- **Security [QA-2]:** Supabase's Data API (PostgREST) exposes the `public` schema to anyone holding the anon key, which is public by design. **The first migration enables RLS with no policies (deny-all) on every table.** Prisma connects as the table owner, so app access is unaffected. **A test calls the Data API with the anon key and expects every table to be denied.** All app access goes through server code, with ownership checks.
- **`PostgresCacheStore`** implements `CacheStore` (key, method, params, response, fetchedAt, TTL 7 days).

### 212: Guest sessions (Supabase anonymous) [QA-1, QA-10]
- **`src/proxy.ts`** does nothing unless `SESSION_MODE=supabase`. Its matcher skips `_next/static`, `_next/image`, images and the favicon. It **only refreshes** an existing session cookie and never creates users.
- **Lazy creation:** the anonymous user is created on the **first write** (planning or saving a trip) via **`POST /api/session`**. That route checks the cookie first, so repeated or parallel calls don't create duplicates; the client also de-duplicates in-flight calls. Crawlers that only read never create users.
- `getCurrentUser()` in supabase mode returns `{ id: auth.uid, isAnonymous }` and upserts the `User` row. Ownership is checked on every trip, quest and journal query, with tests for cross-user denial.
- **Before hosting (v0.3.0+):** enable Supabase's anonymous sign-in rate limits and captcha.

### Testing in this version
- **Unit (Vitest):** env additions and the Vercel file-cache rejection; dev-route gate; throttle (≤ 4/s); rate-limit body detection; retry policy (5xx once); quota guard including unknown-remaining fail-closed and persistence; file cache round-trip and read-only fallback; normalizer with synthetic fixtures; corridor segmentation; chain filter; calibration, power mean, vibe %, especially-for; naive day split; Scout (fires on an outlier, MAD floor, small-sample fallback, window, cooldown, daily cap, no repeats); template why; XP clamping.
- **End-to-end test of the pipeline (Vitest) [QA-13]:** `sliceTrip` on `MockQlooClient` with a stubbed route, asserting the exit criteria below hold on mock data.
- **DB tests (Phase 6–7):** repository round-trips, quest lifecycle, XP ledger totals, RLS denial via the anon key, cross-user denial.
- **Live (budgeted):** one Anaheim → Denver plan, then a cached re-run.

### Exit criteria (measurable) [QA-13]
On the live Anaheim → Denver plan for the demo crew:
1. **≤ 20 Qloo calls** for a fresh plan; **0 calls** on the cached re-run.
2. **0 chains and 0 casinos** among planned stops and Side Quests.
3. **≥ 3 stops on at least 3 of the 4 days.**
4. **Each traveler is "especially for" at least 1 planned stop.**
5. **≥ 2 Side Quest offers fire** at default thresholds while sliding the full route.
6. Full loop works in the browser: offer → accept → arrive → complete → XP + journal entry (task 5.8).
7. After 211/212: reload restores the trip and journal; a second browser can't see the first guest's trip; anon-key Data API access is denied.

## 4. Other Technical Considerations
_Shared any other technical information that might be relevant to building this version._

- **Quota budget for this version:** about **300 calls** (favorites picking ~15, tag validation ~20, batch verification ~3, slice iterations ~10 plans × ~20). Re-plans are served from the file cache unless inputs change.
- **Raw Qloo data stays out of git:** `.qloo-cache/` is gitignored, and unit tests use small synthetic fixtures.
- **Production impact:** none beyond the 404 gate. Vercel still serves the mock; `/api/health` gains the quota fields.
- **Free tier:** local Supabase costs nothing. A hosted Supabase project is only needed when persistence must work on Vercel (end of v0.3.0).

### Schedule and slip rule [QA-4]
- **Timebox:** Phases 1–5 (slice) by **end of Oct 14**; Phases 6–8 on **Oct 15**.
- **Slip rule:** if the slice checkpoint (5.8) isn't reached by end of Oct 14, **212 (guest sessions) moves to day one of v0.3.0**. If 211 isn't done by end of Oct 15, **211 moves too**. The slice never waits on persistence.
- **Revised milestone dates** (backlog updated): M1 Oct 13–15 · M2 Oct 16–19 · M3 Oct 20–22 · M4 Oct 23–26 · M5 bonus only if M4 finishes early · **M6 Oct 27–29 protected**.

### Deviations from the approved plan [QA-5, QA-7]
| Plan / backlog said | v0.2.0 does | Why |
|---|---|---|
| Corridor segments of 60–90 min | ~2.5 h segments | Halves Qloo calls under the 10k/month quota; S1 showed long polygons work |
| Candidate queries `take≈30–50` | `take=15` per segment × bucket; only the top 100 candidates are scored | Qloo caps `take` at 50, so scoring batches are ≤ 50; keeps the plan ≤ 20 calls |
| Qloo concurrency 6 | Throttle 4 req/s, concurrency 4 | Observed limit is 5 req/s |
| Postgres cache in 210; `record` mode produces fixtures | File cache in development, Postgres in 211; recordings stay local and gitignored | Raw Qloo data must not be committed to the public repo |
| `AgentRun` / `AgentEvent` in 211 | Moved to v0.3.0 (with the Planner agent) | No agent exists yet |
| Scout: z on stop score S, G ≥ 0.88, 30–60 min window, detour ≤ 20 min, 1–2/day | z on G (S arrives in v0.3.0), G ≥ 0.80, z ≥ 1.5, km window, detour 5–25 min, ≤ 2/day | Naive scoring has no S yet; thresholds start lower and are tuned from the printed z distribution |
| "Why" from explainability | Per-traveler scores + tag overlap; explainability only breaks ties | S2: explainability is flat with many signals |
| Calibration: percentile within the trip's pool | **Local calibration**: percentile among candidates within ±200 km (≥ 10 nearest). "Your Vibe %" = how well a place fits the crew *compared with this stretch of road* | Trip-wide ranking let metro areas crowd out rural stretches: 1 Side Quest and a thin day 3. Local: 2 Side Quests (incl. Mystic Hot Springs) and ≥ 3 stops on 3 days. Approved by the product owner 2026-10-13 |
| Itinerary floor G ≥ 0.60 | G ≥ 0.45, with a 2-stop minimum flagged `belowFloor` | Local percentiles spread wider; 0.60 left rural days empty |
| Pipeline test asserts exit criteria on mock data | Mock test asserts criteria 1, 2, 4, 5 (Scout's absolute G floor lowered to 0.5) and ≥ 2 stops/day; criterion 3 and default Scout thresholds are proven on the live run (`pnpm slice:live`) | ~45 fictional places can't produce real density, and the mock crew's tastes barely overlap |

## 5. Open Questions
_Unresolved technical or product questions affecting this version._

Resolved in review: favorites are picked by you; travelers are "Matt" and "Alex"; hosted Supabase waits until the end of v0.3.0; Prisma is pinned to the latest stable 7.x.

1. **Quota increase:** not yet requested (task 1.1). It affects how freely we can re-plan during v0.3.0 tuning.
