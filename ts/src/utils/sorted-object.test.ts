import { toSortedObjectArray, toSortedArray, toSortedObject } from "./sorted-object.js";

it("should sort object to object-array", () => {
  const set = { b: 2, a: 1 };
  expect(toSortedObjectArray(set)).toEqual([{ a: 1 }, { b: 2 }]);
});

it("should sort object array", () => {
  const set = { b: 2, a: 1 };
  expect(toSortedArray(set)).toEqual([
    ["a", 1],
    ["b", 2],
  ]);
});

it("should sort object", () => {
  const set = { b: 2, a: 1 };
  expect(Array.from(Object.entries(toSortedObject(set)))).toEqual([
    ["a", 1],
    ["b", 2],
  ]);
});
