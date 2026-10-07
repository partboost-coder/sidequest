import "server-only";

import { getServerEnv } from "@/lib/config/env.server";

import type { QlooClient } from "./client";
import { createQlooClient } from "./create";

export type { QlooClient } from "./client";
export { QlooError } from "./client";
export { pointWkt, polygonWkt } from "./params";
export type * from "./types";

let client: QlooClient | undefined;

/** The app's Qloo client: chosen by QLOO_MODE and always wrapped in the cache. */
export function getQlooClient(): QlooClient {
  if (!client) {
    const env = getServerEnv();
    client = createQlooClient({
      mode: env.QLOO_MODE,
      apiKey: env.QLOO_API_KEY,
      baseUrl: env.QLOO_BASE_URL,
    });
  }
  return client;
}

export function getQlooMode() {
  return getServerEnv().QLOO_MODE;
}
