export function toSortedObjectArray<T>(set?: T): Record<string, unknown>[] {
  if (!set) return [];
  return toSortedArray(set).map(([k, v]) => ({ [k]: v }));
}

export function toSortedArray<T>(set?: T): [string, unknown][] {
  if (!set) return [];
  return Object.entries(set).sort(([a], [b]) => a.localeCompare(b));
}

export function toSortedObject<S, T extends NonNullable<S>>(set?: T): T {
  if (!set) return set as T;
  return Object.fromEntries(toSortedArray(set)) as T;
  // return toSortedArray(set).reduce((acc, cur) => {
  //     acc[cur[0]] = cur[1];
  //     return acc
  // }, {} as Record<string, unknown>) as T;
}
