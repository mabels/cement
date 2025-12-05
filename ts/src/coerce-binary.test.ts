import { to_arraybuf, to_blob, to_uint8, top_uint8 } from "@adviser/cement";
import { describe, it, expect } from "vitest";

describe("to_uint8", () => {
  it("string to Uint8Array", () => {
    const input = "hello";
    const result = to_uint8(input);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
  });
  it("ArrayBuffer to Uint8Array", () => {
    const ab = new ArrayBuffer(5);
    const input1 = new Uint8Array(ab, 0, 3);
    input1[0] = 104;
    input1[1] = 101;
    input1[2] = 108;
    const input2 = new Uint8Array(ab, 3, 2);
    input2[0] = 108;
    input2[1] = 111;
    const result = to_uint8(ab);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
  });
  it("Uint8Array to Uint8Array", () => {
    const input = new Uint8Array([104, 101, 108, 108, 111]);
    const result = to_uint8(input);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
  });

  it("Blob to Uint8Array", async () => {
    const input = to_blob("hello");
    const result = await top_uint8(input);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
  });

  it("ArrayBuffer to Uint8Array", () => {
    const result = to_arraybuf("hello");
    expect(new Uint8Array(result)).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
  });
});
