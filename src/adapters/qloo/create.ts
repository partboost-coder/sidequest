import { CachedQlooClient, type CacheStore } from "./cached";
import type { QlooClient } from "./client";
import { MockQlooClient } from "./mock";
import { RealQlooClient } from "./real";

export type QlooMode = "mock" | "real" | "record";

export interface CreateQlooClientOptions {
  mode: QlooMode;
  apiKey?: string;
  baseUrl: string;
  cacheStore?: CacheStore;
  mockLatencyMs?: number;
}

/** Pure factory (no env access), so it can be tested. App code uses `getQlooClient()`. */
export function createQlooClient(options: CreateQlooClientOptions): CachedQlooClient {
  const inner: QlooClient =
    options.mode === "mock"
      ? new MockQlooClient({ latencyMs: options.mockLatencyMs })
      : // "record" mode (live + fixture capture) lands with the real client in v0.2.0.
        new RealQlooClient({ apiKey: options.apiKey ?? "", baseUrl: options.baseUrl });
  return new CachedQlooClient(inner, options.cacheStore);
}
