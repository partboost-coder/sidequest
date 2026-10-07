import { parseClientEnv, type ClientEnv } from "./env.schema";

let cached: ClientEnv | undefined;

/**
 * Public env, safe for the browser. NEXT_PUBLIC_* values are inlined at build time,
 * so each one must be referenced literally here.
 */
export function getClientEnv(): ClientEnv {
  cached ??= parseClientEnv({
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return cached;
}
