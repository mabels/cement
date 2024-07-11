import { Future } from "./future";

interface ResolveSeqItem<T, C> {
  future: Future<T>;
  fn: (c: C) => Promise<T>;
}

export class ResolveSeq<T, C = void> {
  readonly ctx: C;
  constructor(ctx?: C) {
    this.ctx = ctx as C;
  }
  reset() {
    /* noop */
  }
  async _step(item?: ResolveSeqItem<T, C> | undefined) {
    if (!item) {
      // done
      return;
    }
    item
      .fn(this.ctx)
      .then((value) => item.future.resolve(value))
      .catch((e) => item.future.reject(e as Error))
      .finally(() => this._step(this._seqFutures.shift()));
  }
  readonly _seqFutures: ResolveSeqItem<T, C>[] = [];
  async add(fn: (c: C) => Promise<T>): Promise<T> {
    const future = new Future<T>();
    this._seqFutures.push({ future, fn });
    this._step(this._seqFutures.shift());
    return future.asPromise();
  }
}

export class ResolveOnce<T, C = void> {
  _onceDone = false;
  readonly _onceFutures: Future<T>[] = [];
  _onceOk = false;
  _onceValue?: T;
  _onceError?: Error;

  readonly ctx: C;

  constructor(ctx?: C) {
    this.ctx = ctx as C;
  }

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

  async once(fn: (c: C) => Promise<T>): Promise<T> {
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
      fn(this.ctx)
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
          this._onceOk = false;
          this._onceValue = undefined;
          this._onceDone = true;
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this._onceFutures.forEach((f) => f.reject(this._onceError!));
          this._onceFutures.length = 0;
        });
    }
    return future.asPromise();
  }
}

export class Keyed<T extends { reset: () => void }, K = string> {
  private readonly _map = new Map<K, T>();

  readonly factory: (key: K) => T;
  constructor(factory: (key: K) => T) {
    this.factory = factory;
  }

  async asyncGet(key: () => Promise<K>): Promise<T> {
    return this.get(await key());
  }

  get(key: K | (() => K)): T {
    if (typeof key === "function") {
      key = (key as () => K)();
    }
    let keyed = this._map.get(key);
    if (!keyed) {
      keyed = this.factory(key);
      this._map.set(key, keyed);
    }
    return keyed;
  }

  reset() {
    this._map.forEach((keyed) => keyed.reset());
    this._map.clear();
  }
}

export class KeyedResolvOnce<T, K = string> extends Keyed<ResolveOnce<T, K>, K> {
  constructor() {
    super((key) => new ResolveOnce<T, K>(key));
  }
}

export class KeyedResolvSeq<T, K = string> extends Keyed<ResolveSeq<T, K>, K> {
  constructor() {
    super((key) => new ResolveSeq<T, K>(key));
  }
}
