import { buffer, lineSliceAlong, lineString, simplify } from "@turf/turf";
import type { Feature, LineString, MultiPolygon, Polygon, Position } from "geojson";

import { routeLengthKm } from "./progress";
import type { LonLat, RouteGeometry } from "./types";

export interface CorridorSegment {
  index: number;
  startKm: number;
  endKm: number;
  /** Closed ring, [lon, lat], ≤ maxVertices points. */
  ring: LonLat[];
  /** POLYGON WKT, longitude first (Qloo `filter.location`). */
  wkt: string;
}

export interface CorridorOptions {
  /** Target hours of driving per segment. */
  segmentHours?: number;
  /** Half-width of the corridor, km. */
  bufferKm?: number;
  /** Vertex budget per polygon (keeps GET URLs short). */
  maxVertices?: number;
}

/**
 * Splits a route into ~equal drive-time segments and turns each into a buffered, simplified
 * corridor polygon for Qloo. Driving time is assumed proportional to distance along the line.
 */
export function segmentCorridor(
  route: RouteGeometry,
  options: CorridorOptions = {},
): CorridorSegment[] {
  const { segmentHours = 2.5, bufferKm = 15, maxVertices = 40 } = options;
  const totalKm = routeLengthKm(route.geometry);
  if (totalKm === 0) return [];
  const hours = route.durationSec / 3600;
  const count = Math.max(1, Math.ceil(hours / segmentHours));
  const stepKm = totalKm / count;
  const line = lineString(route.geometry.coordinates);

  return Array.from({ length: count }, (_, index) => {
    const startKm = index * stepKm;
    const endKm = index === count - 1 ? totalKm : (index + 1) * stepKm;
    const slice = lineSliceAlong(line, startKm, endKm, { units: "kilometers" });
    const ring = simplifiedRing(
      buffer(slice, bufferKm, { units: "kilometers", steps: 4 })!,
      maxVertices,
    );
    return { index, startKm: round1(startKm), endKm: round1(endKm), ring, wkt: ringToWkt(ring) };
  });
}

/** Largest polygon's outer ring, simplified with increasing tolerance until within budget. */
function simplifiedRing(feature: Feature<Polygon | MultiPolygon>, maxVertices: number): LonLat[] {
  const outer = (f: Feature<Polygon | MultiPolygon>): Position[] =>
    f.geometry.type === "Polygon"
      ? f.geometry.coordinates[0]
      : f.geometry.coordinates.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
  let tolerance = 0.002;
  let ring = outer(feature);
  for (let i = 0; i < 12 && ring.length > maxVertices; i++) {
    ring = outer(simplify(feature, { tolerance, highQuality: true }));
    tolerance *= 1.6;
  }
  return ring.map(([lon, lat]) => [round4(lon), round4(lat)]);
}

export function ringToWkt(ring: LonLat[]): string {
  const closed =
    ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring : [...ring, ring[0]];
  return `POLYGON((${closed.map(([lon, lat]) => `${lon} ${lat}`).join(", ")}))`;
}

/** The segment containing a km position. */
export function segmentFor(segments: CorridorSegment[], km: number): CorridorSegment | undefined {
  return segments.find((s) => km >= s.startKm && km <= s.endKm) ?? segments.at(-1);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export type { LineString };
