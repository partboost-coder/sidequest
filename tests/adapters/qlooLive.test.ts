import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { QlooError } from "@/adapters/qloo/client";
import { createQlooClient } from "@/adapters/qloo/create";
import { FileCacheStore, FileQuotaStore } from "@/adapters/qloo/fileStore";
import { CallMeter } from "@/adapters/qloo/meter";
import { MemoryQuotaStore, QuotaGuard } from "@/adapters/qloo/quota";
import { RealQlooClient } from "@/adapters/qloo/real";
import { isRateLimited, retryDelayMs } from "@/adapters/qloo/retry";
import { Throttle } from "@/adapters/qloo/throttle";

// ---------------------------------------------------------------------------
// Throttle
// ---------------------------------------------------------------------------

describe("Throttle", () => {
  it("spaces request starts to the configured rate", async () => {
    // Clock frozen at 0: each request's sleep equals its scheduled start offset.
    const waits: number[] = [];
    const throttle = new Throttle({
      ratePerSec: 4,
      concurrency: 10,
      now: () => 0,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    await Promise.all(Array.from({ length: 8 }, () => throttle.run(async () => {})));
    // 8 requests at 4/s: starts at 0 (no wait), 250, …, 1750 ms, never more than 4 in any 1 s window
    expect(waits.sort((a, b) => a - b)).toEqual([250, 500, 750, 1000, 1250, 1500, 1750]);
  });

  it("caps concurrency", async () => {
    let active = 0;
    let peak = 0;
    const throttle = new Throttle({ ratePerSec: 1000, concurrency: 2 });
    await Promise.all(
      Array.from({ length: 6 }, () =>
        throttle.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 5));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

describe("retry policy", () => {
  const noJitter = () => 0;

  it("retries rate limits twice, network/timeouts twice with backoff, 5xx once", () => {
    expect([0, 1, 2].map((n) => retryDelayMs("rate_limited", 429, n, noJitter))).toEqual([
      1000,
      1000,
      undefined,
    ]);
    expect([0, 1, 2].map((n) => retryDelayMs("network", undefined, n, noJitter))).toEqual([
      500,
      1500,
      undefined,
    ]);
    expect([0, 1].map((n) => retryDelayMs("http", 500, n, noJitter))).toEqual([1000, undefined]);
  });

  it("never retries client errors or the quota guard", () => {
    expect(retryDelayMs("http", 400, 0)).toBeUndefined();
    expect(retryDelayMs("quota_reserve", 429, 0)).toBeUndefined();
    expect(retryDelayMs("invalid_response", 200, 0)).toBeUndefined();
  });

  it("detects rate limiting by status or by Qloo's error body", () => {
    expect(isRateLimited(429, {})).toBe(true);
    expect(isRateLimited(200, { error_msg: "Rate limit exceeded" })).toBe(true);
    expect(isRateLimited(403, { error_msg: "Forbidden" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Quota guard
// ---------------------------------------------------------------------------

describe("QuotaGuard", () => {
  it("allows calls above the reserve and refuses below it unless allowReserve", async () => {
    const guard = new QuotaGuard({ reserve: 100, unknownBudget: 5 });
    await guard.observe("150");
    await expect(guard.check()).resolves.toBeUndefined();
    await guard.observe("99");
    await expect(guard.check()).rejects.toMatchObject({ code: "quota_reserve" });
    await expect(guard.check(true)).resolves.toBeUndefined();
  });

  it("fails closed after the unknown-quota budget", async () => {
    const guard = new QuotaGuard({ reserve: 100, unknownBudget: 2 });
    await guard.check();
    await guard.check();
    await expect(guard.check()).rejects.toMatchObject({ code: "quota_reserve" });
  });

  it("restores the last known quota from its store", async () => {
    const store = new MemoryQuotaStore();
    await new QuotaGuard({ reserve: 100, unknownBudget: 0, store }).observe("50");
    const restarted = new QuotaGuard({ reserve: 100, unknownBudget: 0, store });
    await expect(restarted.check()).rejects.toMatchObject({ code: "quota_reserve" });
    expect((await restarted.snapshot())?.remaining).toBe(50);
  });

  it("ignores missing or invalid headers", async () => {
    const guard = new QuotaGuard({ reserve: 0, unknownBudget: 5 });
    expect(await guard.observe(null)).toBeUndefined();
    expect(await guard.observe("abc")).toBeUndefined();
    expect(await guard.snapshot()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// RealQlooClient (fake fetch)
// ---------------------------------------------------------------------------

type Reply = { status: number; body: unknown; remaining?: string } | Error;

function scriptedFetch(
  replies: Reply[],
  seen: { url: string; headers: Record<string, string> }[] = [],
) {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(url), headers: init?.headers as Record<string, string> });
    const reply = replies.shift();
    if (!reply) throw new Error("no more scripted replies");
    if (reply instanceof Error) throw reply;
    const headers = new Headers({ "content-type": "application/json" });
    if (reply.remaining) headers.set("x-month-ratelimit-remaining", reply.remaining);
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers });
  }) as typeof fetch;
}

const PLACE = {
  success: true,
  results: {
    entities: [
      { entity_id: "p1", name: "Somewhere", type: "urn:entity:place", query: { affinity: 0.9 } },
    ],
  },
};

function client(
  replies: Reply[],
  opts: { reserve?: number; seen?: { url: string; headers: Record<string, string> }[] } = {},
) {
  const sleeps: number[] = [];
  const quota = new QuotaGuard({ reserve: opts.reserve ?? 10, unknownBudget: 25 });
  const real = new RealQlooClient({
    apiKey: "secret-key",
    baseUrl: "https://hackathon.api.qloo.com",
    fetch: scriptedFetch(replies, opts.seen),
    throttle: new Throttle({ ratePerSec: 1000, concurrency: 4 }),
    quota,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { real, quota, sleeps };
}

describe("RealQlooClient", () => {
  it("sends the key as a header, normalizes the response and records quota + meter", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const { real, quota } = client([{ status: 200, body: PLACE, remaining: "9970" }], { seen });
    const meter = new CallMeter();
    const result = await real.insights({ filterType: "urn:entity:place", take: 1 }, { meter });

    expect(result.entities[0]).toMatchObject({ id: "p1", affinity: 0.9 });
    expect(seen[0].url).toBe(
      "https://hackathon.api.qloo.com/v2/insights?filter.type=urn%3Aentity%3Aplace&take=1",
    );
    expect(seen[0].headers["X-Api-Key"]).toBe("secret-key");
    expect(seen[0].url).not.toContain("secret-key");
    expect((await quota.snapshot())?.remaining).toBe(9970);
    expect(meter.summary()).toMatchObject({ liveCalls: 1, remaining: 9970 });
  });

  it("retries a rate-limit body and then succeeds", async () => {
    const { real, sleeps } = client([
      { status: 200, body: { error_msg: "Rate limit exceeded" } },
      { status: 200, body: PLACE, remaining: "9969" },
    ]);
    await expect(real.insights({ filterType: "urn:entity:place" })).resolves.toBeDefined();
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBeGreaterThanOrEqual(1000);
  });

  it("retries a 5xx only once", async () => {
    const { real, sleeps } = client([
      { status: 500, body: { errors: [{ message: "System Error" }] } },
      { status: 500, body: { errors: [{ message: "System Error" }] } },
    ]);
    await expect(real.insights({ filterType: "urn:entity:place" })).rejects.toMatchObject({
      code: "http",
      status: 500,
      message: expect.stringContaining("System Error"),
    });
    expect(sleeps).toHaveLength(1);
  });

  it("does not retry a 4xx", async () => {
    const { real, sleeps } = client([
      { status: 400, body: { errors: [{ message: "bad param" }] } },
    ]);
    await expect(real.tags({ query: "x" })).rejects.toMatchObject({ code: "http", status: 400 });
    expect(sleeps).toHaveLength(0);
  });

  it("retries network errors with backoff", async () => {
    const { real, sleeps } = client([
      new TypeError("fetch failed"),
      { status: 200, body: { results: [] } },
    ]);
    await expect(real.search({ query: "drive" })).resolves.toEqual([]);
    expect(sleeps).toHaveLength(1);
  });

  it("refuses live calls below the quota reserve without touching the network", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const { real, quota } = client([], { reserve: 100, seen });
    await quota.observe("50");
    await expect(real.search({ query: "drive" })).rejects.toBeInstanceOf(QlooError);
    expect(seen).toHaveLength(0);
    await expect(real.search({ query: "drive" }, { allowReserve: true })).rejects.toThrow(
      /no more scripted replies|network/,
    );
  });
});

// ---------------------------------------------------------------------------
// File stores and factory
// ---------------------------------------------------------------------------

describe("file stores", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "qloo-cache-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips cache entries with expiry", async () => {
    let now = 1_000;
    const store = new FileCacheStore(dir, () => now);
    await store.set("k", { a: 1 }, 500, { method: "insights", params: { take: 1 } });
    expect(await store.get("k")).toEqual({ a: 1 });
    now = 1_600;
    expect(await store.get("k")).toBeUndefined();
    expect(await store.get("missing")).toBeUndefined();
  });

  it("falls back to memory when the directory isn't writable", async () => {
    const store = new FileCacheStore("/dev/null/not-a-dir");
    await store.set("k", 42, 1_000);
    expect(store.usingFallback).toBe(true);
    expect(await store.get("k")).toBe(42);
  });

  it("persists quota state", async () => {
    const file = path.join(dir, "quota.json");
    await new FileQuotaStore(file).save({
      remaining: 1234,
      observedAt: "2026-10-13T00:00:00.000Z",
    });
    expect(await new FileQuotaStore(file).load()).toEqual({
      remaining: 1234,
      observedAt: "2026-10-13T00:00:00.000Z",
    });
  });

  it("factory: postgres cache isn't available until item 211", () => {
    expect(() =>
      createQlooClient({ mode: "real", apiKey: "k", baseUrl: "https://x", cache: "postgres" }),
    ).toThrow(/211/);
  });
});
