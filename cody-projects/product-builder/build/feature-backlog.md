# Feature Backlog

This document lists features and enhancements derived from the plan. It is a living document that will evolve throughout the project. It is grouped by version, with the Backlog tracking all features not added to a version yet.  It is used to create versions to work on.

| Status |  | Priority |  |
|--------|-------------|---------|-------------|
| 🔴 | Not Started | High | High priority items |
| 🟡 | In Progress | Medium | Medium priority items |
| 🟢 | Completed | Low | Low priority items |

**How versions map to the plan:** v0.1.0–v0.5.0 = milestones M0–M4, the **hackathon critical path**. v0.6.0 = M5, **bonus scope** (start only after v0.5.0 exit criteria are met; feature freeze end of Oct 26). v1.0.0 = M6, **protected polish & submission** (no new features). P1 items are behind feature flags and are cut in this order if behind: auth UI → public recap → conversational replanning → hotel entities → photo upload → XP levels/titles → advanced editing.

## Backlog

| #  | Feature             | Description                               | Source |
|----|---------------------|-------------------------------------------|--------|
| B-01 | Overnight DP optimizer | Dynamic program that chooses all overnight towns together. **Conditional:** build only if golden-trip review shows the greedy heuristic producing poor itineraries. | Agent |
| B-02 | Real GPS trip mode | Optional live-location mode that drives the Scout from the device's real position instead of Simulate Drive. Post-MVP. | Agent |
| B-03 | Traveler accounts & invites | Link crew members to real user accounts; each traveler maintains their own taste profile. Post-hackathon. | Agent |
| B-04 | Social & sharing platform | Feeds, friends, shared discoveries, public quest pages. Post-hackathon vision. | Agent |
| B-05 | Achievements & progression | Achievement system built on the XP event ledger. Post-hackathon. | Agent |
| B-06 | Non-US trips & longer trips | Expand beyond US-only and the 2–6 day window. Post-hackathon. | Agent |

## v0.1.0-foundations - 🟡 In Progress
M0 (Oct 6–7): Repo, deploy pipeline, adapter interfaces and mocks so the vertical slice can start immediately.

| ID  | Feature                 | Description                              | Priority | Status |
|-----|-------------------------|------------------------------------------|----------|--------|
| 101 | Qloo key & community | Submit the Qloo hackathon API key request (today) and join the Qloo Discord (#api-help). | High | 🔴 Not Started |
| 102 | Repo & license | Public GitHub repo with a detectable MIT `LICENSE`; README stub. | High | 🔴 Not Started |
| 103 | App scaffold | Next.js App Router + TypeScript + Tailwind + shadcn/ui + Framer Motion; ESLint/Prettier; Vitest configured. | High | 🔴 Not Started |
| 104 | Vercel deploy | Vercel project linked; production on `main`, preview deploys on branches; env vars wired. | High | 🔴 Not Started |
| 105 | Config & feature flags | Typed env config (`QLOO_MODE`, keys) and `FEATURE_*` flags for every P1 cuttable item. | High | 🔴 Not Started |
| 106 | Qloo adapter interface + mock | `QlooClient` interface (search, insights, tags) with Zod types; `MockQlooClient` built from documented response shapes; `CachedQlooClient` wrapper skeleton. | High | 🔴 Not Started |
| 107 | Mapbox adapter | US geocoding/autocomplete, Directions (geometry, legs, durations), detour helper; route renders on a Mapbox GL map. | High | 🔴 Not Started |
| 108 | Session bootstrap (non-blocking) | Attempt Supabase project + anonymous sign-in; if setup causes friction, use a seeded local session with a fixed user ID and move on. | Medium | 🔴 Not Started |

## v0.2.0-vertical-slice - 🔴 Not Started
M1 (Oct 8–12): The ugliest complete loop end to end, then real persistence and the Qloo spike.

| ID  | Feature                 | Description                              | Priority | Status |
|-----|-------------------------|------------------------------------------|----------|--------|
| 201 | Hardcoded demo crew | Two demo travelers (brief's tastes + 3–4 cross-domain favorites each) as static profiles. | High | 🔴 Not Started |
| 202 | Route corridor geometry | Segment the route (~60–90 min), buffer + simplify into lon-first WKT polygons with a vertex budget; progress-along-route helpers. | High | 🔴 Not Started |
| 203 | Corridor scan (naive) | Qloo candidate generation per segment using union signals; store candidate pool. | High | 🔴 Not Started |
| 204 | Naive group scoring | Per-traveler scoring + simple combined score; enough to rank candidates. | High | 🔴 Not Started |
| 205 | Ugly itinerary | Days split naively; stops listed per day and plotted on the map. | High | 🔴 Not Started |
| 206 | Slider simulation | Basic slider moves a marker along the route and reports progress. | High | 🔴 Not Started |
| 207 | Scout trigger (basic) | Unused high-scoring candidate near upcoming progress fires a Side Quest offer. | High | 🔴 Not Started |
| 208 | Side Quest accept/complete | Accept/skip, complete with sample photo + rating, award XP, write journal entry. | High | 🔴 Not Started |
| 209 | Qloo API spike (S1–S8) | Once the key arrives: test polygon `filter.location` + URL limits, explainability, heatmap, `filter.entities` scoring, `/search` quality, place tags, affinity distribution/latency, tag inference. Record findings in `docs/qloo-findings.md` and fixtures. | High | 🔴 Not Started |
| 210 | Real Qloo client + cache | `RealQlooClient` with concurrency limit, retry/backoff, timeouts; Postgres-backed cache; `record` mode producing fixtures. | High | 🔴 Not Started |
| 211 | Persistence & data model | Prisma schema in Supabase Postgres (users, travelers, signals, trips, days, candidates, stops, side quests, journal, XP ledger, agent runs/events, cache); slice state moved to the DB. | High | 🔴 Not Started |
| 212 | Anonymous guest sessions | Replace any seeded session with Supabase anonymous users; ownership checks on every row. | High | 🔴 Not Started |

## v0.3.0-taste-engine-planner - 🔴 Not Started
M2 (Oct 13–16): Real recommendation quality, a believable multi-day plan, and the visible Planner agent.

| ID  | Feature                 | Description                              | Priority | Status |
|-----|-------------------------|------------------------------------------|----------|--------|
| 301 | Corridor scan (full) | Bucketed queries (food & drink, experiences/outdoors/culture), explainability, diversify, parallelism; per-traveler scoring via `filter.entities` or spike fallback. | High | 🔴 Not Started |
| 302 | Group scoring module | Calibration (percentiles), group fit (soft-min), delight, overlap, quality prior, detour penalty, Your Vibe %, "especially for"; unit-tested. | High | 🔴 Not Started |
| 303 | Fairness-aware selection | Greedy trip-wide selection weighting the least-served traveler; category/near-duplicate penalties; quality floor. | High | 🔴 Not Started |
| 304 | Feasibility check | Detect impossible days/pace combinations and propose fixes (add a day, change pace). | High | 🔴 Not Started |
| 305 | Overnight towns (heuristic) | Feasible drive window → candidate towns → taste density + route quality → select, with remaining-days lookahead. No hotel entities yet. | High | 🔴 Not Started |
| 306 | Scheduling & slot fit | Departure time, dwell times, meal/coffee slots, opening hours, ~21:00 arrival cutoff; drop lowest-scoring optional stops on overrun. | High | 🔴 Not Started |
| 307 | Exact detours | Mapbox waypoint/matrix detours for selected stops and Side Quest candidates. | Medium | 🔴 Not Started |
| 308 | Grounded explanations | Haiku "why" lines from structured facts (explainability, per-traveler contributors), batched per day, with validator + template fallback. | High | 🔴 Not Started |
| 309 | Planner agent | Vercel AI SDK + Sonnet 5.5 with tools (context, scan, overnight options, build, evaluate, alternatives, apply change, finalize); baseline-first, ≤2 fix rounds, step budget. | High | 🔴 Not Started |
| 310 | Activity stream | Tool-emitted, user-facing agent events persisted and streamed; resumable after disconnect. | High | 🔴 Not Started |
| 311 | Demo seed & clone | `seed-demo` runs the real pipeline for Anaheim → Denver; "Try the demo trip" clones it into the guest's account; event replay. | High | 🔴 Not Started |
| 312 | Golden trips (2 routes) | Quality report for Anaheim → Denver and Phoenix → Moab; tune constants; decide on B-01 escalation. | High | 🔴 Not Started |

## v0.4.0-onboarding-trip-ui - 🔴 Not Started
M3 (Oct 17–19): "Teach us your vibe," the crew reveal, and the polished trip view — Plan Your Own Trip works end to end.

| ID  | Feature                 | Description                              | Priority | Status |
|-----|-------------------------|------------------------------------------|----------|--------|
| 401 | Home screen | Promise + Maps-vs-Sidequest contrast; Try the demo trip / Plan your own trip. | High | 🔴 Not Started |
| 402 | Crew builder | 1–4 travelers with name and color/emoji. | High | 🔴 Not Started |
| 403 | Favorites search | 3–5 cross-domain favorites via Qloo `/search` autocomplete with images. | High | 🔴 Not Started |
| 404 | Inferred taste cards | Qloo-aggregated tags from favorites to confirm/dismiss (LLM fallback). | High | 🔴 Not Started |
| 405 | Vibe cards & free text | ~8 broad vibe cards; "Anything else you're into?" mapped to validated Qloo tags. | High | 🔴 Not Started |
| 406 | Crew vibe reveal | Animated shared/complementary themes, per-traveler highlights, generated sentence. | High | 🔴 Not Started |
| 407 | Trip setup | Origin/destination autocomplete, start date, 2–6 days, departure time, pace, inline feasibility. | High | 🔴 Not Started |
| 408 | Planning screen | Live activity feed beside a map that fills in corridor, candidates, and overnight towns. | High | 🔴 Not Started |
| 409 | Trip view | Synchronized map + day timeline; stop cards with vibe %, traveler chips, detour, why. Responsive desktop/mobile. | High | 🔴 Not Started |
| 410 | Stop detail sheet | Full explanation, per-traveler bars, swap alternatives, remove. | High | 🔴 Not Started |
| 411 | Plan Your Own Trip E2E | Onboarding → setup → live planning → trip view works for arbitrary US routes. | High | 🔴 Not Started |

## v0.5.0-drive-scout-journal - 🔴 Not Started
M4 (Oct 20–23): Simulate Drive, the Scout, the full Side Quest loop, and the journal — demo path ≤90 s.

| ID  | Feature                 | Description                              | Priority | Status |
|-----|-------------------------|------------------------------------------|----------|--------|
| 501 | Simulate Drive | Car animates along the route; HUD with current town, next stop, ETA, day/time; 1×/4×/16×, skip to next stop; check-in prompts. | High | 🔴 Not Started |
| 502 | Scout agent | Deterministic z-score shortlist + Haiku choice/naming using trip state; cooldowns; template fallback; pre-computed candidates. | High | 🔴 Not Started |
| 503 | Side Quest flow | SIDE QUEST AVAILABLE card → detail (why, per-traveler fit, detour, XP) → accept/skip → reroute → jump to arrival. | High | 🔴 Not Started |
| 504 | Completion & XP | Complete sheet (sample photo, rating/reaction, note), XP rules + ledger, XP celebration. | High | 🔴 Not Started |
| 505 | Journal & recap | Journal timeline for planned stops and Side Quests; trip XP total; private recap card. | High | 🔴 Not Started |
| 506 | Photo upload (P1) | Signed upload to Supabase Storage; sample photo always available. Behind `FEATURE_PHOTO_UPLOAD`. | Medium | 🔴 Not Started |
| 507 | Public recap page (P1) | `/t/[slug]` read-only recap with OG image. Behind `FEATURE_PUBLIC_RECAP`. | Medium | 🔴 Not Started |
| 508 | XP levels/titles (P1) | Light titles derived from XP total. Behind `FEATURE_XP_LEVELS`. | Low | 🔴 Not Started |
| 509 | Live-planning protection | Per-session and global daily limits, friendly limit message, LLM spend cap, `/api/health`. | High | 🔴 Not Started |
| 510 | Demo path E2E | Playwright test: home → demo → Side Quest complete → journal, no login, timed ≤90 s; re-check both golden trips. | High | 🔴 Not Started |

## v0.6.0-bonus-scope - 🔴 Not Started
M5 (Oct 24–26), bonus only: start after v0.5.0 exit criteria are met; feature freeze end of Oct 26 regardless.

| ID  | Feature                 | Description                              | Priority | Status |
|-----|-------------------------|------------------------------------------|----------|--------|
| 601 | Taste-matched hotels (P1) | Hotel query per overnight town, scored per traveler; shown on the overnight card. Behind `FEATURE_HOTELS`. | Medium | 🔴 Not Started |
| 602 | Regenerate day (P1) | Re-run selection for a single day using the existing candidate pool. Behind `FEATURE_REGENERATE_DAY`. | Medium | 🔴 Not Started |
| 603 | Conversational replanning (P1) | Intent classifier + Replanner tools (remove, swap, rescore day, boost traveler, shift schedule, alternatives); scoped diffs highlighted; off-topic decline. Behind `FEATURE_REPLAN_CHAT`. | Medium | 🔴 Not Started |
| 604 | Save your adventure (P1) | Optional magic link/OAuth identity linking to the existing anonymous user. Behind `FEATURE_AUTH_UI`. | Low | 🔴 Not Started |
| 605 | Full golden suite | Add SF → Portland, Chicago → Nashville, Austin → New Orleans to the quality report. | Low | 🔴 Not Started |

## v1.0.0-polish-and-submit - 🔴 Not Started
M6 (Oct 27–29), protected: no new features — reliability, rehearsal, and submission. Submit Oct 29.

| ID  | Feature                 | Description                              | Priority | Status |
|-----|-------------------------|------------------------------------------|----------|--------|
| 701 | Bug bash & hardening | Fix defects, error states, empty/sparse states, slow-network behavior. | High | 🔴 Not Started |
| 702 | Polish pass | Performance, accessibility, mobile layout, motion and visual details. | High | 🔴 Not Started |
| 703 | Final demo seed | Re-seed demo trip from the final pipeline; freeze it (Oct 28). | High | 🔴 Not Started |
| 704 | Timed rehearsals | Rehearse the 90-second script on desktop and mobile; fix friction. | High | 🔴 Not Started |
| 705 | Demo video (required) | 60–90 s video showing the full Side Quest sequence; draft Oct 27, final Oct 28–29; hosted for Devpost. | High | 🔴 Not Started |
| 706 | Submission materials | Description, 6–8 screenshots, architecture diagram, testing instructions ("no login needed"), README. | High | 🔴 Not Started |
| 707 | Release & judging ops | Tag `v1.0-submission`; daily keep-alive cron; quota/health monitoring through Nov 16; critical fixes only. | High | 🔴 Not Started |
