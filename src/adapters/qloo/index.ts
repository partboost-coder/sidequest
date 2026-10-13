import "server-only";

import { getServerEnv } from "@/lib/config/env.server";

import type { QlooClient } from "./client";
import { createQlooClient, type CreatedQlooClient } from "./create";
import type { QuotaState } from "./quota";

export type { QlooClient, RequestOptions } from "./client";
export { QlooError } from "./client";
export { CallMeter } from "./meter";
export { pointWkt, polygonWkt } from "./params";
export type * from "./types";

let created: CreatedQlooClient | undefined;

function instance(): CreatedQlooClient {
  if (!created) {
    const env = getServerEnv();
    created = createQlooClient({
      mode: env.QLOO_MODE,
      apiKey: env.QLOO_API_KEY,
      baseUrl: env.QLOO_BASE_URL,
      cache: env.QLOO_CACHE,
      quotaReserve: env.QLOO_QUOTA_RESERVE,
      unknownQuotaBudget: env.QLOO_UNKNOWN_QUOTA_BUDGET,
    });
  }
  return created;
}

/** The app's Qloo client: chosen by QLOO_MODE and always wrapped in the cache. */
export function getQlooClient(): QlooClient {
  return instance().client;
}

export function getQlooMode() {
  return getServerEnv().QLOO_MODE;
}

/** Last-known monthly quota (live modes only). */
export async function getQlooQuota(): Promise<QuotaState | undefined> {
  return instance().quota?.snapshot();
}
