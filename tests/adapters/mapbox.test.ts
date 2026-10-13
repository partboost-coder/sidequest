import type { LineString } from "geojson";
import { describe, expect, it } from "vitest";

import { MapboxClient } from "@/adapters/mapbox/client";
import { estimateDetourMin, exactDetourMin } from "@/adapters/mapbox/detour";
import { displayGeometry } from "@/adapters/mapbox/display";
import { MapboxError, type Route } from "@/adapters/mapbox/types";

const TOKEN = "pk.test-token-secret";

function fakeFetch(status: number, body: unknown, seen: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

// Shapes recorded from real Mapbox responses (trimmed).
const GEOCODE_FIXTURE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "dXJuOm1ieHBsYzpBVFZv",
      geometry: { type: "Point", coordinates: [-117.913192, 33.833337] },
      properties: {
        mapbox_id: "dXJuOm1ieHBsYzpBVFZv",
        feature_type: "place",
        full_address: "Anaheim, California, United States",
        name: "Anaheim",
        place_formatted: "California, United States",
      },
    },
  ],
};

const DIRECTIONS_FIXTURE = {
  code: "Ok",
  routes: [
    {
      duration: 57_240,
      distance: 1_630_000,
      geometry: {
        type: "LineString",
        coordinates: [
          [-117.9145, 33.8366],
          [-115.14, 36.17],
          [-104.9903, 39.7392],
        ],
      },
      legs: [{ duration: 57_240, distance: 1_630_000, summary: "I 15 North, I 70" }],
    },
  ],
};

describe("MapboxClient.geocode", () => {
  it("normalizes v6 features and restricts to the US", async () => {
    const seen: string[] = [];
    const client = new MapboxClient({ token: TOKEN, fetch: fakeFetch(200, GEOCODE_FIXTURE, seen) });
    const [place] = await client.geocode("Anaheim");
    expect(place).toEqual({
      id: "dXJuOm1ieHBsYzpBVFZv",
      name: "Anaheim",
      fullName: "Anaheim, California, United States",
      context: "California, United States",
      lon: -117.913192,
      lat: 33.833337,
      kind: "place",
    });
    const url = new URL(seen[0]);
    expect(url.pathname).toBe("/search/geocode/v6/forward");
    expect(url.searchParams.get("country")).toBe("us");
    expect(url.searchParams.get("types")).not.toContain("poi");
  });

  it("skips the network for very short queries", async () => {
    const seen: string[] = [];
    const client = new MapboxClient({ token: TOKEN, fetch: fakeFetch(200, GEOCODE_FIXTURE, seen) });
    expect(await client.geocode(" a ")).toEqual([]);
    expect(seen).toHaveLength(0);
  });
});

describe("MapboxClient.directions", () => {
  it("returns full geometry, duration, distance and legs", async () => {
    const seen: string[] = [];
    const client = new MapboxClient({
      token: TOKEN,
      fetch: fakeFetch(200, DIRECTIONS_FIXTURE, seen),
    });
    const route = await client.directions([
      [-117.9145, 33.8366],
      [-104.9903, 39.7392],
    ]);
    expect(route.durationSec).toBe(57_240);
    expect(route.geometry.coordinates).toHaveLength(3);
    expect(route.legs[0].summary).toBe("I 15 North, I 70");
    expect(seen[0]).toContain(
      "/directions/v5/mapbox/driving/-117.914500,33.836600;-104.990300,39.739200",
    );
    expect(new URL(seen[0]).searchParams.get("geometries")).toBe("geojson");
  });

  it("rejects bad waypoint counts", async () => {
    const client = new MapboxClient({ token: TOKEN, fetch: fakeFetch(200, DIRECTIONS_FIXTURE) });
    await expect(client.directions([[0, 0]])).rejects.toBeInstanceOf(MapboxError);
  });

  it("reports NoRoute as a 422", async () => {
    const client = new MapboxClient({
      token: TOKEN,
      fetch: fakeFetch(200, { code: "NoRoute", message: "No route found", routes: [] }),
    });
    await expect(
      client.directions([
        [-117.9, 33.8],
        [-157.8, 21.3],
      ]),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("surfaces HTTP errors without leaking the token", async () => {
    const client = new MapboxClient({
      token: TOKEN,
      fetch: fakeFetch(401, { message: "Not Authorized - Invalid Token" }),
    });
    const error = (await client.geocode("Denver").catch((e) => e)) as MapboxError;
    expect(error).toBeInstanceOf(MapboxError);
    expect(error.status).toBe(401);
    expect(error.message).toContain("Invalid Token");
    expect(error.message).not.toContain(TOKEN);
  });

  it("requires a token", () => {
    expect(() => new MapboxClient({ token: "" })).toThrow(MapboxError);
  });
});

describe("estimateDetourMin", () => {
  // An east-west "highway" along latitude 36, ~180 km long. Densely sampled like real Mapbox
  // geometry (a 2-point line would be a great-circle arc bowing ~5 km north of the parallel).
  const highway: LineString = {
    type: "LineString",
    coordinates: Array.from({ length: 201 }, (_, i) => [-116 + i * 0.01, 36]),
  };

  it("is zero for points on the route", () => {
    const est = estimateDetourMin(highway, [-115, 36]);
    expect(est.detourMin).toBe(0);
    expect(est.alongKm).toBeGreaterThan(85);
    expect(est.alongKm).toBeLessThan(95);
  });

  it("grows with distance from the route", () => {
    const near = estimateDetourMin(highway, [-115, 36.05]); // ~5.6 km off
    const far = estimateDetourMin(highway, [-115, 36.3]); // ~33 km off
    expect(near.offRouteKm).toBeCloseTo(5.6, 0);
    expect(near.detourMin).toBeGreaterThan(0);
    expect(far.detourMin).toBeGreaterThan(near.detourMin * 3);
    // 33 km off, out and back × 1.3 road factor ≈ 86 road-km at 70 km/h ≈ 74 min, + 4 min ≈ 78 min
    expect(far.detourMin).toBeGreaterThan(70);
    expect(far.detourMin).toBeLessThan(85);
  });
});

describe("exactDetourMin", () => {
  it("is the extra time of A→P→B over A→B", async () => {
    const route = (durationSec: number): Route => ({
      geometry: { type: "LineString", coordinates: [] },
      durationSec,
      distanceM: 0,
      legs: [],
    });
    const fake = {
      directions: async (points: [number, number][]) => route(points.length === 3 ? 4_500 : 3_600),
    };
    expect(await exactDetourMin(fake, [0, 0], [0.1, 0.1], [1, 1])).toBe(15);
  });
});

describe("displayGeometry", () => {
  it("reduces point count while keeping endpoints", () => {
    const coordinates = Array.from({ length: 5_000 }, (_, i) => [
      -117 + i * 0.002,
      34 + Math.sin(i / 200) * 0.01,
    ]);
    const out = displayGeometry({ type: "LineString", coordinates });
    expect(out.coordinates.length).toBeLessThan(500);
    expect(out.coordinates[0]).toEqual([-117, 34]);
    expect(out.coordinates.at(-1)![0]).toBeCloseTo(coordinates.at(-1)![0], 4);
  });
});
