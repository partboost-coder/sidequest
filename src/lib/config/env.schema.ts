import { z } from "zod";

/**
 * Pure env schemas (no `server-only`), so they can be unit-tested.
 * Runtime accessors live in env.server.ts and env.client.ts.
 */

export const QLOO_MODES = ["mock", "real", "record"] as const;
export const SESSION_MODES = ["supabase", "dev"] as const;

const optionalString = z.string().trim().optional();

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    QLOO_MODE: z.enum(QLOO_MODES).default("mock"),
    QLOO_API_KEY: optionalString,
    QLOO_BASE_URL: z.url().default("https://hackathon.api.qloo.com"),

    MAPBOX_TOKEN: optionalString,

    SESSION_MODE: z.enum(SESSION_MODES).default("supabase"),
    DEV_USER_ID: z.uuid().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
    SUPABASE_SERVICE_ROLE_KEY: optionalString,

    ANTHROPIC_API_KEY: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.QLOO_MODE !== "mock" && !env.QLOO_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["QLOO_API_KEY"],
        message: `QLOO_API_KEY is required when QLOO_MODE=${env.QLOO_MODE}`,
      });
    }
    if (!env.MAPBOX_TOKEN) {
      ctx.addIssue({
        code: "custom",
        path: ["MAPBOX_TOKEN"],
        message: "MAPBOX_TOKEN (secret token) is required for routing and geocoding",
      });
    }
    if (env.SESSION_MODE === "dev" && !env.DEV_USER_ID) {
      ctx.addIssue({
        code: "custom",
        path: ["DEV_USER_ID"],
        message: "DEV_USER_ID (a UUID) is required when SESSION_MODE=dev",
      });
    }
    if (env.SESSION_MODE === "supabase") {
      for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when SESSION_MODE=supabase`,
          });
        }
      }
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_MAPBOX_TOKEN: optionalString,
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export class EnvError extends Error {
  constructor(scope: string, error: z.ZodError) {
    const lines = error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    super(`Invalid ${scope} environment variables:\n${lines.join("\n")}\nSee .env.example.`);
    this.name = "EnvError";
  }
}

/** Treat blank values (common in .env files) as unset. */
function blanksToUndefined(raw: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v === undefined || v.trim() === "" ? undefined : v]),
  );
}

export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(blanksToUndefined(raw));
  if (!result.success) throw new EnvError("server", result.error);
  return result.data;
}

export function parseClientEnv(raw: Record<string, string | undefined>): ClientEnv {
  const result = clientEnvSchema.safeParse(blanksToUndefined(raw));
  if (!result.success) throw new EnvError("client", result.error);
  return result.data;
}
