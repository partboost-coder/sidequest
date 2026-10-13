import { describe, expect, it } from "vitest";

import { DEFAULT_DEV_USER_ID } from "@/lib/config/env.schema";
import { resolveSessionUser } from "@/lib/session/resolve";
import { SessionError } from "@/lib/session/types";

describe("resolveSessionUser", () => {
  it("returns the fixed guest in dev mode", () => {
    expect(resolveSessionUser({ SESSION_MODE: "dev", DEV_USER_ID: DEFAULT_DEV_USER_ID })).toEqual({
      id: DEFAULT_DEV_USER_ID,
      isAnonymous: true,
      source: "dev",
    });
  });

  it("fails loudly in supabase mode until item 212 lands", () => {
    expect(() =>
      resolveSessionUser({ SESSION_MODE: "supabase", DEV_USER_ID: DEFAULT_DEV_USER_ID }),
    ).toThrow(SessionError);
  });
});
