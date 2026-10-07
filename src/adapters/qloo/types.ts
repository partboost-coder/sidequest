import { z } from "zod";

/**
 * Qloo types in two layers:
 *  1. Raw response schemas: deliberately lenient (`looseObject`) because Qloo doesn't publish
 *     example responses. Only fields we rely on are named, and almost all are optional.
 *  2. Normalized types (`QlooEntity`, `QlooTag`, `InsightsResult`): what the rest of the app uses.
 *     If the real response shape differs (spike S1–S8), only `normalize.ts` changes.
 */

// ---------------------------------------------------------------------------
// Entity types (documented `filter.type` values supported by the hackathon API)
// ---------------------------------------------------------------------------

export const QLOO_ENTITY_TYPES = [
  "urn:entity:artist",
  "urn:entity:book",
  "urn:entity:brand",
  "urn:entity:destination",
  "urn:entity:movie",
  "urn:entity:person",
  "urn:entity:place",
  "urn:entity:podcast",
  "urn:entity:tv_show",
  "urn:entity:video_game",
] as const;

export type QlooEntityType = (typeof QLOO_ENTITY_TYPES)[number];

export const WEIGHTS = ["very_low", "low", "mid", "medium", "high", "very_high"] as const;
export type QlooWeight = (typeof WEIGHTS)[number] | number;

// ---------------------------------------------------------------------------
// Raw response schemas (lenient)
// ---------------------------------------------------------------------------

export const rawTagSchema = z.looseObject({
  tag_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  subtype: z.string().optional(),
});

export const rawEntitySchema = z.looseObject({
  entity_id: z.string(),
  name: z.string(),
  types: z.array(z.string()).optional(),
  type: z.string().optional(),
  subtype: z.string().optional(),
  popularity: z.number().optional(),
  location: z
    .looseObject({
      lat: z.number().optional(),
      lon: z.number().optional(),
      geohash: z.string().optional(),
    })
    .optional(),
  properties: z
    .looseObject({
      address: z.string().optional(),
      business_rating: z.number().optional(),
      price_level: z.number().optional(),
      image: z.looseObject({ url: z.string().optional() }).optional(),
      images: z.array(z.looseObject({ url: z.string().optional() })).optional(),
      geocode: z
        .looseObject({
          name: z.string().optional(),
          city: z.string().optional(),
          admin1_region: z.string().optional(),
          country_code: z.string().optional(),
        })
        .optional(),
      hours: z.unknown().optional(),
      keywords: z.unknown().optional(),
    })
    .optional(),
  tags: z.array(rawTagSchema).optional(),
  query: z
    .looseObject({
      affinity: z.number().optional(),
      explainability: z.unknown().optional(),
    })
    .optional(),
});

export const rawInsightsResponseSchema = z.looseObject({
  success: z.boolean().optional(),
  results: z
    .looseObject({
      entities: z.array(rawEntitySchema).optional(),
      tags: z.array(rawTagSchema).optional(),
    })
    .optional(),
  duration: z.number().optional(),
});

export const rawSearchResponseSchema = z.looseObject({
  results: z.array(rawEntitySchema).optional(),
});

export const rawTagsResponseSchema = z.looseObject({
  results: z
    .union([z.array(rawTagSchema), z.looseObject({ tags: z.array(rawTagSchema).optional() })])
    .optional(),
});

export type RawEntity = z.infer<typeof rawEntitySchema>;
export type RawTag = z.infer<typeof rawTagSchema>;

// ---------------------------------------------------------------------------
// Normalized types used by the app
// ---------------------------------------------------------------------------

export interface QlooTag {
  id: string;
  name: string;
  type?: string;
}

export interface Contribution {
  /** Qloo ID of the input signal (entity ID or tag ID) that contributed to this result. */
  signalId: string;
  kind: "entity" | "tag";
  /** Normalized 0–1. */
  score: number;
}

export interface QlooEntity {
  id: string;
  name: string;
  types: string[];
  subtype?: string;
  popularity?: number;
  location?: { lat: number; lon: number };
  address?: string;
  city?: string;
  region?: string;
  countryCode?: string;
  businessRating?: number;
  priceLevel?: number;
  imageUrl?: string;
  hours?: unknown;
  tags: QlooTag[];
  /** `query.affinity`, normalized 0–1. Present on Insights results. */
  affinity?: number;
  /** Parsed `query.explainability`, when requested and available. */
  contributions?: Contribution[];
  /** True for fixture data from MockQlooClient. Must never reach users outside mock mode. */
  mock?: boolean;
}

export interface InsightsResult {
  entities: QlooEntity[];
  /** Server-reported duration (ms), when provided. */
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Request params
// ---------------------------------------------------------------------------

export interface SearchParams {
  query: string;
  types?: QlooEntityType[];
  take?: number;
}

export interface TagsParams {
  query?: string;
  /** e.g. "urn:tag:genre:place" (exact tag type IDs confirmed in spike S6). */
  tagTypes?: string[];
  take?: number;
}

export type Weekday =
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

/** Typed Insights request. Serialized to documented GET query parameters by `toQueryString`. */
export interface InsightsParams {
  filterType: QlooEntityType;
  filter?: {
    /** WKT (longitude first) or a Qloo locality ID. */
    location?: string;
    locationRadiusM?: number;
    locationQuery?: string;
    tags?: string[];
    excludeTags?: string[];
    entities?: string[];
    excludeEntities?: string[];
    popularityMin?: number;
    popularityMax?: number;
    priceLevelMin?: number;
    priceLevelMax?: number;
    hours?: Weekday;
  };
  signal?: {
    entities?: string[];
    entitiesWeight?: QlooWeight;
    tags?: string[];
    tagsWeight?: QlooWeight;
    tagsOperator?: "union" | "intersection";
    location?: string;
    locationRadiusM?: number;
    locationWeight?: QlooWeight;
  };
  explainability?: boolean;
  diversify?: {
    by: "properties.geocode.city" | "properties.geocode.metro" | "subtype";
    take: number;
  };
  biasTrends?: "off" | "very_low" | "low" | "mid" | "medium" | "high" | "very_high";
  take?: number;
  page?: number;
  /**
   * Escape hatch for spike experiments with documented params not yet modeled
   * (e.g. `output.heatmap.boundary`). Keys must be documented Qloo parameter names.
   */
  extra?: Record<string, string | number | boolean>;
}
