import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    clearMocks: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["app/api/**/*.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 75,
        branches: 40,
        functions: 90,
        lines: 80,
      },
    },
  },
});
