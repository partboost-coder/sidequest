import { describe, expect, it } from "vitest";

import { cand } from "../helpers/candidates";

import {
  dayAt,
  initialJourney,
  journeyReducer,
  nextStop,
  type JourneyAction,
  type JourneyContext,
  type JourneyState,
} from "@/domain/journey";
import { checkInXp } from "@/domain/xp";

const ordinary = Array.from({ length: 12 }, (_, i) =>
  cand({ id: `o${i}`, alongKm: 20 + i * 10, groupFit: 0.55 + (i % 4) * 0.03, detourMin: 12 }),
);
const star = cand({ id: "star", name: "Taco Heaven", alongKm: 60, groupFit: 0.92, detourMin: 11 });
const stop = cand({ id: "stop1", alongKm: 100, groupFit: 0.9, detourMin: 2 });

const ctx: JourneyContext = {
  days: [
    { index: 0, startKm: 0, endKm: 150, stops: [stop] },
    { index: 1, startKm: 150, endKm: 300, stops: [] },
  ],
  pool: [...ordinary, star],
  routeKm: 300,
};

const run = (actions: JourneyAction[], from: JourneyState = initialJourney()) =>
  actions.reduce((s, a) => journeyReducer(s, a, ctx), from);
const at = "2026-10-13T12:00:00.000Z";

describe("journeyReducer", () => {
  it("offers a Side Quest when the car moves near an outlier, once", () => {
    const s = run([{ type: "move", km: 10 }]);
    expect(s.quest).toMatchObject({ status: "offered", offer: { candidate: { id: "star" } } });
    expect(s.offeredIds).toEqual(["star"]);
    expect(s.offersByDay).toEqual({ 0: 1 });
    // Skipping never re-offers it
    const skipped = run([{ type: "skip" }, { type: "move", km: 20 }], s);
    expect(skipped.quest).toBeUndefined();
    expect(skipped.skipped).toEqual(["star"]);
  });

  it("runs the full loop: accept → arrive → complete → XP + journal", () => {
    const s = run([
      { type: "move", km: 10 },
      { type: "accept" },
      { type: "move", km: 30 }, // still heading there: no new offer
      { type: "arrive" },
      { type: "complete", photo: "/samples/a.svg", rating: 7, note: "  so good ", at },
    ]);
    expect(s.quest).toBeUndefined();
    expect(s.progressKm).toBe(60);
    expect(s.journal).toHaveLength(1);
    expect(s.journal[0]).toMatchObject({
      kind: "side_quest",
      name: "Taco Heaven",
      rating: 5,
      note: "so good",
      photo: "/samples/a.svg",
      km: 60,
    });
    expect(s.xp).toBe(s.journal[0].xp);
    expect(s.xp).toBeGreaterThan(100);
  });

  it("ignores out-of-order quest actions", () => {
    expect(run([{ type: "accept" }])).toEqual(initialJourney());
    const offered = run([{ type: "move", km: 10 }]);
    expect(run([{ type: "complete", at }], offered)).toBe(offered);
    expect(run([{ type: "arrive" }], offered)).toBe(offered);
  });

  it("checks in at a reached planned stop once, for check-in XP", () => {
    expect(run([{ type: "checkIn", stopId: "stop1", at }]).xp).toBe(0); // not reached yet
    const s = run([
      { type: "move", km: 10 },
      { type: "skip" },
      { type: "move", km: 99 },
      { type: "checkIn", stopId: "stop1", at },
      { type: "checkIn", stopId: "stop1", at },
    ]);
    expect(s.checkedIn).toEqual(["stop1"]);
    expect(s.xp).toBe(checkInXp(0.9));
    expect(s.journal.map((e) => e.kind)).toEqual(["check_in"]);
  });

  it("clamps progress to the route and resets", () => {
    expect(run([{ type: "move", km: 999 }]).progressKm).toBe(300);
    expect(run([{ type: "move", km: 10 }, { type: "reset" }])).toEqual(initialJourney());
  });
});

describe("dayAt / nextStop", () => {
  it("finds the day and the next stop ahead", () => {
    expect(dayAt(ctx.days, 0)).toBe(0);
    expect(dayAt(ctx.days, 150)).toBe(1);
    expect(dayAt(ctx.days, 300)).toBe(1);
    expect(nextStop(ctx.days, 50)?.id).toBe("stop1");
    expect(nextStop(ctx.days, 99)).toBeUndefined(); // already arriving
  });
});
