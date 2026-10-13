import { describe, expect, it } from "vitest";

import { devRoutesEnabled, devRoutesGuard } from "@/lib/devRoutes";

describe("devRoutesEnabled", () => {
  it("defaults on outside production and off in production", () => {
    expect(devRoutesEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(devRoutesEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(devRoutesEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("respects an explicit DEV_ROUTES value", () => {
    expect(devRoutesEnabled({ NODE_ENV: "production", DEV_ROUTES: "true" })).toBe(true);
    expect(devRoutesEnabled({ NODE_ENV: "development", DEV_ROUTES: "off" })).toBe(false);
    expect(devRoutesEnabled({ NODE_ENV: "production", DEV_ROUTES: "garbage" })).toBe(false);
  });

  it("guards handlers with a 404", () => {
    expect(devRoutesGuard({ NODE_ENV: "production" })?.status).toBe(404);
    expect(devRoutesGuard({ NODE_ENV: "development" })).toBeUndefined();
  });
});
