import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: "node",
    include: ["src/**/*test.?(c|m)[jt]s?(x)"],
  },
});
