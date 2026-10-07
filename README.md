# Sidequest

**The road trip built around your taste.**

Google Maps answers "what's along the way?" Sidequest answers "what's along the way that _we_ would actually love?"

Sidequest is an agentic road-trip companion for groups of 1–4 travelers. It uses [Qloo](https://www.qloo.com/)'s taste intelligence to build a profile for each traveler, scans the driving corridor for places that match the group, and plans a multi-day trip that's fair to everyone in the car. While you drive (or simulate the drive), the Scout agent surfaces **Side Quests**: unexpected nearby places that are an unusually strong match for your crew.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com) (2026).

> Status: early development (v0.1.0 foundations). Planning docs live in [`cody-projects/product-builder`](cody-projects/product-builder).

## Stack

- Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- Qloo Insights API (taste intelligence and place recommendations)
- Mapbox (maps, directions, geocoding) + Turf.js
- Supabase (Postgres, anonymous guest sessions, storage)
- Vercel AI SDK + Claude (planning, replanning, and Scout agents)
- Deployed on Vercel

## Run locally

Requires Node.js 24 (see `.nvmrc`) and pnpm.

```bash
pnpm install
cp .env.example .env.local   # fill in your keys; QLOO_MODE=mock works without a Qloo key
pnpm dev
```

Useful scripts: `pnpm check` (lint + typecheck + tests), `pnpm test`, `pnpm format`.

## License

[MIT](LICENSE)
