export type UnPromisify<T> = T extends Promise<infer U> ? U : T;

export function isPromise<T>(a: T): a is T {
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
