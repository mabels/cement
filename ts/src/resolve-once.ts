import { Future } from "./future";

export class ResolveOnce<T> {
  _onceDone = false;
  readonly _onceFutures: Future<T>[] = [];
  _onceOk = false;
  _onceValue?: T;
  _onceError?: Error;

  get ready() {
    return this._onceDone;
  }

  async once(fn: () => Promise<T>): Promise<T> {
    if (this._onceDone) {
      if (this._onceError) {
        return Promise.reject(this._onceError);
      }
      if (this._onceOk) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return Promise.resolve(this._onceValue!);
      }
      throw new Error("impossible");
    }
    const future = new Future<T>();
    this._onceFutures.push(future);
    if (this._onceFutures.length > 1) {
      return future.asPromise();
    }
    try {
      this._onceValue = await fn();
      this._onceOk = true;
      this._onceDone = true;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this._onceFutures.slice(1).forEach((f) => f.resolve(this._onceValue!));
      this._onceFutures.length = 0;
    } catch (e) {
      this._onceError = e as Error;
      this._onceDone = true;
      this._onceFutures.slice(1).forEach((f) => f.reject(this._onceError));
      this._onceFutures.length = 0;
    }
    return this.once(fn);
  }
}
