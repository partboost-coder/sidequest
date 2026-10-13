import { CachedQlooClient, MemoryCacheStore, type CacheStore } from "./cached";
import type { QlooClient } from "./client";
import { QlooError } from "./client";
import { FileCacheStore, FileQuotaStore } from "./fileStore";
import { MockQlooClient } from "./mock";
import { MemoryQuotaStore, QuotaGuard } from "./quota";
import { RealQlooClient } from "./real";

export type QlooMode = "mock" | "real" | "record";
export type QlooCacheKind = "file" | "memory" | "postgres";

export interface CreateQlooClientOptions {
  mode: QlooMode;
  apiKey?: string;
  baseUrl: string;
  cache?: QlooCacheKind;
  /** Overrides `cache` (tests, or the Postgres store from item 211). */
  cacheStore?: CacheStore;
  quotaReserve?: number;
  unknownQuotaBudget?: number;
  mockLatencyMs?: number;
  fetch?: typeof fetch;
}

export interface CreatedQlooClient {
  client: CachedQlooClient;
  /** Present for live modes; exposes the quota snapshot for /api/health. */
  quota?: QuotaGuard;
}

/** Pure factory (no env access), so it can be tested. App code uses `getQlooClient()`. */
export function createQlooClient(options: CreateQlooClientOptions): CreatedQlooClient {
  const cacheKind: QlooCacheKind = options.mode === "record" ? "file" : (options.cache ?? "memory");
  const store = options.cacheStore ?? cacheStoreFor(cacheKind);

  if (options.mode === "mock") {
    return {
      client: new CachedQlooClient(new MockQlooClient({ latencyMs: options.mockLatencyMs }), store),
    };
  }

  const quota = new QuotaGuard({
    reserve: options.quotaReserve ?? 1000,
    unknownBudget: options.unknownQuotaBudget ?? 25,
    store: cacheKind === "file" ? new FileQuotaStore() : new MemoryQuotaStore(),
  });
  const inner: QlooClient = new RealQlooClient({
    apiKey: options.apiKey ?? "",
    baseUrl: options.baseUrl,
    quota,
    fetch: options.fetch,
  });
  return { client: new CachedQlooClient(inner, store), quota };
}

function cacheStoreFor(kind: QlooCacheKind): CacheStore {
  if (kind === "file") return new FileCacheStore();
  if (kind === "postgres") {
    throw new QlooError(
      "QLOO_CACHE=postgres arrives with persistence (v0.2.0 item 211).",
      undefined,
      false,
      "bad_request",
    );
  }
  return new MemoryCacheStore();
}
