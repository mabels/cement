import { MockFileService } from "./mock-file-service.js";
import { runtimeFn, TxtEnDecoderSingleton } from "@adviser/cement";

describe("MockFileService", () => {
  if (runtimeFn().isNodeIsh || runtimeFn().isDeno) {
    let MFS: MockFileService;
    beforeAll(async () => {
      const { MockFileService } = await import("./mock-file-service.js");
      MFS = new MockFileService(TxtEnDecoderSingleton());
    });
    it("writeFileString", async () => {
      const f = MFS;
      const absFname = f.abs("test");
      await f.writeFileString("test", "hello");
      expect(f.files).toEqual({
        [absFname]: {
          content: "hello",
          name: absFname,
        },
        test: {
          name: absFname,
          content: "hello",
        },
      });
    });
  } else {
    it.skip("nothing in browser", () => {
      expect(1).toEqual(1);
    });
  }
});
