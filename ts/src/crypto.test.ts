import { it, expect, assert } from "vitest";
import { toCryptoRuntime } from "@adviser/cement";

it("not extractable import -> export", async () => {
  const cp = toCryptoRuntime();
  const key = cp.randomBytes(32);
  const x = await cp.importKey("raw", key, "AES-CBC", false, ["encrypt"]);
  try {
    await cp.exportKey("raw", x);
    assert(false, "should not reach here");
  } catch (ie) {
    const e = ie as Error;
    expect(e.message).toMatch(/(key is not extractable|non-extractable|the underlying object)/i);
  }
});

it("extractable import -> export", async () => {
  const cp = toCryptoRuntime();
  const key = cp.randomBytes(32);
  const x = await cp.importKey("raw", key, "AES-CBC", true, ["encrypt"]);
  expect(new Uint8Array((await cp.exportKey("raw", x)) as ArrayBuffer)).toEqual(key);
});
