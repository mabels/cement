export type TouchFn = (value: string | boolean | number) => void;

function toSortedRecursive<T>(arrayOrObject: T, touchFn?: TouchFn, cycleReferences = new Set<T>()): T {
  function ref(): T {
    if (cycleReferences.has(arrayOrObject)) {
      return undefined as T;
    }
    cycleReferences.add(arrayOrObject);
    return true as T;
  }
  switch (true) {
    case arrayOrObject === null || arrayOrObject === undefined:
      return arrayOrObject;

    case arrayOrObject instanceof Date: {
      const val = arrayOrObject.toISOString();
      touchFn?.(val);
      return val as unknown as T;
    }
    case typeof arrayOrObject === "symbol": {
      const val = arrayOrObject.toString();
      touchFn?.(val);
      return val as unknown as T;
    }

    case Array.isArray(arrayOrObject):
      return ref() && (arrayOrObject.map((i) => toSortedRecursive<unknown>(i, touchFn, cycleReferences)) as T);

    case typeof arrayOrObject === "function":
      return undefined as T;

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
      touchFn?.(arrayOrObject as string | boolean | number);
      return arrayOrObject;
  }
}

export function toSorted<T>(arrayOrObject: T, touchFn?: TouchFn): T {
  return toSortedRecursive(arrayOrObject, touchFn, new Set<T>());
}
