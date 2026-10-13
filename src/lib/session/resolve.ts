import type { ServerEnv } from "@/lib/config/env.schema";

import { SessionError, type SessionUser } from "./types";

/**
 * Pure session resolution (testable). Dev mode returns the fixed guest. Supabase anonymous
 * sessions are wired in v0.2.0 (item 212); until then supabase mode fails loudly rather than
 * silently pretending to have a session.
 */
export function resolveSessionUser(
  env: Pick<ServerEnv, "SESSION_MODE" | "DEV_USER_ID">,
): SessionUser {
  switch (env.SESSION_MODE) {
    case "dev":
      return { id: env.DEV_USER_ID, isAnonymous: true, source: "dev" };
    case "supabase":
      throw new SessionError(
        "SESSION_MODE=supabase is not wired yet (v0.2.0, item 212). Use SESSION_MODE=dev for now.",
      );
  }
}
