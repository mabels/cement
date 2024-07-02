import { Future } from "./future";

export class ResolveOnce<T> {
  _onceDone = false;
  readonly _onceFutures: Future<T>[] = [];
  _onceOk?: T;
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
        return Promise.resolve(this._onceOk);
      }
      throw new Error("impossible");
    }
    const future = new Future<T>();
    this._onceFutures.push(future);
    if (this._onceFutures.length > 1) {
      return future.asPromise();
    }
    try {
      this._onceOk = await fn();
      this._onceDone = true;
      this._onceFutures.slice(1).forEach((f) => f.resolve(this._onceOk as T));
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
