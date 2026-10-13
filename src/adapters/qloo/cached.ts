import { createHash } from "node:crypto";

import type { QlooClient, RequestOptions } from "./client";
import type {
  InsightsParams,
  InsightsResult,
  QlooEntity,
  QlooTag,
  SearchParams,
  TagsParams,
} from "./types";

/** What a cache entry was for. Stores that persist entries (file, Postgres) keep it for debugging. */
export interface CacheMeta {
  method: string;
  params: unknown;
}

/** Pluggable cache storage: memory, file (development) or Postgres (item 211). */
export interface CacheStore {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttlMs: number, meta?: CacheMeta): Promise<void>;
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(
    private readonly maxEntries = 2_000,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string) {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  async set(key: string, value: unknown, ttlMs: number) {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  get size() {
    return this.entries.size;
  }
}

/** JSON with object keys sorted, so equivalent params always hash the same. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function cacheKey(method: string, params: unknown): string {
  return createHash("sha256")
    .update(`${method}:${stableStringify(params)}`)
    .digest("hex");
}

export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Caches any QlooClient and de-duplicates identical in-flight requests. */
export class CachedQlooClient implements QlooClient {
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(
    readonly inner: QlooClient,
    private readonly store: CacheStore = new MemoryCacheStore(),
    private readonly ttlMs = DEFAULT_TTL_MS,
  ) {}

  search(params: SearchParams, options?: RequestOptions): Promise<QlooEntity[]> {
    return this.cached("search", params, options, () => this.inner.search(params, options));
  }

  insights(params: InsightsParams, options?: RequestOptions): Promise<InsightsResult> {
    return this.cached("insights", params, options, () => this.inner.insights(params, options));
  }

  tags(params: TagsParams, options?: RequestOptions): Promise<QlooTag[]> {
    return this.cached("tags", params, options, () => this.inner.tags(params, options));
  }

  private async cached<T>(
    method: "search" | "insights" | "tags",
    params: unknown,
    options: RequestOptions | undefined,
    load: () => Promise<T>,
  ): Promise<T> {
    const key = cacheKey(method, params);
    const hit = await this.store.get(key);
    if (hit !== undefined) {
      options?.meter?.record({ endpoint: method, ms: 0, cached: true });
      return hit as T;
    }

    const pending = this.inflight.get(key);
    if (pending) {
      options?.meter?.record({ endpoint: method, ms: 0, cached: true });
      return pending as Promise<T>;
    }

    const promise = load()
      .then(async (value) => {
        await this.store.set(key, value, this.ttlMs, { method, params });
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}
