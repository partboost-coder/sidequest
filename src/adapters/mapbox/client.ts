import { z } from "zod";

import { MapboxError, type LonLat, type Place, type Route } from "./types";

/**
 * Pure Mapbox client: token and fetch are injected, so it can be unit-tested and must only be
 * constructed on the server (see index.ts). Geocoding v6 + Directions v5 (driving).
 */

const API = "https://api.mapbox.com";

const geocodeResponseSchema = z.looseObject({
  features: z.array(
    z.looseObject({
      id: z.string().optional(),
      geometry: z.looseObject({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.looseObject({
        mapbox_id: z.string().optional(),
        feature_type: z.string().optional(),
        name: z.string(),
        full_address: z.string().optional(),
        place_formatted: z.string().optional(),
      }),
    }),
  ),
});

const directionsResponseSchema = z.looseObject({
  code: z.string(),
  message: z.string().optional(),
  routes: z
    .array(
      z.looseObject({
        duration: z.number(),
        distance: z.number(),
        geometry: z.looseObject({
          type: z.literal("LineString"),
          coordinates: z.array(z.array(z.number())),
        }),
        legs: z
          .array(
            z.looseObject({
              duration: z.number(),
              distance: z.number(),
              summary: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export interface MapboxClientOptions {
  token: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface GeocodeOptions {
  limit?: number;
  types?: string[];
  /** Bias results toward a point. */
  proximity?: LonLat;
}

export class MapboxClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: MapboxClientOptions) {
    if (!options.token) throw new MapboxError("Mapbox token is required");
    this.fetchImpl = options.fetch ?? fetch;
  }

  /** US-only forward geocoding (Geocoding v6). */
  async geocode(query: string, opts: GeocodeOptions = {}): Promise<Place[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const params = new URLSearchParams({
      q,
      country: "us",
      limit: String(opts.limit ?? 5),
      types: (opts.types ?? ["place", "locality", "neighborhood", "address"]).join(","),
      autocomplete: "true",
    });
    if (opts.proximity) params.set("proximity", opts.proximity.join(","));
    const json = await this.get(`/search/geocode/v6/forward?${params}`);
    const parsed = geocodeResponseSchema.parse(json);
    return parsed.features.map((f) => ({
      id: f.properties.mapbox_id ?? f.id ?? `${f.geometry.coordinates.join(",")}`,
      name: f.properties.name,
      fullName: f.properties.full_address ?? f.properties.name,
      context: f.properties.place_formatted,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      kind: f.properties.feature_type ?? "place",
    }));
  }

  /** Driving route through 2–25 waypoints, full-resolution GeoJSON geometry. */
  async directions(waypoints: LonLat[]): Promise<Route> {
    if (waypoints.length < 2 || waypoints.length > 25) {
      throw new MapboxError(`Directions needs 2–25 waypoints, got ${waypoints.length}`, 400);
    }
    const coords = waypoints.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(";");
    const params = new URLSearchParams({ geometries: "geojson", overview: "full", steps: "false" });
    const json = await this.get(`/directions/v5/mapbox/driving/${coords}?${params}`);
    const parsed = directionsResponseSchema.parse(json);
    const route = parsed.routes[0];
    if (parsed.code !== "Ok" || !route) {
      throw new MapboxError(
        `No driving route found (${parsed.code}${parsed.message ? `: ${parsed.message}` : ""})`,
        422,
      );
    }
    return {
      geometry: { type: "LineString", coordinates: route.geometry.coordinates },
      durationSec: route.duration,
      distanceM: route.distance,
      legs: route.legs.map((l) => ({
        durationSec: l.duration,
        distanceM: l.distance,
        summary: l.summary,
      })),
    };
  }

  private async get(pathAndQuery: string): Promise<unknown> {
    const sep = pathAndQuery.includes("?") ? "&" : "?";
    const url = `${API}${pathAndQuery}${sep}access_token=${encodeURIComponent(this.options.token)}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
      });
    } catch (e) {
      throw new MapboxError(`Mapbox request failed: ${(e as Error).message}`);
    }
    const body = await res.json().catch(() => undefined);
    if (!res.ok) {
      const message = (body as { message?: string } | undefined)?.message ?? res.statusText;
      // Never include the URL: it contains the token.
      throw new MapboxError(`Mapbox ${res.status}: ${message}`, res.status);
    }
    return body;
  }
}
