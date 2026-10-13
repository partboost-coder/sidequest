import type { BucketId } from "@/config/buckets";

/** One traveler's view of a candidate place. */
export interface TravelerScore {
  /** Raw Qloo `query.affinity` under this traveler's signals (0–1). */
  affinity: number;
  /** Percentile of `affinity` within this trip's pool for this traveler (0–1). */
  percentile: number;
}

/** A place found along the corridor, enriched for planning. Plain data (JSON-serializable). */
export interface Candidate {
  id: string;
  name: string;
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  subtype?: string;
  tags: { id: string; name: string }[];
  description?: string;
  specialtyDishes?: string[];
  imageUrl?: string;
  popularity?: number;
  businessRating?: number;
  bucket: BucketId;
  segmentIndex: number;
  /** Affinity from the group (union-signal) query, used to rank candidates for scoring. */
  groupQueryAffinity: number;
  /** Input signals that contributed in the group query (explainability), strongest first. */
  contributions: { signalId: string; score: number }[];
  alongKm: number;
  offRouteKm: number;
  detourMin: number;
  /** Filled by scoring. */
  scores?: Record<string, TravelerScore>;
  /** Group fit G (0–1): soft minimum of travelers' percentiles. */
  groupFit?: number;
  /** "Your Vibe %" (0–99). */
  vibePct?: number;
  /** Traveler IDs this place is especially for. */
  especiallyFor?: string[];
}
