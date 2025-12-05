import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "browser",
    include: ["src/**/*test.?(c|m)[jt]s?(x)"],
    browser: {
      enabled: true,
      headless: process.env.BROWSER === "safari" ? false : true,
      provider: "playwright",
      instances: [
        {
          browser: "chromium",
          //setupFile: './chromium-setup.js',
        },
      ],
    },
  },
});
