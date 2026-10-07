import "server-only";

import { parseFlags, type Flags } from "./flags.schema";

export { FEATURE_FLAGS, type FeatureFlag, type Flags } from "./flags.schema";

let cached: Flags | undefined;

/** Server-side feature flags. Pass the values a client component needs down as props. */
export function getFlags(): Flags {
  cached ??= parseFlags(process.env);
  return cached;
}
