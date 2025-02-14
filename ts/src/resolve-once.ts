import { Future } from "./future.js";
import { LRUMap, LRUParam } from "./lru-map-set.js";
import { Result } from "./result.js";

interface ResolveSeqItem<T, C> {
  readonly future: Future<T>;
  readonly fn: (c: C) => Promise<T>;
  readonly id?: number;
}

export class ResolveSeq<T, C = void> {
  readonly ctx: C;
  constructor(ctx?: C) {
    this.ctx = ctx as C;
  }
  reset(): void {
    /* noop */
  }

  readonly _flushWaiting: Future<void>[] = [];
  flush(): Promise<void> {
    if (this._seqFutures.length > 0) {
      const waitForFlush = new Future<void>();
      this._flushWaiting?.push(waitForFlush);
      return waitForFlush.asPromise();
    }
    return Promise.resolve();
  }
  _step(item?: ResolveSeqItem<T, C>): Promise<void> {
    if (!item) {
      // done
      this._flushWaiting.forEach((f) => f.resolve());
      this._flushWaiting?.splice(0, this._flushWaiting.length);
      return Promise.resolve();
    }
    item
      .fn(this.ctx)
      .then((value) => item.future.resolve(value))
      .catch((e) => item.future.reject(e as Error))
      .finally(() => {
        this._seqFutures.shift();
        void this._step(this._seqFutures[0]);
      });
    return Promise.resolve();
  }
  readonly _seqFutures: ResolveSeqItem<T, C>[] = [];
  async add(fn: (c: C) => Promise<T>, id?: number): Promise<T> {
    const future = new Future<T>();
    this._seqFutures.push({ future, fn, id });
    if (this._seqFutures.length === 1) {
      void this._step(this._seqFutures[0]);
    }
    return future.asPromise();
  }
}

export class ResolveOnce<T, CTX = void> {
  _onceDone = false;
  readonly _onceFutures: Future<T>[] = [];
  _onceOk = false;
  _onceValue?: T;
  _onceError?: Error;
  _isPromise = false;
  _inProgress?: Future<T>;

  readonly ctx: CTX;

  constructor(ctx?: CTX) {
    this.ctx = ctx as CTX;
  }

  get ready(): boolean {
    return this._onceDone;
  }

  reset(): void {
    this._onceDone = false;
    this._onceOk = false;
    this._onceValue = undefined;
    this._onceError = undefined;
    if (this._inProgress) {
      const idx = this._onceFutures.findIndex((f) => f === this._inProgress);
      if (idx >= 0) {
        // leave the current in progress future
        this._onceFutures.push(...this._onceFutures.splice(2).slice(1));
      }
    } else {
      this._onceFutures.length = 0;
    }
  }

  // T extends Option<infer U> ? U : T
  once<R>(fn: (c: CTX) => R): R {
    if (this._onceDone) {
      if (this._onceError) {
        if (this._isPromise) {
          return Promise.reject(this._onceError) as unknown as R;
        } else {
          throw this._onceError;
        }
      }
      if (this._onceOk) {
        if (this._isPromise) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return Promise.resolve(this._onceValue!) as unknown as R;
        } else {
          return this._onceValue as unknown as R;
        }
      }
      throw new Error("ResolveOnce.once impossible");
    }
    const future = new Future<T>();
    this._onceFutures.push(future);
    if (this._onceFutures.length === 1) {
      const okFn = (value: T): void => {
        this._onceValue = value;
        this._onceOk = true;
        this._onceDone = true;
        if (this._isPromise) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this._onceFutures.forEach((f) => f.resolve(this._onceValue!));
        }
        this._onceFutures.length = 0;
      };
      const catchFn = (e: Error): void => {
        this._onceError = e;
        this._onceOk = false;
        this._onceValue = undefined;
        this._onceDone = true;
        if (this._isPromise) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this._onceFutures.forEach((f) => f.reject(this._onceError!));
        }
        this._onceFutures.length = 0;
      };
      this._inProgress = future;
      // let inCriticalSection = false;
      try {
        const ret = fn(this.ctx);
        if (typeof (ret as Promise<T>).then === "function") {
          this._isPromise = true;
          // inCriticalSection = true;
          (ret as Promise<T>)
            .then(okFn)
            .catch(catchFn)
            .finally(() => {
              this._inProgress = undefined;
            });
        } else {
          okFn(ret as unknown as T);
        }
      } catch (e) {
        catchFn(e as Error);
      }
      if (!this._isPromise) {
        this._inProgress = undefined;
      }
    }
    if (this._isPromise) {
      return future.asPromise() as unknown as R;
    } else {
      // abit funky but i don't want to impl the return just once
      return this.once(fn);
    }
  }
}

export interface KeyedParam {
  readonly lru: Partial<LRUParam>;
}

export class Keyed<T extends { reset: () => void }, K = string> {
  protected readonly _map: LRUMap<K, T>;

  readonly factory: (key: K) => T;
  constructor(factory: (key: K) => T, params: Partial<KeyedParam>) {
    this.factory = factory;
    this._map = new LRUMap<K, T>(params?.lru ?? { maxEntries: -1 });
  }

  setParam(params: KeyedParam): void {
    this._map.setParam(params.lru);
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

  unget(key: K): void {
    const keyed = this._map.get(key);
    keyed?.reset();
    this._map.delete(key);
  }

  reset(): void {
    this._map.forEach((keyed) => keyed.reset());
    this._map.clear();
  }
}

export class KeyedResolvOnce<T, K = string> extends Keyed<ResolveOnce<T, K>, K> {
  constructor(kp: Partial<KeyedParam> = {}) {
    super((key) => new ResolveOnce<T, K>(key), kp);
  }

  /**
   *
   * @returns The values of the resolved keys
   */
  values(): { key: K; value: Result<T> }[] {
    return (
      Array.from(this._map.entries())
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .filter(([_, v]) => v._onceDone)
        .map(([k, v]) => {
          if (v._onceDone) {
            if (v._onceError) {
              return {
                key: k,
                value: Result.Err(v._onceError),
              };
            }
            return {
              key: k,
              value: Result.Ok(v._onceValue as T),
            };
          }
          throw new Error("KeyedResolvOnce.values impossible");
        })
    );
  }
}

export class KeyedResolvSeq<T, K = string> extends Keyed<ResolveSeq<T, K>, K> {
  constructor(kp: Partial<KeyedParam> = {}) {
    super((key) => new ResolveSeq<T, K>(key), kp);
  }
}
