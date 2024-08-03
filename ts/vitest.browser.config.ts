import { defineConfig } from "vitest/config";

import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "browser",
    include: ["src/**/*test.?(c|m)[jt]s?(x)"],
    globals: true,
    browser: {
      enabled: true,
      headless: true,
      provider: "webdriverio",
      name: "chrome", // browser name is required
    },
  },
});
