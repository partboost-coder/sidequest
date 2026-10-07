# Product Implementation Plan
This document defines how the product will be built and when.

## Section Explanations
| Section                  | Overview |
|--------------------------|--------------------------|
| Overview                 | A brief recap of what we're building and the current state of the PRD. |
| Architecture             | High-level technical decisions and structure (e.g., frontend/backend split, frameworks, storage). |
| Components               | Major parts of the system and their roles. Think modular: what pieces are needed to make it work. |
| Data Model               | What data structures or models are needed. Keep it conceptual unless structure is critical. |
| Major Technical Steps    | High-level implementation tasks that guide development. Not detailed coding steps. |
| Tools & Services         | External tools, APIs, libraries, or platforms this app will depend on. |
| Risks & Unknowns         | Technical or project-related risks, open questions, or blockers that need attention. |
| Milestones    | Key implementation checkpoints or phases to show progress. |
| Environment Setup | Prerequisites or steps to get the app running in a local/dev environment. |

Additional sections in this plan: **Qloo Integration**, **Recommendation & Group Scoring**, **Agents & Tool Boundaries**, **Screens**, **Testing Strategy**, **Deployment Strategy**, **Demo Strategy**, **Scope Boundaries**.

## Overview
_A quick summary of what this plan is for and what product it's implementing._

This plan implements the Sidequest hackathon MVP defined in `prd.md`: an agentic, Qloo-powered road-trip companion for 1–4 travelers that plans a multi-day US road trip around each traveler's tastes, then surfaces Side Quests during a simulated drive.

Guiding principles:
1. **Vertical slice first.** The ugliest complete loop (taste → route → Qloo → itinerary → simulated drive → Scout → Side Quest → complete → journal) runs by **Oct 12**. Everything after that improves a working product.
2. **Qloo chooses, code scores, the LLM orchestrates and narrates.** Places come only from Qloo. Ranking is deterministic, testable code. The agent makes judgment calls through tools and writes copy grounded in structured facts. It never invents places or scores.
3. **One pipeline, two entry points.** The demo trip is a persisted output of the same live pipeline, not a separate fake path.
4. **Stability beats feature count.** Feature freeze at the end of **Oct 26**. **Oct 27–29** is reserved for polish, reliability, rehearsal and submission.
5. **Guest-first, account-ready.** Every row is owned by a real user ID from day one. Guests are Supabase anonymous users who can later become permanent accounts without moving any data. Auth infrastructure must never block the vertical slice (see M1).
6. **M1–M4 is the hackathon critical path. M5 is bonus scope.** Work from M5 starts only once M4's exit criteria are met, and never at the expense of the core experience.
7. **Simplest thing that produces believable trips first.** Heuristics come before optimizers, and the quality suite starts small and grows. More complex approaches are added only when testing shows the simple version falls short.

## Architecture
_High-level structure and major technical decisions. Include how the system is organized (e.g., client-server, monolith, microservices) and the proposed tech stack (frameworks, languages, storage, deployment)._

### Shape
A **single Next.js monolith** (App Router, TypeScript) deployed on **Vercel**, with **Supabase** for Postgres, auth and storage. There are no separate services or queues. Long-running work (planning) runs in a streaming route handler. Its progress is saved to the database so the client can reconnect if the stream drops.

```
Browser (Next.js client: React, Tailwind, shadcn/ui, Framer Motion, Mapbox GL JS)
   │  server actions / route handlers / streamed agent events
   ▼
Next.js server (Vercel functions)
   ├─ agents/        Planner · Replanner · Scout · Taste helpers   (Vercel AI SDK + Claude)
   ├─ domain/        taste · scoring · planner · scout · xp          (pure TypeScript, unit-tested)
   ├─ adapters/      qloo (real | mock | cached) · mapbox · storage
   └─ db/            Prisma → Supabase Postgres
   ▼
External: Qloo Hackathon API · Mapbox (Directions, Geocoding, Matrix) · Anthropic Claude · Supabase (Auth, Storage)
```

### Stack decisions
| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Your strongest stack. Server actions and streaming suit the agent UI. |
| UI | **Tailwind + shadcn/ui + Framer Motion**, Lucide icons | The fastest route to a polished consumer UI. Motion makes the Side Quest and XP moments feel good. |
| Maps & routing | **Mapbox GL JS** (via `react-map-gl`), **Directions**, **Geocoding/Search Box**, **Matrix**; **Turf.js** for geometry | Custom styling for a distinctive look. Turf buffers the route into polygons for Qloo. No Google Places, so Qloo stays the only source of places. |
| Database | **Supabase Postgres** via **Prisma** | You already know Prisma. Supabase gives Postgres, anonymous auth and storage in one free tier. |
| Auth | **Supabase anonymous sign-in**, with an optional email magic link / OAuth upgrade via identity linking | The guest's user ID stays the same after upgrading, so nothing has to be migrated. If setup causes friction during M1, a seeded local session (a fixed user ID) stands in temporarily, and real anonymous sessions are wired in immediately after the slice works. |
| Storage | **Supabase Storage** (`journal-photos` bucket), with sample photos in `/public` | Simple signed uploads. |
| Agents / LLM | **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`) with **Claude Sonnet 5.5** (`claude-sonnet-5-5`) for planning and replanning, and **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) for tag mapping, copy and the Scout | An agent framework that is native to Next.js, with tool calling and streaming. This satisfies the "built using an agent framework" rule in a way judges can see. |
| Validation | **Zod** | Shared schemas for tool inputs and outputs, API payloads and LLM structured output. |
| Testing | **Vitest** (domain + adapters), **Playwright** (demo path E2E) | Fast unit tests for the scoring logic. One E2E test guards the 90-second path. |
| Hosting | **Vercel** (Fluid compute, long `maxDuration` on the planning route), **Vercel Cron** for keep-alive and cache warm-up | Easy deploys and preview URLs. |
| Repo | Public GitHub with an **MIT `LICENSE`** from the first commit | Required by the hackathon rules. |

### Key architectural rules
- **Domain logic is pure.** Scoring, calibration, fairness selection, overnight optimization, feasibility, the Scout trigger and XP are pure functions over typed inputs. Agents and route handlers call them; they never re-implement them.
- **The Qloo adapter is an interface.** `QlooClient` has `RealQlooClient`, `MockQlooClient` (fixture-backed) and a `CachedQlooClient` wrapper. Which one is used is set by an env flag (`QLOO_MODE=real|mock|record`).
- **Agent activity comes from tools, not model thoughts.** Each tool writes concise, factual status events ("Scanning Kingman → Flagstaff… 31 places"). The UI shows those events. No chain-of-thought is ever displayed.
- **Every trip is reproducible.** A trip stores snapshots of each traveler's taste profile plus the scored candidate pool. Swaps, replanning and Side Quests draw from that pool before making new Qloo calls.
- **Feature flags** (env) for every cuttable item: `FEATURE_AUTH_UI`, `FEATURE_PUBLIC_RECAP`, `FEATURE_REPLAN_CHAT`, `FEATURE_HOTELS`, `FEATURE_PHOTO_UPLOAD`, `FEATURE_XP_LEVELS`, `FEATURE_REGENERATE_DAY`.

## Qloo Integration

### Documented facts (do not re-test)
- Base URL `https://hackathon.api.qloo.com`. Auth header `X-Api-Key`. Keys are issued manually and do not work against staging/production hosts.
- `/v2/insights` is **GET-only** on the hackathon host, so all parameters go in the query string. `/recommendations` and `/recs` are unsupported.
- Endpoints: `/v2/insights`, `/search`, `/v2/tags`, Entity Data APIs.
- Supported `filter.type` values: `urn:entity:place`, `artist`, `movie`, `tv_show`, `book`, `brand`, `destination`, `person`, `podcast`, `video_game`.
- Invalid parameters are silently ignored. **Every experiment must check that a parameter actually changed the results**, not just that the request returned 200.

### Uncertain behavior to test (Spike, ~half a day once the key arrives)
| # | Question | How we'll know | Fallback if it fails |
|---|---|---|---|
| S1 | Does `filter.location` accept WKT `POLYGON` for places on the hackathon host? What vertex count fits within GET URL limits? | Compare results for a corridor polygon vs. a point; increase vertex counts until it fails | Sample the route every ~40 km with `POINT` + `filter.location.radius` |
| S2 | Is `feature.explainability=true` honored, and what is the response shape? | `query.explainability` is present on results | Explain from per-traveler scores plus the place's tags matched against each traveler's tags |
| S3 | Does `output.heatmap` with `output.heatmap.boundary=urn:entity:locality` work for places in a polygon? | Response contains locality rows with affinity | Count top-scored places per town from the corridor scan |
| S4 | Does `filter.entities` (a list of candidate IDs) return affinity for exactly those candidates under one traveler's signals? How many IDs per request? | Same IDs in, scores out, scores change with the signals | One traveler-signal query per corridor segment, then intersect with the candidate pool |
| S5 | How well does `/search` resolve across domains (artists, movies, restaurants, brands, destinations)? Which response fields are useful for autocomplete? | Try 30 typical favorites | Filter by type, and use the LLM to pick from the top 5 |
| S6 | What place tags exist for our buckets (coffee, Vietnamese, Mexican, hiking, vintage, art gallery, scenic, live music, hotel)? | `/v2/tags` queries | Use entity signals only, and bucket results by returned tags |
| S7 | What is the real distribution of `query.affinity` and what is the latency (p50/p95) at 6 concurrent requests? | Log from 5 routes | Informs calibration constants and concurrency limits |
| S8 | Can tags inferred from a traveler's favorites be pulled from Insights results (for taste cards)? | Aggregate tags on the top results for a traveler's favorites | LLM proposes tags from favorites' metadata, validated against `/v2/tags` |

Spike output goes in `docs/qloo-findings.md` and the request/response pairs are recorded as fixtures for the mock client.

### Request patterns
1. **Favorite resolution (onboarding):** `/search?query=…` (with an optional type), debounced, cached. We store `qloo_id`, `type`, `name` and image.
2. **Taste inference (onboarding):** for each traveler, Insights calls across a few types using `signal.interests.entities=<favorites>`. We aggregate the tags on the results and show the top 6–8 as cards to confirm.
3. **Free text → tags:** Haiku proposes tag names, which are validated through `/v2/tags`. Only tags that resolve are kept.
4. **Corridor scan (planning):** the route is split into segments of about 60–90 minutes. Each segment becomes a buffered, simplified polygon (S1). For each segment and bucket (food & drink, experiences/outdoors/culture), one Insights GET with `filter.type=urn:entity:place`, `filter.location=<POLYGON>`, the **union of all travelers' signals** (entities + tags), `filter.tags` for the bucket, `feature.explainability=true`, `diversify.by=properties.geocode.city`, `take≈30–50`. This is **candidate generation only**.
5. **Per-traveler scoring:** for each traveler, Insights with `filter.entities=<candidate IDs>` and **only that traveler's** signals → `a_i(place)` for every candidate (S4). This is what keeps travelers separate.
6. **Overnight towns and hotels:** heatmap by locality (S3) or corridor-scan density to rank candidate towns. **Hotels (P1, deferred until Plan Your Own Trip works end to end):** a hotel query per chosen town (`filter.location` = town point + radius, hotel tag), scored per traveler like any other candidate. Until then, overnight towns show basic lodging context only.
7. **Replanning / Scout deepening:** targeted re-queries for one segment with adjusted bucket tags or a traveler-weighted signal set, e.g. `filter.popularity.max` for "something weird".

### Client behavior
- A concurrency limit (start at 6, tuned from S7), retries with backoff on 429/5xx, and a 10 s timeout per call.
- **Postgres-backed cache** (`qloo_cache`) keyed by a hash of normalized params, with a 7-day TTL. This also produces fixtures (`QLOO_MODE=record`).
- Every Qloo call is logged as an `agent_event` with a count, so the activity feed and the write-up can show real Qloo usage.

## Recommendation & Group Scoring

All of this lives in `domain/scoring` as pure, unit-tested functions. Constants are tuned against S7 and the golden trips.

**Inputs for each candidate place `p`:** per-traveler raw affinity `a_i(p)` ∈ [0,1], explainability contributions (which input entities and tags drove the match), quality prior `q(p)` (popularity / business rating, normalized), estimated detour `d(p)` in minutes, bucket/category, and position along the route.

1. **Calibration:** `c_i(p)` = percentile rank of `a_i(p)` within this trip's candidate pool for traveler *i*. Raw Qloo affinities aren't comparable across travelers with different signal sets, but percentiles are.
2. **Group fit** `G(p)` = a generalized power mean of `c_i` with p ≈ −2 (a soft minimum). One unhappy traveler drags it down, but not as sharply as a strict minimum.
3. **Individual delight** `D(p)` = max_i `c_i(p)`, which rewards "Alex will *love* this."
4. **Overlap** `O(p)` = the share of travelers whose own favorites or tags appear in the explainability contributions above a threshold, or who have `c_i ≥ 0.8`.
5. **Stop score** `S(p) = 0.50·G + 0.20·D + 0.15·O + 0.15·q − λ·max(0, d − d_free)`, with `d_free` and `λ` set by pace.
6. **"Your Vibe %"** = `round(100·G(p))`, capped at 99. It's honest and explainable: *"Ranked against 412 places along your route, this is in the top 6% for both of you."* Per-traveler scores are shown as `round(100·c_i)`.
7. **Quality floor:** a stop is only planned if `G ≥ τ_G` (start at 0.70) and `S ≥ τ_S`. Days can have fewer stops, and the timeline labels quiet stretches on purpose.
8. **Trip-level fairness and variety** (in selection): stops are picked greedily across the whole trip by marginal utility `S(p) + μ·Σ_i w_i·c_i(p)`, where `w_i ∝ 1/(1 + satisfaction_i)` and satisfaction_i is the sum of traveler *i*'s top delights so far. A traveler who has been underserved therefore pulls the next pick toward their taste. Penalties apply to repeating a category on the same day and to near-duplicates. Each traveler should get at least one "especially for you" stop (`c_i ≥ 0.9`) every day or two; `evaluate_trip` checks this.
9. **Slot fit:** meal slots need food places open at that time (`filter.hours`, plus a dwell time per category). Coffee in the morning, scenic stops anywhere, hotels at the overnight town (once hotel entities ship).
10. **"Especially for"** tags on a stop: the travelers with `c_i ≥ 0.85` whose contribution is clearly larger than the others'.

**Explanations:** structured facts (place name and tags, the top contributing entities/tags per traveler, traveler names, the scores) → Haiku writes one sentence for each stop, batched per day. A validator rejects any explanation that names an entity or traveler not in the facts and regenerates it (falling back to a template).

**Side Quest trigger** (`domain/scout`): from candidates that were **not** planned, within the next 30–60 minutes of driving: local z-score `z = (S(p) − median_local) / MAD_local`. The Scout fires when `z ≥ k` (start at 2.0), `G ≥ 0.88`, and `detour ≤ 20 min` (pace-adjusted), with a cooldown and at most 1–2 per day. Side Quest candidates are pre-computed at planning time, so the simulation never waits on Qloo.

**Overnight planning** (`domain/planner`): total drive time and the pace window → feasibility check. If `total_drive_h / days > pace_max + 1.5`, the trip is infeasible, and Sidequest offers alternatives ("needs 5 days at Balanced, or 4 at Push It"). Overnight towns are chosen with the **simplest deterministic heuristic that produces believable trips**, one night at a time:
1. **Feasible drive window:** for night *n*, the stretch of route reachable within [pace_min − 1 h, pace_max + 1 h] of driving from the previous overnight, adjusted so the remaining days stay feasible.
2. **Candidate towns:** localities along the route inside that window (Mapbox reverse geocoding at sampled points, or localities from Qloo results).
3. **Score:** taste density (top-scored candidates within ~25 km) + route quality (how close drive time is to the pace target; how good the next day's stretch looks). Town affinity from the heatmap (S3) is used if available.
4. **Select:** the highest-scoring town; then move to the next night.

This lets a slightly longer day win when it lands somewhere much better, without an optimizer. **Escalation rule:** the dynamic-programming optimizer (choosing all nights together to minimize `drive-deviation penalty − α·town score − β·next-day stop density`) is built **only if** golden-trip review shows the greedy heuristic producing poor itineraries (e.g. a bad final day caused by an earlier greedy choice). Days are then scheduled from the departure time, with dwell times and an arrival cutoff of about 21:00; if a day runs over, the lowest-scoring optional stops are dropped.

**Detours:** a cheap estimate for every candidate (distance from the route ÷ local speed × 2). An exact figure for selected stops and Side Quests uses Mapbox Directions with the stop as a waypoint (or Matrix), comparing time(A→P→B) with time(A→B).

## Agents & Tool Boundaries

Agents make the judgment calls. Tools do the deterministic work and write activity events. Every tool has a Zod input/output schema and a step budget.

### Planner agent (Sonnet 5.5) — "plan this trip"
The pipeline first produces a **valid baseline trip** deterministically. The agent then evaluates and improves it. If the agent fails or times out, the baseline is still saved and the user still gets a trip.

| Tool | Does | Deterministic? |
|---|---|---|
| `get_trip_context` | Travelers, profiles, route summary, pace | yes |
| `scan_corridor` | Segments the route, builds polygons, runs Qloo candidate queries + per-traveler scoring in parallel, stores the candidate pool | yes (Qloo) |
| `propose_overnight_plans` | Returns 2–3 feasible overnight-town plans with tradeoffs | yes |
| `build_itinerary(plan_id)` | Fairness-aware selection + scheduling → draft days | yes |
| `evaluate_trip` | Per-traveler satisfaction, category mix, quiet stretches, floor violations, timing problems | yes |
| `find_alternatives(scope, focus, traveler?)` | Re-queries Qloo for a segment/day with a focus (category, traveler, low popularity) | yes (Qloo) |
| `apply_change(change)` | add / remove / swap / reorder, then re-schedules | yes |
| `finalize_trip` | Exact detours, explanations, crew vibe, Side Quest candidates | yes + Haiku copy |

Loop: context → scan → choose an overnight plan (agent picks and states why in one user-facing line) → build → evaluate → at most 2 fix rounds → finalize. Step cap is about 12 tool calls. Wall-clock target ≤60 s, with heavy parallelism inside `scan_corridor`.

### Replanner (Sonnet 5.5) — conversational edits, constrained
Tools: `remove_stop`, `swap_stop`, `rescore_day(day, focus_tags)`, `boost_traveler(traveler, scope)`, `shift_schedule(day, arrive_by)`, `find_alternatives`, `evaluate_trip`. A Zod-typed intent classifier runs first. Off-topic requests get a polite decline plus example requests. Each run returns a **diff**, and the UI highlights changed stops with a one-line summary ("Swapped 2 restaurants for a slot canyon hike and a desert sculpture garden, both strong for Alex").

### Scout (deterministic trigger + Haiku)
At simulation checkpoints, a pure-function shortlist (above) → Haiku chooses among the qualifying candidates using trip state (time of day, recent stop categories, the least-served traveler) and writes the quest's name and teaser ("🌮 The Taco Detour"). If Haiku fails, the top-ranked candidate is used with a template name. Accept / skip / complete are plain server actions.

### Taste helpers (Haiku)
Free text → tags (validated via `/v2/tags`). Taste card inference (Qloo aggregation first, LLM fallback). Crew vibe reveal: 4–6 themes + one sentence that names both overlap and difference, grounded in the travelers' actual signals.

## Components
_What are the key parts/modules of the system and what do they do?_

- **`adapters/qloo`**: `QlooClient` interface; real / mock / cached implementations; concurrency, retry and caching; fixture recorder.
- **`adapters/mapbox`**: geocoding/autocomplete (US-only), directions (route geometry, legs, durations), matrix/waypoint detours.
- **`adapters/storage`**: signed photo uploads, sample photo catalog.
- **`domain/taste`**: traveler profile model, signal weighting (favorites > confirmed cards > vibe cards > free text), crew overlap/difference analysis.
- **`domain/geo`**: route segmentation, Turf buffer + simplify into WKT polygons, progress along the route, detour estimates.
- **`domain/scoring`**: calibration, group fit, delight, overlap, stop score, vibe %, "especially for".
- **`domain/planner`**: feasibility, overnight-town heuristic (DP optimizer only if escalated), fairness-aware selection, slot fitting, scheduling.
- **`domain/scout`**: Side Quest shortlist and trigger rules, cooldowns.
- **`domain/xp`**: XP rules (base by match strength + detour; Side Quest bonus; check-in bonuses), totals, light titles.
- **`agents/*`**: Planner, Replanner, Scout, taste helpers. Tool definitions, prompts, event emitter.
- **`app/*` (UI)**: screens listed below, plus shared components: `MapView`, `DayTimeline`, `StopCard`, `StopSheet`, `VibeMeter`, `TravelerChips`, `ActivityFeed`, `SideQuestCard`, `DriveHUD`, `XPBurst`, `JournalEntry`, `RecapCard`.
- **`lib/session`**: Supabase anonymous session bootstrap (middleware), current-user helpers, ownership checks.
- **`scripts/`**: `seed-demo` (runs the real pipeline for the demo trip), `qloo-spike`, `qloo-smoke`, `golden-trips` (quality report).

## Screens

1. **Home**: the promise, a short Maps-vs-Sidequest contrast, **Try the demo trip** (primary) and **Plan your own trip**.
2. **Crew builder**: traveler cards (name, color/emoji), add up to 4.
3. **Teach us your vibe** (per traveler): favorites search (3–5, cross-domain chips with images) → Qloo-inferred taste cards → ~8 broad vibe cards → "Anything else you're into?"
4. **Your Crew's Vibe**: animated reveal of shared and complementary themes, a highlight per traveler, and the generated sentence.
5. **Trip setup**: origin/destination autocomplete, start date, days, departure time, pace. Inline feasibility feedback.
6. **Planning**: live agent activity feed beside a map where the corridor, candidates and overnight towns appear as they're found. For the demo, the stored events are replayed in about 6–8 s.
7. **Trip**: map + day timeline (day tabs). Stop cards show vibe %, traveler chips, detour and a "why" line. The stop detail sheet has the full explanation, per-traveler bars, swap alternatives and remove. A replan input sits at the bottom. A **Simulate Drive** call to action.
8. **Simulate Drive**: a full-map HUD (car marker, current town, next stop, ETA, day/time), speed controls (1×/4×/16×), "skip to next stop", check-in prompts at planned stops.
9. **Side Quest**: **SIDE QUEST AVAILABLE** card → detail (why, per-traveler fit, detour, XP) → Accept/Skip → en route (rerouted line) → **Jump to arrival** → complete sheet (photo upload or sample, rating/reaction, note) → XP celebration → journal updated.
10. **Journal & recap**: journal timeline, XP total/title, trip recap card, Share toggle.
11. **Public recap** `/t/[slug]`: read-only, OG image for link previews.
12. **Save your adventure**: sheet offered after the first completed quest or on the recap. Magic link/OAuth links the identity to the existing anonymous user.

Responsive layout: on desktop, the map and the panel sit side by side; on mobile, the map is on top with a bottom drawer.

## Data Model
_What are the main types of data or objects the system will manage?_

All user-generated rows trace back to `users.id` (the Supabase auth UID). Guests are anonymous auth users. Upgrading links an identity to the **same UID**, so no data needs to be claimed or migrated.

- **User**: `id` (auth uid), `is_anonymous`, `email?`, `display_name?`, `created_at`, `upgraded_at?`.
- **Traveler**: a reusable crew member owned by a user. `id`, `owner_user_id`, `name`, `color`, `emoji`. *(Post-MVP: links to a real user account.)*
- **TasteSignal**: `id`, `traveler_id`, `kind` (entity|tag), `qloo_id`, `qloo_type`, `label`, `image_url?`, `source` (favorite|inferred|vibe_card|freetext), `weight`.
- **Trip**: `id`, `owner_user_id`, `title`, `origin`/`destination` (name, lat, lng), `start_date`, `days`, `departure_time`, `pace`, `status` (draft|planning|ready|driving|completed), `route` (GeoJSON + total minutes/km), `crew_vibe` (themes + sentence), `is_demo`, `source_trip_id?` (demo clones), `share_slug?`, `is_public`, `version`, timestamps.
- **TripTraveler**: `trip_id`, `traveler_id`, `profile_snapshot` (frozen signals for reproducibility).
- **Candidate**: the scored pool for a trip. `id`, `trip_id`, `qloo_entity_id`, `name`, `bucket`/`category`, `lat`, `lng`, `address`, `properties` (JSON: hours, rating, images, tags), `route_progress_km`, `detour_est_min`, `scores` (JSON: per-traveler `a_i`/`c_i`, G, D, O, S, vibe_pct), `explainability` (JSON), `is_hotel`, `town`.
- **TripDay**: `id`, `trip_id`, `day_index`, `date`, `start` and `overnight` (town + lat/lng), `drive_minutes`, `summary`, `hotel_candidate_id?`.
- **Stop**: a planned stop. `id`, `trip_day_id`, `candidate_id`, `order`, `slot` (coffee|breakfast|lunch|dinner|scenic|attraction|discovery|hotel), `arrive_at`, `depart_at`, `detour_min`, `why`, `especially_for` (traveler IDs), `status` (planned|visited|skipped|removed).
- **SideQuest**: `id`, `trip_id`, `candidate_id`, `title`, `teaser`, `trigger_progress_km`, `detour_min`, `xp_reward`, `status` (pending|offered|accepted|skipped|completed), `offered_at`, `resolved_at`.
- **JournalEntry**: `id`, `trip_id`, `author_user_id`, `stop_id?` | `side_quest_id?`, `photo_path?`, `is_sample_photo`, `rating?`, `reaction?`, `note?`, `xp_awarded`, `created_at`.
- **XpEvent**: an append-only ledger. `id`, `user_id`, `trip_id`, `source_type`, `source_id`, `amount`, `created_at`. Totals and levels are derived from it, and future achievements can build on it.
- **AgentRun**: `id`, `trip_id`, `kind` (plan|replan|scout), `status`, `input`, `model`, `started_at`, `finished_at`, `error?`.
- **AgentEvent**: `id`, `run_id`, `seq`, `type` (status|tool_start|tool_result|change|error), `message` (user-facing), `payload` (JSON), `at`. This drives the live activity feed, the demo replay and the diffs.
- **QlooCache**: `key` (hash), `endpoint`, `params`, `response`, `fetched_at`.

Demo handling: one canonical demo trip (`is_demo=true`, owned by a system user). **Try the demo trip** clones the trip and its days, stops, candidates and side quests into the guest's account, so every judge gets their own journal/XP state and the original is never modified.

## Major Technical Steps
_What are the major technical steps required to implement this product? Keep the tasks high-level and milestone-focused (e.g., "Build user input form," not "Write handleInput() function"). These will guide the AGENT or dev team in breaking down the work further._

**Critical path (M0–M4):**
1. **Request the Qloo hackathon key (today)**, and join the Qloo Discord.
2. Scaffold the repo: Next.js + TS + Tailwind + shadcn, MIT license, Prisma, Vercel project with preview deploys, env/feature flags. Supabase anonymous sessions are set up here, but if setup causes friction, use a seeded local session and continue.
3. Define the `QlooClient` interface and Zod types; build the mock client from documented response shapes; add the cache wrapper.
4. Mapbox adapter: US geocoding autocomplete, directions, detour calculation.
5. **Vertical slice:** hardcoded demo travelers → route → corridor scan → naive group scoring → list itinerary → basic map → slider simulation → Scout trigger → Side Quest accept/complete → journal entry + XP. It must not wait on auth: state can be in memory or a seeded session.
6. **Wire persistence immediately after the slice works:** Prisma models in Supabase Postgres, anonymous sessions replacing the seeded one, user ownership on every row.
7. **Qloo spike** (S1–S8) as soon as the key arrives. Record fixtures, then switch the slice to the real Qloo API.
8. Implement the full scoring module (calibration, group fit, delight, overlap, fairness selection, quality floor) with unit tests.
9. Implement the planner: feasibility, overnight towns via the simple heuristic, slot fitting, scheduling. No hotel entities yet.
10. Build the Planner agent with tools, streamed activity events, the baseline fallback and the step budget.
11. Explanation generation with grounding validation; crew vibe reveal.
12. `seed-demo` script run against real Qloo; demo clone-on-start; event replay.
13. Golden-trip quality check on **Anaheim → Denver + Phoenix → Moab**; calibration tuning; build the overnight DP optimizer only if the heuristic fails this review.
14. Onboarding: favorites search, inferred taste cards, vibe cards, free text → tags.
15. Trip UI: synchronized map + timeline, stop detail sheet, remove/swap. **Plan Your Own Trip works end to end.**
16. Simulate Drive: animation along the route, HUD, speed/skip controls, check-ins.
17. Scout + Side Quest flow: offer, inspect, accept/skip, reroute, jump to arrival, complete, XP celebration.
18. Journal, XP ledger, recap card. Photo upload and the public recap page with an OG image (both P1, behind flags).
19. Rate limiting/quotas for live planning.

**Bonus scope (M5, only after M4 exit criteria are met):**
20. Taste-matched hotel entities for overnight towns (P1, the first bonus item, because Plan Your Own Trip already works by then).
21. Regenerate day; conversational Replanner with diffs.
22. Optional "Save your adventure" identity linking.
23. Expand golden trips to the full five-route suite.

**Polish & submission (M6, no new features):**
24. Polish, performance, accessibility, mobile pass; Playwright demo E2E; final demo seed; timed rehearsals.
25. Submission materials: **60–90 s demo video (required internally)**, screenshots, write-up, architecture diagram, testing instructions.

## Tools & Services
_What tools, APIs, or libraries will be used?_

- **Qloo Hackathon API**: Insights (GET), Search, Tags, Entity Data.
- **Mapbox**: GL JS (`react-map-gl`), Directions, Geocoding / Search Box, Matrix. The free tier covers hackathon volume.
- **Anthropic Claude** via **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`): Sonnet 5.5 and Haiku 4.5. Set a monthly spend cap.
- **Supabase**: Postgres, anonymous auth + magic link/OAuth linking, Storage.
- **Prisma** ORM; **Zod** schemas.
- **Turf.js** (`@turf/buffer`, `simplify`, `along`, `nearestPointOnLine`, `length`) and **@mapbox/polyline**.
- **Tailwind CSS**, **shadcn/ui**, **Framer Motion**, **Lucide**, `canvas-confetti` (XP moments), `@vercel/og` (recap OG images).
- **p-limit** (Qloo concurrency); **nanoid** (share slugs).
- **Vitest**, **Playwright**, **ESLint/Prettier**.
- **Vercel** (hosting, preview deploys, Cron); **GitHub** (public repo, MIT).
- Optional: **Sentry** free tier for error monitoring.

## Risks & Unknowns
_What might block us, or what needs more investigation?_

| Risk | Likelihood / Impact | Mitigation |
|---|---|---|
| Qloo key arrives late | Med / High | Request today. Mock adapter behind the real interface. The vertical slice doesn't depend on the key. Ask in Discord after 3 business days. |
| Polygon `filter.location` unsupported or URL too long (GET-only) | Med / Med | Simplify polygons to a vertex budget; fall back to point+radius sampling (S1). |
| Explainability/heatmap unavailable on the hackathon host | Med / Med | Fallbacks defined in S2/S3; explanations from per-traveler scores + tags. |
| `filter.entities` doesn't score fixed candidates per traveler | Med / High | Per-traveler signal queries per segment, intersected with the pool (S4). The group logic still holds. |
| Sparse Qloo coverage on rural stretches | High / Med | Quality floor + honest "quiet stretch" framing; widen the radius on sparse segments; the demo route is checked by golden-trip review. |
| Recommendations feel generic (chains, obvious picks) | Med / High | Popularity caps/diversity, chain detection by name/tags, golden-trip "Starbucks test", weight favorites heavily. |
| Live planning takes >60 s | Med / Med | Parallel scan, tight agent step budget, baseline-first, cache, streamed progress so the wait feels useful. |
| LLM invents facts in explanations | Low / High | Grounding validator + template fallback; LLM never chooses places. |
| Scope vs. ~95 hours | High / High | Vertical slice by Oct 12, feature flags, strict cut order, freeze Oct 26. |
| Quota/cost abuse during judging | Med / High | Per-session and global daily limits on live planning, cache, spend caps; the demo trip needs no live calls. |
| Supabase free project pauses after inactivity | Med / High | Daily Vercel Cron keep-alive ping through Nov 16; consider the Pro tier for judging weeks. |
| Agent nondeterminism breaks the demo | Low / High | The demo is a persisted, cloned trip; the Scout for the demo uses stored quests; the live path has a deterministic baseline. |
| Judges score only from description and images | Med / Med | The 60–90 s demo video is a **required internal deliverable** (the Side Quest moment has to be seen, not described), plus screenshots and the write-up explaining the "same pipeline" demo design. |
| Greedy overnight heuristic produces a bad day late in the trip | Med / Med | Lookahead for remaining-days feasibility; golden-trip review; escalate to the DP optimizer only if the review fails. |
| Auth/Supabase setup slows the vertical slice | Med / Med | Seeded local session for M1; wire anonymous sessions right after the slice works. |

**Open questions:** final calibration constants (after S7); exact place tags per bucket (S6); whether hotels have enough Qloo coverage in small overnight towns; the demo crew's specific favorites (choose them to show cross-domain magic, e.g. a band, a film and a restaurant each).

## Milestones
_What are the major implementation phases or delivery checkpoints?_

**Critical path: M0 → M4.** These milestones are the hackathon. M5 is bonus scope and starts only after M4's exit criteria are met. If M4 isn't done by Oct 23, M5's days go to finishing M4. M6 is never touched.

| Milestone | Dates | Path | Exit criteria |
|---|---|---|---|
| **M0: Foundations** | Oct 6–7 | Critical | Qloo key requested. Public repo with MIT license. Next.js app deployed on Vercel. Mapbox route renders. `QlooClient` interface + mock. Supabase anonymous sessions attempted; **not a blocker** (a seeded local session is acceptable). |
| **M1: Ugly vertical slice** | Oct 8–12 | Critical | The full loop runs end to end with hardcoded demo travelers: route → Qloo (real if the key has arrived, otherwise mock) → scored stops in a list + map → slider simulation → Scout fires → accept → complete → journal + XP. **Then persistence is wired in:** Supabase Postgres + anonymous sessions, user-owned rows. Spike S1–S8 done and findings recorded once the key arrives. |
| **M2: Recommendation quality & Planner agent** | Oct 13–16 | Critical | Full scoring + fairness, feasibility, **overnight towns via the simple heuristic**, grounded explanations, Planner agent with live activity stream and baseline fallback. First real demo seed. Golden-trip review on **Anaheim → Denver + Phoenix → Moab** (DP optimizer only if the heuristic fails it). *Hotel entities deferred.* |
| **M3: Onboarding & trip UI** | Oct 17–19 | Critical | Vibe onboarding with inferred cards, crew vibe reveal, trip setup, polished map + timeline, stop sheet with per-traveler bars, remove/swap. **Plan Your Own Trip works end to end.** |
| **M4: Simulate Drive, Scout & journal** | Oct 20–23 | Critical | Polished Simulate Drive with skip/jump, Scout agent, full Side Quest flow with XP celebration, journal, recap, live-planning rate limits. P1 behind flags: photo upload, public recap page. **Demo path ≤90 s; both golden trips still pass.** |
| **M5: Bonus scope** | Oct 24–26 | Bonus | In order, as time allows: taste-matched hotel entities → regenerate day + conversational Replanner with diffs → optional Save your adventure → full five-route golden suite. **Feature freeze at end of Oct 26** regardless of what's finished. |
| **M6: Polish & submit** | Oct 27–29 | Protected | No new features. Bug fixes, performance, mobile pass, accessibility, final demo seed, timed rehearsals, Playwright green, hardening, screenshots, write-up, **60–90 s demo video (required internally)**. **Submit Oct 29.** |
| **Buffer** | Oct 30 | — | Emergency fixes only; deadline 11:45 PM EDT. |
| **Judging** | Oct 31–Nov 16 | — | Production frozen (critical fixes only); keep-alive and quota monitoring. |

If behind schedule at any checkpoint, apply the cut order: auth UI → public recap → conversational replanning → hotel entities → photo upload → XP levels/titles → advanced editing. Never-cut items are listed under **Scope Boundaries**.

## Testing Strategy

- **Unit (Vitest), required for `domain/*`:** calibration, power mean, fairness weighting, quality floor, overnight-town heuristic (and DP optimizer if escalated), feasibility thresholds, scheduling/cutoffs, Scout z-score trigger and cooldowns, XP rules, polygon simplification and WKT formatting (longitude first).
- **Adapter contract tests:** the mock and real Qloo clients satisfy the same Zod schemas. Recorded fixtures replay deterministically. `qloo-smoke` script hits the live API for 3 canonical queries (run manually and before deploys).
- **Agent tests:** tool schemas validated. Planner runs on fixtures and must produce a valid trip within the step budget. Replanner eval set of about 12 requests (including off-topic) with expected tool categories and "unaffected days unchanged" assertions. The explanation grounding validator gets its own tests.
- **Golden trips (quality), staged:** start with two routes: **Anaheim → Denver** (the demo; must be excellent) and **Phoenix → Moab** (adversarial and sparse; must degrade gracefully, with honest quiet stretches and no floor violations or impossible days). These are reviewed by hand at M2 and re-checked at M4. Only after the demo and Plan Your Own Trip are stable (M5 bonus, or M6 if time remains) expand to the full suite: SF → Portland, Chicago → Nashville, Austin → New Orleans. The report covers vibe-% distribution, per-traveler satisfaction, floor violations, chains, drive-time vs. pace, generation time, and overnight-town quality (the trigger for the DP escalation rule).
- **E2E (Playwright):** the demo path from Home to journal entry with no login, timed (target <90 s for a scripted user). A smoke test of Plan Your Own Trip against the mock. Run on preview deploys.
- **Manual:** timed demo rehearsal on desktop Chrome/Safari and an iPhone-sized viewport; slow-network check; a fresh-guest check (incognito).

## Deployment Strategy

- **Vercel:** `main` → production, branches → previews. The planning route uses Fluid compute with a long `maxDuration` and streams events; progress is saved so the client can resume.
- **Environments:** local (`QLOO_MODE=mock` by default), preview (record/cached), production (real + cache). Separate Supabase projects for dev and prod if time permits; otherwise separate schemas.
- **Secrets:** `QLOO_API_KEY`, `ANTHROPIC_API_KEY`, `MAPBOX_TOKEN` (server, secret) + `NEXT_PUBLIC_MAPBOX_TOKEN` (URL-restricted public token), Supabase URL/anon/service keys, `DATABASE_URL` (pooled) and `DIRECT_URL`.
- **Protection:** live planning rate limits per guest session (e.g., 3/hour, 10/day) plus a global daily cap. On hitting a limit: a friendly message and a nudge toward the demo trip. Anthropic spend cap. Qloo cache. `/api/health` checks Qloo, Mapbox, Supabase and the LLM.
- **Uptime through Nov 16:** daily Vercel Cron keep-alive (DB query + cache warm for the demo). Monitor quota in the Qloo Discord. Tag `v1.0-submission`; after submission only critical fixes are deployed.
- **Migrations:** Prisma migrate in CI before deploy. Seed demo via `scripts/seed-demo` against prod after each scoring change (then freeze on Oct 28).

## Demo Strategy

**Demo crew:** two travelers matching the brief. Traveler 1: Vietnamese food, Mexican food, cars, scenic drives, outdoors. Traveler 2: art, coffee, vintage, hiking, indie music. Each gets 3–4 specific cross-domain favorites (a band, a film, a restaurant, a brand) so the explanations name real things.

**Demo trip:** Anaheim → Denver, 4 days, Balanced pace. Produced by `seed-demo` with the real pipeline. The Side Quest the Scout surfaces first is the highest-z qualifying candidate early on Day 1 or 2, so the judge sees it within about 10–15 s of starting Simulate Drive.

**90-second script:**
| Time | Beat |
|---|---|
| 0–8 s | Home: "Google Maps tells you what's along the way. Sidequest finds what *you'd* love." → Try the demo trip |
| 8–20 s | Crew vibe reveal (two distinct travelers, shared + different) → quick replay of planning activity |
| 20–40 s | Trip: map + 4-day timeline; tap a stop → 94% Your Vibe, per-traveler bars, "especially for Alex", why, +18 min |
| 40–55 s | Simulate Drive at 16×; HUD updates; **SIDE QUEST AVAILABLE** |
| 55–68 s | Inspect why it matches → Accept → reroute → Jump to arrival |
| 68–85 s | Complete: sample photo, 5 stars, reaction → +150 XP celebration → journal entry appears |
| 85–90 s | Recap card; "Plan your own trip" invitation |

**Submission materials:** a description that leads with the differentiation and how Qloo is used (corridor polygons, per-traveler scoring, explainability), plus the "the demo is a saved trip from the same pipeline" explanation. 6–8 screenshots, a short architecture diagram, and testing instructions ("no login needed").

**Demo video (required internally, even though Devpost lists it as optional):** 60–90 s, following the script above, recorded from the production build at a 1080p desktop viewport, with a short mobile cut-in if time allows. The Side Quest offer → accept → jump to arrival → complete → XP → journal sequence must be shown on screen in full. Captions or a voiceover state the Maps-vs-Sidequest difference and "every pick is scored per traveler by Qloo." Record a draft on Oct 27 (after the final demo seed), re-record on Oct 28–29 after fixes, and upload it to YouTube/Vimeo for the Devpost link.

## Scope Boundaries

**In (P0, never cut):** Qloo-powered onboarding/entity resolution, individual traveler profiles, group scoring, real route/corridor planning, Qloo recommendations, explainability, map + itinerary, demo trip, Plan Your Own Trip, Simulate Drive, Scout agent, Side Quest discover/accept/complete loop, basic journal, simple XP, guest sessions with a user-owned data model, remove/swap.

**In (P1, cut in this order if behind):** 1) auth UI ("Save your adventure"), 2) public shareable recap page, 3) conversational replanning, 4) hotels as taste-matched entities (keep overnight towns), 5) photo upload (keep sample-photo completion), 6) XP levels/titles (keep simple XP), 7) advanced itinerary editing / regenerate day.

**Out:** social feeds, followers/friends, DMs, creator profiles, leaderboards, achievement systems, native apps, booking/pricing/availability/payments, turn-by-turn navigation, real-GPS tracking, a proprietary places database, Google Places, non-US trips, trips outside 2–6 days, separate traveler accounts/invites, a general travel chatbot, and any new features during Oct 27–29.

## Environment Setup
_What setup steps are needed to start development or run the app?_

1. Install Node.js LTS and pnpm. Create a public GitHub repo with an MIT `LICENSE`.
2. **Request a Qloo hackathon API key** via the form in the Qloo hackathon developer guide (check spam for the email); join the Qloo Discord.
3. Create accounts/keys: **Mapbox** (secret token + URL-restricted public token), **Anthropic** (API key + spend cap), **Supabase** (project; enable anonymous sign-ins; create the `journal-photos` storage bucket), **Vercel** (link the repo).
4. `pnpm create next-app` (TypeScript, Tailwind, App Router), then add shadcn/ui, Prisma, Zod, Vercel AI SDK, react-map-gl/mapbox-gl, Turf, Framer Motion, Vitest, Playwright.
5. Create `.env.local`: `QLOO_API_KEY`, `QLOO_BASE_URL=https://hackathon.api.qloo.com`, `QLOO_MODE=mock`, `ANTHROPIC_API_KEY`, `MAPBOX_TOKEN`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `FEATURE_*` flags.
6. `pnpm prisma migrate dev` → `pnpm dev`.
7. When the key arrives: `pnpm qloo:spike` (records findings + fixtures), then set `QLOO_MODE=real` (or `record`).
8. `pnpm seed:demo` to generate the demo trip from the real pipeline; `pnpm test` and `pnpm e2e` before each production deploy.
