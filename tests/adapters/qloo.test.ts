import { describe, expect, it } from "vitest";

import {
  CachedQlooClient,
  MemoryCacheStore,
  cacheKey,
  stableStringify,
} from "@/adapters/qloo/cached";
import type { QlooClient } from "@/adapters/qloo/client";
import { QlooError } from "@/adapters/qloo/client";
import { createQlooClient } from "@/adapters/qloo/create";
import { MOCK_ENTITIES } from "@/adapters/qloo/fixtures/entities";
import { MOCK_TAGS } from "@/adapters/qloo/fixtures/tags";
import { MockQlooClient } from "@/adapters/qloo/mock";
import { normalizeInsightsResponse, parseContributions } from "@/adapters/qloo/normalize";
import { pointWkt, polygonWkt, toQueryString } from "@/adapters/qloo/params";
import { RealQlooClient } from "@/adapters/qloo/real";
import type { InsightsParams } from "@/adapters/qloo/types";

// Demo crew favorites (mock IDs)
const TRAVELER_1 = [
  "mock-place-pho-79",
  "mock-place-guelaguetza",
  "mock-movie-ford-v-ferrari",
  "mock-destination-joshua-tree",
];
const TRAVELER_2 = [
  "mock-artist-phoebe-bridgers",
  "mock-brand-blue-bottle",
  "mock-brand-patagonia",
  "mock-destination-marfa",
];

/** A rough box around the Las Vegas valley (lon first). */
const VEGAS_BOX = polygonWkt([
  [-115.5, 35.95],
  [-114.95, 35.95],
  [-114.95, 36.35],
  [-115.5, 36.35],
]);

describe("toQueryString", () => {
  it("uses documented parameter names and keeps commas literal", () => {
    const qs = toQueryString({
      filterType: "urn:entity:place",
      filter: { location: "POINT(-115.14 36.17)", locationRadiusM: 5000, tags: ["a", "b"] },
      signal: { entities: ["e1", "e2"], tagsWeight: "high" },
      explainability: true,
      diversify: { by: "properties.geocode.city", take: 2 },
      take: 25,
    });
    expect(qs).toBe(
      [
        "filter.type=urn%3Aentity%3Aplace",
        "filter.location=POINT(-115.14%2036.17)",
        "filter.location.radius=5000",
        "filter.tags=a,b",
        "signal.interests.entities=e1,e2",
        "signal.interests.tags.weight=high",
        "feature.explainability=true",
        "diversify.by=properties.geocode.city",
        "diversify.take=2",
        "take=25",
      ].join("&"),
    );
  });

  it("omits unset and empty values", () => {
    expect(toQueryString({ filterType: "urn:entity:movie", signal: { entities: [] } })).toBe(
      "filter.type=urn%3Aentity%3Amovie",
    );
  });

  it("passes documented extra params through", () => {
    expect(
      toQueryString({
        filterType: "urn:entity:place",
        extra: { "output.heatmap.boundary": "urn:entity:locality" },
      }),
    ).toContain("output.heatmap.boundary=urn%3Aentity%3Alocality");
  });
});

describe("WKT helpers", () => {
  it("formats points longitude first", () => {
    expect(pointWkt([-117.9145, 33.8366])).toBe("POINT(-117.9145 33.8366)");
  });

  it("closes polygon rings", () => {
    expect(
      polygonWkt([
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toBe("POLYGON((0 0, 1 0, 1 1, 0 0))");
  });

  it("rejects degenerate polygons", () => {
    expect(() =>
      polygonWkt([
        [0, 0],
        [1, 1],
      ]),
    ).toThrow();
  });
});

describe("normalize", () => {
  it("maps raw Qloo-shaped JSON to app types", () => {
    const result = normalizeInsightsResponse({
      success: true,
      results: {
        entities: [
          {
            entity_id: "x1",
            name: "Somewhere",
            types: ["urn:entity:place"],
            location: { lat: 36.1, lon: -115.1 },
            properties: {
              geocode: { city: "Las Vegas", admin1_region: "NV" },
              image: { url: "https://img" },
            },
            tags: [{ tag_id: "t1", name: "Coffee", type: "place" }, { name: "no id" }],
            query: {
              affinity: 0.9,
              explainability: { "signal.interests.entities": [{ entity_id: "e1", score: 0.7 }] },
            },
            unknown_field: "kept by looseObject",
          },
        ],
      },
      duration: 12,
    });
    const [entity] = result.entities;
    expect(result.durationMs).toBe(12);
    expect(entity).toMatchObject({
      id: "x1",
      city: "Las Vegas",
      region: "NV",
      imageUrl: "https://img",
      affinity: 0.9,
      location: { lat: 36.1, lon: -115.1 },
      tags: [{ id: "t1", name: "Coffee", type: "place" }],
      contributions: [{ signalId: "e1", kind: "entity", score: 0.7 }],
    });
  });

  it("parses flat explainability arrays and sorts by score", () => {
    expect(
      parseContributions([
        { entity_id: "a", score: 0.2 },
        { tag_id: "t", score: 0.9 },
      ]),
    ).toEqual([
      { signalId: "t", kind: "tag", score: 0.9 },
      { signalId: "a", kind: "entity", score: 0.2 },
    ]);
    expect(parseContributions(undefined)).toBeUndefined();
  });
});

describe("MockQlooClient", () => {
  const mock = new MockQlooClient();

  it("finds cross-domain favorites", async () => {
    const phoebe = await mock.search({ query: "phoebe" });
    expect(phoebe[0]?.name).toBe("Phoebe Bridgers");
    expect(phoebe[0]?.mock).toBe(true);

    const films = await mock.search({ query: "dr", types: ["urn:entity:movie"] });
    expect(films.map((f) => f.name)).toContain("Drive");
    expect(films.every((f) => f.types.includes("urn:entity:movie"))).toBe(true);
  });

  it("is deterministic", async () => {
    const params: InsightsParams = {
      filterType: "urn:entity:place",
      signal: { entities: TRAVELER_1 },
      take: 10,
    };
    expect(await mock.insights(params)).toEqual(await mock.insights(params));
  });

  it("scores the same places differently for different travelers", async () => {
    const take = 100;
    const a = await mock.insights({
      filterType: "urn:entity:place",
      signal: { entities: TRAVELER_1 },
      take,
    });
    const b = await mock.insights({
      filterType: "urn:entity:place",
      signal: { entities: TRAVELER_2 },
      take,
    });
    const affinity = (r: typeof a, id: string) =>
      r.entities.find((e) => e.id === id)?.affinity ?? 0;

    // Traveler 1 (Vietnamese/Mexican/cars) vs. Traveler 2 (indie/coffee/vintage)
    expect(affinity(a, "mock-place-vegas-pho")).toBeGreaterThan(
      affinity(b, "mock-place-vegas-pho"),
    );
    expect(affinity(b, "mock-place-vegas-records")).toBeGreaterThan(
      affinity(a, "mock-place-vegas-records"),
    );
    expect(a.entities[0]?.id).not.toBe(b.entities[0]?.id);
  });

  it("filters places to a polygon corridor", async () => {
    const result = await mock.insights({
      filterType: "urn:entity:place",
      filter: { location: VEGAS_BOX },
      take: 100,
    });
    expect(result.entities.length).toBeGreaterThan(5);
    expect(result.entities.every((e) => e.city === "Las Vegas")).toBe(true);
  });

  it("filters by point + radius", async () => {
    const result = await mock.insights({
      filterType: "urn:entity:place",
      filter: { location: pointWkt([-109.5498, 38.5733]), locationRadiusM: 5_000 },
      take: 100,
    });
    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.entities.every((e) => e.city === "Moab")).toBe(true);
  });

  it("scores exactly the requested candidates with filter.entities", async () => {
    const ids = ["mock-place-moab-tacos", "mock-place-denver-murals"];
    const result = await mock.insights({
      filterType: "urn:entity:place",
      filter: { entities: ids },
      signal: { entities: TRAVELER_2 },
    });
    expect(result.entities.map((e) => e.id).sort()).toEqual([...ids].sort());
    expect(result.entities.every((e) => typeof e.affinity === "number")).toBe(true);
  });

  it("filters by tags and diversifies by city", async () => {
    const coffee = await mock.insights({
      filterType: "urn:entity:place",
      filter: { tags: [MOCK_TAGS.coffee.id] },
      take: 100,
    });
    expect(coffee.entities.every((e) => e.tags.some((t) => t.id === MOCK_TAGS.coffee.id))).toBe(
      true,
    );

    const diverse = await mock.insights({
      filterType: "urn:entity:place",
      diversify: { by: "properties.geocode.city", take: 1 },
      take: 100,
    });
    const cities = diverse.entities.map((e) => e.city);
    expect(new Set(cities).size).toBe(cities.length);
  });

  it("returns explainability that references the input signals", async () => {
    const result = await mock.insights({
      filterType: "urn:entity:place",
      signal: { entities: TRAVELER_2, tags: [MOCK_TAGS.vintage.id] },
      explainability: true,
      take: 5,
    });
    const inputs = new Set([...TRAVELER_2, MOCK_TAGS.vintage.id]);
    const explained = result.entities.filter((e) => e.contributions?.length);
    expect(explained.length).toBeGreaterThan(0);
    for (const e of explained) {
      for (const c of e.contributions!) expect(inputs.has(c.signalId)).toBe(true);
    }
  });

  it("recommends non-place entities, excluding the inputs", async () => {
    const result = await mock.insights({
      filterType: "urn:entity:artist",
      signal: { entities: ["mock-artist-phoebe-bridgers"] },
      take: 3,
    });
    expect(result.entities).toHaveLength(3);
    expect(result.entities.map((e) => e.id)).not.toContain("mock-artist-phoebe-bridgers");
    expect(
      MOCK_ENTITIES.filter((x) => x.type === "urn:entity:artist").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("looks up tags", async () => {
    const tags = await mock.tags({ query: "vint" });
    expect(tags.map((t) => t.id)).toContain(MOCK_TAGS.vintage.id);
  });

  it("rejects unsupported location formats", async () => {
    await expect(
      mock.insights({
        filterType: "urn:entity:place",
        filter: { location: "LINESTRING(0 0, 1 1)" },
      }),
    ).rejects.toBeInstanceOf(QlooError);
  });
});

describe("CachedQlooClient", () => {
  function countingClient() {
    const calls = { insights: 0 };
    const inner: QlooClient = {
      search: async () => [],
      tags: async () => [],
      insights: async () => {
        calls.insights++;
        await new Promise((r) => setTimeout(r, 5));
        return { entities: [] };
      },
    };
    return { inner, calls };
  }

  it("hashes params independently of key order", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: 2 }, b: 1 }),
    );
    expect(cacheKey("insights", { a: 1, b: 2 })).toBe(cacheKey("insights", { b: 2, a: 1 }));
    expect(cacheKey("insights", { a: 1 })).not.toBe(cacheKey("search", { a: 1 }));
  });

  it("serves repeats from cache and de-duplicates in-flight requests", async () => {
    const { inner, calls } = countingClient();
    const cached = new CachedQlooClient(inner);
    const params: InsightsParams = { filterType: "urn:entity:place", take: 5 };
    await Promise.all([cached.insights(params), cached.insights(params), cached.insights(params)]);
    await cached.insights({ take: 5, filterType: "urn:entity:place" });
    expect(calls.insights).toBe(1);
  });

  it("expires entries after the TTL", async () => {
    let now = 0;
    const store = new MemoryCacheStore(10, () => now);
    const { inner, calls } = countingClient();
    const cached = new CachedQlooClient(inner, store, 1_000);
    const params: InsightsParams = { filterType: "urn:entity:place" };
    await cached.insights(params);
    now = 999;
    await cached.insights(params);
    now = 1_001;
    await cached.insights(params);
    expect(calls.insights).toBe(2);
  });

  it("evicts the oldest entry when full", async () => {
    const store = new MemoryCacheStore(2);
    await store.set("a", 1, 1_000);
    await store.set("b", 2, 1_000);
    await store.set("c", 3, 1_000);
    expect(store.size).toBe(2);
    expect(await store.get("a")).toBeUndefined();
  });
});

describe("RealQlooClient", () => {
  const real = new RealQlooClient({
    apiKey: "test-key",
    baseUrl: "https://hackathon.api.qloo.com/",
  });

  it("builds GET requests with the X-Api-Key header", () => {
    const req = real.buildInsightsRequest({ filterType: "urn:entity:place", take: 5 });
    expect(req.url).toBe(
      "https://hackathon.api.qloo.com/v2/insights?filter.type=urn%3Aentity%3Aplace&take=5",
    );
    expect(req.init.method).toBe("GET");
    expect(req.init.headers["X-Api-Key"]).toBe("test-key");
    expect(req.url).not.toContain("test-key");
  });

  it("is not implemented yet", async () => {
    await expect(real.insights({ filterType: "urn:entity:place" })).rejects.toMatchObject({
      status: 501,
    });
  });

  it("requires an API key", () => {
    expect(() => new RealQlooClient({ apiKey: "", baseUrl: "https://x" })).toThrow(QlooError);
  });
});

describe("createQlooClient", () => {
  it("wraps the mock in the cache by default", () => {
    const client = createQlooClient({ mode: "mock", baseUrl: "https://hackathon.api.qloo.com" });
    expect(client).toBeInstanceOf(CachedQlooClient);
    expect(client.inner).toBeInstanceOf(MockQlooClient);
  });

  it("uses the real client outside mock mode", () => {
    const client = createQlooClient({
      mode: "real",
      apiKey: "k",
      baseUrl: "https://hackathon.api.qloo.com",
    });
    expect(client.inner).toBeInstanceOf(RealQlooClient);
  });
});

describe("normalize: place properties (shapes observed in the spike)", () => {
  it("maps descriptions, dishes, good-for, keywords, closed flag and distance", () => {
    const [place] = normalizeInsightsResponse({
      success: true,
      results: {
        entities: [
          {
            entity_id: "p1",
            name: "Synthetic Diner",
            type: "urn:entity:place",
            subtype: "urn:entity:place",
            properties: {
              description: "A roadside diner.",
              short_description: "Diner.",
              is_closed: false,
              specialty_dishes: [
                { id: "urn:tag:specialty_dish:place:corn_dog", name: "Corn Dog", weight: 1 },
              ],
              good_for: [
                { id: "urn:tag:children:place:good_kids", name: "Good for kids", weight: 0.5 },
              ],
              keywords: Array.from({ length: 12 }, (_, i) => ({ name: `k${i}`, count: 100 - i })),
            },
            query: { affinity: 0.8, distance: 884 },
          },
        ],
      },
    }).entities;
    expect(place).toMatchObject({
      types: ["urn:entity:place"],
      description: "A roadside diner.",
      shortDescription: "Diner.",
      isClosed: false,
      specialtyDishes: ["Corn Dog"],
      goodFor: ["Good for kids"],
      distanceM: 884,
    });
    expect(place.keywords).toHaveLength(10);
  });

  it("mock places carry the same fields", async () => {
    const { entities } = await new MockQlooClient().insights({
      filterType: "urn:entity:place",
      take: 1,
    });
    expect(entities[0]).toMatchObject({ isClosed: false, mock: true });
    expect(entities[0].description).toContain("mock data");
  });
});
