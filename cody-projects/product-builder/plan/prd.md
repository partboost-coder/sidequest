# Product Requirements Document (PRD)
This document formalizes the idea and defines the what and the why of the product the USER is building.

## Section Explanations
| Section           | Overview |
|-------------------|--------------------------|
| Summary           | Sets the high-level context for the product. |
| Goals             | Articulates the product's purpose — core to the "why". |
| Target Users      | Clarifies the audience, essential for shaping features and priorities. |
| Key Features      | Describes what needs to be built to meet the goals — part of the "what". |
| Success Criteria  | Defines what outcomes validate the goals. |
| Out of Scope      | Prevents scope creep and sets boundaries. |
| User Stories      | High-level stories keep focus on user needs (why) and guide what to build. |
| Assumptions       | Makes the context and unknowns explicit — essential for product clarity. |
| Dependencies      | Identifies blockers and critical integrations — valuable for planning dependencies and realism. |

## Summary
_A 1–2 sentence high-level description of the product or feature._

Sidequest is an agentic road-trip companion that uses Qloo's Taste AI to plan multi-day US road trips around the individual and shared tastes of everyone in the car, then surfaces unexpected, unusually well-matched "Side Quests" along the way. It answers not "what's along the way?" but "what's along the way that **we** would actually love?" — *The road trip built around your taste.*

## Goals
_What are we trying to achieve? List the key objectives or outcomes._

- **Win (or place in) the Qloo Agentic Hackathon** by Oct 30, 2026, scoring strongly on all four equally weighted criteria: Technological Implementation, Design, Potential Impact, Quality of the Idea.
- **Make Qloo fundamental, not decorative.** Every recommendation is chosen and scored by Qloo signals and traceable to traveler tastes; removing Qloo materially breaks the product.
- **Model groups honestly.** Preserve each traveler's taste profile and plan for group fit, individual delight, overlap, and fairness — never a single averaged profile.
- **Deliver the "never would have found this, but it's exactly us" feeling** through explainable recommendations and the Side Quest mechanic.
- **Make agentic behavior visible and real** — planning, querying taste intelligence, evaluating alternatives, reacting to trip state, replanning — shown as concise user-facing activity.
- **Be demonstrable in 60–90 seconds** with no login and no dead ends, while also letting judges plan their own live trip.
- **Lay a foundation, not a throwaway.** A user-owned, guest-first data model and modular services that can grow into the social, gamified travel platform post-hackathon.

## Target Users
_Who is this for? Briefly describe the audience._

**Primary:** Groups of 1–4 people taking multi-day (2–6 day) US road trips — friends, couples, families — whose tastes overlap in some areas and diverge in others, and who want the drive itself to be part of the adventure rather than dead time between destinations.

**Hackathon audience:** Qloo/Devpost judges and sponsors who will evaluate either a hands-on session with the live app (likely brief) or the text description, screenshots, and optional video. They need to grasp the differentiation within ~30 seconds.

**Today's alternatives:** Google Maps "search along route," Yelp/TripAdvisor, Roadtrippers, TikTok/Instagram saves, and generic ChatGPT-style itineraries. These find what is *near* the route or what is generally popular — not what fits these specific people, and none reason about a group with differing tastes.

## Key Features
_What core features are required to meet the goals?_

Priority legend: **P0** = never cut (core product and hackathon story). **P1** = in MVP, cut in the stated order if behind. Cut order: auth UI → public recap → conversational replanning → hotel entities → photo upload → XP levels/titles → advanced editing.

### 1. Home & entry paths (P0)
- Landing screen that communicates the promise and the Maps-vs-Sidequest distinction in seconds.
- **Try the demo trip:** instantly loads Anaheim, CA → Denver, CO (4 days) with two preconfigured travelers. It is a persisted trip produced by the real pipeline (not a separate hardcoded experience), with its agent activity log replayed quickly.
- **Plan your own trip:** runs the live onboarding → agent planning pipeline.

### 2. "Teach us your vibe" onboarding (P0)
- 1–4 travelers, all entered by one person. No invites or traveler accounts.
- Per traveler: name (+ avatar color/emoji); **3–5 cross-domain favorites** via Qloo `/search` autocomplete (artists, movies, restaurants, brands, destinations, TV, books…) — weighted most heavily; **Qloo-inferred taste cards** to confirm/dismiss; ~8 broad visual vibe cards (Food, Coffee, Outdoors, Art, Music, Cars, Vintage, Nightlife); optional "Anything else you're into?" free text mapped to Qloo tags by the LLM.
- Target: under 60–90 seconds for two travelers.

### 3. Group taste reveal (P0)
- "Your Crew's Vibe": 4–6 shared/complementary themes with icons, plus a generated sentence that celebrates both overlap and difference (e.g., "You agree on adventure and great food, but your different tastes in art, cars and music give Sidequest more ways to surprise you.").
- Shows individual traveler highlights so per-person understanding is visible.

### 4. Trip setup (P0)
- Origin, destination (US only), start date, 2–6 days, preferred departure time, pace: **Relaxed** (~4–5 h/day), **Balanced** (~6–7 h/day), **Push It** (~8–10 h/day) — preferences, not hard limits.
- **Feasibility check:** if the trip can't reasonably be done in the chosen days/pace, explain why and suggest fixes (add a day, change pace) instead of generating an impossible itinerary.

### 5. Agentic planning with visible activity (P0)
- A Planner agent orchestrates deterministic tools (taste resolution, routing, corridor scan, per-traveler scoring, explanation, day planning).
- The UI streams concise, user-facing activity ("Scanning the Kingman → Flagstaff corridor… 31 places found… scoring for Alex…") — never raw or fake chain-of-thought.
- Live trip ready in roughly ≤60 seconds.

### 6. Qloo-powered corridor recommendations & group scoring (P0)
- Route is buffered into corridor polygons; Qloo returns taste-matched places inside them.
- Each candidate is scored **per traveler** using that traveler's own signals; group score combines **group fit** (soft-min), **individual delight** (max), **overlap** (multiple travelers' tastes driving the match), and **trip-level fairness/variety** (no traveler left without wins; category and geographic variety).
- **"Your Vibe %"** is a calibrated, explainable transform of Qloo affinities.

### 7. Itinerary: map + day-by-day timeline (P0)
- Overnight towns chosen by taste-match density, hotel quality, drive time and next-day setup — not equal splits.
- ~3–5 stops/day, flexible, mixing coffee/breakfast, lunch/dinner, scenic/outdoor, attraction/activity, local discovery, and overnight town. **Quality floor** over slot-filling; quiet stretches are explicitly framed.
- Each stop shows: Your Vibe %, per-traveler affinity where useful, added detour time, "Why Sidequest picked this" (grounded in Qloo explainability + traveler tastes), and which traveler(s) it especially delights.
- Synchronized map (route, stops, overnight towns) and scannable timeline.

### 8. Lightweight hotels (P1, cut #4)
- One or a few taste-matched places to stay per overnight town. No booking, pricing, or availability. If cut, keep overnight towns with basic lodging context.

### 9. Itinerary editing (P1)
- Remove a stop; swap a stop for an alternate recommendation (P0-adjacent basic controls).
- Regenerate a day; advanced editing (cut #7).

### 10. Conversational replanning (P1, cut #3)
- A constrained input on the trip screen ("Make day 2 more outdoorsy," "We're tired — get us to the hotel earlier," "Find us something weird instead of another restaurant," "Alex hasn't gotten anything she really loves yet").
- The agent interprets the request against traveler profiles and trip state, re-queries Qloo when appropriate, edits only the affected part, and highlights what changed. Not a general travel chatbot; off-topic requests are politely declined.

### 11. Simulate Drive (P0)
- A polished demo/product mode: the car animates along the route; current location, next destination, ETA and day progress update; playback speed controls and **skip ahead**.
- Real GPS is post-MVP.

### 12. Scout agent & Side Quests (P0)
- The Scout monitors trip progress and evaluates **unused** high-scoring candidates near the upcoming route; it fires when a candidate is unusually strong relative to its local corridor baseline and the detour is reasonable.
- **SIDE QUEST AVAILABLE** card: playful name (e.g., "The Taco Detour"), place, match %, per-traveler fit, why it matches, detour time, XP reward; **Accept** or **Skip**.
- On accept, the simulation reroutes toward the stop; **jump to arrival** is available.
- Complete: add photo (or choose a sample photo), quick reaction/rating, earn XP.

### 13. Journal, XP & recap (P0 basic journal; P1 extras)
- Check-ins for planned stops and Side Quests: photo, 1–5 rating or emoji reaction, one-line note — appended to a trip journal timeline immediately.
- Simple XP per check-in (scaled by match strength and detour; Side Quest bonus) and trip total. Light levels/titles (cut #6).
- Private trip recap card (P0). **Public read-only shareable recap page** (P1, cut #2).
- Photo upload (P1, cut #5) — sample-photo completion always available.

### 14. Guest-first identity (P0 data model; P1 auth UI)
- Everything works without an account via anonymous guest sessions.
- All data is user-owned from day one so guest trips can be claimed by an account later.
- Optional "Save your adventure" sign-in offered only after the experience (cut #1). Auth never blocks the demo.

## Success Criteria
_How do we know it worked?_

1. A judge goes from opening Sidequest to completing a Side Quest in the demo trip in **≤90 seconds**, with no login and no dead ends.
2. **Plan Your Own Trip** generates a believable, explained US road trip in **roughly ≤60 seconds** while visibly showing the agent working.
3. **Qloo is fundamental:** every recommendation is traceable to real Qloo signals (affinities, explainability) and traveler tastes; removing Qloo materially breaks the product.
4. The demo contains at least one memorable **"I never would have found this, but it's exactly our kind of place"** moment.
5. **Stability beats feature count:** the live app stays up and within API budgets through Nov 16, 2026; no broken core path on judging day.
6. A judge understands within **~30 seconds** why Sidequest is fundamentally different from Google Maps, Yelp, or a generic AI itinerary generator.
7. The demo visibly shows Sidequest understands **multiple travelers independently** (per-traveler scores, "especially for Alex," fairness across the trip).
8. Sidequest visibly demonstrates **agentic behavior** — planning, querying taste intelligence, evaluating alternatives, reacting to trip state, and replanning — as concise activity, never fake chain-of-thought.
9. Submission is complete before the deadline: live URL, public repo with detectable open-source license, description, screenshots, and (optional) video.

## Out of Scope (Optional)
_What won't be included in the first version?_

- Social feeds, followers/friends, DMs, public creator profiles
- Complex leaderboards, large achievement systems
- Native iOS/Android apps (responsive web only)
- Hotel/flight booking, pricing engines, availability, payments
- Turn-by-turn navigation; real-GPS trip tracking (post-MVP)
- A proprietary travel/places database (Qloo is the place source; Mapbox only for routing/geocoding/maps)
- Non-US trips; trips outside 2–6 days
- Separate traveler accounts, invites, or collaborative onboarding
- General-purpose travel chatbot
- Meaningful new features during Oct 27–29

## User Stories (Optional)
_What does the user want to accomplish? Keep these high-level to focus on user goals, not implementation details._

- As a **judge**, I want to try a polished demo trip instantly without signing up, so I can understand Sidequest in about a minute.
- As a **judge**, I want to plan a trip with my own route and tastes, so I can verify the recommendations are real and not hardcoded.
- As a **traveler**, I want to teach Sidequest my vibe by naming a few things I love, so I don't have to fill out a long survey.
- As a **group organizer**, I want to see what my crew shares and where we differ, so I trust Sidequest understands each of us.
- As a **group**, we want a realistic multi-day plan with great overnight towns and stops that suit us, so the drive becomes part of the adventure.
- As a **traveler**, I want to know why each place was picked and who it's especially for, so I can trust the recommendations.
- As a **group**, we want everyone to get moments they love across the trip, so no one feels like a passenger to someone else's taste.
- As a **traveler**, I want to tweak the plan by removing, swapping, or just asking in plain words, so the trip adapts to how we feel.
- As a **traveler on the road**, I want Sidequest to surprise us with an unusually good nearby find, so we discover places we'd never have found.
- As a **traveler**, I want to capture a photo and reaction when we finish a stop and earn XP, so the trip becomes a story we can look back on.
- As a **traveler**, I want to share a recap of our trip, so friends can see what we discovered.
- As a **guest**, I want to optionally save my adventure to an account after trying it, without losing anything I've done.

## Assumptions
_What are we assuming to be true when building this?_

- A Qloo hackathon API key will arrive within days of requesting it; until then a mock adapter with the same interface unblocks development.
- Qloo's place coverage along common US interstate corridors is rich enough to produce 3–5 quality stops per day for typical routes; sparse stretches are acceptable and framed honestly.
- Qloo `/search` can resolve a meaningful share of typed favorites across domains to entity IDs.
- Documented-but-unconfirmed-on-hackathon-host behavior (polygon `filter.location`, `feature.explainability`, `output.heatmap`, `filter.entities` scoring) works; if not, documented fallbacks (point+radius sampling, LLM-composed explanations from per-traveler scores and entity tags, place-count density) are acceptable.
- Hackathon rate limits/quotas are sufficient with aggressive caching; increases can be requested via Qloo Discord.
- Judges will use a modern desktop or mobile browser; sessions are short.
- Sample photos are acceptable for demo completions.
- One builder working ~25–30 h/week with AI coding agents can deliver the P0 scope plus most P1 scope by Oct 26.

## Dependencies
_What systems, tools, or teams does this depend on?_

- **Qloo Hackathon API** (`https://hackathon.api.qloo.com`): `/v2/insights` (GET), `/search`, `/v2/tags`, Entity Data APIs — key issued manually by Qloo (critical path).
- **Mapbox:** Directions API (routing, drive times, detours), Geocoding/Search (origin/destination autocomplete), GL JS (map rendering).
- **Anthropic Claude API** (via Vercel AI SDK): agent orchestration, tag mapping, taste reveal copy, explanations, replanning interpretation.
- **Supabase:** Postgres, anonymous auth (+ optional email magic link), Storage for photos.
- **Vercel:** hosting and deployment of the Next.js app; must remain live through Nov 16, 2026.
- **GitHub:** public repository with a detectable open-source license (MIT).
- **Devpost:** submission platform; Qloo Discord #api-help for API support.
