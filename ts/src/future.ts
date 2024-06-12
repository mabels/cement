export class Future<T> {
  readonly #promise: Promise<T>;
  #resolveFn: (value: T) => void = () => {
    throw new Error("This Promise is not working as expected.");
  };
  #rejectFn: (reason: any) => void = () => {
    throw new Error("This Promise is not working as expected.");
  };

  constructor() {
    this.#promise = new Promise<T>((resolve, reject) => {
      this.#resolveFn = resolve;
      this.#rejectFn = reject;
    });
  }

  async asPromise(): Promise<T> {
    return this.#promise;
  }

  resolve(value: T) {
    this.#resolveFn(value);
  }
  reject(reason: any) {
    this.#rejectFn(reason);
  }
}
