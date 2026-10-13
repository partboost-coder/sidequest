import { describe, expect, it } from "vitest";

import type { Candidate } from "@/domain/candidate";
import {
  especiallyFor,
  percentileRanks,
  powerMean,
  scoreCandidates,
  vibePct,
} from "@/domain/scoring";

describe("percentileRanks", () => {
  it("ranks within the list, splitting ties", () => {
    expect(percentileRanks([0.8, 0.9, 0.7, 0.9])).toEqual([0.375, 0.75, 0.125, 0.75]);
    expect(percentileRanks([])).toEqual([]);
  });
});

describe("powerMean", () => {
  it("is a soft minimum at p = -2", () => {
    expect(powerMean([0.9, 0.9])).toBeCloseTo(0.9, 6);
    const balanced = powerMean([0.7, 0.7]);
    const lopsided = powerMean([0.99, 0.41]); // same arithmetic mean
    expect(lopsided).toBeLessThan(balanced);
    expect(powerMean([0.95, 0.3])).toBeGreaterThan(0.3);
    expect(powerMean([0.95, 0.3])).toBeLessThan(0.5);
  });

  it("guards zeros", () => {
    expect(Number.isFinite(powerMean([0, 0.9]))).toBe(true);
  });
});

describe("vibePct and especiallyFor", () => {
  it("caps the vibe at 99", () => {
    expect(vibePct(0.999)).toBe(99);
    expect(vibePct(0.743)).toBe(74);
  });

  it("requires a high percentile and a clear margin", () => {
    expect(
      especiallyFor({
        matt: { affinity: 0, percentile: 0.95 },
        alex: { affinity: 0, percentile: 0.6 },
      }),
    ).toEqual(["matt"]);
    expect(
      especiallyFor({
        matt: { affinity: 0, percentile: 0.95 },
        alex: { affinity: 0, percentile: 0.9 },
      }),
    ).toEqual([]);
    expect(especiallyFor({ solo: { affinity: 0, percentile: 0.9 } })).toEqual(["solo"]);
  });
});

describe("scoreCandidates", () => {
  const candidate = (id: string): Candidate => ({
    id,
    name: id,
    lat: 0,
    lon: 0,
    tags: [],
    bucket: "food",
    segmentIndex: 0,
    groupQueryAffinity: 0.8,
    contributions: [],
    alongKm: 0,
    offRouteKm: 0,
    detourMin: 0,
  });

  it("scores per traveler, then combines into group fit", () => {
    const scored = scoreCandidates([candidate("a"), candidate("b"), candidate("c")], {
      matt: { a: 0.9, b: 0.8, c: 0.7 },
      alex: { a: 0.9, b: 0.7, c: 0.8 },
    });
    const byId = Object.fromEntries(scored.map((c) => [c.id, c]));
    expect(byId.a.groupFit).toBeGreaterThan(byId.b.groupFit!); // both love a
    expect(byId.b.scores!.matt.percentile).toBeGreaterThan(byId.b.scores!.alex.percentile);
    expect(byId.a.vibePct).toBe(vibePct(byId.a.groupFit!));
  });

  it("drops candidates a traveler couldn't score", () => {
    const scored = scoreCandidates([candidate("a"), candidate("b")], {
      matt: { a: 0.9, b: 0.8 },
      alex: { a: 0.9 },
    });
    expect(scored.map((c) => c.id)).toEqual(["a"]);
  });
});
