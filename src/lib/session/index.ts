import "server-only";

import { connection } from "next/server";

import { getServerEnv } from "@/lib/config/env.server";

import { resolveSessionUser } from "./resolve";
import type { SessionUser } from "./types";

export type { SessionUser } from "./types";
export { SessionError } from "./types";

/**
 * The only way app code gets the current user. Always request-time: sessions are per request,
 * so any page or handler that calls this is excluded from build-time prerendering.
 */
export async function getCurrentUser(): Promise<SessionUser> {
  await connection();
  return resolveSessionUser(getServerEnv());
}
