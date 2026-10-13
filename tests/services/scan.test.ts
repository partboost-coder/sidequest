import { describe, expect, it } from "vitest";

import { syntheticRoute } from "../helpers/geometry";

import { CachedQlooClient } from "@/adapters/qloo/cached";
import { CallMeter } from "@/adapters/qloo/meter";
import { MockQlooClient } from "@/adapters/qloo/mock";
import { DEMO_CREW } from "@/config/demoCrew";
import { segmentCorridor } from "@/domain/geo/corridor";
import { scanCorridor } from "@/services/corridorScan";
import { SCORING_BATCH, scoreForTravelers } from "@/services/travelerScoring";

describe("scanCorridor + scoreForTravelers (mock Qloo)", () => {
  const geometry = syntheticRoute();
  const segments = segmentCorridor({ geometry, durationSec: 15.9 * 3600 });

  it("queries each segment × bucket, filters, de-duplicates and orders along the route", async () => {
    const meter = new CallMeter();
    const scan = await scanCorridor(new MockQlooClient(), geometry, segments, DEMO_CREW, { meter });
    expect(scan.queries).toBe(segments.length * 2);
    expect(meter.liveCalls).toBe(segments.length * 2);
    expect(scan.candidates.length).toBeGreaterThan(10);
    expect(new Set(scan.candidates.map((c) => c.id)).size).toBe(scan.candidates.length);
    const along = scan.candidates.map((c) => c.alongKm);
    expect(along).toEqual([...along].sort((a, b) => a - b));
    // Off-route fixtures (Sedona) are outside the 15 km corridor
    expect(scan.candidates.some((c) => c.city === "Sedona")).toBe(false);
  });

  it("scores the top candidates per traveler within the call budget", async () => {
    const meter = new CallMeter();
    const client = new CachedQlooClient(new MockQlooClient());
    const scan = await scanCorridor(client, geometry, segments, DEMO_CREW, { meter });
    const scored = await scoreForTravelers(client, scan.candidates, DEMO_CREW, {
      meter,
      maxCandidates: 100,
    });
    const batches = Math.ceil(Math.min(100, scan.candidates.length) / SCORING_BATCH);
    expect(meter.liveCalls).toBe(segments.length * 2 + batches * DEMO_CREW.length);
    expect(meter.liveCalls).toBeLessThanOrEqual(20);
    for (const c of scored) {
      expect(Object.keys(c.scores!)).toEqual(["matt", "alex"]);
      expect(c.vibePct).toBeGreaterThanOrEqual(0);
      expect(c.vibePct).toBeLessThanOrEqual(99);
    }
  });
});
