import { describe, expect, it } from "vitest";

import { cand } from "../helpers/candidates";

import type { Candidate } from "@/domain/candidate";
import { findSideQuest, medianMad, questTitle, robustZ } from "@/domain/scout";

/** A typical stretch: 12 ordinary candidates around G 0.55–0.66, plus optional outliers. */
function stretch(extra: Candidate[] = []): Candidate[] {
  const ordinary = Array.from({ length: 12 }, (_, i) =>
    cand({ id: `o${i}`, alongKm: 20 + i * 10, groupFit: 0.55 + (i % 4) * 0.03, detourMin: 12 }),
  );
  return [...ordinary, ...extra];
}

const base = { progressKm: 0, dayIndex: 0, offersToday: 0, offeredIds: [] as string[] };

describe("medianMad / robustZ", () => {
  it("computes median and MAD", () => {
    expect(medianMad([1, 2, 3, 4, 100])).toEqual({ median: 3, mad: 1 });
  });

  it("floors the scale so a flat baseline doesn't explode", () => {
    expect(robustZ(0.7, [0.6, 0.6, 0.6, 0.6])).toBeCloseTo(0.1 / 0.03, 6);
  });
});

describe("findSideQuest", () => {
  const star = cand({
    id: "star",
    name: "Taco Heaven",
    alongKm: 40,
    groupFit: 0.92,
    detourMin: 11,
    tags: [{ id: "urn:tag:category:place:taco_restaurant", name: "Taco" }],
  });

  it("fires on a local outlier just ahead, with title and XP", () => {
    const offer = findSideQuest(stretch([star]), base);
    expect(offer?.candidate.id).toBe("star");
    expect(offer?.title).toBe("The Taco Detour");
    expect(offer?.emoji).toBe("🌮");
    expect(offer!.z).toBeGreaterThan(1.5);
    expect(offer!.xp).toBe(100 + 30 + 22);
  });

  it("stays quiet when nothing stands out", () => {
    expect(findSideQuest(stretch(), base)).toBeUndefined();
  });

  it("respects the look-ahead window and detour band", () => {
    expect(findSideQuest(stretch([{ ...star, alongKm: 200 }]), base)).toBeUndefined(); // too far ahead
    expect(findSideQuest(stretch([{ ...star, alongKm: 2 }]), base)).toBeUndefined(); // already passing it
    expect(findSideQuest(stretch([{ ...star, detourMin: 40 }]), base)).toBeUndefined(); // too far off route
    expect(findSideQuest(stretch([{ ...star, detourMin: 1 }]), base)).toBeUndefined(); // on the route: not a detour
  });

  it("respects cooldown, the daily cap and never repeats", () => {
    const pool = stretch([star]);
    expect(findSideQuest(pool, { ...base, progressKm: 10, lastOfferKm: 0 })).toBeUndefined();
    expect(findSideQuest(pool, { ...base, offersToday: 2 })).toBeUndefined();
    expect(findSideQuest(pool, { ...base, offeredIds: new Set(["star"]) })).toBeUndefined();
  });

  it("falls back to the whole pool when the local baseline is too small", () => {
    const sparse = [cand({ id: "lonely", alongKm: 1000, groupFit: 0.9, detourMin: 10 })];
    const elsewhere = Array.from({ length: 10 }, (_, i) =>
      cand({ id: `e${i}`, alongKm: i * 10, groupFit: 0.5 }),
    );
    expect(
      findSideQuest([...elsewhere, ...sparse], { ...base, progressKm: 960 })?.candidate.id,
    ).toBe("lonely");
  });

  it("requires a minimum absolute group fit", () => {
    const weakStar = { ...star, groupFit: 0.75 };
    expect(findSideQuest(stretch([weakStar]), base)).toBeUndefined();
  });
});

describe("questTitle", () => {
  it("falls back to a generic title", () => {
    expect(questTitle(cand({ id: "x", name: "Mystery" }))).toEqual({
      title: "The Side Quest",
      emoji: "✨",
    });
    expect(
      questTitle(
        cand({ id: "y", tags: [{ id: "urn:tag:category:place:hot_spring", name: "Hot spring" }] }),
      ).title,
    ).toBe("The Hot Springs Soak");
  });
});
