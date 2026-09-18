import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The pure-function tests finish in milliseconds regardless; this ceiling only
    // matters for tests/auth-ownership.test.ts, whose cases chain several real
    // network + DB round trips (and one real-browser Playwright run).
    testTimeout: 20_000,
  },
});
