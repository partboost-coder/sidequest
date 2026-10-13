import { lineString, simplify } from "@turf/turf";
import type { LineString } from "geojson";

/**
 * Simplified geometry for the browser. The full Anaheim → Denver route is ~12.8k points; the map
 * only needs a few hundred. Corridor math always uses the full-resolution geometry.
 */
export function displayGeometry(route: LineString, tolerance = 0.002): LineString {
  const simplified = simplify(lineString(route.coordinates), { tolerance, highQuality: false });
  return {
    type: "LineString",
    coordinates: simplified.geometry.coordinates.map(([lon, lat]) => [round5(lon), round5(lat)]),
  };
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
