import type { Contribution, InsightsResult, QlooEntity, QlooTag, RawEntity, RawTag } from "./types";
import { rawInsightsResponseSchema, rawSearchResponseSchema, rawTagsResponseSchema } from "./types";

/**
 * Raw Qloo JSON → normalized types. This is the only module that knows Qloo's response shape.
 * The shape is unconfirmed until spike S1–S8, so parsing is tolerant.
 */

export function normalizeTag(raw: RawTag): QlooTag | undefined {
  const id = raw.tag_id ?? raw.id;
  if (!id) return undefined;
  return { id, name: raw.name ?? id, type: raw.type ?? raw.subtype };
}

/**
 * Explainability format is undocumented in detail. Accepts either
 * `{ "signal.interests.entities": [{ entity_id, score }], "signal.interests.tags": [{ tag_id, score }] }`
 * or a flat array of `{ id | entity_id | tag_id, score }`.
 */
export function parseContributions(raw: unknown): Contribution[] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Contribution[] = [];
  const push = (item: unknown, kind: Contribution["kind"]) => {
    if (!item || typeof item !== "object") return;
    const r = item as Record<string, unknown>;
    const id = (r.entity_id ?? r.tag_id ?? r.id) as string | undefined;
    const score = typeof r.score === "number" ? r.score : undefined;
    if (id && score !== undefined) {
      out.push({ signalId: id, kind: r.tag_id ? "tag" : kind, score });
    }
  };
  if (Array.isArray(raw)) {
    raw.forEach((item) => push(item, "entity"));
  } else {
    const obj = raw as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (!Array.isArray(value)) continue;
      const kind = key.includes("tags") ? "tag" : "entity";
      value.forEach((item) => push(item, kind));
    }
  }
  return out.length > 0 ? out.sort((a, b) => b.score - a.score) : undefined;
}

export function normalizeEntity(raw: RawEntity): QlooEntity {
  const p = raw.properties ?? {};
  const lat = raw.location?.lat;
  const lon = raw.location?.lon;
  const types = raw.types ?? (raw.type ? [raw.type] : []);
  return {
    id: raw.entity_id,
    name: raw.name,
    types,
    subtype: raw.subtype,
    popularity: raw.popularity,
    location: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
    address: p.address,
    city: p.geocode?.city ?? p.geocode?.name,
    region: p.geocode?.admin1_region,
    countryCode: p.geocode?.country_code,
    businessRating: p.business_rating,
    priceLevel: p.price_level,
    imageUrl: p.image?.url ?? p.images?.[0]?.url,
    hours: p.hours,
    tags: (raw.tags ?? []).map(normalizeTag).filter((t): t is QlooTag => t !== undefined),
    affinity: raw.query?.affinity,
    contributions: parseContributions(raw.query?.explainability),
    mock: (raw as Record<string, unknown>).mock === true ? true : undefined,
  };
}

export function normalizeInsightsResponse(json: unknown): InsightsResult {
  const parsed = rawInsightsResponseSchema.parse(json);
  return {
    entities: (parsed.results?.entities ?? []).map(normalizeEntity),
    durationMs: parsed.duration,
  };
}

export function normalizeSearchResponse(json: unknown): QlooEntity[] {
  const parsed = rawSearchResponseSchema.parse(json);
  return (parsed.results ?? []).map(normalizeEntity);
}

export function normalizeTagsResponse(json: unknown): QlooTag[] {
  const parsed = rawTagsResponseSchema.parse(json);
  const list = Array.isArray(parsed.results) ? parsed.results : (parsed.results?.tags ?? []);
  return list.map(normalizeTag).filter((t): t is QlooTag => t !== undefined);
}
