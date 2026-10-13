import type { LineString } from "geojson";

export type LonLat = [lon: number, lat: number];

/** A route as the domain sees it: full-resolution geometry plus total driving time. */
export interface RouteGeometry {
  geometry: LineString;
  durationSec: number;
}
