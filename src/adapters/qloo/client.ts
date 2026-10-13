import type { CallMeter } from "./meter";
import type {
  InsightsParams,
  InsightsResult,
  QlooEntity,
  QlooTag,
  SearchParams,
  TagsParams,
} from "./types";

export interface RequestOptions {
  /** Allow live calls below the quota reserve. Demo seeding only. */
  allowReserve?: boolean;
  /** Counts calls for one unit of work (e.g. a trip plan). */
  meter?: CallMeter;
  signal?: AbortSignal;
}

/**
 * The only Qloo surface the rest of the app may use. Get an instance from `getQlooClient()`.
 * Never import a concrete implementation directly.
 */
export interface QlooClient {
  /** Entity lookup by name (`/search`). Used for favorites autocomplete. */
  search(params: SearchParams, options?: RequestOptions): Promise<QlooEntity[]>;
  /** Recommendations and affinity scores (`GET /v2/insights`). */
  insights(params: InsightsParams, options?: RequestOptions): Promise<InsightsResult>;
  /** Tag lookup (`/v2/tags`). */
  tags(params: TagsParams, options?: RequestOptions): Promise<QlooTag[]>;
}

export type QlooErrorCode =
  | "quota_reserve"
  | "rate_limited"
  | "http"
  | "timeout"
  | "network"
  | "invalid_response"
  | "not_implemented"
  | "bad_request";

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
    readonly code: QlooErrorCode = "http",
  ) {
    super(message);
    this.name = "QlooError";
  }
}
