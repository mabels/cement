import { defineConfig } from "vitest/config";

import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: ["./vitest.node.config.ts", "./vitest.browser.config.ts", "./vitest.cfruntime.config.ts"],
    //  include: ["src/**/*test.?(c|m)[jt]s?(x)"],
    //  globals: true,
  },
});
