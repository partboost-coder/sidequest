import { describe, expect, it } from "vitest";

import { cand } from "../helpers/candidates";

import { naiveItinerary } from "@/domain/itinerary/naive";

describe("naiveItinerary", () => {
  it("splits the route into equal days and picks the best nearby stops in route order", () => {
    const candidates = [
      cand({ id: "a", alongKm: 50, groupFit: 0.9 }),
      cand({ id: "b", alongKm: 20, groupFit: 0.8, bucket: "experience" }),
      cand({ id: "c", alongKm: 80, groupFit: 0.7, bucket: "experience" }),
      cand({ id: "d", alongKm: 150, groupFit: 0.95 }),
      cand({ id: "e", alongKm: 160, groupFit: 0.85, bucket: "experience" }),
    ];
    const { days, pool } = naiveItinerary(candidates, 200, { days: 2 });
    expect(days.map((d) => [d.startKm, d.endKm])).toEqual([
      [0, 100],
      [100, 200],
    ]);
    expect(days[0].stops.map((s) => s.id)).toEqual(["b", "a", "c"]); // ordered along the route
    expect(days[1].stops.map((s) => s.id)).toEqual(["d", "e"]);
    expect(pool).toHaveLength(0);
  });

  it("caps stops per day and per bucket and leaves the rest for the Scout", () => {
    const food = Array.from({ length: 5 }, (_, i) =>
      cand({ id: `f${i}`, alongKm: i * 10, groupFit: 0.9 - i * 0.01 }),
    );
    const { days, pool } = naiveItinerary(food, 100, { days: 1 });
    expect(days[0].stops).toHaveLength(2); // maxPerBucket = 2
    expect(pool.map((c) => c.id)).toEqual(["f2", "f3", "f4"]);
  });

  it("keeps long detours out of the plan (they become Side Quest candidates)", () => {
    const { days, pool } = naiveItinerary(
      [cand({ id: "far", alongKm: 10, groupFit: 0.99, detourMin: 20 })],
      100,
      { days: 1 },
    );
    expect(days[0].stops).toHaveLength(0);
    expect(pool.map((c) => c.id)).toEqual(["far"]);
  });

  it("fills to the minimum below the floor, flagged as belowFloor", () => {
    const quiet = [
      cand({ id: "q1", alongKm: 10, groupFit: 0.3 }),
      cand({ id: "q2", alongKm: 20, groupFit: 0.2, bucket: "experience" }),
    ];
    const { days } = naiveItinerary(quiet, 100, { days: 1 });
    expect(days[0].stops.map((s) => [s.id, s.belowFloor])).toEqual([
      ["q1", true],
      ["q2", true],
    ]);
  });

  it("never plans the same place twice", () => {
    const { days } = naiveItinerary([cand({ id: "x", alongKm: 100, groupFit: 0.9 })], 200, {
      days: 2,
    });
    expect(days.flatMap((d) => d.stops).map((s) => s.id)).toEqual(["x"]);
  });
});
