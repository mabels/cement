import { toSorted, TouchFn } from "./to-sorted.js";

/**
 * Converts an object to an array of single-key objects, sorted by key.
 *
 * Each entry becomes its own object with one key-value pair, useful for
 * serialization formats that need objects instead of tuples.
 *
 * @template T - The input object type
 * @param set - The object to convert
 * @param touchFn - Optional function to transform values during sorting
 * @returns Array of objects, each with a single key-value pair, sorted by key
 *
 * @example
 * ```typescript
 * const sorted = toSortedObjectArray({ z: 3, a: 1, m: 2 });
 * // [{ a: 1 }, { m: 2 }, { z: 3 }]
 * ```
 */
export function toSortedObjectArray<T>(set?: T, touchFn?: TouchFn): Record<string, unknown>[] {
  if (!set) return [];
  return toSortedArray(set, touchFn).map(([k, v]) => ({ [k]: v }));
}

/**
 * Converts an object to a sorted array of [key, value] tuples.
 *
 * @template T - The input object type
 * @param set - The object to convert
 * @param touchFn - Optional function to transform values during sorting
 * @returns Array of [key, value] tuples sorted by key
 *
 * @example
 * ```typescript
 * const sorted = toSortedArray({ z: 3, a: 1, m: 2 });
 * // [['a', 1], ['m', 2], ['z', 3]]
 * ```
 */
export function toSortedArray<T>(set?: T, touchFn?: TouchFn): [string, unknown][] {
  if (!set) return [];
  return Object.entries(toSorted(set, touchFn));
  //set).sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Returns a new object with keys sorted alphabetically.
 *
 * Creates a shallow copy of the object with keys in sorted order.
 * Useful for deterministic serialization or comparison.
 *
 * @template T - The input object type
 * @template S - Base type for non-null assertion
 * @param set - The object to sort
 * @param touchFn - Optional function to transform values during sorting
 * @returns New object with sorted keys, or undefined if input is null/undefined
 *
 * @example
 * ```typescript
 * const sorted = toSortedObject({ z: 3, a: 1, m: 2 });
 * // { a: 1, m: 2, z: 3 }
 * Object.keys(sorted); // ['a', 'm', 'z']
 * ```
 */
export function toSortedObject<T extends NonNullable<S>, S>(set?: T, touchFn?: TouchFn): T | undefined {
  if (!set) return set; // as T;
  return Object.fromEntries(toSortedArray(set, touchFn)) as T;
  // return toSortedArray(set).reduce((acc, cur) => {
  //     acc[cur[0]] = cur[1];
  //     return acc
  // }, {} as Record<string, unknown>) as T;
}
