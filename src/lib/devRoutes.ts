/**
 * Gate for /dev/* pages and /api/dev/* handlers (the vertical-slice harness).
 * Reads only DEV_ROUTES and NODE_ENV, so a missing unrelated secret can't turn a 404 into a 500.
 * Default: enabled everywhere except production.
 */
export function devRoutesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.DEV_ROUTES?.trim().toLowerCase();
  if (raw && ["true", "1", "yes", "on"].includes(raw)) return true;
  if (raw && ["false", "0", "no", "off"].includes(raw)) return false;
  return env.NODE_ENV !== "production";
}

/** For route handlers: a 404 Response when dev routes are disabled, otherwise undefined. */
export function devRoutesGuard(
  env: Record<string, string | undefined> = process.env,
): Response | undefined {
  return devRoutesEnabled(env) ? undefined : new Response("Not Found", { status: 404 });
}
