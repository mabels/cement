import { describe, it, expect } from "vitest";
import { loadAsset } from "./load-asset.js";
import { runtimeFn } from "./runtime.js";

describe("loadAsset", () => {
  if (!runtimeFn().isCFWorker) {
    it("returns file content using fetch", async () => {
      const result = await loadAsset("version.ts", {
        fallBackUrl: "not://working/x",
        pathCleaner: (base, localPath) => `${base}/./${localPath}`,
      });
      expect(result.isOk()).toBe(true);
      expect(result.Ok()).toContain("VERSION");
    });
    it("returns file content from fallback", async () => {
      const result = await loadAsset("version.ts", {
        fallBackUrl: runtimeFn().isBrowser ? import.meta.url : "file://./",
        pathCleaner: (base, localPath) => `${base}/${localPath}`,
      });
      expect(result.isOk()).toBe(true);
      expect(result.Ok()).toContain("VERSION");
    });
  } else {
    it("do nothing", () => {
      assert(true);
    });
  }
});
