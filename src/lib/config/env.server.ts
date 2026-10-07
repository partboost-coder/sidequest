import "server-only";

import { parseServerEnv, type ServerEnv } from "./env.schema";

let cached: ServerEnv | undefined;

/**
 * Validated server environment. Parsed on first access (not at import time) so `next build`
 * doesn't need runtime secrets, but any request that needs config fails fast with a readable error.
 */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
