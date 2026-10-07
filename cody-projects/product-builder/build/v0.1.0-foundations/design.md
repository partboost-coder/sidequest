# Version Design Document : v0.1.0-foundations
Technical implementation and design guide for the upcoming version.

## 1. Features Summary
_Overview of features included in this version._

Milestone **M0 (Oct 6–7)**, on the critical path. Goal: get every external dependency and module boundary in place so the v0.2.0 vertical slice can start on Oct 8 with no setup work left, **even if the Qloo key hasn't arrived**.

| ID | Feature | Outcome when done |
|----|---------|-------------------|
| 101 | Qloo key & community | Key request submitted (date recorded); joined the Qloo Discord (#api-help). |
| 102 | Repo & license | Public GitHub repo `sidequest` with an MIT `LICENSE` that GitHub detects; README stub. |
| 103 | App scaffold | Next.js App Router + TypeScript (strict) + Tailwind + shadcn/ui + Framer Motion; ESLint/Prettier; Vitest runs. |
| 104 | Vercel deploy | `main` → production URL; branches → preview URLs; env vars configured. |
| 105 | Config & feature flags | Zod-validated env config (server/client split); `QLOO_MODE`; typed `FEATURE_*` flags. |
| 106 | Qloo adapter interface + mock | `QlooClient` interface with Zod types; `MockQlooClient` returns realistic fixtures for the demo corridor; `CachedQlooClient` wrapper skeleton; factory selects by `QLOO_MODE`. |
| 107 | Mapbox adapter | Server-side geocoding (US-only) and directions; detour helper; Anaheim → Denver route renders on a Mapbox GL map. |
| 108 | Session bootstrap (non-blocking) | `getCurrentUser()` abstraction backed by Supabase anonymous auth **or** a seeded dev user. Time-boxed: whichever works in ≤1 hour ships. |

**Out of scope for this version:** database schema/Prisma models (v0.2.0, item 211), real Qloo calls (v0.2.0, items 209/210), any product UI beyond a route smoke page, agents/LLM calls.

## 2. Technical Architecture Overview
_High-level technical structure that supports all features in this version. May include information about the frontend stack, backend / api, authentication, database, deployment, etc._

**Repo layout:** the Next.js app lives at the repository root (`/Users/matt/sidequest`). The Cody planning docs stay in `cody-projects/` and are committed alongside the code.

```
sidequest/
├─ LICENSE                      MIT
├─ README.md
├─ cody.json, cody-projects/    planning docs (Cody)
├─ docs/                        qloo-findings.md (v0.2.0), architecture notes
├─ scripts/                     qloo-smoke.ts (stub), seed scripts later
├─ src/
│  ├─ app/
│  │  ├─ page.tsx               placeholder home ("Sidequest — coming soon" + links)
│  │  ├─ dev/route/page.tsx     route smoke page (Anaheim → Denver on the map)
│  │  └─ api/
│  │     ├─ route/route.ts      POST {origin, destination} → route (server-side Mapbox)
│  │     ├─ geocode/route.ts    GET ?q= → US place suggestions
│  │     └─ health/route.ts     reports config + adapter modes (no secrets)
│  ├─ adapters/
│  │  ├─ qloo/                  types.ts · client.ts (interface) · mock.ts · cached.ts · real.ts (stub) · index.ts (factory) · fixtures/
│  │  └─ mapbox/                geocode.ts · directions.ts · detour.ts · types.ts
│  ├─ domain/                   (empty, with README: pure logic lives here from v0.2.0)
│  ├─ agents/                   (empty, with README)
│  ├─ components/               ui/ (shadcn) · map/RouteMap.tsx
│  └─ lib/
│     ├─ config/                env.server.ts · env.client.ts (Zod)
│     ├─ flags.ts               typed feature flags
│     └─ session/               getCurrentUser.ts · supabase/ (client + server helpers) · dev.ts
└─ tests/                       Vitest unit tests (adapters/config)
```

**Stack and tooling for this version**
- **Next.js (latest stable, App Router)**, React, **TypeScript strict**, `src/` dir, `@/*` import alias.
- **Tailwind CSS** (version bundled with create-next-app) + **shadcn/ui** (init with neutral base; add `button`, `card`, `input`, `badge`, `sheet`, `sonner`) + **Framer Motion** + **lucide-react**.
- **Map:** `mapbox-gl` + `react-map-gl`, loaded client-side only (`dynamic(..., { ssr: false })`).
- **Geometry:** `@turf/turf` installed now (used heavily in v0.2.0) and `@mapbox/polyline`.
- **Validation:** `zod`.
- **Supabase:** `@supabase/supabase-js` + `@supabase/ssr` (cookie-based sessions in the App Router).
- **Testing:** Vitest (+ `@vitest/coverage-v8`). Playwright is not installed until v0.5.0.
- **Package manager:** pnpm. **Node:** local v26; `engines.node` set to the newest LTS Vercel supports, pinned via the Vercel project setting (see Open Questions).

**Deployment:** GitHub repo connected to Vercel via Git integration (no Vercel CLI required; `npx vercel` if needed). Secrets go in Vercel project env vars for Production and Preview. Only `NEXT_PUBLIC_*` values reach the browser.

## 3. Implementation Notes
_Shared technical considerations across all features in this version._

### 105: Config & flags
- `env.server.ts` parses `process.env` with Zod at module load and **fails fast** with a readable error listing missing keys. Server-only (`import 'server-only'`).
- Variables: `QLOO_MODE` (`mock` | `real` | `record`, default `mock`), `QLOO_API_KEY` (required only when mode ≠ mock), `QLOO_BASE_URL` (default `https://hackathon.api.qloo.com`), `MAPBOX_TOKEN` (secret, server), `NEXT_PUBLIC_MAPBOX_TOKEN` (public, URL-restricted), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (optional now), `SESSION_MODE` (`supabase` | `dev`, default `supabase`), `DEV_USER_ID` (UUID used when `SESSION_MODE=dev`), `ANTHROPIC_API_KEY` (optional until v0.3.0).
- `flags.ts`: `FEATURE_AUTH_UI`, `FEATURE_PUBLIC_RECAP`, `FEATURE_REPLAN_CHAT`, `FEATURE_HOTELS`, `FEATURE_PHOTO_UPLOAD`, `FEATURE_XP_LEVELS`, `FEATURE_REGENERATE_DAY`. Parsed as booleans, all default **off**. Exposed as one typed object, read on the server.
- `.env.example` documents every variable. `.env.local` is gitignored.

### 106: Qloo adapter
- **Interface** (`client.ts`), shaped around the documented hackathon API (GET-only `/v2/insights`):
  ```ts
  interface QlooClient {
    search(params: { query: string; types?: QlooEntityType[]; take?: number }): Promise<QlooEntity[]>;
    insights(params: InsightsParams): Promise<InsightsResult>;   // GET /v2/insights
    tags(params: { query?: string; tagTypes?: string[]; take?: number }): Promise<QlooTag[]>;
  }
  ```
- `InsightsParams` is a typed object that serializes to the **documented parameter names**: `filter.type`, `filter.location` (WKT, longitude first), `filter.location.radius`, `filter.tags`, `filter.entities`, `filter.popularity.min/max`, `filter.price_level.min/max`, `filter.hours`, `signal.interests.entities`, `signal.interests.tags`, `signal.interests.*.weight`, `feature.explainability`, `diversify.by`, `diversify.take`, `bias.trends`, `output.heatmap.*`, `take`, `page`. A pure `toQueryString(params)` function handles serialization and is unit-tested. It's the one place the GET URL is built (URL-length checks come in v0.2.0).
- **Zod response schemas** are lenient (`.passthrough()`), with only the fields we rely on required: entity `entity_id`, `name`, `type`/`subtype`, `properties` (address, geocode, hours, images, business rating), `location` (lat/lon), `tags`, `query.affinity`, optional `query.explainability`. They're tightened after the spike in v0.2.0.
- **MockQlooClient** behaves deterministically:
  - `search`: fuzzy-matches a fixture list of about 40 cross-domain entities (artists, movies, restaurants, brands, destinations), including the demo crew's favorites.
  - `insights` for `urn:entity:place`: returns fixture places from an **Anaheim → Denver corridor set** (~60 plausible places across Barstow/Needles/Kingman/Flagstaff/Sedona/Page/Moab/Grand Junction/Glenwood Springs/Denver). It filters by a point-in-polygon check against `filter.location` (Turf) and generates `query.affinity` from a seeded hash of (entity, signals), so the same query always gives the same answer and different travelers get different scores. It honors `take`. When `feature.explainability` is set, it returns synthetic `query.explainability`.
  - `tags`: a small fixture tag list (cuisines, hiking, vintage, coffee, art gallery, live music, scenic).
  - Fixture places are clearly marked `mock` and never shown outside `QLOO_MODE=mock`.
- **CachedQlooClient**: wraps any client. The key is a stable hash of method + normalized params. The in-memory store implements a `CacheStore` interface so the Postgres store can plug in later (v0.2.0).
- **RealQlooClient**: a stub that throws `NotImplemented` (built in v0.2.0, items 209/210). It already includes the `X-Api-Key` header construction and base URL so the shape is fixed.
- **Factory** (`index.ts`): `getQlooClient()` returns `CachedQlooClient(MockQlooClient | RealQlooClient)` based on `QLOO_MODE`. Callers never import an implementation directly.

### 107: Mapbox adapter
- **Server-side calls only** for Geocoding (Search Box or Geocoding v6, `country=us`, `types=place,address,poi`) and Directions (`driving`, `geometries=geojson`, `overview=full`, `steps=false`, returning legs, duration, distance). They use `MAPBOX_TOKEN`. Results are normalized into our own types (`Place`, `Route { geometry: LineString; durationSec; distanceM; legs }`).
- `detour.ts`: `estimateDetourMin(route, point)` (distance to the nearest route point ÷ assumed speed × 2, via Turf) and `exactDetourMin(a, p, b)` (Directions with a waypoint). Both are unit-tested with fixtures. Exact detours aren't used until v0.3.0, but the function shape is fixed now.
- `RouteMap.tsx`: a client component with a custom-styled base map (start from a Mapbox Standard or Outdoors style; final art direction is in v0.4.0), a route line layer, origin/destination markers, and fit to bounds.
- `/dev/route`: a smoke page that calls `/api/route` for Anaheim, CA → Denver, CO and renders it. It's linked from the placeholder home page and hidden from navigation later.

### 108: Session bootstrap (time-boxed, ≤1 hour)
- `getCurrentUser(): Promise<{ id: string; isAnonymous: boolean }>` is the only API the rest of the app uses.
- **Supabase path (`SESSION_MODE=supabase`):** middleware uses `@supabase/ssr` to refresh the session cookie. On first visit with no session, a server action or route calls `supabase.auth.signInAnonymously()`. Requires enabling **Anonymous sign-ins** in the Supabase dashboard and adding CAPTCHA/rate limits later (judging ops).
- **Dev path (`SESSION_MODE=dev`):** returns `{ id: DEV_USER_ID, isAnonymous: true }`. Used if the Supabase path isn't working within the time box. Switching back is a config change only.
- Nothing in v0.1.0 persists user data yet. This just fixes the seam.

### 101 / 102 / 104: Accounts & repo
- **101:** submit the Qloo form from the hackathon developer guide; record the date in `docs/qloo-findings.md`; check spam daily; post in Discord #api-help after 3 business days without a key.
- **102:** `git init`, `.gitignore` (Node/Next, `.env*.local`, `.vercel`), MIT `LICENSE` (copyright Matthew Nguyen, 2026), README stub (one-paragraph pitch, stack, "run locally"), `gh repo create sidequest --public --source . --push`. Check that GitHub's About sidebar shows "MIT license".
- **104:** import the repo into Vercel; set env vars for Production + Preview (`QLOO_MODE=mock` until the key arrives); confirm a preview deploy from a branch; restrict the public Mapbox token to the Vercel and localhost URLs.

### Testing in this version
- Vitest unit tests: `toQueryString` (parameter names, lon-first WKT, comma joins, encoding), Zod config (fails on missing keys, defaults), flags parsing, mock determinism (same params → same results; different signals → different affinities), polygon filtering in the mock, `estimateDetourMin` on a synthetic line.
- Manual: `/dev/route` renders locally and on the production URL; `/api/health` reports `qloo: mock`, `session: supabase|dev`, Mapbox reachable.
- `pnpm lint && pnpm typecheck && pnpm test` must pass before each push.

## 4. Other Technical Considerations
_Shared any other technical information that might be relevant to building this version._

- **Security:** the Qloo key, the Mapbox secret token and the Supabase service role key are never exposed to the client. Server modules import `server-only`. The public Mapbox token is URL-restricted.
- **Cost:** everything in M0 is free tier (Vercel Hobby, Supabase Free, Mapbox Free). No Anthropic spend yet.
- **Credentials needed from you during this version:** Qloo form submission, GitHub (via `gh auth`), a Vercel account linked to GitHub, a Mapbox account (2 tokens), and a Supabase project (URL + anon key; enable anonymous sign-ins). Interactive logins should be run by you (for example `! gh auth login`).
- **Mock realism matters:** v0.2.0's ugly slice runs on this mock if the key is late, so the fixtures cover the demo corridor convincingly enough to test the Scout and scoring logic. They aren't meant to impress anyone.
- **The public repo includes the planning docs.** That's useful for judges (it shows process), but they'll be public from the first push.
- **Commit hygiene:** small commits per backlog item (`feat(106): qloo adapter interface + mock`), which keeps progress easy to follow during judging.

## 5. Open Questions
_Unresolved technical or product questions affecting this version._

1. **Node version on Vercel:** local is Node 26. Pin Vercel to the newest LTS it supports (likely 24.x) and set `engines` to match, or keep local and deploy versions aligned via `.nvmrc`? *Proposed: `.nvmrc` + `engines` = Vercel's newest LTS; use that locally via nvm/fnm.*
2. **Public planning docs:** are you comfortable with `cody-projects/` (discovery, PRD, plan) being public in the repo? *Proposed: yes; it strengthens the submission's story.*
3. **GitHub repo name/owner:** `sidequest` under your personal account, or a different name/org?
4. **Mapbox map style:** start from Mapbox Standard (clean, modern) or Outdoors (terrain, road-trip feel)? *Proposed: Standard with custom colors for now; final art direction in v0.4.0.*
5. **Supabase region:** choose the region closest to Vercel's default function region (us-east-1 / iad1) to keep latency low. *Proposed: US East.*
