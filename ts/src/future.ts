import { Lazy } from "./resolve-once.js";

/**
 * A Promise that can be resolved or rejected externally after creation.
 *
 * Future provides a way to create a Promise whose resolution is controlled
 * externally rather than in the executor function. This is useful for
 * coordinating async operations, implementing custom async primitives,
 * or bridging callback-based APIs to promises.
 *
 * @template T - The type of the resolved value
 * @template CTX - Optional context type for additional data
 *
 * @example
 * ```typescript
 * const future = new Future<string>();
 *
 * // Later, resolve it from anywhere
 * future.resolve('hello');
 *
 * // Or reject it
 * future.reject(new Error('failed'));
 *
 * // Use it like a promise
 * const result = await future.asPromise();
 * ```
 */
export class Future<T, CTX = void> {
  // readonly id = Math.random();
  readonly #promise: Promise<T>;
  #resolveFn: (value: T) => void = () => {
    throw new Error("This Promise is not working as expected.");
  };
  #rejectFn: (reason: unknown) => void = () => {
    throw new Error("This Promise is not working as expected.");
  };

  readonly ctx?: CTX;
  constructor(ctx?: CTX) {
    this.ctx = ctx;
    this.#promise = new Promise<T>((resolve, reject) => {
      this.#resolveFn = resolve;
      this.#rejectFn = reject;
    });
  }

  /**
   * Lazily-generated unique identifier for this Future.
   * Not cryptographically secure, but suitable for transaction/debug tracking.
   */
  readonly id: () => string = Lazy(() => Math.random().toString(36).substring(2) + Date.now().toString(36));

  /**
   * Returns the underlying Promise that will be resolved or rejected.
   *
   * @returns The Promise representation of this Future
   */
  asPromise(): Promise<T> {
    return this.#promise;
  }

  /**
   * Resolves the Future with the given value.
   *
   * @param value - The value to resolve the Promise with
   */
  resolve(value: T): void {
    this.#resolveFn(value);
  }

  /**
   * Rejects the Future with the given reason.
   *
   * @param reason - The reason for rejection (typically an Error)
   */
  reject(reason: unknown): void {
    this.#rejectFn(reason);
  }
}
