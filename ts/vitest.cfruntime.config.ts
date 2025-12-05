import tsconfigPaths from "vite-tsconfig-paths";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "cf-runtime",
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.test.toml" },
      },
    },
    include: ["src/**/*test.?(c|m)[jt]s?(x)"],
  },
});
