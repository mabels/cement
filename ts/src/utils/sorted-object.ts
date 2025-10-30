import { toSorted, TouchFn } from "./to-sorted.js";

export function toSortedObjectArray<T>(set?: T, touchFn?: TouchFn): Record<string, unknown>[] {
  if (!set) return [];
  return toSortedArray(set, touchFn).map(([k, v]) => ({ [k]: v }));
}

export function toSortedArray<T>(set?: T, touchFn?: TouchFn): [string, unknown][] {
  if (!set) return [];
  return Object.entries(toSorted(set, touchFn));
  //set).sort(([a], [b]) => a.localeCompare(b));
}

export function toSortedObject<T extends NonNullable<S>, S>(set?: T, touchFn?: TouchFn): T | undefined {
  if (!set) return set; // as T;
  return Object.fromEntries(toSortedArray(set, touchFn)) as T;
  // return toSortedArray(set).reduce((acc, cur) => {
  //     acc[cur[0]] = cur[1];
  //     return acc
  // }, {} as Record<string, unknown>) as T;
}
