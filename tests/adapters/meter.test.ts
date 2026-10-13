import { describe, expect, it } from "vitest";

import { CachedQlooClient } from "@/adapters/qloo/cached";
import { CallMeter } from "@/adapters/qloo/meter";
import { MockQlooClient } from "@/adapters/qloo/mock";

describe("CallMeter", () => {
  it("separates live and cached calls and keeps plans isolated", async () => {
    const client = new CachedQlooClient(new MockQlooClient());
    const planA = new CallMeter();
    const planB = new CallMeter();
    await client.insights({ filterType: "urn:entity:place", take: 3 }, { meter: planA });
    await client.insights({ filterType: "urn:entity:place", take: 3 }, { meter: planA });
    await client.search({ query: "drive" }, { meter: planB });

    expect(planA.liveCalls).toBe(1);
    expect(planA.cachedCalls).toBe(1);
    expect(planB.summary()).toMatchObject({
      liveCalls: 1,
      cachedCalls: 0,
      byEndpoint: { search: 1, insights: 0 },
    });
  });

  it("reports the latest known remaining quota", () => {
    const meter = new CallMeter();
    meter.record({ endpoint: "insights", ms: 400, cached: false, remaining: 9000 });
    meter.record({ endpoint: "insights", ms: 0, cached: true });
    expect(meter.summary()).toMatchObject({ remaining: 9000, totalMs: 400 });
  });
});
