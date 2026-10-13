import { along, length, lineString, nearestPointOnLine, point } from "@turf/turf";
import type { LineString } from "geojson";

import type { LonLat } from "./types";

const KM = { units: "kilometers" } as const;

export function routeLengthKm(route: LineString): number {
  return length(lineString(route.coordinates), KM);
}

/** Distance along the route (km) of the route point closest to `p`. */
export function alongKm(route: LineString, [lon, lat]: LonLat): number {
  return (
    nearestPointOnLine(lineString(route.coordinates), point([lon, lat]), KM).properties.location ??
    0
  );
}

/** The point `km` along the route (clamped to the route's ends). */
export function pointAt(route: LineString, km: number): LonLat {
  const line = lineString(route.coordinates);
  const clamped = Math.min(Math.max(km, 0), length(line, KM));
  const [lon, lat] = along(line, clamped, KM).geometry.coordinates;
  return [lon, lat];
}

/** 0–1 progress for a km position. */
export function progressFraction(route: LineString, km: number): number {
  const total = routeLengthKm(route);
  return total === 0 ? 0 : Math.min(Math.max(km / total, 0), 1);
}
