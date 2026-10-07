/**
 * Feature flags for every P1 (cuttable) item. All default to off.
 * Cut order if behind schedule: AUTH_UI → PUBLIC_RECAP → REPLAN_CHAT → HOTELS →
 * PHOTO_UPLOAD → XP_LEVELS → REGENERATE_DAY.
 */
export const FEATURE_FLAGS = [
  "FEATURE_AUTH_UI",
  "FEATURE_PUBLIC_RECAP",
  "FEATURE_REPLAN_CHAT",
  "FEATURE_HOTELS",
  "FEATURE_PHOTO_UPLOAD",
  "FEATURE_XP_LEVELS",
  "FEATURE_REGENERATE_DAY",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];
export type Flags = Record<FeatureFlag, boolean>;

const TRUTHY = new Set(["1", "true", "on", "yes"]);

export function parseFlags(raw: Record<string, string | undefined>): Flags {
  return Object.fromEntries(
    FEATURE_FLAGS.map((flag) => [flag, TRUTHY.has((raw[flag] ?? "").trim().toLowerCase())]),
  ) as Flags;
}
