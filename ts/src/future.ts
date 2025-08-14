export class Future<T> {
  // readonly id = Math.random();
  readonly #promise: Promise<T>;
  #resolveFn: (value: T) => void = () => {
    throw new Error("This Promise is not working as expected.");
  };
  #rejectFn: (reason: unknown) => void = () => {
    throw new Error("This Promise is not working as expected.");
  };

  constructor() {
    this.#promise = new Promise<T>((resolve, reject) => {
      this.#resolveFn = resolve;
      this.#rejectFn = reject;
    });
  }

  asPromise(): Promise<T> {
    return this.#promise;
  }

  resolve(value: T): void {
    this.#resolveFn(value);
  }
  reject(reason: unknown): void {
    this.#rejectFn(reason);
  }
}
