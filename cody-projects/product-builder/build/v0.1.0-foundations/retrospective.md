# Version Retrospective – v0.1.0-foundations
This document reflects on what worked, what didn't, and how future versions can be improved.

## Version Summary
Milestone M0. Planned for Oct 6–7, finished Oct 12. 43 of 45 tasks completed. The remaining two (a hosted Supabase project and Supabase anonymous sessions) were deliberately moved to v0.2.0 item 212, to be built against local Supabase.

Delivered:
- Next.js 16.4 / React 19 / TypeScript / Tailwind v4 / shadcn (base-nova) app, Node 24 pinned, MIT-licensed public repo (`partboost-coder/sidequest`).
- Deployed on Vercel Hobby (free) at https://sidequest-rust-phi.vercel.app, with automatic production deploys from `main` and preview deploys for branches.
- Zod-validated env config (checked on first use) and seven feature flags for the cuttable features.
- Qloo adapter: a single interface, one URL builder using the documented GET parameter names, lenient response schemas behind one normalizer, a deterministic mock along the real I-15/I-70 corridor, a cache with in-flight de-duplication, and a stub for the real client.
- Mapbox adapter: server-side Geocoding v6 and Directions, detour estimates, simplified display geometry, a RouteMap component, and the `/dev/route` smoke page.
- `getCurrentUser()` session seam (dev guest), `/api/session`, `/api/health`.
- 56 unit tests; lint, typecheck and build are green.

## What Went Well
- **Mock-first adapters let work continue without credentials.** Phases 2–4 shipped before any account existed, and the mock is realistic enough to build the vertical slice on.
- **Testing against real services early caught real bugs:** Geocoding v6 has no `poi` type, Mapbox's actual corridor is I-15/I-70 (not I-40, as originally assumed), and the full route has ~12.8k points and needs simplifying for display.
- **Sanity-checking the mock's rankings** exposed a bad affinity model (the Vietnamese-food traveler got desert trails) before anything was built on it.
- **Screenshots from the user** found layout bugs (a zero-height map, a serif font) that the HTTP checks couldn't.
- **One error helper and one URL builder** kept security concerns (tokens, internal errors) in a single place.

## What Could Have Gone Better
- **Schedule:** M0 took six calendar days instead of two, mostly waiting on account setup (Mapbox, Vercel, the Qloo key). M1 (due Oct 12) has not started, so we are about five days behind.
- **Next.js 16 surprises** cost time: `LayoutProps` needs `next typegen`, `cacheComponents` prerenders route handlers (internal bail-out errors must be rethrown), `middleware` is now `proxy`, and dynamic work needs `connection()`.
- **The shadcn init left a self-referencing `--font-sans` variable,** which shipped a serif font until the user noticed.
- **Two test failures were mistakes in the tests** (a great-circle arc in a 2-point test line, then wrong arithmetic), not in the code. Expected values should be computed carefully, not guessed.
- **The design assumed a hosted Supabase project in M0.** The user preferred local Supabase, so 6.3 and 1.4 moved.

## Lessons Learned
- Read the bundled `node_modules/next/dist/docs` before writing Next-specific code. This version of Next differs from older patterns.
- Treat third-party response shapes as unknown until observed: keep schemas loose and normalize in one place.
- Look at the output, not just status codes. Ranking printouts and screenshots caught issues that tests passed over.
- Account setup is on the user's critical path. Batch every credential request early, with exact click-paths.
- Keep free-tier boundaries explicit (Vercel Hobby with no card, Mapbox free tier, local Supabase). The LLM is the only expected cost.

## Action Items
- **v0.2.0 starts with the Qloo spike (209)** using the real key. Record findings in `docs/qloo-findings.md` and save real responses as mock fixtures.
- **Then build the ugly vertical slice (201–208) immediately,** before persistence. Don't let infrastructure come first again.
- **212:** wire Supabase anonymous sessions against local Supabase (`supabase start`), using Next 16 `proxy`; create a hosted project only when persistence needs to ship.
- **Fix the latent RouteMap race** (fit bounds when the route arrives after the map loads) when the map is next touched.
- **Restrict the public Mapbox token** to localhost and the Vercel URLs before submission.
- **Set an Anthropic spend cap** before the first agent call (v0.3.0).
