import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "bench",
    include: ["bench/**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
