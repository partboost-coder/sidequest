import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEV_USER_ID,
  EnvError,
  parseClientEnv,
  parseServerEnv,
} from "@/lib/config/env.schema";
import { FEATURE_FLAGS, parseFlags } from "@/lib/flags.schema";

const base = {
  MAPBOX_TOKEN: "sk.test",
  SESSION_MODE: "dev",
  DEV_USER_ID: "00000000-0000-4000-8000-000000000001",
};

describe("parseServerEnv", () => {
  it("applies defaults", () => {
    const env = parseServerEnv(base);
    expect(env.QLOO_MODE).toBe("mock");
    expect(env.QLOO_BASE_URL).toBe("https://hackathon.api.qloo.com");
    expect(env.NODE_ENV).toBe("development");
  });

  it("does not require a Qloo key in mock mode", () => {
    expect(() => parseServerEnv({ ...base, QLOO_MODE: "mock" })).not.toThrow();
  });

  it.each(["real", "record"])("requires a Qloo key when QLOO_MODE=%s", (mode) => {
    expect(() => parseServerEnv({ ...base, QLOO_MODE: mode })).toThrow(/QLOO_API_KEY/);
    expect(() => parseServerEnv({ ...base, QLOO_MODE: mode, QLOO_API_KEY: "k" })).not.toThrow();
  });

  it("requires the Mapbox secret token", () => {
    expect(() => parseServerEnv({ ...base, MAPBOX_TOKEN: undefined })).toThrow(/MAPBOX_TOKEN/);
  });

  it("defaults to dev sessions with a fixed guest ID, and requires Supabase keys in supabase mode", () => {
    const env = parseServerEnv({ MAPBOX_TOKEN: "sk.test" });
    expect(env.SESSION_MODE).toBe("dev");
    expect(env.DEV_USER_ID).toBe(DEFAULT_DEV_USER_ID);
    expect(() => parseServerEnv({ ...base, DEV_USER_ID: "not-a-uuid" })).toThrow(/DEV_USER_ID/);
    expect(() => parseServerEnv({ ...base, SESSION_MODE: "supabase" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL[\s\S]*NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
    expect(() =>
      parseServerEnv({
        ...base,
        SESSION_MODE: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      }),
    ).not.toThrow();
  });

  it("treats blank values as unset and reports every problem at once", () => {
    try {
      parseServerEnv({ QLOO_MODE: "real", QLOO_API_KEY: "  ", MAPBOX_TOKEN: "" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError);
      const message = (e as Error).message;
      expect(message).toContain("QLOO_API_KEY");
      expect(message).toContain("MAPBOX_TOKEN");
      expect(message).toContain(".env.example");
    }
  });

  it("rejects an unknown Qloo mode", () => {
    expect(() => parseServerEnv({ ...base, QLOO_MODE: "staging" })).toThrow(EnvError);
  });
});

describe("parseClientEnv", () => {
  it("accepts an empty client env", () => {
    expect(parseClientEnv({})).toEqual({});
  });

  it("rejects an invalid Supabase URL", () => {
    expect(() => parseClientEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(EnvError);
  });
});

describe("parseFlags", () => {
  it("defaults every flag to off", () => {
    const flags = parseFlags({});
    for (const flag of FEATURE_FLAGS) expect(flags[flag]).toBe(false);
  });

  it("accepts common truthy spellings", () => {
    const flags = parseFlags({
      FEATURE_HOTELS: "true",
      FEATURE_AUTH_UI: "1",
      FEATURE_XP_LEVELS: " ON ",
      FEATURE_PUBLIC_RECAP: "false",
    });
    expect(flags.FEATURE_HOTELS).toBe(true);
    expect(flags.FEATURE_AUTH_UI).toBe(true);
    expect(flags.FEATURE_XP_LEVELS).toBe(true);
    expect(flags.FEATURE_PUBLIC_RECAP).toBe(false);
  });
});

describe("v0.2.0 env additions", () => {
  const minimal = { MAPBOX_TOKEN: "pk.test" };

  it("resolves cache and dev-route defaults from NODE_ENV", () => {
    expect(parseServerEnv({ ...minimal, NODE_ENV: "development" })).toMatchObject({
      QLOO_CACHE: "file",
      DEV_ROUTES: true,
      QLOO_QUOTA_RESERVE: 1000,
      QLOO_UNKNOWN_QUOTA_BUDGET: 25,
    });
    expect(parseServerEnv({ ...minimal, NODE_ENV: "production" })).toMatchObject({
      QLOO_CACHE: "memory",
      DEV_ROUTES: false,
    });
  });

  it("uses the file cache for record mode and honors explicit values", () => {
    const env = parseServerEnv({
      ...minimal,
      NODE_ENV: "production",
      QLOO_MODE: "record",
      QLOO_API_KEY: "k",
    });
    expect(env.QLOO_CACHE).toBe("file");
    expect(
      parseServerEnv({
        ...minimal,
        QLOO_CACHE: "postgres",
        DEV_ROUTES: "off",
        QLOO_QUOTA_RESERVE: "250",
      }),
    ).toMatchObject({ QLOO_CACHE: "postgres", DEV_ROUTES: false, QLOO_QUOTA_RESERVE: 250 });
  });

  it("rejects the file cache on Vercel", () => {
    expect(() => parseServerEnv({ ...minimal, VERCEL: "1", QLOO_CACHE: "file" })).toThrow(
      /read-only/,
    );
    expect(() =>
      parseServerEnv({ ...minimal, VERCEL: "1", QLOO_MODE: "record", QLOO_API_KEY: "k" }),
    ).toThrow(/read-only/);
    expect(parseServerEnv({ ...minimal, VERCEL: "1", NODE_ENV: "production" }).QLOO_CACHE).toBe(
      "memory",
    );
  });

  it("rejects invalid booleans and negative budgets", () => {
    expect(() => parseServerEnv({ ...minimal, DEV_ROUTES: "maybe" })).toThrow(EnvError);
    expect(() => parseServerEnv({ ...minimal, QLOO_QUOTA_RESERVE: "-5" })).toThrow(EnvError);
  });
});
