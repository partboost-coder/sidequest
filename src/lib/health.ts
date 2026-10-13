import { EnvError, parseServerEnv, type ServerEnv } from "@/lib/config/env.schema";
import { parseFlags, type Flags } from "@/lib/flags.schema";

export type CheckStatus = "ok" | "degraded" | "down";

export interface HealthReport {
  status: CheckStatus;
  version: string;
  checkedAt: string;
  config: { status: CheckStatus; problems?: string[] };
  qloo?: {
    mode: ServerEnv["QLOO_MODE"];
    keyConfigured: boolean;
    cache: ServerEnv["QLOO_CACHE"];
    monthRemaining?: number;
    remainingObservedAt?: string;
  };
  session?: { mode: ServerEnv["SESSION_MODE"] };
  mapbox?: { status: CheckStatus; latencyMs?: number; error?: string };
  llm?: { configured: boolean };
  flags?: Flags;
}

/** Async probe of an upstream; resolves to a status, never throws. */
export type Probe = () => Promise<{ status: CheckStatus; latencyMs?: number; error?: string }>;

/**
 * Builds the health report. Pure apart from the injected probe, so it's testable.
 * Never includes secret values: only whether they are configured.
 */
export async function buildHealthReport(
  rawEnv: Record<string, string | undefined>,
  probeMapbox: Probe,
  version: string,
  now = new Date(),
  qlooQuota?: () => Promise<{ remaining: number; observedAt: string } | undefined>,
): Promise<HealthReport> {
  const base = { version, checkedAt: now.toISOString() };
  let env: ServerEnv;
  try {
    env = parseServerEnv(rawEnv);
  } catch (error) {
    const problems =
      error instanceof EnvError
        ? error.message
            .split("\n")
            .filter((l) => l.startsWith("  - "))
            .map((l) => l.slice(4))
        : ["Unknown configuration error"];
    return { ...base, status: "down", config: { status: "down", problems } };
  }

  const [mapbox, quota] = await Promise.all([probeMapbox(), qlooQuota?.().catch(() => undefined)]);
  const status: CheckStatus =
    mapbox.status === "ok" ? "ok" : mapbox.status === "down" ? "down" : "degraded";

  return {
    ...base,
    status,
    config: { status: "ok" },
    qloo: {
      mode: env.QLOO_MODE,
      keyConfigured: Boolean(env.QLOO_API_KEY),
      cache: env.QLOO_CACHE,
      monthRemaining: quota?.remaining,
      remainingObservedAt: quota?.observedAt,
    },
    session: { mode: env.SESSION_MODE },
    mapbox,
    llm: { configured: Boolean(env.ANTHROPIC_API_KEY) },
    flags: parseFlags(rawEnv),
  };
}
