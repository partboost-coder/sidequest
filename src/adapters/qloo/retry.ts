import type { QlooErrorCode } from "./client";

/**
 * Retry policy (pure). Returns the delay before the next attempt, or undefined to stop.
 * - rate_limited: retry after ~1 s, at most 2 retries
 * - network / timeout: exponential backoff with jitter, at most 2 retries
 * - 5xx: at most 1 retry (some 500s are deterministic and would only burn quota)
 * - everything else (4xx, quota_reserve, invalid_response…): never
 */
export function retryDelayMs(
  code: QlooErrorCode,
  status: number | undefined,
  retriesSoFar: number,
  random: () => number = Math.random,
): number | undefined {
  const jitter = Math.round(random() * 250);
  if (code === "rate_limited") return retriesSoFar < 2 ? 1000 + jitter : undefined;
  if (code === "network" || code === "timeout") {
    return retriesSoFar < 2 ? 500 * 3 ** retriesSoFar + jitter : undefined;
  }
  if (code === "http" && status !== undefined && status >= 500) {
    return retriesSoFar < 1 ? 1000 + jitter : undefined;
  }
  return undefined;
}

/** Qloo signals rate limiting with 429 and/or a `{"error_msg":"Rate limit exceeded"}` body. */
export function isRateLimited(status: number, body: unknown): boolean {
  if (status === 429) return true;
  if (body && typeof body === "object") {
    const msg = (body as Record<string, unknown>).error_msg;
    return typeof msg === "string" && /rate limit/i.test(msg);
  }
  return false;
}
