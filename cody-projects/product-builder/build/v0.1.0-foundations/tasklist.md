# Version Tasklist – v0.1.0-foundations
This document outlines all the tasks to work on to delivery this particular version, grouped by phases.

Milestone M0 (Oct 6–7). Backlog items 101–108. Decisions from design review: Node pinned to Vercel's newest supported LTS (24.x) via `.nvmrc` + `engines`; `cody-projects/` committed publicly; repo `sidequest` under your personal GitHub account; Mapbox Standard style to start; Supabase in US East; MIT copyright "Matthew Nguyen".

| Status |      |
|--------|------|
| 🔴 | Not Started |
| 🟡 | In Progress |
| 🟢 | Completed |


## Phase 1 – Accounts & Access (critical path, start today)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 1.1 | Request Qloo API key | Submit the key request form from the Qloo hackathon developer guide; note the submission date; join the Qloo Discord (#api-help). | None | 🔴 Not Started | USER |
| 1.2 | GitHub CLI auth | Confirm `gh auth status` is logged in (run `! gh auth login` if not). | None | 🔴 Not Started | USER |
| 1.3 | Mapbox tokens | Create a Mapbox account; copy the default public token; create a secret token with Directions/Geocoding scopes. Share via `.env.local` (not chat). | None | 🔴 Not Started | USER |
| 1.4 | Supabase project | Create project `sidequest` in US East; enable **Anonymous sign-ins** (Auth → Providers); put URL + anon key in `.env.local`. | None | 🔴 Not Started | USER |
| 1.5 | Vercel account | Sign up/log in to Vercel with GitHub so the repo can be imported in Phase 2. | None | 🔴 Not Started | USER |

## Phase 2 – Repo, Scaffold & Deploy (items 102, 103, 104)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 2.1 | Scaffold Next.js app | `create-next-app` at repo root (TypeScript strict, App Router, `src/`, Tailwind, ESLint, `@/*` alias) without disturbing `cody.json`/`cody-projects/`; pnpm. | None | 🔴 Not Started | AGENT |
| 2.2 | Node pinning | `.nvmrc` + `package.json` `engines` set to Node 24.x; note in README. | 2.1 | 🔴 Not Started | AGENT |
| 2.3 | UI & tooling deps | Add shadcn/ui (init + button, card, input, badge, sheet, sonner), Framer Motion, lucide-react, zod, Prettier, Vitest (+ coverage); scripts `lint`, `typecheck`, `test`, `format`. | 2.1 | 🔴 Not Started | AGENT |
| 2.4 | Folder skeleton | Create `src/adapters/{qloo,mapbox}`, `src/domain`, `src/agents` (README stubs), `src/lib/{config,session}`, `src/components/{ui,map}`, `docs/`, `scripts/`, `tests/`. | 2.1 | 🔴 Not Started | AGENT |
| 2.5 | Placeholder home | Simple branded "Sidequest — the road trip built around your taste" page with a link to `/dev/route`. | 2.3 | 🔴 Not Started | AGENT |
| 2.6 | License, README, gitignore | MIT `LICENSE` (2026, Matthew Nguyen); README stub (pitch, stack, run locally); `.gitignore` covering `.env*.local`, `.vercel`, build output. | 2.1 | 🔴 Not Started | AGENT |
| 2.7 | Init git & create public repo | `git init`, first commit, `gh repo create sidequest --public --source . --push`; verify GitHub detects the MIT license in About. | 1.2, 2.6 | 🔴 Not Started | AGENT |
| 2.8 | Connect Vercel | Import the repo in Vercel; set Node 24.x; confirm the production deploy of the placeholder home. | 1.5, 2.7 | 🔴 Not Started | USER |
| 2.9 | Verify preview deploys | Push a branch and confirm a preview URL builds. | 2.8 | 🔴 Not Started | AGENT |

## Phase 3 – Config & Feature Flags (item 105)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 3.1 | Server env schema | `env.server.ts` (`server-only`): Zod schema for `QLOO_MODE`, `QLOO_API_KEY` (required unless mock), `QLOO_BASE_URL`, `MAPBOX_TOKEN`, Supabase keys, `SESSION_MODE`, `DEV_USER_ID`, `ANTHROPIC_API_KEY` (optional); fail fast with readable errors. | 2.4 | 🔴 Not Started | AGENT |
| 3.2 | Client env schema | `env.client.ts` for `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. | 2.4 | 🔴 Not Started | AGENT |
| 3.3 | Feature flags | `flags.ts` with the seven `FEATURE_*` booleans, all default off. | 3.1 | 🔴 Not Started | AGENT |
| 3.4 | `.env.example` | Document every variable with comments; create local `.env.local` from it. | 3.1, 3.2 | 🔴 Not Started | AGENT |
| 3.5 | Config tests | Vitest: missing required keys fail; defaults applied; mock mode doesn't require a Qloo key; flag parsing. | 3.1, 3.3 | 🔴 Not Started | AGENT |

## Phase 4 – Qloo Adapter Interface & Mock (item 106)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 4.1 | Types & Zod schemas | `QlooEntityType`, `QlooEntity`, `QlooTag`, `InsightsParams`, `InsightsResult` (lenient/passthrough, required fields only). | 2.4 | 🔴 Not Started | AGENT |
| 4.2 | Client interface | `QlooClient` with `search`, `insights`, `tags`. | 4.1 | 🔴 Not Started | AGENT |
| 4.3 | Query serializer | Pure `toQueryString(InsightsParams)` using documented parameter names; lon-first WKT; comma joins; encoding. | 4.1 | 🔴 Not Started | AGENT |
| 4.4 | Mock fixtures | ~40 cross-domain search entities (incl. demo crew favorites); ~60 Anaheim → Denver corridor places with realistic coordinates, tags, hours; fixture tag list. All flagged `mock`. | 4.1 | 🔴 Not Started | AGENT |
| 4.5 | MockQlooClient | Deterministic search (fuzzy), insights (polygon/radius filter via Turf, seeded affinity per entity+signals, `take`, synthetic explainability), tags. | 4.2, 4.4 | 🔴 Not Started | AGENT |
| 4.6 | CachedQlooClient | Wrapper with stable param hashing and a pluggable `CacheStore` (in-memory now). | 4.2 | 🔴 Not Started | AGENT |
| 4.7 | RealQlooClient stub | Base URL + `X-Api-Key` header construction; methods throw `NotImplemented` until v0.2.0. | 4.2, 4.3 | 🔴 Not Started | AGENT |
| 4.8 | Factory | `getQlooClient()` selects implementation by `QLOO_MODE`, always wrapped in cache. | 4.5, 4.6, 4.7, 3.1 | 🔴 Not Started | AGENT |
| 4.9 | Qloo adapter tests | Serializer cases; mock determinism; different signals → different affinities; polygon filtering; cache hits. | 4.3, 4.5, 4.6 | 🔴 Not Started | AGENT |
| 4.10 | Findings doc stub | `docs/qloo-findings.md` with key request date and the S1–S8 spike checklist for v0.2.0. | 1.1 | 🔴 Not Started | AGENT |

## Phase 5 – Mapbox Adapter & Route Smoke Page (item 107)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 5.1 | Geocoding adapter | Server-side US-only place search normalized to `Place`. | 3.1, 1.3 | 🔴 Not Started | AGENT |
| 5.2 | Directions adapter | Server-side driving route (GeoJSON geometry, duration, distance, legs) normalized to `Route`. | 3.1, 1.3 | 🔴 Not Started | AGENT |
| 5.3 | Detour helpers | `estimateDetourMin(route, point)` (Turf) and `exactDetourMin(a, p, b)` (Directions with waypoint). | 5.2 | 🔴 Not Started | AGENT |
| 5.4 | API routes | `GET /api/geocode?q=`, `POST /api/route` with Zod-validated input and error handling. | 5.1, 5.2 | 🔴 Not Started | AGENT |
| 5.5 | RouteMap component | Client-only Mapbox GL map (Standard style), route line, origin/destination markers, fit bounds. | 3.2, 2.3 | 🔴 Not Started | AGENT |
| 5.6 | `/dev/route` page | Renders Anaheim, CA → Denver, CO with drive time and distance. | 5.4, 5.5 | 🔴 Not Started | AGENT |
| 5.7 | Mapbox tests | Detour estimate on a synthetic line; response normalization from a recorded fixture. | 5.2, 5.3 | 🔴 Not Started | AGENT |

## Phase 6 – Session Bootstrap (item 108, time-boxed ≤1 hour)

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 6.1 | `getCurrentUser()` seam | Single API returning `{ id, isAnonymous }`; mode chosen by `SESSION_MODE`. | 3.1 | 🔴 Not Started | AGENT |
| 6.2 | Dev session | `SESSION_MODE=dev` returns `DEV_USER_ID`. | 6.1 | 🔴 Not Started | AGENT |
| 6.3 | Supabase anonymous session | `@supabase/ssr` client/server helpers, middleware cookie refresh, `signInAnonymously()` on first visit. If not working within the time box, set `SESSION_MODE=dev` and move on. | 6.1, 1.4 | 🔴 Not Started | AGENT |
| 6.4 | Session indicator | Show the guest ID (shortened) on `/dev/route` to verify sessions persist across reloads. | 6.2 or 6.3 | 🔴 Not Started | AGENT |

## Phase 7 – Health, Env Rollout & Verification

| ID  | Task             | Description                             | Dependecies | Status | Assigned To |
|-----|------------------|-----------------------------------------|-------------|----------|--------|
| 7.1 | Health endpoint | `GET /api/health` reports Qloo mode, session mode, Mapbox reachability, flags (no secrets). | 4.8, 5.2, 6.1 | 🔴 Not Started | AGENT |
| 7.2 | Vercel env vars | Add all variables to Production + Preview (`QLOO_MODE=mock`); restrict the public Mapbox token to the Vercel and localhost URLs. | 2.8, 3.4 | 🔴 Not Started | USER |
| 7.3 | Quality gate | `pnpm lint && pnpm typecheck && pnpm test` all green. | 3.5, 4.9, 5.7 | 🔴 Not Started | AGENT |
| 7.4 | Production verification | On the production URL: home loads, `/dev/route` renders the route, `/api/health` is healthy, session persists. | 7.1, 7.2, 7.3 | 🔴 Not Started | USER |
| 7.5 | M0 exit check | Confirm M0 exit criteria: key requested, public MIT repo, deployed app, route renders, Qloo interface + mock, session seam ready. | 7.4 | 🔴 Not Started | AGENT |
