# Release Notes

This document lists new features, bug fixes and other changes implemented during a particular build (version or patch).

- [v0.1.0-foundations - 2026-10-12](#v010-foundations---2026-10-12)

---

# v0.1.0-foundations - 2026-10-12

## Overview
Foundations for Sidequest (milestone M0): a deployed Next.js app, a public MIT-licensed repo, typed configuration, and the Qloo and Mapbox adapters that the v0.2.0 vertical slice builds on. Live at https://sidequest-rust-phi.vercel.app.

## Key Features
- **App scaffold:** Next.js 16.4 (App Router), React 19, TypeScript strict, Tailwind v4, shadcn/ui, Framer Motion; Node 24.
- **Qloo adapter:** `QlooClient` interface (search, insights, tags); query strings built with documented GET parameter names; lenient response schemas with a single normalizer; deterministic `MockQlooClient` along the real Anaheim → Denver (I-15/I-70) corridor with per-traveler affinities, corridor/radius filtering, `filter.entities` scoring and simulated explainability; `CachedQlooClient` with TTL and in-flight de-duplication; `RealQlooClient` request builder (network calls arrive in v0.2.0).
- **Mapbox adapter:** server-side US Geocoding v6 and driving Directions; detour estimates and exact detours; simplified display geometry.
- **API routes:** `POST /api/route`, `GET /api/geocode`, `GET /api/session`, `GET /api/health`.
- **Route smoke page:** `/dev/route` renders Anaheim → Denver (15.9 h, 1,013 mi) on a Mapbox map, with a guest session badge.
- **Session seam:** `getCurrentUser()` with a fixed dev guest (Supabase anonymous sessions follow in v0.2.0).

## Enhancements
- Zod-validated environment config that lists every problem at once and never exposes values.
- Seven feature flags for the cuttable features, all off by default.
- Health report: config validity, Qloo mode and key presence, session mode, live Mapbox probe, LLM configuration and flags, with no secrets.
- 56 unit tests; `pnpm check` runs lint, typecheck and tests.

## Bug Fixes
- Map collapsed to zero height inside min-height containers.
- Pages rendered in a serif font because of a self-referencing `--font-sans` theme variable.
- Geocoding requests failed because v6 has no `poi` type.
- Next.js prerender bail-out signals were being caught and logged as errors in route handlers.

## Other Notes
- Hosted on Vercel Hobby (free). Preview deploys are protected by Vercel Authentication; production is public.
- Planning docs (discovery, PRD, plan, backlog) are published in `cody-projects/` as part of the public repo.
