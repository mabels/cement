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

/**
 * Recursively sorts object keys and normalizes values for deterministic serialization.
 *
 * Deep sorts all object keys alphabetically, converts Dates to ISO strings,
 * symbols to strings, and recursively processes nested structures. Handles
 * circular references by returning undefined for cycles. Optional callback
 * tracks all values encountered during traversal.
 *
 * @template T - The input value type
 * @param arrayOrObject - Value to sort (object, array, or primitive)
 * @param touchFn - Optional callback invoked for each value with its type
 * @returns Sorted/normalized copy of the input
 *
 * @example
 * ```typescript
 * const obj = {
 *   z: { nested: true, another: false },
 *   a: [3, 1, 2],
 *   date: new Date('2024-01-01')
 * };
 *
 * const sorted = toSorted(obj);
 * // {
 * //   a: [3, 1, 2],
 * //   date: '2024-01-01T00:00:00.000Z',
 * //   z: { another: false, nested: true }
 * // }
 *
 * // Track value types
 * const types: string[] = [];
 * toSorted(obj, (value, type) => types.push(type));
 * // types: ['Key', 'Array', 'Number', ..., 'Date', ...]
 * ```
 */
export function toSorted<T>(arrayOrObject: T, touchFn?: TouchFn): T {
  return toSortedRecursive(arrayOrObject, touchFn, new Set<T>());
}
