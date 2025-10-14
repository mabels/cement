function toSortedRecursive<T>(arrayOrObject: T, touchFn?: (value: unknown) => void, cycleReferences = new Set<T>()): T {
  function ref(): T {
    if (cycleReferences.has(arrayOrObject)) {
      return undefined;
    }
    cycleReferences.add(arrayOrObject);
    return true as T;
  }
  switch (true) {
    case arrayOrObject === null || arrayOrObject === undefined:
      return arrayOrObject;

    case arrayOrObject instanceof Date: {
      const val = arrayOrObject.toISOString() as unknown as T;
      touchFn?.(val);
      return val;
    }
    case typeof arrayOrObject === "symbol": {
      const val = arrayOrObject.toString() as unknown as T;
      touchFn?.(val);
      return val;
    }

    case Array.isArray(arrayOrObject):
      return ref() && (arrayOrObject.map((i) => toSortedRecursive<unknown>(i, touchFn, cycleReferences)) as T);

    case typeof arrayOrObject === "function":
      return undefined;

    case typeof arrayOrObject === "object":
      return (
        ref() &&
        (Object.fromEntries(
          Object.entries(arrayOrObject as Record<string, unknown>)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, value]) => {
              touchFn?.(key);
              return [key, toSortedRecursive(value, touchFn, cycleReferences)];
            }),
        ) as T)
      );

    default:
      touchFn?.(arrayOrObject);
      return arrayOrObject;
  }
}

export function toSorted<T>(arrayOrObject: T, touchFn?: (value: unknown) => void): T {
  return toSortedRecursive(arrayOrObject, touchFn, new Set<T>());
}
