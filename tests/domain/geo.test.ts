import { describe, expect, it } from "vitest";

import { pointInPolygonRing, syntheticRoute } from "../helpers/geometry";

import { ringToWkt, segmentCorridor, segmentFor } from "@/domain/geo/corridor";
import { alongKm, pointAt, progressFraction, routeLengthKm } from "@/domain/geo/progress";

describe("segmentCorridor", () => {
  const geometry = syntheticRoute();
  const segments = segmentCorridor({ geometry, durationSec: 15.9 * 3600 });

  it("splits ~16 h of driving into ~2.5 h segments covering the whole route", () => {
    expect(segments).toHaveLength(7);
    expect(segments[0].startKm).toBe(0);
    expect(segments.at(-1)!.endKm).toBeCloseTo(routeLengthKm(geometry), 0);
    for (let i = 1; i < segments.length; i++)
      expect(segments[i].startKm).toBe(segments[i - 1].endKm);
  });

  it("keeps polygons within the vertex budget, as lon-first WKT", () => {
    for (const s of segments) {
      expect(s.ring.length).toBeLessThanOrEqual(41); // ≤ 40 vertices + closing point
      expect(s.wkt.startsWith("POLYGON((-1")).toBe(true); // longitude (negative in the US) first
      expect(s.wkt.length).toBeLessThan(1200);
    }
  });

  it("covers the route: midpoints of each segment are inside its polygon", () => {
    for (const s of segments) {
      const mid = pointAt(geometry, (s.startKm + s.endKm) / 2);
      expect(pointInPolygonRing(mid, s.ring)).toBe(true);
    }
  });

  it("finds the segment for a km position", () => {
    expect(segmentFor(segments, 0)?.index).toBe(0);
    expect(segmentFor(segments, segments[3].startKm + 1)?.index).toBe(3);
  });

  it("returns one segment for short drives and none for empty routes", () => {
    expect(
      segmentCorridor({
        geometry: { type: "LineString", coordinates: geometry.coordinates.slice(0, 20) },
        durationSec: 3600,
      }),
    ).toHaveLength(1);
    expect(
      segmentCorridor({
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [0, 0],
          ],
        },
        durationSec: 0,
      }),
    ).toHaveLength(0);
  });

  it("closes WKT rings", () => {
    expect(
      ringToWkt([
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toBe("POLYGON((0 0, 1 0, 1 1, 0 0))");
  });
});

describe("route progress", () => {
  const geometry = syntheticRoute();
  const total = routeLengthKm(geometry);

  it("round-trips pointAt and alongKm", () => {
    const p = pointAt(geometry, 500);
    expect(alongKm(geometry, p)).toBeCloseTo(500, 0);
  });

  it("clamps positions and reports progress", () => {
    expect(pointAt(geometry, -10)).toEqual(pointAt(geometry, 0));
    expect(progressFraction(geometry, total / 2)).toBeCloseTo(0.5, 2);
    expect(progressFraction(geometry, total * 2)).toBe(1);
  });
});
