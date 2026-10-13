import {
  booleanPointInPolygon,
  distance,
  lineString,
  multiPolygon,
  point,
  pointToLineDistance,
  polygon,
} from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

import type { QlooClient, RequestOptions } from "./client";
import { QlooError } from "./client";
import { MOCK_ENTITIES, MOCK_ENTITY_BY_ID, type MockSearchEntity } from "./fixtures/entities";
import { MOCK_PLACES, type MockPlace } from "./fixtures/places";
import { MOCK_TAG_LIST, MOCK_TAGS, type MockTagKey } from "./fixtures/tags";
import {
  normalizeInsightsResponse,
  normalizeSearchResponse,
  normalizeTagsResponse,
} from "./normalize";
import type {
  InsightsParams,
  InsightsResult,
  QlooEntity,
  QlooTag,
  SearchParams,
  TagsParams,
} from "./types";

/**
 * Deterministic, fixture-backed Qloo client for development before (and alongside) real API
 * access. It emits raw Qloo-shaped JSON and runs it through the same normalizer as the real client.
 *
 * Affinity model (mock only): each signal entity "implies" some place tags; explicit signal tags
 * count extra. A place's affinity blends tag overlap with a seeded hash, so the same request always
 * returns the same scores and different travelers' signals produce different scores.
 */

const TAG_KEY_BY_ID = new Map<string, MockTagKey>(
  (Object.entries(MOCK_TAGS) as [MockTagKey, (typeof MOCK_TAGS)[MockTagKey]][]).map(([k, t]) => [
    t.id,
    k,
  ]),
);

const DEFAULT_POINT_RADIUS_M = 25_000;

export interface MockQlooClientOptions {
  /** Simulated latency per call, for UI work. Default 0. */
  latencyMs?: number;
}

export class MockQlooClient implements QlooClient {
  constructor(private readonly options: MockQlooClientOptions = {}) {}

  async search(params: SearchParams, options?: RequestOptions): Promise<QlooEntity[]> {
    await this.delay();
    options?.meter?.record({ endpoint: "search", ms: this.options.latencyMs ?? 0, cached: false });
    const q = params.query.trim().toLowerCase();
    if (!q) return [];
    const types = params.types ? new Set<string>(params.types) : undefined;

    const candidates: {
      id: string;
      name: string;
      type: string;
      subtype?: string;
      popularity: number;
      tags: MockTagKey[];
    }[] = [
      ...MOCK_ENTITIES.map((x) => ({ ...x, tags: x.implies })),
      ...MOCK_PLACES.map((x) => ({
        id: x.id,
        name: x.name,
        type: "urn:entity:place",
        subtype: x.subtype,
        popularity: x.popularity,
        tags: x.tags,
      })),
    ];

    const scored = candidates
      .filter((c) => !types || types.has(c.type))
      .map((c) => ({ c, match: matchScore(c.name.toLowerCase(), q) }))
      .filter((x) => x.match > 0)
      .sort((a, b) => b.match - a.match || b.c.popularity - a.c.popularity)
      .slice(0, params.take ?? 10);

    return normalizeSearchResponse({
      results: scored.map(({ c }) => ({
        entity_id: c.id,
        name: c.name,
        types: [c.type],
        subtype: c.subtype,
        popularity: c.popularity,
        tags: c.tags.map(rawTag),
        mock: true,
      })),
    });
  }

  async insights(params: InsightsParams, options?: RequestOptions): Promise<InsightsResult> {
    await this.delay();
    options?.meter?.record({
      endpoint: "insights",
      ms: this.options.latencyMs ?? 0,
      cached: false,
    });
    const interest = interestProfile(params);
    const signalKey = signalFingerprint(params);
    const explain = params.explainability === true;

    if (params.filterType !== "urn:entity:place") {
      const ranked = MOCK_ENTITIES.filter((x) => x.type === params.filterType)
        .filter((x) => !params.signal?.entities?.includes(x.id))
        .map((x) => ({
          x,
          affinity: affinityFor(x.id, x.implies, x.popularity, interest, signalKey),
        }))
        .sort((a, b) => b.affinity - a.affinity);
      return normalizeInsightsResponse({
        success: true,
        results: {
          entities: page(ranked, params).map(({ x, affinity }) =>
            rawEntityFromSearch(x, affinity, explain ? explainFor(x.implies, params) : undefined),
          ),
        },
      });
    }

    const location = params.filter?.location ? parseWkt(params.filter.location) : undefined;
    const radiusM = params.filter?.locationRadiusM;
    const onlyIds = params.filter?.entities ? new Set(params.filter.entities) : undefined;
    const excludeIds = new Set(params.filter?.excludeEntities ?? []);
    const filterTagKeys = tagKeys(params.filter?.tags);
    const excludeTagKeys = tagKeys(params.filter?.excludeTags);
    const f = params.filter ?? {};

    const places = MOCK_PLACES.filter((pl) => {
      if (onlyIds && !onlyIds.has(pl.id)) return false;
      if (excludeIds.has(pl.id)) return false;
      if (filterTagKeys.size > 0 && !pl.tags.some((t) => filterTagKeys.has(t))) return false;
      if (pl.tags.some((t) => excludeTagKeys.has(t))) return false;
      if (f.popularityMin !== undefined && pl.popularity < f.popularityMin) return false;
      if (f.popularityMax !== undefined && pl.popularity > f.popularityMax) return false;
      if (f.priceLevelMin !== undefined && (pl.priceLevel ?? 0) < f.priceLevelMin) return false;
      if (f.priceLevelMax !== undefined && (pl.priceLevel ?? 0) > f.priceLevelMax) return false;
      if (location && !withinLocation(pl, location, radiusM)) return false;
      return true;
    });

    let ranked = places
      .map((pl) => ({
        pl,
        affinity: affinityFor(pl.id, pl.tags, pl.popularity, interest, signalKey),
      }))
      .sort((a, b) => b.affinity - a.affinity);

    if (params.diversify?.by === "properties.geocode.city") {
      const perTown = new Map<string, number>();
      ranked = ranked.filter(({ pl }) => {
        const n = (perTown.get(pl.town) ?? 0) + 1;
        perTown.set(pl.town, n);
        return n <= params.diversify!.take;
      });
    }

    return normalizeInsightsResponse({
      success: true,
      results: {
        entities: page(ranked, params).map(({ pl, affinity }) =>
          rawEntityFromPlace(pl, affinity, explain ? explainFor(pl.tags, params) : undefined),
        ),
      },
      duration: 42,
    });
  }

  async tags(params: TagsParams, options?: RequestOptions): Promise<QlooTag[]> {
    await this.delay();
    options?.meter?.record({ endpoint: "tags", ms: this.options.latencyMs ?? 0, cached: false });
    const q = params.query?.trim().toLowerCase();
    const types = params.tagTypes?.map((t) => t.toLowerCase());
    const list = MOCK_TAG_LIST.filter(
      (t) => !q || t.name.toLowerCase().includes(q) || t.id.includes(q),
    )
      .filter((t) => !types || types.some((ty) => t.id.includes(ty) || t.type === ty))
      .slice(0, params.take ?? 20);
    return normalizeTagsResponse({
      results: { tags: list.map((t) => ({ tag_id: t.id, name: t.name, type: t.type })) },
    });
  }

  private async delay() {
    const ms = this.options.latencyMs ?? 0;
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }
}

// ---------------------------------------------------------------------------
// Affinity model (mock only)
// ---------------------------------------------------------------------------

type Interest = Map<MockTagKey, number>;

function interestProfile(params: InsightsParams): Interest {
  const interest: Interest = new Map();
  const add = (k: MockTagKey, w: number) => interest.set(k, (interest.get(k) ?? 0) + w);
  // Each favorite contributes a total weight of 1, spread across the tags it implies,
  // so a precise favorite (a pho restaurant) isn't drowned out by a broad one (a national park).
  for (const id of params.signal?.entities ?? []) {
    const implied =
      MOCK_ENTITY_BY_ID.get(id)?.implies ?? MOCK_PLACES.find((pl) => pl.id === id)?.tags ?? [];
    implied.forEach((k) => add(k, 1 / implied.length));
  }
  for (const id of params.signal?.tags ?? []) {
    const k = TAG_KEY_BY_ID.get(id);
    if (k) add(k, 1);
  }
  return interest;
}

function affinityFor(
  id: string,
  tags: readonly MockTagKey[],
  popularity: number,
  interest: Interest,
  signalKey: string,
): number {
  const noise = seeded(`${id}|${signalKey}`);
  if (interest.size === 0) return round(0.7 * popularity + 0.3 * noise);
  // Cosine similarity between the interest vector and the place's (binary) tag vector.
  const norm = Math.sqrt([...interest.values()].reduce((a, w) => a + w * w, 0));
  const dot = tags.reduce((sum, t) => sum + (interest.get(t) ?? 0), 0);
  const overlap = dot / (norm * Math.sqrt(Math.max(1, tags.length)));
  return round(Math.min(0.99, 0.12 + 0.62 * overlap + 0.16 * noise + 0.1 * popularity));
}

function explainFor(tags: readonly MockTagKey[], params: InsightsParams) {
  const tagSet = new Set(tags);
  const entities = (params.signal?.entities ?? [])
    .map((id) => {
      const implied =
        MOCK_ENTITY_BY_ID.get(id)?.implies ?? MOCK_PLACES.find((pl) => pl.id === id)?.tags ?? [];
      const hits = implied.filter((k) => tagSet.has(k)).length;
      return { entity_id: id, score: implied.length ? hits / implied.length : 0 };
    })
    .filter((x) => x.score > 0);
  const tagHits = (params.signal?.tags ?? [])
    .filter((id) => {
      const k = TAG_KEY_BY_ID.get(id);
      return k !== undefined && tagSet.has(k);
    })
    .map((id) => ({ tag_id: id, score: 1 }));
  const max = Math.max(0, ...entities.map((x) => x.score), ...tagHits.map((x) => x.score));
  if (max === 0) return undefined;
  const norm = <T extends { score: number }>(x: T) => ({ ...x, score: round(x.score / max) });
  return {
    "signal.interests.entities": entities.map(norm),
    "signal.interests.tags": tagHits.map(norm),
  };
}

function signalFingerprint(params: InsightsParams): string {
  return [...(params.signal?.entities ?? []), ...(params.signal?.tags ?? [])].sort().join(",");
}

// ---------------------------------------------------------------------------
// Raw JSON builders (Qloo-shaped; see normalize.ts)
// ---------------------------------------------------------------------------

function rawTag(k: MockTagKey) {
  const t = MOCK_TAGS[k];
  return { tag_id: t.id, name: t.name, type: t.type };
}

function rawEntityFromPlace(pl: MockPlace, affinity: number, explainability?: unknown) {
  return {
    entity_id: pl.id,
    name: pl.name,
    types: ["urn:entity:place"],
    subtype: pl.subtype,
    popularity: pl.popularity,
    location: { lat: pl.lat, lon: pl.lon },
    properties: {
      address: `${pl.town}, ${pl.region}`,
      business_rating: pl.rating,
      price_level: pl.priceLevel,
      geocode: { city: pl.town, admin1_region: pl.region, country_code: "US" },
      hours: pl.hours,
      description: `${pl.name} is a ${pl.subtype.replace("_", " ")} in ${pl.town}, ${pl.region} (mock data).`,
      is_closed: false,
      keywords: pl.tags
        .slice(0, 3)
        .map((k, i) => ({ name: MOCK_TAGS[k].name.toLowerCase(), count: 30 - i * 10 })),
    },
    tags: pl.tags.map(rawTag),
    query: { affinity, ...(explainability ? { explainability } : {}) },
    mock: true,
  };
}

function rawEntityFromSearch(x: MockSearchEntity, affinity: number, explainability?: unknown) {
  return {
    entity_id: x.id,
    name: x.name,
    types: [x.type],
    subtype: x.subtype,
    popularity: x.popularity,
    tags: x.implies.map(rawTag),
    query: { affinity, ...(explainability ? { explainability } : {}) },
    mock: true,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function page<T>(items: T[], params: InsightsParams): T[] {
  const take = params.take ?? 20;
  const start = ((params.page ?? 1) - 1) * take;
  return items.slice(start, start + take);
}

function tagKeys(ids: readonly string[] | undefined): Set<MockTagKey> {
  return new Set(
    (ids ?? []).map((id) => TAG_KEY_BY_ID.get(id)).filter((k): k is MockTagKey => !!k),
  );
}

function matchScore(name: string, q: string): number {
  if (name === q) return 3;
  if (name.startsWith(q)) return 2.5;
  if (name.split(/[\s,.'&:-]+/).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q)) return 1;
  return 0;
}

/** FNV-1a → [0, 1). Deterministic pseudo-randomness for mock scores. */
function seeded(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x1_0000_0000;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// Minimal WKT parsing (POINT, POLYGON, MULTIPOLYGON), longitude first
// ---------------------------------------------------------------------------

type ParsedLocation =
  | { kind: "point"; lon: number; lat: number }
  | { kind: "area"; feature: Feature<Polygon | MultiPolygon>; rings: Position[][] };

function parseCoords(s: string): [number, number][] {
  return s.split(",").map((pair) => pair.trim().split(/\s+/).map(Number) as [number, number]);
}

export function parseWkt(wkt: string): ParsedLocation {
  const text = wkt.trim().toUpperCase();
  const pointMatch = /^POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/.exec(text);
  if (pointMatch) return { kind: "point", lon: Number(pointMatch[1]), lat: Number(pointMatch[2]) };

  if (text.startsWith("POLYGON")) {
    const rings = [...text.matchAll(/\(([^()]+)\)/g)].map((m) => parseCoords(m[1]));
    return { kind: "area", feature: polygon(rings), rings };
  }
  if (text.startsWith("MULTIPOLYGON")) {
    const polys = [...text.matchAll(/\(\(([^()]+(?:\),\s*\([^()]+)*)\)\)/g)].map((m) =>
      m[1].split(/\),\s*\(/).map(parseCoords),
    );
    return { kind: "area", feature: multiPolygon(polys), rings: polys.flat() };
  }
  throw new QlooError(
    `MockQlooClient: unsupported filter.location value: ${wkt}`,
    400,
    false,
    "bad_request",
  );
}

function withinLocation(pl: MockPlace, loc: ParsedLocation, radiusM?: number): boolean {
  const pt = point([pl.lon, pl.lat]);
  if (loc.kind === "point") {
    const r = radiusM ?? DEFAULT_POINT_RADIUS_M;
    return distance(point([loc.lon, loc.lat]), pt, { units: "meters" }) <= r;
  }
  if (booleanPointInPolygon(pt, loc.feature)) return true;
  if (!radiusM) return false;
  return loc.rings.some(
    (ring) => pointToLineDistance(pt, lineString(ring), { units: "meters" }) <= radiusM,
  );
}
