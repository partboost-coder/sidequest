# Discovery
This document captures the raw, unfiltered idea or initial AI prompt that sparked the project.

## Starting Prompt

> I want to create Sidequest, an AI-powered road-trip companion that builds personalized adventures around the tastes of the people traveling together.
>
> Sidequest's core promise is: **"The road trip built around your taste."**
>
> The product should make travelers say: "I never would have found this place, but this is exactly our kind of place."
>
> This project is initially being built for the Qloo Agentic Hackathon, with a submission deadline of October 30, 2026. The hackathon MVP should be tightly scoped and demonstrate a compelling, meaningful use of Qloo's Taste AI rather than being a generic AI itinerary generator with Qloo added on.
>
> **Core experience.** A user creates a road trip by entering origin, destination, trip dates or available travel time, travel companions, and interests/tastes for each traveler. Interests should be able to span categories such as food, restaurants, music, movies, brands, activities, destinations, art, outdoors, etc. Sidequest uses Qloo's API/Taste AI to create a taste profile for the travelers and identify where their tastes overlap. The app then considers the road-trip route and recommends places and experiences along or near that route specifically because they match the group's taste.
>
> The key distinction is: Google Maps answers "What's along the way?" Sidequest answers "What's along the way that WE would actually love?"
>
> Recommendations should ideally include explainability so the traveler can understand why a place matches them. Example:
> *94% Your Vibe — Desert restaurant outside Joshua Tree — Why Sidequest picked it: Your group's love of Mexican food, indie music, and outdoor destinations makes this an unusually strong match. +18 min detour.*
>
> **Signature feature: Side Quests.** The memorable product mechanic is an optional Side Quest. While viewing or taking a trip, Sidequest can surface unusually good discoveries near the route. Example:
> *SIDE QUEST AVAILABLE — 🌮 The Taco Detour — You're 11 minutes away from a place unusually aligned with your crew's taste. Match: 96% · Detour: +11 min · Reward: +150 XP — [Accept Side Quest]*
> The traveler can accept or skip it. After completing a Side Quest, they can add a photo and quick reaction/rating. The experience becomes part of their trip journal and awards XP.
>
> **Hackathon MVP.** One excellent end-to-end experience: Taste onboarding → Create trip → Qloo-powered group taste profile → Route → Personalized recommendations → AI-generated itinerary → Side Quest discovery → Accept/skip quest → Complete quest → lightweight trip journal + XP. Authentication and saved trips can be included if straightforward.
>
> **Explicitly out of scope for the hackathon:** social feeds, followers/friends, DMs, public creator profiles, complex leaderboards, large achievement systems, native iOS/Android apps, hotel or flight booking, payments, turn-by-turn navigation, a giant proprietary travel database.
>
> **Long-term vision.** Sidequest can eventually evolve into a social, gamified travel platform where people discover places, complete quests, document trips, earn achievements, share discoveries, and travel with friends. However, architecture should not sacrifice the hackathon MVP in an attempt to build the future platform now.
>
> **Demo scenario.** Two travelers drive Anaheim, CA → Denver, CO over four days. Traveler 1 likes Vietnamese food, Mexican food, cars, scenic drives, outdoor destinations. Traveler 2 likes art, coffee, vintage stores, hiking, indie music. Sidequest identifies where their tastes overlap and creates a road trip with places likely to appeal to both. During the trip, Sidequest discovers an unexpected place near the route with an unusually high taste match. SIDE QUEST AVAILABLE. They accept, visit, add a photo, complete the quest, receive XP, and the experience is added to their trip journal. The demo should make the concept understandable within roughly 60–90 seconds.
>
> **Product priorities (in order):** 1. Meaningful Qloo integration · 2. Excellent recommendation quality · 3. Group taste matching · 4. Delightful Side Quest mechanic · 5. Beautiful, polished consumer UI · 6. Reliable route/map experience · 7. AI assistance where it materially improves the experience · 8. Lightweight journal/gamification · 9. Extensible architecture for post-hackathon development.
>
> Challenge assumptions, identify missing product decisions, and help scope the smallest polished implementation that convincingly demonstrates Sidequest's core idea before the October 30 deadline.

## Questions

**AGENT Q1:** Who is building this and with what? Team size and weekly hours; preferred stack (Next.js, Supabase, Mapbox/Google, LLM); and do you have a Qloo hackathon API key and know its endpoints/limits?
*(Agent also flagged up front: free-text interests must be resolved into Qloo entities/tags; "during the trip" Side Quests need a simulated location for a 60–90s demo; the "94%" score must be honestly derived; Qloo must decide **what** is recommended and the LLM only explain/sequence it.)*
**USER A1:** Solo, using AI coding agents heavily, ~25–30 focused hours/week until Oct 30. Strongest stack is Next.js + TypeScript + Tailwind; has used Prisma and Stripe; open to recommendations for database/backend, maps (Mapbox vs Google), and LLM — optimize for fastest development, polished consumer UI, reliable maps/routing, easy deployment, low cost, and an architecture that won't be thrown away. No Qloo key yet; endpoints not yet explored. Investigate Qloo's actual hackathon API before locking architecture, and design the taste system around what Qloo really provides. Reference: Qloo LLM Hackathon Developer Guide.

*Agent research findings (Qloo docs):* hackathon base URL `https://hackathon.api.qloo.com`, `X-Api-Key` header, keys issued manually within a few business days. Endpoints: `/v2/insights`, `/search`, `/v2/tags`, Entity Data APIs (`/recommendations` is legacy/unsupported). Entity types include `urn:entity:place`, `artist`, `movie`, `brand`, `destination`, `tv_show`, `book`, `podcast`, `video_game`, `person`. Place queries support `filter.location` (WKT POINT/POLYGON/MULTIPOLYGON, lon-first) with `filter.location.radius`, `filter.popularity`, `filter.price_level`, `filter.hours`, external rating filters, `filter.entities` (affinity of a fixed candidate set), `diversify.by`, `feature.explainability` (per-result contribution of input entities, 0–1), `output.heatmap` (by geohash or locality), `bias.trends`, `signal.interests.entities`/`.tags` with global weights. `query.affinity` is normalized 0–1. Agent proposed: corridor polygons for "along the way," per-traveler scoring for an honest group score, explainability-grounded "why," and stack: Next.js/Tailwind/shadcn/Framer Motion on Vercel, Mapbox + Turf, Supabase, Claude via an LLM SDK.

**AGENT Q2:** Do you have the official rules/judging criteria — does "Agentic" require an agent architecture?
**USER A2:** https://qloo.devpost.com
*Agent research findings (Devpost rules):* Qloo Agentic Hackathon, deadline **Oct 30, 2026, 11:45 PM EDT**. Theme "Agents, but with taste." Project must (a) be an agentic tool, (b) be built with an agent framework, or (c) wire Qloo into an existing agent. Submissions that work identically without Qloo do not qualify. Requires a functional, publicly accessible demo; public repo with a detectable open-source license; text description; video optional. Judges may judge on description/images/video alone. App must remain free and available through the judging period ending **Nov 16, 2026**. Private apps must supply test credentials. Four equally weighted criteria: Technological Implementation, Design, Potential Impact, Quality of the Idea. Qloo must be integrated after Sept 30, 2026.

**AGENT Q3:** How should judges experience the trip? Proposed: a "Try the demo trip" path (precomputed Anaheim → Denver) and a "Plan your own trip" path (live agent); a "Simulate Drive" mode in which the Scout surfaces a Side Quest; US-only, 2–6 day trips.
**USER A3:** Yes — simulated driving is the primary way judges experience Side Quests. Two-path home screen: (1) Try the demo trip — extremely fast and polished, ideal experience; (2) Plan your own trip — real live Qloo/agent pipeline so judges can verify it isn't hardcoded. Simulate Drive must feel like a real product feature/demo mode, not a dev harness: car progresses along route, current location/next destination update, Scout interrupts with SIDE QUEST AVAILABLE; judge inspects why it matches, detour time, XP; accepts or skips. On accept, simulation branches toward the stop, can accelerate/skip to arrival; complete with sample photo option, reaction/rating, XP, and immediately see it in the journal. Real GPS optional/post-MVP. US-only, 2–6 days is right. The demo may be precomputed/cached but must be genuine output of the same Qloo-powered system — not a separate fake experience. Preserve skip-ahead; open → completed Side Quest in ~60–90 seconds.

**AGENT Q4:** How should taste onboarding work? Proposed: one person enters everyone; 2–4 travelers; category chips with sub-chips; up to 3 favorites via Qloo `/search`; free-text escape hatch; a group taste reveal.
**USER A4:** Don't make it a survey with tons of chips — it should feel like "teach Sidequest your vibe" and let Qloo do the heavy lifting. One person enters everyone; support 1–4 travelers (solo works). Per traveler: name; a handful of broad interests visually; some specific tastes (Vietnamese food, hiking, vintage, indie music, scenic drives); most importantly 3–5 specific loved things via Qloo autocomplete across domains (artists, movies, restaurants, brands, destinations) — these carry meaningful weight; optional "Anything else you're into?" free text. A group taste reveal ("Your Crew's Vibe" + a generated sentence) before trip generation. Treat differences as useful, not just intersection — a great stop can strongly satisfy Traveler A in one dimension and B in another. Don't average everyone into one generic profile: preserve individual profiles and score for group fit, individual delight, overlap, and variety/fairness across the trip. Onboarding under 60–90s for two travelers; demo travelers preconfigured.

**AGENT Q5:** What should the itinerary look like? Proposed: origin/destination/start date/days; suggested overnight towns; 3–5 mixed stops/day; optional taste-matched hotels; editing (swap/remove/regenerate) and possibly conversational edits.
**USER A5:** It must feel like a real road-trip plan, not a list of stops. Inputs: origin, destination, start date, 2–6 days, preferred departure time, pace (Relaxed ~4–5h/day, Balanced ~6–7h, Push It ~8–10h) as preferences, not rigid limits. If the trip is unrealistic, say so rather than generating something impossible. Don't split days equally — the Planner weighs good overnight towns, concentration of high-quality matches, worthwhile experiences, and total drive time. ~3–5 stops/day, flexible, mixing coffee/breakfast, lunch/dinner, scenic/outdoor, attraction/activity, local discovery, overnight town/hotel. Hotels in MVP but lightweight: one or a few taste-matched places to stay, no booking/pricing/availability. Every stop shows group "Your Vibe" score, individual affinities where useful, detour time, "Why Sidequest picked this," and which traveler(s) it especially matches. Planned stops are conceptually separate from Side Quests (unexpected, surfaced by the Scout during the journey). Editing: remove, swap, regenerate a day, plus one constrained conversational replanning feature ("Make day 2 more outdoorsy," "We're tired, get us to the hotel earlier," "Find us something weird instead of another restaurant," "Alex hasn't gotten anything she really loves yet") that uses existing profiles and trip state, re-queries Qloo when appropriate, and modifies only the affected part — not a general travel chatbot. Show both a map and a day-by-day timeline. Optimize for trip quality, not filling slots.

**AGENT Q6:** Accounts, saved trips, journal and XP: no login (anonymous trips + shareable URL)? Journal entries for Side Quests only or planned stops too? Simple XP? Shareable public recap?
**USER A6:** No login, journal both, simple XP, shareable recap yes.

**AGENT Q7:** Confirm success criteria, schedule (features Oct 6–26, polish Oct 27–29), and cut order.
**USER A7:** Agreed with changes. **Guest-first, not account-less:** the whole demo and Plan Your Own Trip must work without an account, but the data model is user-owned from day one (anonymous/guest sessions) so guest data can later be claimed by an account; optional "Save your adventure" sign-in after the experience, if straightforward; auth must never block the demo. Keep success criteria 1–5 and add: (6) a judge understands within ~30s why Sidequest differs from Google Maps, Yelp, or generic AI itinerary generators; (7) the demo visibly shows that travelers are understood independently, not collapsed into an averaged profile; (8) visible agentic behavior — planning, querying taste intelligence, evaluating alternatives, reacting to trip state, replanning — shown as concise user-facing activity, never fake chain-of-thought. Oct 27–29 reserved almost entirely for polish, reliability, rehearsal, deployment hardening, submission materials, and bug fixes — no meaningful new features. Don't "test" what Qloo's docs already settle (e.g. `/v2/insights` is GET-only on the hackathon host); test only undocumented/uncertain behavior. Cut order: 1) auth UI, 2) public recap page, 3) conversational replanning, 4) hotels as taste-matched entities, 5) photo upload, 6) fancy XP levels/titles, 7) advanced itinerary editing. Never cut: Qloo onboarding/entity resolution, individual profiles, group scoring, real route/corridor planning, Qloo recommendations, explainability, map + itinerary, demo trip, Simulate Drive, Scout, Side Quest loop, basic journal, Plan Your Own Trip. Build a vertical slice as early as possible — the ugliest complete loop first — and mock the Qloo adapter behind the exact expected interface if the key is delayed.

**USER (approval):** Summary approved; write Discovery, PRD, and Plan.

## Discovery Summary

**What it is.** Sidequest is an agentic, Qloo-powered road-trip companion for groups of 1–4 travelers. Promise: *"The road trip built around your taste."* Google Maps answers "what's along the way?" — Sidequest answers "what's along the way that **we** would actually love?" The target emotional outcome: *"I never would have found this place, but this is exactly our kind of place."*

**Context.** Built solo (with AI coding agents) for the **Qloo Agentic Hackathon** — deadline Oct 30, 2026, 11:45 PM EDT; judged equally on Technological Implementation, Design, Potential Impact, and Quality of the Idea. It must be agentic, must depend fundamentally on Qloo, must have a live public demo available free through Nov 16, and a public repo with an open-source license. Roughly 90–100 build hours.

**Who it's for / problem.** Friends, couples, and families on US road trips whose tastes differ. Today they stitch together Google Maps, Yelp, TikTok, and generic AI itineraries, which find what's *near* them — not what fits *them*, and never what fits the whole group.

**Core loop (never cut).** Vibe onboarding → group taste reveal → route + corridor scan → Qloo recommendations scored per traveler → planned itinerary (map + timeline) → Simulate Drive → Scout surfaces a Side Quest → accept/skip → arrive → complete (photo/rating) → journal + XP.

**Key product decisions.**
- Two front-door paths: **Try the demo trip** (Anaheim → Denver, 4 days, 2 preconfigured travelers; persisted output of the same live pipeline, replayed fast) and **Plan your own trip** (live agent with concise visible activity).
- **Onboarding** is favorites-first: name → 3–5 cross-domain favorites via Qloo `/search` (heaviest weight) → Qloo-inferred taste cards to confirm → ~8 broad vibe cards → optional free text. Under 90s for two travelers.
- **Group scoring** preserves individual profiles: per-traveler Qloo affinity per candidate, combined into group fit, individual delight, overlap, and trip-level fairness/variety. Differences are opportunities. "Your Vibe %" is calibrated and explainable, shown with per-traveler scores.
- **Itinerary** is a real multi-day plan: pace-aware, overnight towns chosen by taste density + drive time (not equal splits), feasibility warnings, quality floor over slot-filling, lightweight taste-matched hotels.
- **Planned stops ≠ Side Quests.** The Scout surfaces unusually strong *unused* candidates during the (simulated) drive.
- **Editing:** remove, swap, regenerate day, plus constrained conversational replanning that touches only the affected part.
- **Simulate Drive** is a first-class product mode with skip-ahead and jump-to-arrival; real GPS is post-MVP.
- **Guest-first, account-ready** data model; optional "Save your adventure" sign-in.
- **Journal + XP:** check-ins for planned stops and Side Quests, simple XP, private recap, public read-only recap page.

**Success criteria.** (1) Demo → completed Side Quest in ≤90s, no login, no dead ends. (2) Live trip in ≲60s with visible agent activity. (3) Qloo is fundamental and traceable. (4) At least one memorable "never would have found this" moment. (5) Stability over feature count. (6) Differentiation from Maps/Yelp/AI itineraries clear within ~30s. (7) Visible per-traveler understanding. (8) Visible, honest agentic behavior.

**Process.** Vertical slice first (ugliest complete loop ASAP, mock Qloo adapter if the key is late); features Oct 6–26; Oct 27–29 polish and submission only. Cut order: auth UI → public recap → conversational replanning → hotel entities → photo upload → XP levels/titles → advanced editing.

**Out of scope.** Social feeds, followers, DMs, creator profiles, leaderboards, achievement systems, native apps, booking, payments, turn-by-turn navigation, a proprietary places database, non-US trips.

**Top risks.** Qloo key timing; uncertain hackathon-host support for polygon location filters, explainability, and heatmaps; entity/tag resolution quality; sparse Qloo coverage in rural corridors; live-path latency; scope vs. ~95 hours; cost/stability through Nov 16.
