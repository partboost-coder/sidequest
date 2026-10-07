import type { QlooClient } from "./client";
import { QlooError } from "./client";
import { encodeEntries, insightsEntries, searchEntries, tagsEntries } from "./params";
import type {
  InsightsParams,
  InsightsResult,
  QlooEntity,
  QlooTag,
  SearchParams,
  TagsParams,
} from "./types";

export interface RealQlooClientOptions {
  apiKey: string;
  /** Hackathon keys only work against https://hackathon.api.qloo.com */
  baseUrl: string;
}

/**
 * Live Qloo hackathon API client. Request construction is fixed now; network calls, concurrency
 * limits, retries and timeouts are implemented in v0.2.0 (items 209/210) after the spike.
 */
export class RealQlooClient implements QlooClient {
  constructor(private readonly options: RealQlooClientOptions) {
    if (!options.apiKey) throw new QlooError("RealQlooClient requires an API key");
  }

  /** Builds a GET request. Auth is the `X-Api-Key` header (never a bearer token or query param). */
  buildRequest(path: "/v2/insights" | "/search" | "/v2/tags", query: string) {
    const url = `${this.options.baseUrl.replace(/\/$/, "")}${path}${query ? `?${query}` : ""}`;
    return {
      url,
      init: {
        method: "GET" as const,
        headers: { "X-Api-Key": this.options.apiKey, Accept: "application/json" },
      },
    };
  }

  buildInsightsRequest(params: InsightsParams) {
    return this.buildRequest("/v2/insights", encodeEntries(insightsEntries(params)));
  }

  buildSearchRequest(params: SearchParams) {
    return this.buildRequest("/search", encodeEntries(searchEntries(params)));
  }

  buildTagsRequest(params: TagsParams) {
    return this.buildRequest("/v2/tags", encodeEntries(tagsEntries(params)));
  }

  async search(_params: SearchParams): Promise<QlooEntity[]> {
    throw notImplemented("search");
  }

  async insights(_params: InsightsParams): Promise<InsightsResult> {
    throw notImplemented("insights");
  }

  async tags(_params: TagsParams): Promise<QlooTag[]> {
    throw notImplemented("tags");
  }
}

function notImplemented(method: string) {
  return new QlooError(
    `RealQlooClient.${method} is not implemented yet (v0.2.0, items 209/210). Use QLOO_MODE=mock.`,
    501,
  );
}
