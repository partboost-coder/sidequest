import type { MapboxClient } from "./client";
import type { LonLat } from "./types";

export { estimateDetourMin, type DetourEstimate } from "@/domain/geo/detour";

/**
 * Exact detour via Directions: time(A → P → B) − time(A → B), where A and B are points on the
 * route before and after the stop. Used for selected stops and Side Quests only (two API calls).
 */
export async function exactDetourMin(
  mapbox: Pick<MapboxClient, "directions">,
  a: LonLat,
  p: LonLat,
  b: LonLat,
): Promise<number> {
  const [direct, via] = await Promise.all([
    mapbox.directions([a, b]),
    mapbox.directions([a, p, b]),
  ]);
  return Math.max(0, Math.round((via.durationSec - direct.durationSec) / 60));
}
