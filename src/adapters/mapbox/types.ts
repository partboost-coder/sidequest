import type { LineString } from "geojson";

export type LonLat = [lon: number, lat: number];

export interface Place {
  id: string;
  name: string;
  /** e.g. "Anaheim, California, United States" */
  fullName: string;
  /** e.g. "California, United States" */
  context?: string;
  lon: number;
  lat: number;
  kind: string;
}

export interface RouteLeg {
  durationSec: number;
  distanceM: number;
  summary?: string;
}

export interface Route {
  /** Full-resolution geometry (server-side corridor math). */
  geometry: LineString;
  durationSec: number;
  distanceM: number;
  legs: RouteLeg[];
}

export class MapboxError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MapboxError";
  }
}
