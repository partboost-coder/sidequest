# Version Tasklist – v0.2.0-vertical-slice
This document outlines all the tasks to work on to delivery this particular version, grouped by phases.

Milestone M1, target **Oct 15** (slice by end of Oct 14). Backlog items 201–212 (209 done). Decisions from design review: you pick the demo favorites from real search results; travelers are "Matt" and "Alex"; hosted Supabase is deferred to the end of v0.3.0 (production stays on mock data); Prisma is pinned to the latest stable 7.x. **Quota budget for this version: about 300 Qloo calls.**

| Status |      |
|--------|------|
| 🔴 | Not Started |
| 🟡 | In Progress |
| 🟢 | Completed |


## Phase 1 – Real Qloo Client & Quota Guard (item 210)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 1.1 | Quota increase request | Post the prepared message in Qloo Discord #api-help asking for a higher monthly quota through judging. | None | 🔴 Not Started | USER |
| 1.2 | Normalizer updates | Singular `type`/`subtype` (search uses `types[]`), tag `id` vs `tag_id`, `query.distance`, and the useful `properties` (description, short_description, specialty_dishes, keywords, good_for, price_level, business_rating, is_closed, hours, images); update the mock to emit the same shape. | None | 🔴 Not Started | AGENT |
| 1.3 | Throttle | Process-wide token bucket at 4 req/s, concurrency ≤ 4. | None | 🔴 Not Started | AGENT |
| 1.4 | RealQlooClient network calls | `fetch` with `X-Api-Key`, 10 s timeout; retry 2× on 429/5xx/network errors with backoff + jitter; no retry on other 4xx. | 1.2, 1.3 | 🔴 Not Started | AGENT |
| 1.5 | Quota tracking & guard | Read `x-month-ratelimit-remaining`; refuse live calls below `QLOO_QUOTA_RESERVE` (default 1,000) unless `allowReserve`; expose `qloo.monthRemaining` in `/api/health`. | 1.4 | 🔴 Not Started | AGENT |
| 1.6 | File cache store | `FileCacheStore` in gitignored `.qloo-cache/`; `QLOO_CACHE=file|memory|postgres`; `record` mode = real + file cache; call counter (endpoint, ms, cached, remaining). | 1.4 | 🔴 Not Started | AGENT |
| 1.7 | Qloo client tests | Throttle rate, retry policy, quota guard, file cache round-trip, normalizer with synthetic fixtures shaped like the observed responses. | 1.2–1.6 | 🔴 Not Started | AGENT |

## Phase 2 – Demo Crew & Bucket Config (items 201, 203 config)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 2.1 | Favorites picker script | `scripts/pick-favorites.ts`: runs `/search` for proposed favorites and prints the top candidates with type + city + ID. | 1.6 | 🔴 Not Started | AGENT |
| 2.2 | Choose favorites | Pick 3–4 favorites each for Matt and Alex from the printed candidates. | 2.1 | 🔴 Not Started | USER |
| 2.3 | Demo crew config | `src/config/demoCrew.ts`: travelers (name, color), favorites `{qlooId, name, type}`, taste tags. IDs and names only. | 2.2 | 🔴 Not Started | AGENT |
| 2.4 | Bucket tags & exclusions | Validate curated tag IDs via `/v2/tags` (food & drink; experiences; exclusions such as casino, hotel, gas station, fast food); store in `src/config/buckets.ts`. | 1.6 | 🔴 Not Started | AGENT |
| 2.5 | Chain filter | `src/domain/quality/chains.ts`: ~100 national chain names, normalized matching; closed-place filter; unit tests. | None | 🔴 Not Started | AGENT |

## Phase 3 – Corridor, Scan & Scoring (items 202, 203, 204)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 3.1 | Corridor segmentation | `src/domain/geo/corridor.ts`: ~2.5 h drive-time segments, 15 km buffer, ≤ 40 vertices, lon-first WKT. | None | 🔴 Not Started | AGENT |
| 3.2 | Route progress helpers | `alongKm`, `pointAt`, `progressFraction`, `segmentFor`. | 3.1 | 🔴 Not Started | AGENT |
| 3.3 | Corridor scan service | `src/services/corridorScan.ts`: segment × bucket Insights calls with union signals, bucket tags, exclusions, diversify, explainability; post-filters; de-duplication by entity ID. | 1.4, 2.3, 2.4, 2.5, 3.1 | 🔴 Not Started | AGENT |
| 3.4 | Per-traveler scoring calls | `filter.entities` per traveler, batched ≤ 100 IDs. | 3.3 | 🔴 Not Started | AGENT |
| 3.5 | Naive group scoring | `src/domain/scoring`: percentile calibration, power-mean (p = −2) group fit, Your Vibe %, "especially for". | 3.4 | 🔴 Not Started | AGENT |
| 3.6 | Geo & scoring tests | Segment count and coverage, vertex budget, WKT order, calibration, power mean, vibe % cap. | 3.1, 3.2, 3.5 | 🔴 Not Started | AGENT |

## Phase 4 – Itinerary, Scout & XP Logic (items 205, 207, 208 logic)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 4.1 | Naive itinerary | `src/domain/itinerary/naive.ts`: equal-distance days, top 3–4 per day (≤ 2 per bucket), ordered along route, estimated detours; unused pool for the Scout. | 3.2, 3.5 | 🔴 Not Started | AGENT |
| 4.2 | Scout trigger | `src/domain/scout`: upcoming window, detour cap, local median/MAD z-score, thresholds, cooldown, template quest titles. | 4.1 | 🔴 Not Started | AGENT |
| 4.3 | XP rules | `src/domain/xp`: Side Quest and check-in XP formulas. | None | 🔴 Not Started | AGENT |
| 4.4 | Template "why" | Build a one-line explanation from per-traveler scores, top contributing favorites, tags and description snippet. | 3.5 | 🔴 Not Started | AGENT |
| 4.5 | Logic tests | Day split, Scout fires on an outlier and respects window/cooldown/detour, no repeats, XP math, template why. | 4.1–4.4 | 🔴 Not Started | AGENT |

## Phase 5 – Slice Harness & Live Run (items 205, 206, 208 UI)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 5.1 | Slice orchestration | `src/services/sliceTrip.ts`: route → corridor → scan → scores → itinerary → quest pool; reports calls used. | 3.3–3.5, 4.1 | 🔴 Not Started | AGENT |
| 5.2 | Slice API routes | `POST /api/dev/slice/plan`, `POST /api/dev/slice/scout`, `POST /api/dev/slice/quest/:id`. | 5.1, 4.2, 4.3 | 🔴 Not Started | AGENT |
| 5.3 | `/dev/slice` page | Map with numbered stop pins, day list with vibe % + detour + why, slider, ▶ auto-advance, skip to next stop; fix the RouteMap fit-bounds race. | 5.2 | 🔴 Not Started | AGENT |
| 5.4 | Side Quest UI | Offer card (vibe %, per-traveler %, why, detour, XP) → accept/skip → jump to arrival → complete (sample photo, 1–5 rating) → XP → journal list; state in page + localStorage. | 5.3 | 🔴 Not Started | AGENT |
| 5.5 | Sample photos | 3 bundled sample images in `/public/samples` (royalty-free / generated). | None | 🔴 Not Started | AGENT |
| 5.6 | Live run & call budget | One live Anaheim → Denver plan (≤ 20 calls), then a cached re-run (0 calls). | 5.1 | 🔴 Not Started | AGENT |
| 5.7 | Quality review | Print planned stops and Side Quest candidates; review for chains, casinos and genericness; tune tags and exclusions. | 5.6 | 🔴 Not Started | USER, AGENT |
| 5.8 | Slice checkpoint | You walk the full loop on `/dev/slice` end to end. | 5.4, 5.7 | 🔴 Not Started | USER |

## Phase 6 – Persistence (item 211)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 6.1 | Local Supabase | `supabase init` + `supabase start` (Docker); DB URLs in `.env.local`; `supabase/` config committed (no secrets). | 5.8 | 🔴 Not Started | AGENT |
| 6.2 | Prisma setup | Install the latest stable Prisma 7.x; client singleton; `pnpm db:*` scripts. | 6.1 | 🔴 Not Started | AGENT |
| 6.3 | Schema & migration | Models: User, Traveler, TasteSignal, Trip, TripTraveler, TripDay, Candidate, Stop, SideQuest, JournalEntry, XpEvent, QlooCache; ownership columns; first migration. | 6.2 | 🔴 Not Started | AGENT |
| 6.4 | Postgres cache store | `PostgresCacheStore` implementing `CacheStore`; `QLOO_CACHE=postgres`. | 6.3 | 🔴 Not Started | AGENT |
| 6.5 | Save & restore slice state | Plan saves trip, days, stops, candidates, quests; quest actions, journal and XP written to the DB; `/dev/slice?trip=<id>` restores state. | 6.3 | 🔴 Not Started | AGENT |
| 6.6 | Persistence tests | Repository functions against the local DB (save/load trip, quest lifecycle, XP ledger totals). | 6.5 | 🔴 Not Started | AGENT |

## Phase 7 – Guest Sessions (item 212)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 7.1 | Read Next 16 `proxy` docs | Read the bundled docs for `proxy` and cookies before implementing. | 6.1 | 🔴 Not Started | AGENT |
| 7.2 | Supabase SSR clients + proxy | `@supabase/ssr` server/browser helpers; `src/proxy.ts` refreshes the session cookie. | 7.1 | 🔴 Not Started | AGENT |
| 7.3 | Anonymous sign-in | First visit without a session → `signInAnonymously()`; `getCurrentUser()` supabase mode upserts the `User` row. | 7.2, 6.3 | 🔴 Not Started | AGENT |
| 7.4 | Ownership checks | Every trip/quest/journal read and write is scoped to the current user; tests for cross-user access denial. | 7.3, 6.5 | 🔴 Not Started | AGENT |
| 7.5 | Session verification | Fresh browser → new guest; reload keeps the same guest and trip; a second browser can't see the first guest's trip. | 7.4 | 🔴 Not Started | USER |

## Phase 8 – Wrap-up

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 8.1 | Quality gate | `pnpm check` and `pnpm build` green; production still healthy on mock. | 7.4 | 🔴 Not Started | AGENT |
| 8.2 | Findings & docs update | Update `docs/qloo-findings.md` (tag sets, call counts, quota used) and the README run instructions (local Supabase). | 8.1 | 🔴 Not Started | AGENT |
| 8.3 | M1 exit check | The full loop runs on real Qloo data, persists, and works for an anonymous guest; calls per plan ≤ 20. | 8.2, 7.5 | 🔴 Not Started | AGENT |
