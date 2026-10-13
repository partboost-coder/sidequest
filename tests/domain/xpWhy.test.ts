import { describe, expect, it } from "vitest";

import { cand } from "../helpers/candidates";

import { DEMO_CREW } from "@/config/demoCrew";
import { templateWhy } from "@/domain/explain";
import { checkInXp, matchBonus, sideQuestXp } from "@/domain/xp";

describe("XP", () => {
  it("clamps the match bonus to 0–50", () => {
    expect(matchBonus(0.5)).toBe(0);
    expect(matchBonus(0.9)).toBe(25);
    expect(matchBonus(1.2)).toBe(50);
  });

  it("scores side quests and check-ins", () => {
    expect(sideQuestXp(0.96, 11)).toBe(100 + 40 + 22);
    expect(sideQuestXp(0.7, 60)).toBe(100 + 0 + 50); // detour bonus capped
    expect(checkInXp(0.6)).toBe(50);
  });
});

describe("templateWhy", () => {
  const coffeeGallery = cand({
    id: "p",
    groupFit: 0.94,
    vibePct: 94,
    scores: {
      matt: { affinity: 0.8, percentile: 0.93 },
      alex: { affinity: 0.9, percentile: 0.95 },
    },
    tags: [
      { id: "urn:tag:category:place:coffee_shop", name: "Coffee shop" },
      { id: "urn:tag:category:place:art_gallery", name: "Art gallery" },
    ],
    contributions: [{ signalId: "F8CD265E-D9F9-447E-838C-9C004DB8F36F", score: 0.4 }], // Phở 79 (Matt)
    especiallyFor: ["alex"],
    specialtyDishes: ["Horchata Latte", "Concha"],
  });

  it("builds a headline with per-traveler scores", () => {
    expect(templateWhy(coffeeGallery, DEMO_CREW).headline).toBe(
      "94% Your Vibe · Matt 93 · Alex 95",
    );
  });

  it("uses taste-tag overlap, with explainability only as a tie-breaker", () => {
    const why = templateWhy(coffeeGallery, DEMO_CREW);
    expect(why.reasons).toEqual([
      { travelerId: "matt", text: "Matt: because of Phở 79", loves: ["Phở 79"] },
      { travelerId: "alex", text: "Alex: art, coffee", loves: ["art", "coffee"] },
    ]);
    expect(why.sentence).toBe(
      "Picked for Matt's love of Phở 79 and Alex's love of art and coffee. Especially for Alex. Known for horchata latte and concha.",
    );
  });

  it("falls back gracefully with no overlap or snippet", () => {
    const plain = cand({ id: "z", vibePct: 61 });
    expect(templateWhy(plain, DEMO_CREW).sentence).toBe(
      "A strong match for your crew's overall taste.",
    );
  });

  it("excerpts long descriptions to the first sentence", () => {
    const why = templateWhy(
      cand({ id: "d", description: "A desert hot spring with rainbow terraces. Bring a towel." }),
      DEMO_CREW,
    );
    expect(why.snippet).toBe("A desert hot spring with rainbow terraces.");
  });
});

describe("templateWhy text cleanup", () => {
  it("drops connector debris from dish names", () => {
    const why = templateWhy(
      cand({ id: "bbq", specialtyDishes: ["And Cornbread", "BBQ Chicken"] }),
      DEMO_CREW,
    );
    expect(why.snippet).toBe("Known for cornbread and bbq chicken");
  });

  it("doesn't add a period after an ellipsis", () => {
    const long = "A".repeat(200) + ". Second sentence.";
    const why = templateWhy(cand({ id: "long", description: long }), DEMO_CREW);
    expect(why.sentence.endsWith("…")).toBe(true);
  });
});
