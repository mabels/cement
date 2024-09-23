import { toCryptoRuntime } from "./crypto.js";

it("not extractable import -> export", async () => {
  const cp = toCryptoRuntime();
  const key = cp.randomBytes(32);
  const x = await cp.importKey("raw", key, "AES-CBC", false, ["encrypt"]);
  expect(cp.exportKey("raw", x)).rejects.toThrowError(/key is not extractable/i);
});

it("extractable import -> export", async () => {
  const cp = toCryptoRuntime();
  const key = cp.randomBytes(32);
  const x = await cp.importKey("raw", key, "AES-CBC", true, ["encrypt"]);
  expect(new Uint8Array((await cp.exportKey("raw", x)) as ArrayBuffer)).toEqual(key);
});
