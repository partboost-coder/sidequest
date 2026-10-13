import { describe, expect, it } from "vitest";

import { syntheticRoute } from "../helpers/geometry";

import { CachedQlooClient } from "@/adapters/qloo/cached";
import { CallMeter } from "@/adapters/qloo/meter";
import { MockQlooClient } from "@/adapters/qloo/mock";
import { DEMO_CREW } from "@/config/demoCrew";
import type { Candidate } from "@/domain/candidate";
import { segmentCorridor } from "@/domain/geo/corridor";
import { scanCorridor } from "@/services/corridorScan";
import { SCORING_BATCH, scoreForTravelers, selectForScoring } from "@/services/travelerScoring";

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

describe("selectForScoring", () => {
  const c = (id: string, segmentIndex: number, groupQueryAffinity: number) =>
    ({ id, segmentIndex, groupQueryAffinity }) as Parameters<typeof selectForScoring>[0][number];

  it("reserves slots for every segment before filling by affinity", () => {
    const metro = Array.from({ length: 20 }, (_, i) => c(`m${i}`, 0, 0.95 - i * 0.001));
    const rural = [c("r1", 1, 0.7), c("r2", 1, 0.69), c("r3", 2, 0.65)];
    const picked = selectForScoring([...metro, ...rural], 9).map((x) => x.id);
    expect(picked).toHaveLength(9);
    expect(picked).toEqual(expect.arrayContaining(["r1", "r2", "r3"]));
  });

  it("returns everything when under the cap", () => {
    expect(selectForScoring([c("a", 0, 0.5), c("b", 1, 0.9)], 10).map((x) => x.id)).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("scoreForTravelers selection", () => {
  it("sends rural candidates to Qloo even when metro areas have higher group affinity", async () => {
    const requested: string[] = [];
    const fakeClient = {
      search: async () => [],
      tags: async () => [],
      insights: async (params: { filter?: { entities?: string[] } }) => {
        requested.push(...(params.filter?.entities ?? []));
        return {
          entities: (params.filter?.entities ?? []).map((id) => ({
            id,
            name: id,
            types: [],
            tags: [],
            affinity: 0.8,
          })),
        };
      },
    };
    const make = (id: string, segmentIndex: number, groupQueryAffinity: number) =>
      ({
        id,
        name: id,
        lat: 0,
        lon: 0,
        tags: [],
        bucket: "food",
        segmentIndex,
        groupQueryAffinity,
        contributions: [],
        alongKm: 0,
        offRouteKm: 0,
        detourMin: 0,
      }) as Candidate;
    const metro = Array.from({ length: 120 }, (_, i) => make(`metro${i}`, 0, 0.95));
    const rural = Array.from({ length: 10 }, (_, i) => make(`rural${i}`, 3, 0.7));
    await scoreForTravelers(fakeClient as never, [...metro, ...rural], DEMO_CREW, {
      maxCandidates: 100,
    });
    expect(requested.filter((id) => id.startsWith("rural")).length).toBe(10 * DEMO_CREW.length);
  });
});
