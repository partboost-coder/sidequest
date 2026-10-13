# Project Best Practices
The project's living record of best practices learned while building it. Cody writes to this file after every build (version or patch) and reads it during every build, so the project follows its own standards as it grows.

_How to use this file (for the **AGENT**):_
- _Each entry is a single rule plus a one-line why, e.g. `- Keep command files short. **Why:** long files get skimmed and steps skipped.`_
- _Keep it lean and current. When a new learning contradicts an existing rule, change or remove the old rule rather than appending a second one. This file is the project's bible, not an append-only log._
- _Categories below are a starter set, not a fixed schema. Add categories the project needs and remove starter categories that stay empty or do not apply._
- _No version tags on entries._

## Architecture
- App code talks to Qloo only through `getQlooClient()` and to Mapbox only through `getMapbox()`; never import a concrete client. **Why:** mock, real and cached implementations must stay swappable by config.
- Raw third-party JSON is parsed with lenient (`z.looseObject`) schemas and mapped to app types in one normalizer per service. **Why:** Qloo publishes no example responses; when the real shape differs, only one file changes.
- Qloo GET URLs are built only by `src/adapters/qloo/params.ts`, using documented parameter names; WKT is longitude first. **Why:** Qloo silently ignores invalid parameters, so typos fail invisibly.
- `src/domain` is pure TypeScript (no network, framework or LLM calls) and is unit-tested. **Why:** scoring and planning must be deterministic, explainable and testable.
- The server keeps full-resolution route geometry; the browser gets `displayGeometry()` output. **Why:** a cross-country route is ~12.8k points; the map needs ~500.
- Read the current user only via `getCurrentUser()`. **Why:** it marks the caller request-time and hides whether sessions are dev or Supabase.

## Code & Style
- Server-only modules import `server-only`; pure, testable logic lives in sibling files without it (e.g. `env.schema.ts` vs `env.server.ts`). **Why:** Vitest can't import `server-only` modules.
- Mock fixtures use fictional place names and a `urn:tag:mock:` tag prefix, and are flagged `mock: true`. **Why:** mock data must never be mistaken for real businesses or real Qloo IDs.
- Unused-by-design parameters are prefixed `_`. **Why:** ESLint is configured to ignore them.

## Testing
- Run `pnpm check` (lint + typecheck + tests) before every commit; also run `pnpm build` after touching routes or config. **Why:** build-time prerendering issues only appear in `next build`.
- Check outputs by eye, not just status codes: print rankings, look at screenshots. **Why:** a bad mock affinity model and a zero-height map both passed automated checks.
- Work out expected values in tests from first principles before writing assertions, and use densely sampled lines for geometry tests. **Why:** two failures were wrong test expectations (great-circle arcs, bad arithmetic), not bugs.
- Mapbox tests inject `fetch` with recorded-shape fixtures; assert error messages never contain tokens. **Why:** upstream URLs carry the access token.

## Tooling & Dependencies
- Next.js 16: read `node_modules/next/dist/docs` before writing Next-specific code. **Why:** APIs differ from older versions (`proxy` replaces `middleware`, `cacheComponents` is on, Turbopack is the default).
- With `cacheComponents`, call `await connection()` (or use request APIs) in handlers and pages whose output depends on the request or on runtime secrets. **Why:** otherwise Next tries to prerender them at build time, when Vercel builds have no secrets.
- Route-handler `catch` blocks go through `errorResponse()`, which calls `unstable_rethrow` first. **Why:** Next uses thrown control-flow errors (prerender bail-out, notFound, redirect) that must not be swallowed.
- `typecheck` runs `next typegen` before `tsc`. **Why:** `LayoutProps`/`PageProps` types are generated.
- The theme's `--font-sans` must point at the font variable from `layout.tsx` (`--font-geist-sans`). **Why:** shadcn init left it self-referencing, which falls back to the browser serif.
- Mapbox Geocoding v6 has no `poi` type; use `place, locality, neighborhood, address`. **Why:** `poi` returns a 422.
- Vitest uses Vite's native `resolve.tsconfigPaths`. **Why:** the `vite-tsconfig-paths` plugin is no longer needed.

## Workflow & Process
- Keep the stack on free tiers: Vercel Hobby (no payment method), Mapbox free tier, local Supabase until persistence ships, the free Qloo hackathon key. The Claude API is the only paid service, and needs a spend cap. **Why:** the user wants the project free.
- Secrets go in `.env.local` (never in chat); check keys by presence/length only. Production env vars are set for Production and Preview. **Why:** keys must never be echoed or committed.
- Request every credential the user must create in one batch, with exact click-paths. **Why:** account setup was the main schedule delay in M0.
- Small commits per backlog item (`feat(<id>): …`), pushed to `main`; Vercel auto-deploys production. **Why:** progress stays easy to follow for judges.
- Preview deployments are behind Vercel Authentication by default; only production must be public. **Why:** the judges need only the production URL.

## Gotchas
- A Mapbox GL map inside a container sized by `min-height`/flex must be absolutely positioned (`inset: 0`) in a `relative` wrapper. **Why:** `height: 100%` resolves to 0 there.
- Map and data load independently: fit bounds when both are ready, not only in `onLoad`. **Why:** if the route arrives after the map loads, the map never fits it.
- The Anaheim → Denver route Mapbox returns is I-15 → I-70 (Las Vegas, St. George, Richfield, Grand Junction, Glenwood Springs), not I-40/Flagstaff. **Why:** fixtures and the demo story must match the real corridor.
