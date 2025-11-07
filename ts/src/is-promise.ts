export type UnPromisify<T> = T extends Promise<infer U> ? U : T;
export type WithoutPromise<T> = UnPromisify<T>;

export type IsNotPromise<T> = T extends Promise<never> ? never : T;

export type Promisable<T> = T | Promise<T>;

export type NonPromise<T> = T extends Promise<never> ? never : T;

/**
 * Type guard to check if a value is a Promise or Promise-like (thenable).
 *
 * Checks both for instanceof Promise and for objects with then/catch/finally methods,
 * allowing it to work with Promise-like objects from different execution contexts.
 *
 * @template R - The Promise type
 * @template T - The resolved value type
 * @param a - The value to check
 * @returns True if the value is a Promise or thenable
 *
 * @example
 * ```typescript
 * const value: unknown = fetchData();
 * if (isPromise(value)) {
 *   const result = await value;
 * }
 * ```
 */
export function isPromise<R extends Promise<T>, T>(a: unknown): a is R {
  const mayBe = a as { then: () => void; catch: () => void; finally: () => void };
  return (
    mayBe instanceof Promise ||
    !!(
      mayBe &&
      mayBe !== null &&
      typeof mayBe.then === "function" &&
      typeof mayBe.catch === "function" &&
      typeof mayBe.finally === "function"
    )
  );
}

/**
 * Type guard to check if a value is NOT a Promise.
 *
 * @template T - The value type
 * @param a - The value to check
 * @returns The value cast to type T if it's not a Promise
 */
export function isNotPromise<T>(a: T): T {
  return !isPromise(a) as T;
}
