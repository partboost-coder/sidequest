import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    passWithNoTests: true,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/**/*.ts"] },
  },
});
