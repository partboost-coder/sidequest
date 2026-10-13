import { describe, expect, it } from "vitest";

import { buildHealthReport, type Probe } from "@/lib/health";

const ok: Probe = async () => ({ status: "ok", latencyMs: 12 });
const down: Probe = async () => ({ status: "down", error: "Mapbox 401: Not Authorized" });
const now = new Date("2026-10-12T00:00:00Z");

describe("buildHealthReport", () => {
  it("reports configuration without leaking secret values", async () => {
    const report = await buildHealthReport(
      {
        MAPBOX_TOKEN: "pk.secret-mapbox",
        QLOO_API_KEY: "qloo-secret",
        QLOO_MODE: "mock",
        FEATURE_HOTELS: "true",
      },
      ok,
      "0.1.0",
      now,
    );
    expect(report).toMatchObject({
      status: "ok",
      version: "0.1.0",
      checkedAt: "2026-10-12T00:00:00.000Z",
      config: { status: "ok" },
      qloo: { mode: "mock", keyConfigured: true, cache: "file" },
      session: { mode: "dev" },
      mapbox: { status: "ok", latencyMs: 12 },
      llm: { configured: false },
    });
    expect(report.flags?.FEATURE_HOTELS).toBe(true);
    const json = JSON.stringify(report);
    expect(json).not.toContain("pk.secret-mapbox");
    expect(json).not.toContain("qloo-secret");
  });

  it("is down when configuration is invalid, naming problems but not values", async () => {
    const report = await buildHealthReport({ QLOO_MODE: "real" }, ok, "0.1.0", now);
    expect(report.status).toBe("down");
    expect(report.config.problems?.join(" ")).toMatch(/QLOO_API_KEY/);
    expect(report.config.problems?.join(" ")).toMatch(/MAPBOX_TOKEN/);
    expect(report.mapbox).toBeUndefined();
  });

  it("is down when Mapbox is unreachable", async () => {
    const report = await buildHealthReport({ MAPBOX_TOKEN: "pk.x" }, down, "0.1.0", now);
    expect(report.status).toBe("down");
    expect(report.mapbox?.error).toContain("401");
  });
});

describe("buildHealthReport quota", () => {
  it("includes the last known Qloo quota", async () => {
    const report = await buildHealthReport(
      { MAPBOX_TOKEN: "pk.x" },
      ok,
      "0.1.0",
      now,
      async () => ({
        remaining: 9970,
        observedAt: "2026-10-13T00:00:00.000Z",
      }),
    );
    expect(report.qloo).toMatchObject({
      monthRemaining: 9970,
      remainingObservedAt: "2026-10-13T00:00:00.000Z",
    });
  });
});
