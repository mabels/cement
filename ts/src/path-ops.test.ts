import { it, expect } from "vitest";
import { pathOps } from "@adviser/cement";

it("basename", () => {
  expect(pathOps.basename("a/b/c")).toBe("c");
  expect(pathOps.basename("a/b/c/")).toBe("c");
  expect(pathOps.basename("c")).toBe("c");
  expect(pathOps.basename("c/")).toBe("c");
  expect(pathOps.basename("/a/b/c")).toBe("c");
  expect(pathOps.basename("/a/b/c/")).toBe("c");
  expect(pathOps.basename("/c")).toBe("c");
  expect(pathOps.basename("/c/")).toBe("c");
  expect(pathOps.basename("")).toBe("");
});

it("dirname", () => {
  expect(pathOps.dirname("a/b/c")).toBe("a/b");
  expect(pathOps.dirname("/a/b/c")).toBe("/a/b");
  expect(pathOps.dirname("a/b/c/")).toBe("a/b");
  expect(pathOps.dirname("/a/b/c/")).toBe("/a/b");
  expect(pathOps.dirname("///a///b/./c/")).toBe("/a/b");
  expect(pathOps.dirname("c")).toBe(".");
  expect(pathOps.dirname("./c/d")).toBe("c");
  expect(pathOps.dirname("c/")).toBe(".");
  expect(pathOps.dirname("")).toBe(".");
  expect(pathOps.dirname("./yyy/./a")).toBe("yyy");
});

it("join", () => {
  expect(pathOps.join("a", "b", "c")).toBe("a/b/c");
  expect(pathOps.join("a", "b", "c/")).toBe("a/b/c");
  expect(pathOps.join("", "a", "", "b", "", "c/")).toBe("a/b/c");
  expect(pathOps.join("c")).toBe("c");
  expect(pathOps.join("c/")).toBe("c");
  expect(pathOps.join("")).toBe(".");
  expect(pathOps.join(".", "yyy")).toBe("yyy");
  expect(pathOps.join(".", "yyy", ".", "a")).toBe("yyy/a");
  expect(pathOps.join("./")).toBe(".");
  expect(pathOps.join(".")).toBe(".");
  expect(pathOps.join(".", ".")).toBe(".");
  expect(pathOps.join(".", ".", ".", "c")).toBe("c");
});

it("pathops is empty", () => {
  expect(() => pathOps.dirname(undefined as unknown as string)).toThrow();
  expect(() => pathOps.dirname(null as unknown as string)).toThrow();
  expect(() => pathOps.dirname(123 as unknown as string)).toThrow();
});
