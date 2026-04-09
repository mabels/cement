import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: "browser",
    include: ["src/**/*test.?(c|m)[jt]s?(x)"],
    browser: {
      enabled: true,
      headless: process.env.BROWSER === "safari" ? false : true,
      provider: playwright(),
      instances: [
        {
          browser: "chromium",
          //setupFile: './chromium-setup.js',
        },
      ],
    },
  },
});
