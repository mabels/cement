import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    pool: './deno-runner.ts',
    name: "deno",
    include: ["src/**/*test.?(c|m)[jt]s?(x)"],
    globals: true,
  },
});
