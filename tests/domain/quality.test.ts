import { describe, expect, it } from "vitest";

import { EXCLUDED_TAGS } from "@/config/buckets";
import { filterCandidates, isChain, normalizeName } from "@/domain/quality/filters";

describe("normalizeName", () => {
  it("normalizes accents, punctuation, ampersands, store numbers and branch suffixes", () => {
    expect(normalizeName("Phở 79")).toBe("pho 79");
    expect(normalizeName("Dave & Buster's")).toBe("dave and busters");
    expect(normalizeName("Starbucks #10234")).toBe("starbucks");
    expect(normalizeName("Denny's - Barstow")).toBe("dennys");
    expect(normalizeName("Chick-fil-A")).toBe("chick fil a");
  });
});

describe("isChain", () => {
  it.each([
    "Starbucks",
    "Starbucks Reserve Roastery",
    "Panera Bread",
    "McDonald's",
    "The Cheesecake Factory",
    "In-N-Out Burger",
    "Denny's - Barstow",
    "Love's Travel Stop",
    "Buc-ee's",
  ])("flags %s", (name) => expect(isChain(name)).toBe(true));

  it.each([
    "Phở 79",
    "Guelaguetza Restaurant",
    "Bad Owl Coffee Roasters",
    "Sonic Youth Records", // "sonic drive in" is listed, not bare "sonic"
    "The Broad",
    "Targeted Tacos", // prefix match is word-based, not substring
    "Subwayfarer Cafe",
  ])("keeps %s", (name) => expect(isChain(name)).toBe(false));
});

describe("filterCandidates", () => {
  const base = { location: { lat: 36, lon: -115 }, tags: [] as { id: string }[] };

  it("drops closed, chain, excluded-tag, location-less and duplicate candidates with reasons", () => {
    const candidates = [
      { ...base, id: "1", name: "Bad Owl Coffee Roasters" },
      { ...base, id: "2", name: "Starbucks" },
      { ...base, id: "3", name: "Closed Diner", isClosed: true },
      {
        ...base,
        id: "4",
        name: "Luxor Hotel & Casino",
        tags: [{ id: "urn:tag:category:place:casino" }],
      },
      { id: "5", name: "Nowhere Cafe", tags: [] },
      { ...base, id: "1", name: "Bad Owl Coffee Roasters" },
    ];
    const { kept, dropped } = filterCandidates(candidates, EXCLUDED_TAGS);
    expect(kept.map((c) => c.id)).toEqual(["1"]);
    expect(dropped.map((d) => [d.candidate.id, d.reason])).toEqual([
      ["2", "chain"],
      ["3", "closed"],
      ["4", "excluded_tag"],
      ["5", "no_location"],
      ["1", "duplicate"],
    ]);
  });
});
