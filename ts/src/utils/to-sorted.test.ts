import { describe, it, expect } from "vitest";
import { toSorted } from "./to-sorted.js";

describe("toSorted", () => {
  describe("primitive values", () => {
    it("should return null as-is", () => {
      expect(toSorted(null)).toBe(null);
    });

    it("should return undefined as-is", () => {
      expect(toSorted(undefined)).toBe(undefined);
    });

    it("should return string as-is", () => {
      expect(toSorted("hello")).toBe("hello");
    });

    it("should return number as-is", () => {
      expect(toSorted(42)).toBe(42);
    });

    it("should return boolean as-is", () => {
      expect(toSorted(true)).toBe(true);
      expect(toSorted(false)).toBe(false);
    });
  });

  describe("arrays", () => {
    it("should handle empty array", () => {
      expect(toSorted([])).toEqual([]);
    });

    it("should recursively sort array elements", () => {
      const input = [
        { c: 1, a: 2, b: 3 },
        { z: 4, x: 5, y: 6 },
      ];
      const expected = [
        { a: 2, b: 3, c: 1 },
        { x: 5, y: 6, z: 4 },
      ];
      expect(toSorted(input)).toEqual(expected);
    });

    it("should handle nested arrays", () => {
      const input = [[{ b: 1, a: 2 }], [{ d: 3, c: 4 }]];
      const expected = [[{ a: 2, b: 1 }], [{ c: 4, d: 3 }]];
      expect(toSorted(input)).toEqual(expected);
    });

    it("should handle array with mixed types", () => {
      const input = [{ b: 1, a: 2 }, "string", 42, null, undefined];
      const expected = [{ a: 2, b: 1 }, "string", 42, null, undefined];
      expect(toSorted(input)).toEqual(expected);
    });
  });

  describe("objects", () => {
    it("should handle empty object", () => {
      expect(toSorted({})).toEqual({});
    });

    it("should sort object keys alphabetically", () => {
      const input = { c: 1, a: 2, b: 3 };
      const expected = { a: 2, b: 3, c: 1 };
      expect(toSorted(input)).toEqual(expected);
    });

    it("should recursively sort nested objects", () => {
      const input = {
        z: { c: 1, a: 2, b: 3 },
        a: { z: 4, x: 5, y: 6 },
      };
      const expected = {
        a: { x: 5, y: 6, z: 4 },
        z: { a: 2, b: 3, c: 1 },
      };
      expect(toSorted(input)).toEqual(expected);
    });

    it("should handle objects with array values", () => {
      const input = {
        b: [{ z: 1, a: 2 }],
        a: [{ c: 3, b: 4 }],
      };
      const expected = {
        a: [{ b: 4, c: 3 }],
        b: [{ a: 2, z: 1 }],
      };
      expect(toSorted(input)).toEqual(expected);
    });

    it("should handle deeply nested structures", () => {
      const input = {
        c: {
          b: {
            z: 1,
            a: { y: 2, x: 3 },
          },
          a: [{ c: 4, b: 5 }],
        },
        a: "simple",
      };
      const expected = {
        a: "simple",
        c: {
          a: [{ b: 5, c: 4 }],
          b: {
            a: { x: 3, y: 2 },
            z: 1,
          },
        },
      };
      expect(toSorted(input)).toEqual(expected);
    });
  });

  describe("cycle detection", () => {
    it("should handle circular references in objects", () => {
      const obj: { self?: typeof obj; b: number; a: number } = { b: 1, a: 2 };
      obj.self = obj;

      const result = toSorted(obj);
      expect(result).toEqual({
        a: 2,
        b: 1,
        self: undefined,
      });
    });

    it("should handle circular references in arrays", () => {
      const arr: { b: number; a: number }[] = [{ b: 1, a: 2 }];

      arr.push(arr as unknown as { b: number; a: number });

      const result = toSorted(arr);
      expect(result).toEqual([{ a: 2, b: 1 }, undefined]);
    });

    it("should handle complex circular references", () => {
      const obj1: { ref?: typeof obj2; c: number; a: number } = { c: 1, a: 2 };
      const obj2 = { b: obj1, z: 3 };
      obj1.ref = obj2;

      const result = toSorted(obj1);
      expect(result).toEqual({
        a: 2,
        c: 1,
        ref: {
          b: undefined,
          z: 3,
        },
      });
    });
  });

  describe("edge cases", () => {
    it("should handle Date objects", () => {
      const date = new Date("2023-01-01");
      const input = { b: date, a: 1 };
      const result = toSorted(input);

      expect(result).toEqual({
        a: 1,
        b: date.toISOString(),
      });
    });

    it("should handle functions", () => {
      const fn = (): string => "test";
      const input = { b: fn, a: 1 };
      const result = toSorted(input);

      expect(result).toEqual({
        a: 1,
        b: undefined,
      });
    });

    it("should handle symbols as object values", () => {
      const sym = Symbol("test");
      const input = { b: sym, a: 1 };
      const result = toSorted(input);

      expect(result).toEqual({
        a: 1,
        b: sym.toString(),
      });
    });

    it("should maintain object prototype chain", () => {
      class TestClass {
        constructor(
          public b: number,
          public a: number,
        ) {}
      }

      const instance = new TestClass(1, 2);
      const result = toSorted(instance);

      expect(result).toEqual({ a: 2, b: 1 });
      expect(result).toBeInstanceOf(Object);
    });
  });

  describe("performance and deep nesting", () => {
    it("should handle deeply nested objects without stack overflow", () => {
      let deep: Record<string, unknown> = { value: "end" };
      for (let i = 0; i < 100; i++) {
        deep = { [`key${i}`]: deep, [`akey${i}`]: i, ...deep };
      }

      const result = toSorted(deep);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should handle large objects efficiently", () => {
      const large: Record<string, number> = {};
      for (let i = 1000; i >= 0; i--) {
        large[`key${i.toString().padStart(4, "0")}`] = i;
      }

      const result = toSorted(large);
      const keys = Object.keys(result);

      expect(keys).toHaveLength(1001);
      expect(keys[0]).toBe("key0000");
      expect(keys[keys.length - 1]).toBe("key1000");
    });
  });

  it("is touch called", () => {
    const input = {
      b: [{ z: 1, a: 2 }],
      a: [{ c: 3, b: 4 }],
    };
    const touchFn = vi.fn();
    const v = toSorted(input, touchFn);
    expect(v).toEqual({
      a: [{ b: 4, c: 3 }],
      b: [{ a: 2, z: 1 }],
    });
    expect(touchFn.mock.calls).toEqual([
      ["a", "Key"],
      [[{ b: 4, c: 3 }], "Array"],
      ["b", "Key"],
      [4, "Number"],
      ["c", "Key"],
      [3, "Number"],
      ["b", "Key"],
      [[{ a: 2, z: 1 }], "Array"],
      ["a", "Key"],
      [2, "Number"],
      ["z", "Key"],
      [1, "Number"],
    ]);
  });
});
