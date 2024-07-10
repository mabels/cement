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

  reset() {
    this._onceDone = false;
    this._onceOk = false;
    this._onceValue = undefined;
    this._onceError = undefined;
    this._onceFutures.length = 0;
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
      throw new Error("ResolveOnce.once impossible");
    }
    const future = new Future<T>();
    this._onceFutures.push(future);
    if (this._onceFutures.length === 1) {
      fn()
        .then((value) => {
          this._onceValue = value;
          this._onceOk = true;
          this._onceDone = true;
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this._onceFutures.forEach((f) => f.resolve(this._onceValue!));
          this._onceFutures.length = 0;
        })
        .catch((e) => {
          this._onceError = e as Error;
          this._onceDone = true;
          this._onceFutures.forEach((f) => f.reject(this._onceError));
          this._onceFutures.length = 0;
        });
    }
    return future.asPromise();
  }
}

export class KeyedResolvOnce<T> {
  private readonly _map = new Map<string, ResolveOnce<T>>();

  get(key: string | (() => string)): ResolveOnce<T> {
    if (typeof key === "function") {
      key = key();
    }
    let resolveOnce = this._map.get(key);
    if (!resolveOnce) {
      resolveOnce = new ResolveOnce<T>();
      this._map.set(key, resolveOnce);
    }
    return resolveOnce;
  }

  reset() {
    this._map.forEach((resolveOnce) => resolveOnce.reset());
    this._map.clear();
  }
}
