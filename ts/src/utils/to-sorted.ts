export type TouchType = bigint | Date | symbol | string | boolean | number | Uint8Array | null | undefined | object | unknown[];
export type TouchFn = (value: TouchType, type: keyof typeof TouchTypes) => void;

export const TouchTypes = {
  Null: "0",
  Key: "K",
  String: "S",
  Boolean: "B",
  Number: "N",
  Date: "D",
  Symbol: "Y",
  Uint8Array: "U",
  Array: "A",
  Function: "F",
};

function toSortedRecursive<T>(arrayOrObject: T, touchFn?: TouchFn, cycleReferences = new Set<T>()): T {
  function ref(): T {
    if (cycleReferences.has(arrayOrObject)) {
      return undefined as T;
    }
    cycleReferences.add(arrayOrObject);
    return true as T;
  }
  switch (true) {
    case arrayOrObject === null || arrayOrObject === undefined: {
      touchFn?.(arrayOrObject as TouchType, "Null");
      return arrayOrObject;
    }

    case arrayOrObject instanceof Date: {
      touchFn?.(arrayOrObject, "Date");
      return arrayOrObject.toISOString() as unknown as T;
    }
    case typeof arrayOrObject === "symbol": {
      touchFn?.(arrayOrObject, "Symbol");
      return arrayOrObject.toString() as unknown as T;
    }

    case arrayOrObject instanceof Uint8Array:
      touchFn?.(arrayOrObject, "Uint8Array");
      return arrayOrObject as T;

    case Array.isArray(arrayOrObject):
      touchFn?.(arrayOrObject, "Array");
      return ref() && (arrayOrObject.map((i) => toSortedRecursive<unknown>(i, touchFn, cycleReferences)) as T);

    case typeof arrayOrObject === "function":
      touchFn?.(arrayOrObject, "Function");
      return undefined as T;

    case typeof arrayOrObject === "object":
      return (
        ref() &&
        (Object.fromEntries(
          Object.entries(arrayOrObject as Record<string, unknown>)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, value]) => {
              touchFn?.(key, "Key");
              return [key, toSortedRecursive(value, touchFn, cycleReferences)];
            }),
        ) as T)
      );

    default:
      switch (typeof arrayOrObject) {
        case "string":
          touchFn?.(arrayOrObject, "String");
          break;
        case "boolean":
          touchFn?.(arrayOrObject, "Boolean");
          break;
        case "bigint":
        case "number":
          touchFn?.(arrayOrObject, "Number");
          break;
      }
      return arrayOrObject;
  }
}

export function toSorted<T>(arrayOrObject: T, touchFn?: TouchFn): T {
  return toSortedRecursive(arrayOrObject, touchFn, new Set<T>());
}
