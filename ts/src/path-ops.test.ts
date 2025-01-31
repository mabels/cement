import { pathOps } from "./path-ops.js";

it("basename", () => {
  expect(pathOps.basename("a/b/c")).toBe("c");
  expect(pathOps.basename("a/b/c/")).toBe("c");
  expect(pathOps.basename("c")).toBe("c");
  expect(pathOps.basename("c/")).toBe("c");
  expect(pathOps.basename("")).toBe("");
});

it("dirname", () => {
  expect(pathOps.dirname("a/b/c")).toBe("a/b");
  expect(pathOps.dirname("a/b/c/")).toBe("a/b");
  expect(pathOps.dirname("c")).toBe("");
  expect(pathOps.dirname("c/")).toBe("");
  expect(pathOps.dirname("")).toBe("");
});

it("join", () => {
  expect(pathOps.join("a", "b", "c")).toBe("a/b/c");
  expect(pathOps.join("a", "b", "c/")).toBe("a/b/c");
  expect(pathOps.join("c")).toBe("c");
  expect(pathOps.join("c/")).toBe("c");
  expect(pathOps.join("")).toBe("");
});
