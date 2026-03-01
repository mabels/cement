import { it, expect, describe } from "vitest";
import { concatUint8 } from "@adviser/cement";

describe("concatUint8 edge cases", () => {
  it("no arguments returns empty array", () => {
    const result = concatUint8();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it("single empty array returns empty array", () => {
    const result = concatUint8(new Uint8Array(0));
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it("multiple empty arrays returns empty array", () => {
    const result = concatUint8(new Uint8Array(0), new Uint8Array(0), new Uint8Array(0));
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it("single array with one byte", () => {
    const result = concatUint8(new Uint8Array([42]));
    expect(result).toEqual(new Uint8Array([42]));
  });

  it("empty array mixed with non-empty arrays", () => {
    const result = concatUint8(new Uint8Array(0), new Uint8Array([1, 2]), new Uint8Array(0), new Uint8Array([3]));
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("all zero bytes are preserved", () => {
    const result = concatUint8(new Uint8Array([0, 0]), new Uint8Array([0]));
    expect(result).toEqual(new Uint8Array([0, 0, 0]));
  });

  it("boundary byte values (0 and 255)", () => {
    const result = concatUint8(new Uint8Array([0]), new Uint8Array([255]));
    expect(result).toEqual(new Uint8Array([0, 255]));
  });

  it("returns a new array independent from inputs", () => {
    const a = new Uint8Array([1, 2, 3]);
    const result = concatUint8(a);
    result[0] = 99;
    expect(a[0]).toBe(1);
  });
});

describe("concatUint8 normal cases", () => {
  it("two arrays", () => {
    const result = concatUint8(new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6]));
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it("three arrays", () => {
    const result = concatUint8(new Uint8Array([1]), new Uint8Array([2, 3]), new Uint8Array([4, 5, 6]));
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it("total length equals sum of input lengths", () => {
    const a = new Uint8Array(7);
    const b = new Uint8Array(13);
    const result = concatUint8(a, b);
    expect(result.length).toBe(20);
  });
});
