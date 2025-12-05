import { describe, it, expect, assert } from "vitest";
import { loadAsset, urlDirname, runtimeFn } from "@adviser/cement";

describe("loadAsset", () => {
  if (!runtimeFn().isCFWorker) {
    it("returns file content using fetch", async () => {
      const result = await loadAsset("version.ts", {
        fallBackUrl: "not://working/x",
        pathCleaner: (base, localPath) => `${base}/./${localPath}`,
        basePath: () => import.meta.url,
      });
      expect(result.isOk()).toBe(true);
      expect(result.Ok()).toContain("VERSION");
    });
    it("returns file content from fallback", async () => {
      const result = await loadAsset("version.ts", {
        fallBackUrl: urlDirname(import.meta.url),
        pathCleaner: (base, localPath) => `${base}/${localPath}`,
        basePath: () => "kaput",
      });
      expect(result.isOk()).toBe(true);
      expect(result.Ok()).toContain("VERSION");
    });
    it("failed basePath", async () => {
      const result = await loadAsset("version.ts", {
        fallBackUrl: urlDirname(import.meta.url),
        pathCleaner: (base, localPath) => `${base}/${localPath}`,
        basePath: () => {
          throw new Error("failed basePath");
        },
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
