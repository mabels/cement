export type UnPromisify<T> = T extends Promise<infer U> ? U : T;
export type WithoutPromise<T> = UnPromisify<T>;

export type IsNotPromise<T> = T extends Promise<never> ? never : T;

export type Promisable<T> = T | Promise<T>;

export function isPromise<T>(a: T): a is T extends Promise<unknown> ? T : never {
  const mayBe = a as unknown as { then: () => void; catch: () => void; finally: () => void };
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

export function isNotPromise<T>(a: T): T {
  return !isPromise(a) as T;
}
