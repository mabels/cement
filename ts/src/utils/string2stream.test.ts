import { expect, it } from "vitest";
import { stream2string, string2stream } from "@adviser/cement";

it("string2stream", async () => {
  const inStr = string2stream("Hello World!");
  expect(await stream2string(inStr)).toBe("Hello World!");
});
