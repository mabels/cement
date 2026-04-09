import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: ["./vitest.node.config.ts", "./vitest.browser.config.ts", "./vitest.cfruntime.config.ts"],
    //  include: ["src/**/*test.?(c|m)[jt]s?(x)"],
    //  globals: true,
  },
});
