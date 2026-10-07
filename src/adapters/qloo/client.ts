import type {
  InsightsParams,
  InsightsResult,
  QlooEntity,
  QlooTag,
  SearchParams,
  TagsParams,
} from "./types";

/**
 * The only Qloo surface the rest of the app may use. Get an instance from `getQlooClient()`.
 * Never import a concrete implementation directly.
 */
export interface QlooClient {
  /** Entity lookup by name (`/search`). Used for favorites autocomplete. */
  search(params: SearchParams): Promise<QlooEntity[]>;
  /** Recommendations and affinity scores (`GET /v2/insights`). */
  insights(params: InsightsParams): Promise<InsightsResult>;
  /** Tag lookup (`/v2/tags`). */
  tags(params: TagsParams): Promise<QlooTag[]>;
}

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "QlooError";
  }
}
