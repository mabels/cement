import tsconfigPaths from "vite-tsconfig-paths";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    cloudflareTest({
      wrangler: { configPath: "./wrangler.test.toml" },
    }),
  ],
  test: {
    name: "cf-runtime",
    include: ["src/**/*test.?(c|m)[jt]s?(x)"],
  },
});
