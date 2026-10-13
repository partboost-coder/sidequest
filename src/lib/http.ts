import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { MapboxError } from "@/adapters/mapbox/types";
import { QlooError } from "@/adapters/qloo/client";
import { EnvError } from "@/lib/config/env.schema";
import { SessionError } from "@/lib/session/types";

/** Consistent JSON errors for route handlers. Never echoes upstream URLs (they can carry tokens). */
export function errorResponse(error: unknown): Response {
  // Let Next.js internal control-flow errors (prerender bail-out, notFound, redirect) propagate.
  unstable_rethrow(error);
  if (error instanceof z.ZodError) {
    return Response.json(
      {
        error: "invalid_request",
        issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }
  if (error instanceof MapboxError || error instanceof QlooError) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    return Response.json({ error: "upstream_error", message: error.message }, { status });
  }
  if (error instanceof SessionError) {
    return Response.json({ error: "session_unavailable", message: error.message }, { status: 503 });
  }
  if (error instanceof EnvError) {
    console.error(error.message);
    return Response.json(
      {
        error: "server_misconfigured",
        message: process.env.NODE_ENV === "production" ? undefined : error.message,
      },
      { status: 500 },
    );
  }
  console.error(error);
  return Response.json({ error: "internal_error" }, { status: 500 });
}
