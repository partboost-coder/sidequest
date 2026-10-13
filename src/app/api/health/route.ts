import { connection } from "next/server";

import { MapboxClient } from "@/adapters/mapbox/client";
import { buildHealthReport } from "@/lib/health";

import pkg from "../../../../package.json";

/** GET /api/health → configuration and upstream status. Never returns secret values. */
export async function GET() {
  await connection();
  const report = await buildHealthReport(
    process.env,
    async () => {
      const token = process.env.MAPBOX_TOKEN;
      if (!token) return { status: "down", error: "MAPBOX_TOKEN not set" };
      const started = Date.now();
      try {
        await new MapboxClient({ token, timeoutMs: 3_000 }).geocode("Denver", { limit: 1 });
        return { status: "ok", latencyMs: Date.now() - started };
      } catch (e) {
        return { status: "down", latencyMs: Date.now() - started, error: (e as Error).message };
      }
    },
    pkg.version,
  );
  return Response.json(report, {
    status: report.status === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
