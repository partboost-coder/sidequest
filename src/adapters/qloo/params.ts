import type { InsightsParams, QlooWeight, SearchParams, TagsParams } from "./types";

/**
 * The only place Qloo GET query strings are built. `/v2/insights` is GET-only on the hackathon
 * host, so every parameter goes in the URL. Parameter names match Qloo's docs exactly.
 */

type Entry = [name: string, value: string];

function join(values: readonly string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(",") : undefined;
}

function weight(value: QlooWeight | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}

function num(value: number | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}

export function insightsEntries(params: InsightsParams): Entry[] {
  const { filter = {}, signal = {} } = params;
  const entries: [string, string | undefined][] = [
    ["filter.type", params.filterType],
    ["filter.location", filter.location],
    ["filter.location.radius", num(filter.locationRadiusM)],
    ["filter.location.query", filter.locationQuery],
    ["filter.tags", join(filter.tags)],
    ["filter.exclude.tags", join(filter.excludeTags)],
    ["filter.entities", join(filter.entities)],
    ["filter.exclude.entities", join(filter.excludeEntities)],
    ["filter.popularity.min", num(filter.popularityMin)],
    ["filter.popularity.max", num(filter.popularityMax)],
    ["filter.price_level.min", num(filter.priceLevelMin)],
    ["filter.price_level.max", num(filter.priceLevelMax)],
    ["filter.hours", filter.hours],
    ["signal.interests.entities", join(signal.entities)],
    ["signal.interests.entities.weight", weight(signal.entitiesWeight)],
    ["signal.interests.tags", join(signal.tags)],
    ["signal.interests.tags.weight", weight(signal.tagsWeight)],
    ["operator.signal.interests.tags", signal.tagsOperator],
    ["signal.location", signal.location],
    ["signal.location.radius", num(signal.locationRadiusM)],
    ["signal.location.weight", weight(signal.locationWeight)],
    ["feature.explainability", params.explainability ? "true" : undefined],
    ["diversify.by", params.diversify?.by],
    ["diversify.take", num(params.diversify?.take)],
    ["bias.trends", params.biasTrends],
    ["take", num(params.take)],
    ["page", num(params.page)],
    ...Object.entries(params.extra ?? {}).map(([k, v]) => [k, String(v)] as [string, string]),
  ];
  return entries.filter((e): e is Entry => e[1] !== undefined && e[1] !== "");
}

export function searchEntries(params: SearchParams): Entry[] {
  const entries: [string, string | undefined][] = [
    ["query", params.query],
    ["types", join(params.types)],
    ["take", num(params.take)],
  ];
  return entries.filter((e): e is Entry => e[1] !== undefined && e[1] !== "");
}

/** `/v2/tags` parameter names are unconfirmed; verify in spike S6 before relying on them. */
export function tagsEntries(params: TagsParams): Entry[] {
  const entries: [string, string | undefined][] = [
    ["filter.query", params.query],
    ["filter.tag.types", join(params.tagTypes)],
    ["take", num(params.take)],
  ];
  return entries.filter((e): e is Entry => e[1] !== undefined && e[1] !== "");
}

/** Encodes entries as a query string. Commas are kept literal for readability (`a,b`). */
export function encodeEntries(entries: Entry[]): string {
  return entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%2C/g, ",")}`)
    .join("&");
}

export function toQueryString(params: InsightsParams): string {
  return encodeEntries(insightsEntries(params));
}

// ---------------------------------------------------------------------------
// WKT helpers (Qloo expects longitude first)
// ---------------------------------------------------------------------------

export type LonLat = readonly [lon: number, lat: number];

const fmt = (n: number) => Number(n.toFixed(6)).toString();

export function pointWkt([lon, lat]: LonLat): string {
  return `POINT(${fmt(lon)} ${fmt(lat)})`;
}

/** Closed ring of [lon, lat] pairs. The ring is closed automatically if needed. */
export function polygonWkt(ring: readonly LonLat[]): string {
  if (ring.length < 3) throw new Error("A polygon needs at least 3 points");
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
  return `POLYGON((${closed.map(([lon, lat]) => `${fmt(lon)} ${fmt(lat)}`).join(", ")}))`;
}
