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

it("sign and verify with HMAC-SHA256", async () => {
  const cp = toCryptoRuntime();
  const keyMaterial = cp.randomBytes(32);
  const algo = { name: "HMAC", hash: "SHA-256" };
  const key = await cp.importKey("raw", keyMaterial, algo, false, ["sign", "verify"]);
  const data = new TextEncoder().encode("hello cement");
  const signature = await cp.sign(algo, key, data);
  expect(signature.byteLength).toBeGreaterThan(0);
  const valid = await cp.verify(algo, key, signature, data);
  expect(valid).toBe(true);
});

it("verify returns false for tampered data", async () => {
  const cp = toCryptoRuntime();
  const keyMaterial = cp.randomBytes(32);
  const algo = { name: "HMAC", hash: "SHA-256" };
  const key = await cp.importKey("raw", keyMaterial, algo, false, ["sign", "verify"]);
  const data = new TextEncoder().encode("hello cement");
  const signature = await cp.sign(algo, key, data);
  const tampered = new TextEncoder().encode("hello CEMENT");
  const valid = await cp.verify(algo, key, signature, tampered);
  expect(valid).toBe(false);
});
