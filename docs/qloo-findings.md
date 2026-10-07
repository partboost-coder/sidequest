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

## Spike checklist (v0.2.0, item 209)

Run with `QLOO_MODE=record` so request/response pairs are saved as fixtures for `MockQlooClient`.

| #   | Question                                                                                                               | Result    | Fallback if it fails                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| S1  | Does `filter.location` accept WKT `POLYGON` for places? What's the max vertex count before GET URL limits?             | _pending_ | Sample the route every ~40 km with `POINT` + `filter.location.radius` |
| S2  | Is `feature.explainability=true` honored? What's the exact `query.explainability` shape?                               | _pending_ | Explain from per-traveler scores + tag overlap                        |
| S3  | Does `output.heatmap` with `output.heatmap.boundary=urn:entity:locality` work for places in a polygon?                 | _pending_ | Count top-scored places per town from the corridor scan               |
| S4  | Does `filter.entities` return affinity for exactly those candidates under one traveler's signals? Max IDs per request? | _pending_ | Per-traveler signal query per segment, intersected with the pool      |
| S5  | How well does `/search` resolve across domains? Which response fields matter for autocomplete?                         | _pending_ | Filter by type; LLM picks from the top 5                              |
| S6  | Which place tags exist for our buckets? What are the real `/v2/tags` parameter names?                                  | _pending_ | Entity signals only; bucket results by returned tags                  |
| S7  | Real `query.affinity` distribution; p50/p95 latency at 6 concurrent requests                                           | _pending_ | Sets calibration constants and concurrency                            |
| S8  | Can taste-card tags be aggregated from Insights results for a traveler's favorites?                                    | _pending_ | LLM proposes tags, validated against `/v2/tags`                       |

## Assumptions baked into the adapter (verify in the spike)

- **Response envelope:** `{ success, results: { entities: [...] }, duration }`. Entity fields used: `entity_id`, `name`, `types`/`subtype`, `popularity`, `location.{lat,lon}`, `properties.{address, geocode, business_rating, price_level, image(s), hours}`, `tags[].{tag_id,name,type}`, `query.affinity`, `query.explainability`.
- **Explainability:** either a map of signal type → `[{ entity_id | tag_id, score }]` or a flat array. Handled in `src/adapters/qloo/normalize.ts`.
- **`/v2/tags` params:** `filter.query`, `filter.tag.types`, `take` (unconfirmed).
- **Search params:** `query`, `types`, `take`.

All of these live in `normalize.ts` and `params.ts`. If the real API differs, only those two files should need to change.
