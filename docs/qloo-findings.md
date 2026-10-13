# Qloo API Findings

Living record of what the Qloo hackathon API actually does, so Sidequest is designed around real behavior rather than assumptions.

## Access

| Item          | Value                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- |
| Base URL      | `https://hackathon.api.qloo.com` (hackathon keys don't work on staging or production hosts) |
| Auth          | `X-Api-Key` header only                                                                     |
| Key requested | _TODO: date you submitted the request form_                                                 |
| Key received  | _TODO_                                                                                      |
| Support       | Qloo Discord #api-help (ask after 3 business days without a key; also for quota increases)  |

## Documented facts (not re-tested)

- `/v2/insights` is **GET-only** on the hackathon host. All parameters go in the query string.
- Supported endpoints: `/v2/insights`, `/search`, `/v2/tags`, Entity Data APIs. `/recommendations` and `/recs` are legacy and unsupported.
- `filter.type` values: `urn:entity:{artist, book, brand, destination, movie, person, place, podcast, tv_show, video_game}`.
- WKT is longitude first: `POINT(-73.99823 40.722668)`.
- **Invalid parameters are silently ignored**, so every experiment must confirm a parameter actually changed the results.

## Rate limits (observed in response headers, 2026-10-12)

| Header                        | Value      | Meaning                                                                           |
| ----------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `x-second-ratelimit-limit`    | **5**      | 5 requests per second; exceeding it returns `{"error_msg":"Rate limit exceeded"}` |
| `x-month-ratelimit-limit`     | **10,000** | Monthly quota per key                                                             |
| `x-month-ratelimit-remaining` | e.g. 9,986 | Remaining this month; read on every response by the quota guard                   |
| `x-month-ratelimit-reset`     | ~30 days   | Resets around 2026-11-11, which is mid-judging                                    |

The HTTP status of a rate-limited response wasn't recorded (the body was `{"error_msg":"Rate limit exceeded"}`), so the client detects it by status 429 **or** that body.

**This is the binding constraint.** Throttle to ≤4 req/s, cache everything, record fixtures during development, budget calls per trip (target ≤20), cap live planning, and ask in Discord #api-help for a quota increase before judging.

## Spike results (S1–S8), 2026-10-12, ~25 calls

| #   | Question                               | Result                                                                                                                                                                                                                                                                                                                                                                                                                   | Decision                                                                                                                         |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Polygon `filter.location`; URL limits  | ✅ **Works strictly.** 30/30 results inside a 15 km corridor buffer at 16, 27, 47 and 98 vertices; URLs up to 2.4 KB fine; 0.37–0.61 s. Control with no location returned Chicago/NYC, so the filter is really applied.                                                                                                                                                                                                  | Corridor polygons are the primary approach. ~27–47 vertices per segment.                                                         |
| S2  | `feature.explainability`               | ✅ Shape: `query.explainability["signal.interests.entities"] = [{entity_id, score}]`, plus a top-level `query.explainability`. ⚠️ With 8 signals, credit is spread almost evenly (~0.14–0.17 each).                                                                                                                                                                                                                      | Explainability is a supporting signal only. "Why" comes from per-traveler scores (S4) + place tags/descriptions.                 |
| S3  | Heatmap by locality                    | ❌ `filter.type=urn:heatmap` + `output.heatmap.boundary=urn:entity:locality` → HTTP 500. Not pursued further (quota).                                                                                                                                                                                                                                                                                                    | Fallback: count top-scored candidates per town from the corridor scan.                                                           |
| S4  | `filter.entities` per-traveler scoring | ✅ **Works perfectly.** 40/40 candidates returned with that traveler's affinity, ~0.5 s. Scores differ meaningfully (roadside attraction T1 0.88 vs T2 0.75; sushi T1 0.79 vs T2 0.90).                                                                                                                                                                                                                                  | Core of group scoring confirmed: one corridor candidate query, then one scoring call per traveler.                               |
| S5  | `/search` cross-domain                 | ⚠️ Good for brands/films/artists/parks; **ambiguous for small restaurants and places** ("Pho 79" → other Garden Grove pho shops; "Marfa" → a video game first).                                                                                                                                                                                                                                                          | Autocomplete must show type + city/subtitle and let the user choose; never auto-pick. Pass `types` when the UI knows the domain. |
| S6  | Place tags; `/v2/tags` params          | ✅ Params are `filter.query`, `filter.tag.types` (plain `query` is rejected). Response `results.tags[] = {id, name, type, parents, popularity}`. Useful IDs: `urn:tag:genre:place:restaurant:{vietnamese,mexican,coffee_shop}`, `urn:tag:category:place:{coffee_shop,hiking_area}`, `urn:tag:activities:place:hiking`, `urn:tag:setting:qloo:gallery`. ⚠️ Loose tags (e.g. `decor:qloo:vintage`) match unrelated places. | Curate and validate a tag set per bucket; prefer `genre:place` / `category:place` types.                                         |
| S7  | Affinity distribution; latency         | Affinities compressed: ~0.71–0.92 in corridor results. Latency 0.15–0.85 s per call (search fastest).                                                                                                                                                                                                                                                                                                                    | Percentile calibration per trip is required. Parallelize at ≤4 req/s.                                                            |
| S8  | Taste-card tags from favorites         | ✅ `/search` results already include rich tags (e.g. Phoebe Bridgers → Indie, Folk, Indie-Folk, plus Qloo audience tags like "Introspective").                                                                                                                                                                                                                                                                           | Build taste cards from favorites' own tags (no extra calls) + tags on top insights results.                                      |

### Live client verification (2026-10-13, task 1.7)

- **`take` is capped at 50.** Requests with `take > 50` return HTTP 400 ("take must be an integer value between 1 and 50"). Scoring batches are therefore **≤ 50 IDs**.
- **50-ID `filter.entities` batch verified:** 2,012-character URL, all 50 requested IDs returned with affinities.
- **The live API returns `null` for absent fields** (e.g. `price_level`, `geocode.name`, `specialty_dishes`). The normalizer strips nulls before parsing.
- **`x-month-ratelimit-remaining` confirmed** on every response; persisted by the quota guard (9,966 remaining after verification).
- Rate-limit HTTP status: not observed yet (no natural rate limit occurred). The client handles 429 or the `error_msg` body.
- File cache re-run: 0 live calls.

### Tag validation (2026-10-13, task 2.4, 34 calls)

- Place tags come in two parallel forms: `urn:tag:category:place:<x>` and `urn:tag:genre:place[:restaurant]:<x>`. Buckets list both.
- Validated IDs live in `src/config/buckets.ts` (food, experiences, exclusions).
- No car-museum or roadside-attraction tag exists; `category:place:car_racing_track`, `scenic_spot` and `tourist_attraction` cover those interests.
- Searching with `types` fixes the disambiguation from S5: "Pho 79" (type place) → Phở 79, Westminster CA.
- Favorites' own tags are cross-domain (e.g. Wikipedia categories for brands, plot keywords for films) and rarely overlap with place tags.

### First live demo-route scan (2026-10-13, Phase 3)

- Anaheim → Denver: 7 segments (WKT ≤ 740 chars), **18 calls, ~7 s** cold; 0 calls cached.
- 211 raw results → 160 kept (9 chains dropped: Starbucks ×3, Denny's, Chili's, Dave & Buster's ×2, Barnes & Noble, Urban Outfitters).
- Most segments return a full 15 per bucket; **the San Rafael Swell segment (km 930–1163) has only 2 + 2**. That is genuinely sparse.
- **Scoring must be balanced per segment:** ranking the top 100 trip-wide gave LA/Vegas/Denver 85 of 100 slots. Per-segment selection (~14 each) surfaces rural picks such as Mystic Hot Springs, Fishlake National Forest and San Rafael Reef (Matt 90–98).
- Group fit is honestly lower on rural stretches (both travelers rarely love the same small-town place). Watch this in the 5.8 quality review.
- Oddities to tune in 5.8: `tourist_attraction` pulls in golf clubs; cocktail bars (Death & Co, Mezcla) land in the food bucket.

### Calibration finding (2026-10-13, Phase 4 preview on cached data, 0 calls)
- With **trip-wide** percentiles, only metro-area places reach high group fit: 5 Side Quest candidates with G ≥ 0.80, all near Anaheim. The Scout fired **once** (needs ≥ 2), and day 3 had 2 stops.
- Lowering thresholds only yields mediocre offers (52–53%). Blending group fit with single-traveler delight (S = wG·G + wD·D) gave 0 offers.
- **Local calibration** (percentiles among candidates within ±200 km) gives 2/4/4/4 stops per day and 2 Side Quests: Gui BBQ (86%) and **Mystic Hot Springs (84%, Matt 93, +18 min)**. ±300 km gives only 1 offer.
- Pending product decision: what "Your Vibe %" is relative to (the trip vs. the stretch of road).

### Recommendation quality findings

- **An unfiltered group query is generic:** the top results for Barstow → Las Vegas were casinos, a sky lounge and Luxor. Must query **per bucket** with curated `filter.tags`.
- **Chains appear** (Panera, Starbucks), and `popularity` is per location (Starbucks 0.25), so a popularity cap doesn't remove them. Needs **chain detection** (a name list).
- **A popularity cap hurts quality** (it excluded the Neon Museum at 1.0). Use `filter.exclude.tags` for unwanted categories (casino, hotel outside lodging) instead.
- **Place properties are rich:** `description`, `specialty_dishes`, `keywords`, `good_for`, `ambience_description`, `price_level`, `hours`, `business_rating`, `is_closed`. Excellent grounding for explanations. Filter `is_closed`.

### Response shape (confirmed)

- Insights: `{ success, results: { entities: [...] }, query: { explainability } }`.
- Entity: `name, entity_id, type, subtype, popularity, location {lat, lon, geohash}, properties {...}, tags[] {tag_id, name, type, value}, query {affinity, distance, measurements, explainability}, disambiguation, external, references`.
- Search: `{ results: [entity] }`, where entities have `types[]` (plural) instead of `type`.
- Tags: `{ duration, success, results: { tags: [{ id, name, type, parents, popularity }] } }` (`id`, not `tag_id`).

Recorded responses are in the local scratch area. **Don't commit raw Qloo responses to the public repo**; store recorded fixtures in a gitignored folder.

## Adapter assumptions (now mostly confirmed; see above)

- **Response envelope:** `{ success, results: { entities: [...] }, duration }`. Entity fields used: `entity_id`, `name`, `types`/`subtype`, `popularity`, `location.{lat,lon}`, `properties.{address, geocode, business_rating, price_level, image(s), hours}`, `tags[].{tag_id,name,type}`, `query.affinity`, `query.explainability`.
- **Explainability:** either a map of signal type → `[{ entity_id | tag_id, score }]` or a flat array. Handled in `src/adapters/qloo/normalize.ts`.
- **`/v2/tags` params:** `filter.query`, `filter.tag.types`, `take` (confirmed).
- **Search params:** `query`, `types`, `take`.

All of these live in `normalize.ts` and `params.ts`. If the real API differs, only those two files should need to change.
