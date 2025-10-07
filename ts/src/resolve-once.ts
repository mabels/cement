import { Future } from "./future.js";
import { UnPromisify } from "./is-promise.js";
import { isPromise } from "./is-promise.js";
import { LRUMap, LRUParam, UnregFn } from "./lru-map-set.js";
import { Result } from "./result.js";
import { Option } from "./option.js";

// interface ResolveSeqItem<C, R extends NonPromise<X>, X = string | number | boolean | symbol | object> {
interface ResolveSeqItem<C, T, R> {
  readonly future: Future<T>;
  readonly fn: (c: C) => R;
  readonly id?: number;
}

export class ResolveSeq<T, CTX extends NonNullable<object> = object> {
  readonly ctx?: CTX;
  readonly _seqFutures: ResolveSeqItem<CTX, T, unknown>[] = [];

  constructor(ctx?: CTX) {
    this.ctx = ctx;
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
  async _step(item?: ResolveSeqItem<CTX, T, Promise<T> | T>): Promise<void> {
    if (!item) {
      // done
      this._flushWaiting.forEach((f) => f.resolve());
      this._flushWaiting?.splice(0, this._flushWaiting.length);
      return Promise.resolve();
    }
    let value: T;
    try {
      const promiseOrValue = item.fn(this.ctx ?? ({} as CTX));
      if (isPromise(promiseOrValue)) {
        value = await promiseOrValue;
      } else {
        value = promiseOrValue;
      }
      item.future.resolve(value);
    } catch (e) {
      item.future.reject(e as Error);
    } finally {
      this._seqFutures.shift();
    }
    return this._step(this._seqFutures[0] as ResolveSeqItem<CTX, T, Promise<T> | T>);
  }
  add<R extends Promise<T> | T>(fn: (c: CTX) => R, id?: number): R {
    const future = new Future<T>();
    this._seqFutures.push({ future, fn, id });
    if (this._seqFutures.length === 1) {
      void this._step(this._seqFutures[0] as ResolveSeqItem<CTX, T, Promise<T> | T>); // exit into eventloop
    }
    return future.asPromise() as R; // as Promise<UnPromisify<R>>;
  }
}

// readonly _onceFutures: Future<T>[] = [];
// _onceDone = false;
// _onceOk = false;
// _onceValue?: T;
// _onceError?: Error;
// _isPromise = false;
// _inProgress?: Future<T>;

// ResolveOnce
// cases SyncMode, AsyncMode

type ResolveState = "initial" | "processed" | "waiting" | "processing";

// export type VoidEqualUndefined<T> = T extends undefined ? void : T
export type ResultOnce<R> = R extends Promise<infer T> ? Promise<T> : R;

type OnReadyFn<T, CTX> = (val: T, ctx?: CTX) => void;
interface ResolveOnceIf<R, CTX = void> {
  get ready(): boolean;
  get value(): R | undefined;
  get error(): Error | undefined;
  get state(): ResolveState;

  onReady(fn: OnReadyFn<R | undefined, CTX>): void;

  once<R>(fn: (c?: CTX) => R): ResultOnce<R>;
  reset<R>(fn?: (c?: CTX) => R): ResultOnce<R>;
}

export class SyncResolveOnce<T, CTX = void> {
  state: ResolveState = "initial";

  #value?: T;
  #error?: Error;

  readonly queueLength = 0;

  get value(): T | undefined {
    return this.#value;
  }

  get error(): Error | undefined {
    return this.#error;
  }

  get ready(): boolean {
    return this.state === "processed";
  }

  readonly #ctx?: CTX;
  constructor(ctx: CTX | undefined) {
    this.#ctx = ctx;
  }

  resolve(fn: (ctx?: CTX) => T, onReadyFn: OnReadyFn<T | undefined, CTX>): T {
    if (this.state === "initial") {
      this.state = "processed";
      try {
        this.#value = fn(this.#ctx);
        onReadyFn(this.#value, this.#ctx);
      } catch (e) {
        this.#error = e as Error;
      }
      if (isPromise(this.value)) {
        throw new Error("SyncResolveOnce.once fn returned a promise");
      }
    }
    if (this.#error) {
      throw this.#error;
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return this.#value as T;
  }

  reset(fn?: (c?: CTX) => T): T | undefined {
    this.state = "initial";
    this.#value = undefined;
    this.#error = undefined;
    if (fn) {
      return this.resolve(fn, () => undefined as T | undefined);
    }
    return undefined as T;
  }
}

class AsyncResolveItem<T> {
  readonly id = Math.random();
  #state: ResolveState = "initial";
  readonly #toResolve: Promise<UnPromisify<T>>;
  #value: Option<UnPromisify<T>> = Option.None();
  #error?: Error;

  constructor(fn: Promise<UnPromisify<T>>) {
    this.#toResolve = fn;
  }

  get value(): UnPromisify<T> | undefined {
    return this.#value.IsSome() ? this.#value.unwrap() : undefined;
  }

  get error(): Error | undefined {
    return this.#error;
  }

  readonly #queue: Future<UnPromisify<T>>[] = [];

  get queuelength(): number {
    return this.#queue.length;
  }

  isDisposable(): boolean {
    return this.#state === "processed" && this.#queue.length === 0;
  }

  #resolveFuture(future?: Future<UnPromisify<T>>): void {
    if (!future) {
      return;
    }
    if (this.#error) {
      future.reject(this.#error);
      return;
    }
    if (this.#value.IsSome()) {
      future.resolve(this.#value.Unwrap());
    }
  }

  #promiseResult(): Promise<UnPromisify<T>> {
    if (this.#error) {
      return Promise.reject(this.#error);
    }
    if (this.#value.IsSome()) {
      return Promise.resolve(this.#value.Unwrap());
    }
    throw new Error("AsyncResolveItem.#promiseResult impossible");
  }

  resolve(onReadyFn: (val: UnPromisify<T> | undefined) => void): T {
    if (this.#state === "initial") {
      this.#state = "waiting";
      const future = new Future<UnPromisify<T>>();
      // console.log("asyncItem addQueue#initial", this.id, this.#queue.length);
      this.#queue.push(future);
      this.#toResolve
        .then((value) => {
          this.#value = Option.Some(value);
          this.#state = "processed";
          onReadyFn(value);
        })
        .catch((e) => {
          this.#error = e as Error;
        })
        .finally(() => {
          while (this.#queue.length > 0) {
            this.#resolveFuture(this.#queue.shift());
          }
        });
      return future.asPromise() as T;
    }
    if (this.#state === "processed") {
      return this.#promiseResult() as T;
    }
    if (this.#state === "waiting") {
      const future = new Future<UnPromisify<T>>();
      // console.log("asyncItem addQueue#waiting", this.id, this.#queue.length);
      this.#queue.push(future);
      return future.asPromise() as T;
    }
    throw new Error("AsyncResolveItem.resolve impossible");
  }
}

export class AsyncResolveOnce<T, CTX = void> {
  // readonly id = Math.random();
  state: ResolveState = "initial";

  readonly #queue: AsyncResolveItem<T>[] = [];

  readonly #ctx?: CTX;
  constructor(ctx: CTX | undefined) {
    this.#ctx = ctx;
  }

  #active(): AsyncResolveItem<T> {
    const r = this.#queue[this.#queue.length - 1];
    if (!r) {
      throw new Error("AsyncResolveOnce.#active impossible");
    }
    return r;
  }

  get queueLength(): number {
    return this.#queue.reduce((acc, r) => acc + r.queuelength, this.#queue.length);
  }

  get ready(): boolean {
    return this.state !== "initial";
  }
  get value(): UnPromisify<T> | undefined {
    if (this.state === "initial") {
      return undefined;
    }
    return this.#active().value;
  }

  get error(): Error | undefined {
    if (this.state === "initial") {
      return undefined;
    }
    return this.#active().error;
  }

  resolve(fn: (ctx?: CTX) => T, onReadyFn: OnReadyFn<UnPromisify<T> | undefined, CTX>): T {
    if (this.state === "initial") {
      this.state = "waiting";
      let promiseResult: Promise<UnPromisify<T>>;
      try {
        const couldBePromise = fn(this.#ctx);
        if (!isPromise(couldBePromise)) {
          promiseResult = Promise.resolve(couldBePromise as UnPromisify<T>);
        } else {
          promiseResult = couldBePromise as Promise<UnPromisify<T>>;
        }
      } catch (e) {
        promiseResult = Promise.reject(e as Error);
      }
      // console.log("asyncOnce addQueue#initial", this.id, this.#queue.length);
      this.#queue.push(new AsyncResolveItem(promiseResult));
    }
    // remove all disposable items
    this.#queue
      .slice(0, -1)
      .map((i, idx) => (i.isDisposable() ? idx : undefined))
      .filter((i) => i !== undefined)
      .reverse()
      .forEach((idx) => this.#queue.splice(idx, 1));

    return this.#active().resolve((val) => {
      onReadyFn(val, this.#ctx);
    });
  }

  reset(fn?: (c?: CTX) => T): T {
    this.state = "initial";
    if (fn) {
      return this.resolve(fn, () => {
        /* no-op */
      });
    }
    return undefined as T;
  }
}

export class ResolveOnce<T, CTX = void> implements ResolveOnceIf<T, CTX> {
  #state: ResolveState = "initial";

  #syncOrAsync: Option<SyncResolveOnce<never, CTX> | AsyncResolveOnce<never, CTX>> = Option.None();

  readonly #ctx?: CTX;
  constructor(ctx?: CTX) {
    this.#ctx = ctx;
  }

  #onReadyFns: ((val: T | undefined, ctx?: CTX) => void)[] = [];
  onReady(fn: (val: T | undefined, ctx?: CTX) => void): void {
    if (this.#state === "processed") {
      fn(this.value, this.#ctx);
      return;
    }
    this.#onReadyFns.push(fn);
  }

  get ready(): boolean {
    return this.#state !== "initial" && this.#syncOrAsync.Unwrap().ready;
  }

  get value(): T | undefined {
    if (this.#state === "initial") {
      return undefined;
    }
    return this.#syncOrAsync.Unwrap().value as T;
  }

  get queueLength(): number {
    if (this.#state === "initial") {
      return 0;
    }
    return this.#syncOrAsync.Unwrap().queueLength;
  }

  get error(): Error | undefined {
    if (this.#state === "initial") {
      return undefined;
    }
    return this.#syncOrAsync.Unwrap().error;
  }

  get state(): ResolveState {
    if (this.#state === "initial") {
      return "initial";
    }
    return this.#syncOrAsync.Unwrap().state;
  }

  once<R>(fn: (c: CTX) => R): ResultOnce<R> {
    let resultFn: (ctx: CTX) => R;
    let onReadyFn: OnReadyFn<T | undefined, CTX> = () => {
      /* no-op */
    };
    if (this.#state === "initial") {
      this.#state = "processing";
      try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const isSyncOrAsync = fn(this.#ctx ?? ({} as CTX)) as R;
        if (isPromise(isSyncOrAsync)) {
          this.#syncOrAsync = Option.Some(new AsyncResolveOnce<never, CTX>(this.#ctx));
        } else {
          this.#syncOrAsync = Option.Some(new SyncResolveOnce<never, CTX>(this.#ctx));
        }
        resultFn = (): R => isSyncOrAsync;
        onReadyFn = (val: T | undefined, ctx?: CTX): void => {
          this.#state = "processed";
          // call all the onReadyFns
          this.#onReadyFns.forEach((f) => f(val, ctx));
          this.#onReadyFns.splice(0, this.#onReadyFns.length);
        };
      } catch (e) {
        this.#syncOrAsync = Option.Some(new SyncResolveOnce<never, CTX>(this.#ctx));
        resultFn = (): R => {
          throw e;
        };
      }
    } else {
      resultFn = fn;
    }
    if (!this.#syncOrAsync) {
      throw new Error("ResolveOnce.once impossible");
    }
    return this.#syncOrAsync.Unwrap().resolve(resultFn as (c?: CTX) => never, onReadyFn) as ResultOnce<R>;
  }

  reset<R>(fn?: (c: CTX) => R): ResultOnce<R> {
    if (this.#state === "initial") {
      return this.once(fn as (c: CTX) => R);
    }
    if (this.#state === "processing") {
      // eslint-disable-next-line no-console
      console.warn("ResolveOnce.reset dropped was called while processing");
      return undefined as ResultOnce<R>;
    }
    return this.#syncOrAsync.Unwrap().reset(fn as (c?: CTX) => never) as ResultOnce<R>;
  }
}

export interface KeyedParam<K, V> {
  readonly lru: Partial<LRUParam<V, K>>;
}

type AddKeyedParam<K, V, CTX extends NonNullable<object>> = KeyedParam<K, V> & { readonly ctx: CTX };

export class Keyed<T extends { reset: () => void }, K = string, CTX extends NonNullable<object> = object> {
  protected readonly _map: LRUMap<K, T>;
  // #lock = new ResolveSeq<T, K>();
  readonly #ctx: CTX;

  readonly factory: (ctx: AddKey<CTX, K>) => T;

  constructor(factory: (ctx: AddKey<CTX, K>) => T, ctx: Partial<AddKeyedParam<K, T, CTX>>) {
    this.#ctx = ctx.ctx || ({} as CTX);
    this.factory = factory;
    this._map = new LRUMap<K, T>(ctx?.lru ?? ({ maxEntries: -1 } as LRUParam<T, K>));
  }

  onSet(fn: (key: K, value: T) => void): UnregFn {
    return this._map.onSet(fn);
  }

  onDelete(fn: (key: K, value: T) => void): UnregFn {
    return this._map.onDelete(fn);
  }

  setParam(params: KeyedParam<K, T>): void {
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
      keyed = this.factory({ ...this.#ctx, key: key });
      this._map.set(key, keyed);
    }
    return keyed;
  }

  has(key: K | (() => K)): boolean {
    if (typeof key === "function") {
      key = (key as () => K)();
    }
    return this._map.has(key);
  }

  // lock<R extends Promisable<T>>(fn: (map: LRUMap<K, T>) => R): Promise<UnPromisify<R>>  {
  //   return this.#lock.add(() => fn(this._map));
  // }

  delete(key: K): void {
    this._map.delete(key);
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

interface KeyItem<K, V> {
  readonly key: K;
  readonly value: Result<V>;
}

export class KeyedResolvOnce<T, K = string, CTX extends NonNullable<object> = object> extends Keyed<
  ResolveOnce<T, AddKey<CTX, K>>,
  K,
  CTX
> {
  constructor(kp: Partial<AddKeyedParam<K, ResolveOnce<T, CTX>, CTX>> = {}) {
    // need the upcast we add to ResolvOnce CTX the Key
    super((ctx) => new ResolveOnce<T, AddKey<CTX, K>>(ctx), kp as AddKeyedParam<K, ResolveOnce<T, AddKey<CTX, K>>, CTX>);
  }

  *entries(): IterableIterator<KeyItem<K, T>> {
    for (const [k, v] of this._map.entries()) {
      if (!v.ready) {
        continue;
      }
      if (v.error) {
        yield { key: k, value: Result.Err<T>(v.error) };
      } else {
        yield { key: k, value: Result.Ok<T>(v.value) };
      }
    }
  }

  /**
   *
   * @returns The values of the resolved keys
   */
  values(): KeyItem<K, T>[] {
    return Array.from(this.entries());
  }
}

type AddKey<X extends NonNullable<object>, K> = X & { key: K };
type WithCTX<K, T, CTX extends NonNullable<object>> = KeyedParam<K, ResolveSeq<T, AddKey<CTX, K>>> & { readonly ctx: CTX };

export class KeyedResolvSeq<T extends NonNullable<unknown>, K = string, CTX extends NonNullable<object> = object> extends Keyed<
  ResolveSeq<T, AddKey<CTX, K>>,
  K,
  CTX
> {
  constructor(kp: Partial<WithCTX<K, T, CTX>> = {}) {
    super((ctx) => new ResolveSeq<T, AddKey<CTX, K>>(ctx), kp);
  }
}

class LazyContainer<T> {
  readonly resolveOnce = new ResolveOnce<T>();

  call<Args extends readonly unknown[], Return>(fn: (...args: Args) => Return): () => Return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return (...args: Args) => this.resolveOnce.once(() => fn(...args) as any) as unknown as Return;
  }
}

// T extends (...args: infer P) => any
// export function Lazy<R extends (...args: infer P) => infer X >(fn: R): (...args: P) =>infer
export function Lazy<Args extends readonly unknown[], Return>(fn: (...args: Args) => Return): (...args: Args) => Return {
  const lazy = new LazyContainer<Return>();
  return lazy.call(fn);
}

// enable sync functions waiting for async functions without blocking the event loop
// will be used for loading yaml dependency lazy in sync logger
export function WaitForAsync<T, X>(
  fn: () => Promise<T>,
  opts: { onReady: (ctx: Result<T>) => void } = {
    onReady: () => {
      /* no-op */
    },
  },
): (cb: (ctx: Result<T>) => ResultOnce<X>) => Promise<Result<UnPromisify<X>>> {
  const once = Lazy(() =>
    fn()
      .then((v) => {
        opts.onReady(Result.Ok(v));
        return v;
      })
      .catch((e: Error) => {
        opts.onReady(Result.Err(e));
        throw e;
      }),
  );
  const seq = new ResolveSeq<Result<UnPromisify<X>>>();
  return (cb: (ctx: Result<T>) => ResultOnce<X>): Promise<Result<UnPromisify<X>>> =>
    seq.add<Promise<Result<UnPromisify<X>>>>(
      () =>
        once()
          .then((ctx) => Promise.resolve<UnPromisify<X>>(cb(Result.Ok(ctx)) as UnPromisify<X>))
          .catch((err: Error) => Promise.resolve(Result.Err(err))) as Promise<Result<UnPromisify<X>>>,
    );
}
