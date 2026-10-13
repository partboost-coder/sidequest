import { lineString, nearestPointOnLine, point } from "@turf/turf";
import type { LineString } from "geojson";

import type { MapboxClient } from "./client";
import type { LonLat } from "./types";

export interface DetourEstimate {
  /** Estimated extra minutes to visit the point and return to the route. */
  detourMin: number;
  /** Straight-line distance from the route, km. */
  offRouteKm: number;
  /** How far along the route the closest point is, km (used for "progress along route"). */
  alongKm: number;
}

/**
 * Cheap estimate used for every candidate (no API call): out-and-back at an assumed off-highway
 * speed, plus a fixed allowance for exiting and re-entering. Straight-line distance understates
 * road distance, so a road factor is applied.
 */
export function estimateDetourMin(
  route: LineString,
  [lon, lat]: LonLat,
  { speedKmh = 70, roadFactor = 1.3, overheadMin = 4 } = {},
): DetourEstimate {
  const nearest = nearestPointOnLine(lineString(route.coordinates), point([lon, lat]), {
    units: "kilometers",
  });
  const offRouteKm = nearest.properties.dist ?? 0;
  const alongKm = nearest.properties.location ?? 0;
  const driveMin = ((2 * offRouteKm * roadFactor) / speedKmh) * 60;
  const detourMin = offRouteKm < 0.2 ? 0 : Math.round(driveMin + overheadMin);
  return { detourMin, offRouteKm: round1(offRouteKm), alongKm: round1(alongKm) };
}

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

const round1 = (n: number) => Math.round(n * 10) / 10;
