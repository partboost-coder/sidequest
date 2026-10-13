# Version Tasklist – v0.2.0-vertical-slice
This document outlines all the tasks to work on to delivery this particular version, grouped by phases.

Milestone M1. **Revision 2 (Oct 12):** updated after the senior QA review (QA-1 to QA-16; see `design.md`).

Decisions: you pick the demo favorites from real search results; travelers are "Matt" and "Alex"; hosted Supabase waits until the end of v0.3.0 (production stays mock-only, dev routes return 404 there); Prisma pinned to the latest stable 7.x. **Quota budget: ~300 Qloo calls.**

**Timebox & slip rule:** Phases 1–5 by end of **Oct 14**; Phases 6–8 on **Oct 15**. If the slice checkpoint (5.9) slips past Oct 14, Phase 7 (212) moves to v0.3.0 day one. If Phase 6 (211) isn't done by end of Oct 15, it moves too. **The slice never waits on persistence.**

| Status |      |
|--------|------|
| 🔴 | Not Started |
| 🟡 | In Progress |
| 🟢 | Completed |


## Phase 1 – Foundations Fixes & Real Qloo Client (item 210)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 1.0 | Foundations fixes | Env additions (`QLOO_CACHE`, `QLOO_QUOTA_RESERVE`, `QLOO_UNKNOWN_QUOTA_BUDGET`, `DEV_ROUTES`, `DATABASE_URL`, `DIRECT_URL`) with a Vercel rule rejecting `QLOO_CACHE=file`; `.env.example`; `.gitignore` adds `.qloo-cache/`; `RequestOptions { allowReserve, meter, signal }` on `QlooClient`; `QlooError.code`; `CacheStore.set` metadata; dev-route gate (404 unless `DEV_ROUTES`) via `src/proxy.ts` matcher + `devRoutesGuard()` for handlers (a layout gate broke `cacheComponents` prerendering); tests. | None | 🟢 Completed | AGENT |
| 1.1 | Quota increase request | Post the prepared message in Qloo Discord #api-help. | None | 🔴 Not Started | USER |
| 1.2 | Normalizer additions | Capture `query.distance` and the useful `properties` (description, short_description, specialty_dishes, keywords, good_for, price_level, business_rating, is_closed, hours, images); the mock emits the same shape. (`type`/`types` and `tag_id`/`id` already work.) | 1.0 | 🟢 Completed | AGENT |
| 1.3 | Throttle | Process-wide token bucket at 4 req/s, concurrency ≤ 4. | 1.0 | 🟢 Completed | AGENT |
| 1.4 | RealQlooClient network calls | `fetch` + `X-Api-Key`, 10 s timeout; `rate_limited` = HTTP 429 or body `"error_msg":"Rate limit exceeded"` → retry after 1 s, ≤ 2×; network/timeout retry 2× with backoff + jitter; **5xx retried once**; other 4xx never retried. | 1.2, 1.3 | 🟢 Completed | AGENT |
| 1.5 | Quota guard | Track `x-month-ratelimit-remaining` in memory and persist it (`.qloo-cache/quota.json`); refuse below `QLOO_QUOTA_RESERVE` unless `allowReserve`; **unknown remaining fails closed** after `QLOO_UNKNOWN_QUOTA_BUDGET` calls; `/api/health` reports `qloo.monthRemaining` and its age. | 1.4 | 🟢 Completed | AGENT |
| 1.6 | File cache & call meter | `FileCacheStore` (gitignored, falls back to memory if a write fails); `QLOO_CACHE` selection; `record` = real + file cache; per-request `CallMeter` (endpoint, ms, cached, remaining). | 1.4 | 🟢 Completed | AGENT |
| 1.7 | Live verification (~5 calls) | Confirm the quota headers on a live call; record the status code of a rate-limit response if one occurs naturally (don't burn calls to provoke it); **verify a 100-ID `filter.entities` batch with `take=100`** (URL length, all returned); fall back to 50 if it fails; update `docs/qloo-findings.md`. | 1.5, 1.6 | 🟢 Completed | AGENT |
| 1.8 | Qloo client tests | Throttle rate; rate-limit body detection; retry policy (5xx once); quota guard incl. persistence and unknown-remaining fail-closed; file cache round-trip + read-only fallback; meter isolation; normalizer with synthetic fixtures. | 1.2–1.6 | 🟢 Completed | AGENT |

## Phase 2 – Demo Crew & Bucket Config (items 201, 203 config)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 2.1 | Favorites picker script | `scripts/pick-favorites.ts`: `/search` for the proposed favorites; prints top candidates with type, city and ID (~10–15 calls). | 1.5, 1.6 | 🟢 Completed | AGENT |
| 2.2 | Choose favorites | Pick 3–4 favorites each for Matt and Alex from the printed candidates. | 2.1 | 🟢 Completed | USER |
| 2.3 | Demo crew config | `src/config/demoCrew.ts`: name, color, favorites `{qlooId, name, type}`, validated place `tasteTags` (drive why-overlap). IDs, names and tag IDs only. | 2.2 | 🟢 Completed | AGENT |
| 2.4 | Bucket tags & exclusions | Validate curated tag IDs via `/v2/tags` (food & drink; experiences; exclusions: casino, hotel, gas station, fast food); store in `src/config/buckets.ts` (~20 calls). | 1.5, 1.6 | 🟢 Completed | AGENT |
| 2.5 | Chain & closed filters | `src/domain/quality`: ~100 national chain names with normalized matching; `is_closed`; excluded-subtype check; unit tests. | None | 🟢 Completed | AGENT |

## Phase 3 – Corridor, Scan & Scoring (items 202, 203, 204)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 3.1 | Corridor segmentation | `src/domain/geo/corridor.ts`: ~2.5 h drive-time segments, 15 km buffer, ≤ 40 vertices, lon-first WKT. | None | 🟢 Completed | AGENT |
| 3.2 | Route progress helpers | `alongKm`, `pointAt`, `progressFraction`, `segmentFor`; **move `estimateDetourMin` into `domain/geo`** (adapter re-exports it). | 3.1 | 🟢 Completed | AGENT |
| 3.3 | Corridor scan service | `src/services/corridorScan.ts`: segment × bucket Insights calls (union signals, bucket tags, exclusions, diversify, `take=15`, explainability); post-filters **before** scoring; de-duplicate; uses the request's `CallMeter`. | 1.5, 1.7, 2.3, 2.4, 2.5, 3.1 | 🟢 Completed | AGENT |
| 3.4 | Per-traveler scoring calls | `filter.entities` per traveler with that traveler's signals, top 100 candidates only, batches of 50 (Qloo caps `take` at 50), `take` = batch size. | 3.3 | 🟢 Completed | AGENT |
| 3.5 | Naive group scoring | `src/domain/scoring`: percentile calibration, power mean (p = −2), Your Vibe % (cap 99), "especially for" (`c_i ≥ 0.85` and ≥ 0.10 above every other traveler). | 3.4 | 🟢 Completed | AGENT |
| 3.6 | Geo & scoring tests | Segment count and full coverage, vertex budget, WKT order, detour estimate, calibration, power mean, vibe % cap, especially-for. | 3.1, 3.2, 3.5 | 🟢 Completed | AGENT |

## Phase 4 – Itinerary, Scout, Why & XP Logic (items 205, 207, 208 logic)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 4.1 | Naive itinerary | `src/domain/itinerary/naive.ts`: equal-distance days; per day candidates with `G ≥ 0.60` and detour ≤ 10 min; up to 4, at least 2 if available, ≤ 2 per bucket; ordered along the route; unused pool returned for the Scout. | 3.2, 3.5 | 🟢 Completed | AGENT |
| 4.2 | Scout trigger | `src/domain/scout`: window [+5, +80] km, detour 5–25 min; robust z = (G − median) / max(1.4826·MAD, 0.03); baseline ±150 km with ≥ 8 samples else trip-wide; fire at z ≥ 1.5 and G ≥ 0.80; 150 km cooldown; ≤ 2/day; template titles. | 4.1 | 🟢 Completed | AGENT |
| 4.3 | XP rules | `src/domain/xp`: Side Quest = 100 + clamped match bonus (0–50) + min(2·detour, 50); check-in = 50 + clamped match bonus. | None | 🟢 Completed | AGENT |
| 4.4 | Template "why" | `src/domain/explain`: per-traveler % + tag overlap with each traveler's `tasteTags` + description/specialty-dish snippet; explainability only breaks ties. | 3.5, 2.3 | 🟢 Completed | AGENT |
| 4.5 | Logic tests | Day split rules; Scout fires on an outlier, MAD floor, small-sample fallback, window, cooldown, daily cap, no repeats; XP clamping; why text. | 4.1–4.4 | 🟢 Completed | AGENT |

## Phase 5 – Slice Harness, Live Run & Checkpoint (items 205, 206, 208 UI)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 5.1 | Slice orchestration | `src/services/sliceTrip.ts`: route → corridor → scan → scores → itinerary → Side Quest pool → why lines; returns the full Trip plus the call-meter report. | 3.3–3.5, 4.1, 4.4 | 🟢 Completed | AGENT |
| 5.2 | Plan API route | `POST /api/dev/slice/plan` (dev-route gated) returns the full Trip. | 5.1, 1.0 | 🟢 Completed | AGENT |
| 5.3 | `/dev/slice` page | Map with numbered pins, day list (vibe %, per-traveler %, detour, why), slider, ▶ auto-advance, skip to next stop; RouteMap fit-bounds race fixed. | 5.2 | 🟢 Completed | AGENT |
| 5.4 | Side Quest UI (client-side) | The Scout runs in the browser on the returned pool; offer card → accept/skip → jump to arrival → complete (sample photo, 1–5 rating) → XP → journal; state in page + localStorage. | 5.3, 4.2, 4.3 | 🟢 Completed | AGENT |
| 5.5 | Sample photos | 3 CC0 or generated images in `/public/samples` with sources in `public/samples/CREDITS.md`. | None | 🟢 Completed | AGENT |
| 5.6 | Pipeline end-to-end test | Vitest: `sliceTrip` on `MockQlooClient` with a stubbed route meets exit criteria 2–5 on mock data. | 5.1 | 🟢 Completed | AGENT |
| 5.7 | Live run & budget | One live Anaheim → Denver plan (≤ 20 calls), then a cached re-run (0 calls); print planned stops, the Side Quest pool and the z distribution. | 5.1, 1.5 | 🟢 Completed | AGENT |
| 5.8 | Quality review | Check exit criteria 1–5 (≤ 20 calls / 0 cached; 0 chains or casinos; ≥ 3 stops on ≥ 3 of 4 days; each traveler especially-for ≥ 1; ≥ 2 Side Quests fire); tune tags, exclusions and thresholds; review the picks together. | 5.7 | 🟡 In Progress | USER, AGENT |
| 5.9 | Slice checkpoint | You walk the full loop on `/dev/slice` (exit criterion 6). | 5.4, 5.8 | 🔴 Not Started | USER |

## Phase 6 – Persistence (item 211)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 6.1 | Local Supabase | **Precondition: Docker Desktop running.** `supabase init` + `supabase start`; DB URLs in `.env.local`; `supabase/` config committed (no secrets). | 5.9 | 🔴 Not Started | AGENT |
| 6.2 | Prisma 7 setup | Read Prisma 7 docs (`prisma.config.ts`, Postgres driver adapter); install the latest stable 7.x; client singleton; `pnpm db:*` scripts. | 6.1 | 🔴 Not Started | AGENT |
| 6.3 | Schema & migration | Models: User, Traveler, TasteSignal, Trip, TripTraveler, TripDay, Candidate, Stop, SideQuest, JournalEntry, XpEvent, QlooCache, AppState; ownership columns; **first migration enables RLS with no policies on every table**. | 6.2 | 🔴 Not Started | AGENT |
| 6.4 | RLS verification test | Calls the Supabase Data API with the anon key against every table and expects denial. | 6.3 | 🔴 Not Started | AGENT |
| 6.5 | Postgres cache & quota | `PostgresCacheStore` (`QLOO_CACHE=postgres`); quota persisted in `AppState`. | 6.3 | 🔴 Not Started | AGENT |
| 6.6 | Save & restore slice state | Plan saves trip, days, stops and candidates; `POST /api/dev/slice/quest/:id` (gated) persists accept/skip/complete, journal and XP; `/dev/slice?trip=<id>` restores state, reading `searchParams` inside `<Suspense>`. | 6.3 | 🔴 Not Started | AGENT |
| 6.7 | Persistence tests | Repository round-trips, quest lifecycle, XP ledger totals. | 6.5, 6.6 | 🔴 Not Started | AGENT |

## Phase 7 – Guest Sessions (item 212)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 7.1 | Read Next 16 `proxy` docs | Read the bundled docs for `proxy`, matchers and cookies before implementing. | 6.1 | 🔴 Not Started | AGENT |
| 7.2 | Supabase SSR + proxy | `@supabase/ssr` helpers; `src/proxy.ts` is a **no-op unless `SESSION_MODE=supabase`**, its matcher skips static assets, and it only refreshes existing cookies. | 7.1 | 🔴 Not Started | AGENT |
| 7.3 | Lazy anonymous sign-in | `POST /api/session` creates the anonymous user only on first write, checks the cookie first (no duplicates), client de-duplicates in-flight calls; `getCurrentUser()` supabase mode upserts `User`. | 7.2, 6.3 | 🔴 Not Started | AGENT |
| 7.4 | Ownership checks | Every trip/quest/journal read and write scoped to the current user; tests for cross-user denial. | 7.3, 6.6 | 🔴 Not Started | AGENT |
| 7.5 | Session verification | Fresh browser → new guest on first plan; reload keeps guest and trip; a second browser can't see the first guest's trip (exit criterion 7). | 7.4 | 🔴 Not Started | USER |

## Phase 8 – Wrap-up

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 8.1 | Quality gate & production smoke | `pnpm check` and `pnpm build` green; on production: `/dev/*` and `/api/dev/*` return 404, `/api/health` ok, the proxy is a no-op (pages load with `SESSION_MODE=dev`). | 7.4 | 🔴 Not Started | AGENT |
| 8.2 | Findings & docs update | `docs/qloo-findings.md` (tag sets, batch size, call counts, quota used); README run instructions (local Supabase, `DEV_ROUTES`). | 8.1 | 🔴 Not Started | AGENT |
| 8.3 | M1 exit check | All 7 exit criteria in `design.md` met (or the slip rule applied and recorded). | 8.2, 7.5 | 🔴 Not Started | AGENT |
