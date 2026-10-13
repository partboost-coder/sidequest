import type { QlooClient, RequestOptions } from "./client";
import { QlooError } from "./client";
import {
  normalizeInsightsResponse,
  normalizeSearchResponse,
  normalizeTagsResponse,
} from "./normalize";
import { encodeEntries, insightsEntries, searchEntries, tagsEntries } from "./params";
import { QuotaGuard } from "./quota";
import { isRateLimited, retryDelayMs } from "./retry";
import { Throttle } from "./throttle";
import type {
  InsightsParams,
  InsightsResult,
  QlooEntity,
  QlooTag,
  SearchParams,
  TagsParams,
} from "./types";

type Endpoint = "search" | "insights" | "tags";
const PATHS = { insights: "/v2/insights", search: "/search", tags: "/v2/tags" } as const;

export interface RealQlooClientOptions {
  apiKey: string;
  /** Hackathon keys only work against https://hackathon.api.qloo.com */
  baseUrl: string;
  throttle?: Throttle;
  quota?: QuotaGuard;
  timeoutMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** Process-wide throttle shared by every RealQlooClient: Qloo's limit is per key, not per client. */
export const sharedThrottle = new Throttle({ ratePerSec: 4, concurrency: 4 });

/**
 * Live Qloo hackathon API client: GET only, `X-Api-Key` auth, throttled, retried per policy,
 * and guarded by the monthly quota. The API key never appears in URLs, logs or errors.
 */
export class RealQlooClient implements QlooClient {
  private readonly throttle: Throttle;
  readonly quota: QuotaGuard;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: RealQlooClientOptions) {
    if (!options.apiKey) {
      throw new QlooError("RealQlooClient requires an API key", undefined, false, "bad_request");
    }
    this.throttle = options.throttle ?? sharedThrottle;
    this.quota = options.quota ?? new QuotaGuard({ reserve: 1000, unknownBudget: 25 });
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Builds a GET request. Auth is the `X-Api-Key` header (never a bearer token or query param). */
  buildRequest(path: (typeof PATHS)[Endpoint], query: string) {
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
    return this.buildRequest(PATHS.insights, encodeEntries(insightsEntries(params)));
  }

  buildSearchRequest(params: SearchParams) {
    return this.buildRequest(PATHS.search, encodeEntries(searchEntries(params)));
  }

  buildTagsRequest(params: TagsParams) {
    return this.buildRequest(PATHS.tags, encodeEntries(tagsEntries(params)));
  }

  async search(params: SearchParams, options?: RequestOptions): Promise<QlooEntity[]> {
    return normalizeSearchResponse(
      await this.call("search", this.buildSearchRequest(params), options),
    );
  }

  async insights(params: InsightsParams, options?: RequestOptions): Promise<InsightsResult> {
    return normalizeInsightsResponse(
      await this.call("insights", this.buildInsightsRequest(params), options),
    );
  }

  async tags(params: TagsParams, options?: RequestOptions): Promise<QlooTag[]> {
    return normalizeTagsResponse(await this.call("tags", this.buildTagsRequest(params), options));
  }

  private async call(
    endpoint: Endpoint,
    req: { url: string; init: RequestInit },
    options: RequestOptions = {},
  ): Promise<unknown> {
    for (let retries = 0; ; retries++) {
      try {
        return await this.attempt(endpoint, req, options);
      } catch (error) {
        const e =
          error instanceof QlooError
            ? error
            : new QlooError(String(error), undefined, false, "network");
        const delay = retryDelayMs(e.code, e.status, retries);
        if (delay === undefined || options.signal?.aborted) throw e;
        await this.sleep(delay);
      }
    }
  }

  /** One network attempt: quota check → throttled fetch → quota observe → classify. */
  private async attempt(
    endpoint: Endpoint,
    req: { url: string; init: RequestInit },
    options: RequestOptions,
  ): Promise<unknown> {
    await this.quota.check(options.allowReserve);
    return this.throttle.run(async () => {
      const started = Date.now();
      const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 10_000);
      const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
      let res: Response;
      try {
        res = await this.fetchImpl(req.url, { ...req.init, signal });
      } catch (error) {
        const timedOut = (error as Error).name === "TimeoutError" || timeout.aborted;
        throw new QlooError(
          timedOut ? `Qloo ${endpoint} timed out` : `Qloo ${endpoint} network error`,
          undefined,
          true,
          timedOut ? "timeout" : "network",
        );
      }
      const remaining = await this.quota.observe(res.headers.get("x-month-ratelimit-remaining"));
      const body: unknown = await res.json().catch(() => undefined);
      options.meter?.record({ endpoint, ms: Date.now() - started, cached: false, remaining });

      if (isRateLimited(res.status, body)) {
        throw new QlooError(
          `Qloo ${endpoint} rate limited (HTTP ${res.status})`,
          res.status,
          true,
          "rate_limited",
        );
      }
      if (!res.ok) {
        const detail = summarizeError(body);
        throw new QlooError(
          `Qloo ${endpoint} HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
          res.status,
          res.status >= 500,
          "http",
        );
      }
      if (body === undefined) {
        throw new QlooError(
          `Qloo ${endpoint} returned a non-JSON body`,
          res.status,
          false,
          "invalid_response",
        );
      }
      return body;
    });
  }
}

function summarizeError(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as { error_msg?: string; errors?: { message?: string }[] };
  return (
    b.error_msg ??
    b.errors
      ?.map((e) => e.message)
      .filter(Boolean)
      .join("; ")
      .slice(0, 200)
  );
}
