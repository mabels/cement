/**
 * Utilities for executing functions once and caching results, with support for both
 * synchronous and asynchronous operations, sequential execution, and keyed collections.
 *
 * ## Main Classes
 *
 * - **ResolveOnce**: Ensures a function executes only once, automatically handling sync/async
 * - **ResolveSeq**: Executes functions sequentially, maintaining order even with concurrent calls
 * - **Keyed**: Base class for managing keyed instances with LRU caching
 * - **KeyedResolveOnce**: Map of ResolveOnce instances indexed by keys
 * - **KeyedResolveSeq**: Map of ResolveSeq instances indexed by keys
 * - **Lazy**: Function wrapper that executes once and caches the result
 *
 * @module resolve-once
 */

import { Future } from "./future.js";
import { UnPromisify, isPromise } from "./is-promise.js";
import { UnregFn } from "./lru-map-set.js";
import { Result } from "./result.js";
import { Option } from "./option.js";
import { KeyedIf, KeyedNg, KeyedNgItem, KeyedNgItemWithoutValue, KeyedNgOptions } from "./keyed-ng.js";

/**
 * Internal item representing a queued function in a ResolveSeq sequence.
 * @internal
 */
interface ResolveSeqItem<C, T, R> {
  readonly future: Future<T>;
  readonly fn: (c: C) => R;
  readonly id?: number;
}

/**
 * Executes functions sequentially, one at a time, ensuring order of execution.
 *
 * ResolveSeq maintains a queue of functions and executes them in order, waiting for each
 * to complete before starting the next. This is useful when you need to ensure operations
 * happen in a specific sequence, even when multiple operations are queued concurrently.
 *
 * @template T - The return type of the functions
 * @template CTX - Optional context type passed to each function
 *
 * @example
 * ```typescript
 * const seq = new ResolveSeq<number>();
 *
 * // Multiple calls are queued and executed in order
 * const p1 = seq.add(() => asyncOperation1());
 * const p2 = seq.add(() => asyncOperation2());
 * const p3 = seq.add(() => asyncOperation3());
 *
 * // Operations execute sequentially: op1 -> op2 -> op3
 * await Promise.all([p1, p2, p3]);
 * ```
 */
export class ResolveSeq<T, CTX extends NonNullable<object> = object> {
  readonly ctx?: CTX;
  readonly _seqFutures: ResolveSeqItem<CTX, T, unknown>[] = [];

  constructor(ctx?: CTX) {
    this.ctx = ctx;
  }

  /**
   * Resets the sequence (currently a no-op).
   */
  reset(): void {
    /* noop */
  }

  readonly _flushWaiting: Future<void>[] = [];

  /**
   * Returns a promise that resolves when all currently queued items complete.
   *
   * @returns A promise that resolves when the queue is empty
   */
  flush(): Promise<void> {
    if (this._seqFutures.length > 0) {
      const waitForFlush = new Future<void>();
      this._flushWaiting?.push(waitForFlush);
      return waitForFlush.asPromise();
    }
    return Promise.resolve();
  }

  /**
   * Internal method to process items in the queue sequentially.
   * @internal
   */
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

  /**
   * Adds a function to the sequence queue for sequential execution.
   *
   * The function will be executed after all previously queued functions complete.
   * Returns a promise that resolves with the function's result.
   *
   * @param fn - The function to execute
   * @param id - Optional identifier for tracking
   * @returns A promise that resolves with the function's result
   */
  add<R extends Promise<T> | T>(fn: (c: CTX) => R, id?: number): R {
    const future = new Future<T>();
    this._seqFutures.push({ future, fn, id });
    if (this._seqFutures.length === 1) {
      void this._step(this._seqFutures[0] as ResolveSeqItem<CTX, T, Promise<T> | T>); // exit into eventloop
    }
    return future.asPromise() as R; // as Promise<UnPromisify<R>>;
  }
}

/**
 * Represents the current state of a resolve operation.
 * - `initial`: Not yet started
 * - `processed`: Completed
 * - `waiting`: Waiting for async operation
 * - `processing`: Currently executing
 */
type ResolveState = "initial" | "processed" | "waiting" | "processing";

/**
 * Type helper that unwraps Promise types to their resolved value type.
 *
 * @template R - The type to unwrap
 *
 * @example
 * ```typescript
 * type A = ResultOnce<Promise<number>>; // Promise<number>
 * type B = ResultOnce<string>;          // string
 * ```
 */
export type ResultOnce<R> = R extends Promise<infer T> ? Promise<T> : R;

/**
 * Interface defining the contract for ResolveOnce-like objects.
 * @template R - The return type
 * @template CTX - Optional context type
 */
export interface ResolveOnceIf<R, CTX = void> {
  get ready(): boolean;
  get value(): UnPromisify<R> | undefined;
  get error(): Error | undefined;
  get state(): ResolveState;

  once<R>(fn: (c?: CTX) => R): ResultOnce<R>;
  reset<R>(fn?: (c?: CTX) => R): ResultOnce<R>;
}

/**
 * Synchronous version of ResolveOnce for functions that return non-promise values.
 *
 * This class is used internally by ResolveOnce when it detects a synchronous function.
 * It executes the function once and caches the result or error for subsequent calls.
 *
 * @template T - The return type
 * @template CTX - Optional context type
 * @internal
 */
export class SyncResolveOnce<T, CTX = void> {
  #value?: T;
  #error?: Error;

  readonly queueLength = 0;

  readonly #state: StateInstance;
  readonly #rOnce: ResolveOnce<T, CTX>;

  constructor(rOnce: ResolveOnce<T, CTX>, state: StateInstance) {
    this.#state = state;
    this.#rOnce = rOnce;
  }

  /**
   * Gets the cached value if available.
   */
  get value(): T | undefined {
    return this.#value;
  }

  /**
   * Gets the cached error if one occurred.
   */
  get error(): Error | undefined {
    return this.#error;
  }

  /**
   * Returns true if the function has been executed.
   */
  get ready(): boolean {
    return this.#state.isProcessed();
  }

  /**
   * Executes the function once and caches the result.
   * Subsequent calls return the cached value without re-executing.
   *
   * @param fn - The function to execute
   * @returns The result of the function
   * @throws Error if the function returned a promise (use AsyncResolveOnce instead)
   */
  resolve(fn: (ctx?: CTX) => T): T {
    if (this.#state.isProcessing()) {
      try {
        this.#value = fn(this.#rOnce._ctx);
      } catch (e) {
        this.#error = e as Error;
      } finally {
        this.#state.setProcessed();
        this.#rOnce.setProcessed(this.#state);
      }
      if (isPromise(this.#value)) {
        throw new Error("SyncResolveOnce.once fn returned a promise");
      }
    }
    if (this.#error) {
      throw this.#error;
    }
    return this.#value as T;
  }

  /**
   * Resets the cached state, allowing the function to be executed again.
   *
   * @param fn - Optional function to execute immediately after reset
   * @returns The result if fn provided, undefined otherwise
   */
  reset(fn?: (c?: CTX) => T): T | undefined {
    this.#value = undefined;
    this.#error = undefined;
    if (fn) {
      this.#state.setProcessing();
      return this.resolve(fn);
    }
    return undefined as T;
  }
}

/**
 * Internal helper for AsyncResolveOnce that manages a single async resolution.
 * Handles queuing of multiple concurrent requests for the same async operation.
 * @internal
 */
class AsyncResolveItem<T, CTX> {
  readonly id: number = Math.random();
  readonly #toResolve: Promise<UnPromisify<T>>;
  #value: Option<UnPromisify<T>> = Option.None();
  #error?: Error;
  readonly #state: StateInstance;
  readonly #rOnce: ResolveOnce<T, CTX>;

  constructor(fn: Promise<UnPromisify<T>>, rOnce: ResolveOnce<T, CTX>, state: StateInstance) {
    this.#toResolve = fn;
    this.#state = state;
    this.#rOnce = rOnce;
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

  /**
   * Returns true if this item has completed and has no pending futures.
   */
  isDisposable(): boolean {
    return this.#state.isProcessed() && this.#queue.length === 0;
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
    throw new Error(`AsyncResolveItem.#promiseResult impossible: ${this.#state.getResolveState()}`);
  }

  /**
   * Resolves the async operation, queuing the request if already in progress.
   */
  resolve(): T {
    if (this.#state.isWaiting()) {
      const future = new Future<UnPromisify<T>>();
      this.#queue.push(future);
      this.#toResolve
        .then((value) => {
          this.#value = Option.Some(value);
        })
        .catch((e) => {
          this.#error = e as Error;
        })
        .finally(() => {
          this.#state.setProcessed();
          this.#rOnce.setProcessed(this.#state);
          while (this.#queue.length > 0) {
            this.#resolveFuture(this.#queue.shift());
          }
        });
      return future.asPromise() as T;
    }

    if (this.#state.isProcessed()) {
      return this.#promiseResult() as T;
    }
    // if (this.#state.isWaiting()) {
    //   const future = new Future<UnPromisify<T>>();
    //   this.#queue.push(future);
    //   return future.asPromise() as T;
    // }
    throw new Error(`AsyncResolveItem.resolve impossible: ${this.#state.getResolveState()}`);
  }
}

/**
 * Asynchronous version of ResolveOnce for functions that return promises.
 *
 * This class is used internally by ResolveOnce when it detects an async function.
 * It executes the async function once and caches the result for subsequent calls.
 * Multiple concurrent calls while waiting will all receive the same promise result.
 *
 * @template T - The return type (Promise or value)
 * @template CTX - Optional context type
 * @internal
 */

function isAsyncResolveOnce<T, CTX>(obj: SyncOrAsync<T, CTX>): obj is Option<AsyncResolveOnce<T, CTX>> {
  return obj.IsSome() && obj.Unwrap() instanceof AsyncResolveOnce;
}

export class AsyncResolveOnce<T, CTX = void> {
  // #state: ResolveState = "initial";
  readonly #state: StateInstance;

  readonly #queue: AsyncResolveItem<T, CTX>[];

  readonly #rOnce: ResolveOnce<T, CTX>;
  //readonly #ctx?: CTX;
  constructor(rOnce: ResolveOnce<T, CTX>, state: StateInstance, prev: SyncOrAsync<T, CTX>) {
    this.#state = state;
    this.#rOnce = rOnce;
    if (isAsyncResolveOnce(prev)) {
      this.#queue = [...prev.unwrap().#queue];
    } else {
      this.#queue = [];
    }
  }

  #active(): AsyncResolveItem<T, CTX> {
    const r = this.#queue[this.#queue.length - 1];
    if (!r) {
      throw new Error("AsyncResolveOnce.#active impossible");
    }
    return r;
  }

  /**
   * Returns the total number of queued futures across all items.
   */
  get queueLength(): number {
    return this.#queue.reduce((acc, r) => acc + r.queuelength, this.#queue.length);
  }

  /**
   * Gets the cached resolved value if available.
   */
  get value(): UnPromisify<T> | undefined {
    if (this.#state.isInitial()) {
      return undefined;
    }
    return this.#active().value;
  }

  /**
   * Gets the cached error if one occurred.
   */
  get error(): Error | undefined {
    if (this.#state.isInitial()) {
      return undefined;
    }
    return this.#active().error;
  }

  /**
   * Executes the async function once and caches the result.
   * Subsequent calls return the cached promise without re-executing.
   *
   * @param fn - The async function to execute
   * @returns A promise that resolves to the function's result
   */
  resolve(fn: (ctx?: CTX) => T): T {
    if (this.#state.isProcessing()) {
      this.#state.setWaiting();
      let promiseResult: Promise<UnPromisify<T>>;
      try {
        const couldBePromise = fn(this.#rOnce._ctx);
        if (!isPromise(couldBePromise)) {
          promiseResult = Promise.resolve(couldBePromise as UnPromisify<T>);
        } else {
          promiseResult = couldBePromise as Promise<UnPromisify<T>>;
        }
      } catch (e) {
        promiseResult = Promise.reject(e as Error);
      }
      this.#queue.push(new AsyncResolveItem<T, CTX>(promiseResult, this.#rOnce, this.#state));
    }
    // remove all disposable items
    this.#queue
      .slice(0, -1)
      .map((i, idx) => (i.isDisposable() ? idx : undefined))
      .filter((i) => i !== undefined)
      .reverse()
      .forEach((idx) => this.#queue.splice(idx, 1));

    return this.#active().resolve();
  }

  /**
   * Resets the cached state, allowing the function to be executed again.
   *
   * @param fn - Optional function to execute immediately after reset
   * @returns The result if fn provided, undefined otherwise
   */
  reset(fn?: (c?: CTX) => T): T {
    this.#state.setProcessing();
    if (fn) {
      return this.resolve(fn);
    }
    return undefined as T;
  }
}

/**
 * Ensures a function is executed only once, caching and returning the result for subsequent calls.
 *
 * ResolveOnce automatically detects whether the function returns a synchronous value or a Promise,
 * and handles both cases appropriately. All subsequent calls will receive the same cached result.
 * Supports optional context parameter and can be reset to allow re-execution.
 *
 * @template T - The return type of the function (can be synchronous or Promise)
 * @template CTX - Optional context type passed to the function
 *
 * @example
 * ```typescript
 * const expensiveOp = new ResolveOnce<number>();
 *
 * // First call executes the function
 * const result1 = expensiveOp.once(() => computeExpensiveValue());
 *
 * // Subsequent calls return cached result
 * const result2 = expensiveOp.once(() => computeExpensiveValue()); // Not executed
 *
 * // Reset to allow re-execution
 * expensiveOp.reset();
 * ```
 */

export interface ResolveOnceOpts {
  readonly resetAfter?: number; // milliseconds after which to reset the cached value
  readonly skipUnref?: boolean; // skip unref() on the reset timer
}

class StateInstance {
  readonly id: number = Math.random();
  #state: ResolveState = "initial";

  // get state(): ResolveState {
  //   return this.#state;
  // }
  getResolveState(): ResolveState {
    return this.#state;
  }

  isInitial(): boolean {
    return this.#state === "initial";
  }

  isProcessed(): boolean {
    return this.#state === "processed";
  }
  setProcessed(): void {
    this.#state = "processed";
  }

  isProcessing(): boolean {
    return this.#state === "processing";
  }
  setProcessing(): void {
    this.#state = "processing";
  }

  isWaiting(): boolean {
    return this.#state === "waiting";
  }

  setWaiting(): void {
    this.#state = "waiting";
  }

  equals(other: StateInstance): boolean {
    return this.id === other.id;
  }
}

type SyncOrAsync<T, CTX> = Option<SyncResolveOnce<T, CTX> | AsyncResolveOnce<T, CTX>>;

export class ResolveOnce<T, CTX = void> implements ResolveOnceIf<T, CTX> {
  #state = new StateInstance();

  #syncOrAsync: SyncOrAsync<T, CTX> = Option.None();

  readonly #opts: ResolveOnceOpts;
  resetAfterTimer?: ReturnType<typeof setTimeout>;

  readonly _ctx?: CTX;
  constructor(ctx?: CTX, opts?: ResolveOnceOpts) {
    this._ctx = ctx;
    this.#opts = opts ?? {};
  }

  get state(): ResolveState {
    return this.#state.getResolveState();
  }

  // activeState(state: StateInstance): StateInstance | undefined {
  //   if (this.#state.equals(state)) {
  //     return this.#state;
  //   }
  //   return undefined;
  // }

  setProcessed(state: StateInstance): void {
    if (this.resetAfterTimer) {
      clearTimeout(this.resetAfterTimer);
    }
    if (this.#state.equals(state)) {
      this.#state.setProcessed();
      if (typeof this.#opts.resetAfter === "number" && this.#opts.resetAfter > 0) {
        this.resetAfterTimer = setTimeout(() => {
          this.reset();
        }, this.#opts.resetAfter);
        if (!this.#opts.skipUnref) {
          const hasUnref = this.resetAfterTimer as unknown as { unref?: () => void };
          if (typeof hasUnref === "object" && typeof hasUnref.unref === "function") {
            hasUnref.unref();
          } else if (typeof globalThis.Deno === "object") {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
            globalThis.Deno.unrefTimer(this.resetAfterTimer as any);
          }
        }
      }
    }
  }

  get ready(): boolean {
    return !this.#state.isInitial();
  }

  get value(): UnPromisify<T> | undefined {
    if (this.#state.isInitial()) {
      return undefined;
    }
    return this.#syncOrAsync.Unwrap().value as UnPromisify<T>;
  }

  get queueLength(): number {
    if (this.#state.isInitial()) {
      return 0;
    }
    return this.#syncOrAsync.Unwrap().queueLength;
  }

  get error(): Error | undefined {
    if (this.#state.isInitial()) {
      return undefined;
    }
    return this.#syncOrAsync.Unwrap().error;
  }

  // get state(): ResolveState {
  //   return this.#state;
  // }
  // set state(value: ResolveState) {
  //   console.log(`ResolveOnce.state ${this.#state} -> ${value}`);
  //   if (value === "processed") {
  //     if (this.resetAfterTimer) {
  //       clearTimeout(this.resetAfterTimer);
  //     }
  //     if (typeof this.#opts.resetAfter === "number" && this.#opts.resetAfter > 0) {
  //       console.log("setting reset timer for", this.#opts.resetAfter);
  //       this.resetAfterTimer = setTimeout(() => {
  //         console.log("resetting after", this.#opts.resetAfter);
  //         this.reset();
  //       }, this.#opts.resetAfter);
  //     }
  //   }
  //   this.#state = value;
  // }

  once<R>(fn: (c: CTX, prev?: T) => R): ResultOnce<R> {
    let resultFn: (ctx: CTX) => R;
    if (this.#state.isInitial()) {
      const state = this.#state;
      try {
        state.setProcessing();
        let prev: T | undefined = undefined;
        if (this.#syncOrAsync.IsSome()) {
          prev = this.#syncOrAsync.Unwrap().value as T;
        }
        const isSyncOrAsync = fn(this._ctx ?? ({} as CTX), prev);
        if (isPromise(isSyncOrAsync)) {
          this.#syncOrAsync = Option.Some(new AsyncResolveOnce<T, CTX>(this, state, this.#syncOrAsync));
        } else {
          this.#syncOrAsync = Option.Some(new SyncResolveOnce<T, CTX>(this, state));
        }
        resultFn = (): R => isSyncOrAsync;
      } catch (e) {
        this.#syncOrAsync = Option.Some(new SyncResolveOnce<T, CTX>(this, state));
        resultFn = (): R => {
          throw e;
        };
      }
    } else {
      resultFn = fn;
    }
    if (!this.#syncOrAsync) {
      throw new Error(`ResolveOnce.once impossible: state=${this.#state.getResolveState()}`);
    }
    return this.#syncOrAsync.Unwrap().resolve(resultFn as (c?: CTX) => never) as ResultOnce<R>;
  }

  reset<R>(fn?: (c: CTX) => R): ResultOnce<R> {
    if (this.#state.isInitial()) {
      if (!fn) {
        return undefined as ResultOnce<R>;
      }
      return this.once(fn as (c: CTX) => R);
    }
    if (this.#state.isProcessing()) {
      // eslint-disable-next-line no-console
      console.warn("ResolveOnce.reset dropped was called while processing");
      return undefined as ResultOnce<R>;
    }
    let ret = undefined as ResultOnce<R>;
    this.#state = new StateInstance();
    if (fn) {
      ret = this.once(fn as (c: CTX) => R);
      // ret = this.#syncOrAsync.Unwrap().reset(fn as (c?: CTX) => never) as ResultOnce<R>
    }
    return ret;
  }
}

// /**
//  * Configuration parameters for Keyed instances.
//  * @template K - The key type
//  * @template V - The value type
//  */
// export interface KeyedParam<K, V> {
//   readonly lru: Partial<LRUParam<V, K>>;
// }

/**
 * Represents a key-value pair where the value is wrapped in a Result.
 * @template K - The key type
 * @template V - The value type
 */
export interface KeyItem<K, V> {
  readonly key: K;
  readonly value: Result<V>;
}

/**
 * Configuration parameters for KeyedResolvOnce, excluding the createValue factory.
 * @template K - The key type
 * @template V - The value type
 * @template CTX - The context type
 */
export type AddKeyedParam<K, V, CTX extends NonNullable<object>> = Omit<KeyedNgOptions<K, V, CTX>, "createValue">;

/**
 * Type helper that adds a key property to a context object.
 * @template X - The context type
 * @template K - The key type
 */
export type WithKey<X extends NonNullable<object>, K> = X & { readonly key: K };

/**
 * Type helper that adds an optional reset method to a value type.
 * @template V - The value type
 */
export type WithOptionalReset<V> = V & { readonly reset?: () => void };

/**
 * Represents an item in a KeyedResolvOnce collection with its resolved result.
 * @template K - The key type
 * @template T - The value type
 * @template CTX - The context type
 */
export interface KeyedResolveOnceItem<K, T, CTX extends NonNullable<object>> {
  /** The key associated with this item */
  readonly key: K;
  /** The resolved value wrapped in a Result (Ok or Err) */
  readonly value: Result<T>;
  /** The complete KeyedNgItem containing metadata */
  readonly item: KeyedNgItem<K, ResolveOnce<WithOptionalReset<T>, KeyedNgItemWithoutValue<K, CTX>>, CTX>;
}

/**
 * Keyed collection of ResolveOnce instances.
 *
 * Manages a map of ResolveOnce instances indexed by keys, with optional LRU caching.
 * Each key gets its own ResolveOnce instance that can be accessed and manipulated independently.
 * Values can optionally have a reset() method for cleanup on deletion.
 *
 * @template T - The return type of the ResolveOnce instances (must include optional reset)
 * @template K - The key type (defaults to string)
 * @template CTX - Optional context type (defaults to empty object)
 * @template PT - Plain type of T without reset (for internal use)
 *
 * @example
 * ```typescript
 * const cache = new KeyedResolvOnce<number, string>();
 *
 * // Each key gets its own ResolveOnce
 * const result1 = cache.get('key1').once(() => expensiveCalc1());
 * const result2 = cache.get('key2').once(() => expensiveCalc2());
 *
 * // Delete specific key
 * cache.delete('key1');
 *
 * // Iterate over all resolved entries
 * cache.forEach((item) => {
 *   console.log(item.key, item.value.Ok);
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom key type and context
 * interface UserKey { org: string; id: string; }
 * interface UserContext { apiKey: string; }
 *
 * const users = new KeyedResolvOnce<User, UserKey, UserContext>({
 *   key2string: (key) => `${key.org}:${key.id}`,
 *   ctx: { apiKey: 'default' },
 *   lru: { max: 100 }
 * });
 *
 * const user = users.get({ org: 'acme', id: '123' })
 *   .once(({ givenKey, ctx }) => fetchUser(givenKey, ctx));
 * ```
 */
export class KeyedResolvOnce<
  T extends WithOptionalReset<PT>,
  K = string,
  CTX extends NonNullable<object> = object,
  PT = T,
> implements Omit<
  // KeyedIf<ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>>, WithOptionalReset<T>, K>
  KeyedIf<
    KeyedNgItem<K, ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>>, CTX>,
    ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>>,
    K,
    CTX
  >,
  "entries" | "forEach" | "onSet" | "onDelete" | "values" | "setParam"
> {
  /** @internal */
  readonly _keyed: KeyedNg<K, ResolveOnce<WithOptionalReset<T>, KeyedNgItemWithoutValue<K, CTX>>, CTX>;

  /**
   * Creates a new KeyedResolvOnce instance.
   *
   * @param kp - Configuration options (key2string, ctx, lru)
   */
  constructor(kp: Partial<AddKeyedParam<K, T, CTX>> = {}) {
    this._keyed = new KeyedNg({
      createValue: (
        item: KeyedNgItem<K, ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>>, CTX>,
      ): ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>> => {
        return new ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>>(
          {
            ...item,
            ctx: kp.ctx ?? item.ctx,
          },
          {
            resetAfter: kp.resetAfter,
          },
        );
      },
      key2string: kp.key2string,
      ctx: kp.ctx as CTX,
      lru: kp.lru,
    });
  }

  /**
   * Returns all keys currently in the collection.
   *
   * @returns Array of all keys
   */
  keys(): K[] {
    return this._keyed.keys();
  }

  /**
   * Returns all resolved items with their values wrapped in Result.
   *
   * Only includes items that have been resolved (ready state).
   * Each item contains the key, Result-wrapped value, and full item metadata.
   *
   * @returns Array of all resolved items
   *
   * @example
   * ```typescript
   * const items = cache.values();
   * items.forEach(({ key, value }) => {
   *   if (value.Ok) {
   *     console.log(key, value.unwrap());
   *   } else {
   *     console.error(key, value.unwrapErr());
   *   }
   * });
   * ```
   */
  values(): KeyedResolveOnceItem<K, T, CTX>[] {
    return this._keyed
      .values()
      .filter((i) => i.value.ready)
      .map((item) => ({
        key: item.givenKey,
        value: item.value.error ? Result.Err<T>(item.value.error) : Result.Ok<T>(item.value.value as T),
        item,
      }));
  }

  /**
   * Registers a callback that fires when a new ResolveOnce instance is created.
   *
   * @param fn - Callback receiving the key and ResolveOnce instance
   * @returns Unregister function
   */
  onSet(fn: (key: K, value: ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>>) => void): UnregFn {
    return this._keyed.onSet((item) => {
      fn(item.givenKey, item.value);
    });
  }

  /**
   * Registers a callback that fires when a ResolveOnce instance is deleted.
   *
   * @param fn - Callback receiving the key and ResolveOnce instance
   * @returns Unregister function
   */
  onDelete(fn: (key: K, value: ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>>) => void): UnregFn {
    return this._keyed.onDelete((item) => {
      fn(item.givenKey, item.value);
    });
  }

  /**
   * Updates the LRU parameters dynamically.
   *
   * @param params - New LRU parameters
   */
  setParam(params: Partial<AddKeyedParam<K, ResolveOnce<T, CTX>, CTX>>): void {
    this._keyed.setParam({ lru: params.lru });
  }

  /**
   * Asynchronously gets or creates a ResolveOnce for a key resolved from a promise.
   *
   * @param key - Function returning a promise that resolves to the key
   * @returns Promise resolving to the ResolveOnce instance
   */
  asyncGet(key: () => Promise<K>): Promise<ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>>> {
    return this._keyed.asyncGet(key);
  }

  /**
   * Gets or creates a ResolveOnce instance for the given key.
   *
   * This is the primary method for accessing ResolveOnce instances. Each unique
   * key gets its own instance that persists across calls.
   *
   * @param key - The key or function returning the key
   * @param ctx - Optional context override for this operation
   * @returns The ResolveOnce instance for this key
   *
   * @example
   * ```typescript
   * const result = cache.get('myKey').once(({ refKey, givenKey, ctx }) => {
   *   return computeValue(givenKey, ctx);
   * });
   * ```
   */
  get(key: K | (() => K), ctx?: CTX): ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>> {
    if (typeof key === "function") {
      key = (key as () => K)();
    }
    return this._keyed.getItem(key, ctx).value;
  }

  /**
   * Gets or creates the complete KeyedNgItem for a key.
   *
   * Useful when you need access to the full item structure including metadata.
   *
   * @param key - The key to get
   * @param ctx - Optional context override
   * @returns The complete KeyedNgItem
   */
  getItem(key: K, ctx?: CTX): KeyedNgItem<K, ResolveOnce<T, KeyedNgItemWithoutValue<K, CTX>>, CTX> {
    return this._keyed.getItem(key, ctx);
  }

  /**
   * Checks if a key exists in the collection.
   *
   * @param key - The key or function returning the key
   * @returns True if the key exists
   */
  has(key: K | (() => K)): boolean {
    return this._keyed.has(key);
  }

  /**
   * Deletes an entry from the collection.
   *
   * Triggers onDelete callbacks before removal.
   *
   * @param key - The key to delete
   */
  delete(key: K): void {
    this._keyed.delete(key);
  }

  /**
   * Resets and removes an entry from the collection.
   *
   * Calls the optional reset() method on the value before deletion,
   * allowing for cleanup operations.
   *
   * @param key - The key to reset and delete
   */
  unget(key: K): void {
    const item = this._keyed.getItem(key);
    item.value.reset?.();
    return this._keyed.delete(item.givenKey);
  }

  /**
   * Resets all entries by calling their optional reset() methods.
   *
   * Does not remove entries from the collection, only resets their state.
   * Useful for cleanup without losing the collection structure.
   */
  reset(): void {
    for (const v of this._keyed.values()) {
      v.value.reset?.();
    }
  }

  /**
   * Iterates over all completed entries, yielding key-result pairs.
   *
   * Only yields entries that have been resolved (ready state).
   * Values are wrapped in Result to distinguish success from error.
   *
   * @param fn - Callback receiving KeyItem and index
   *
   * @example
   * ```typescript
   * cache.forEach((item, idx) => {
   *   console.log(idx, item.key);
   *   if (item.value.Ok) {
   *     console.log('Success:', item.value.unwrap());
   *   } else {
   *     console.error('Error:', item.value.unwrapErr());
   *   }
   * });
   * ```
   */
  forEach(fn: (ki: KeyItem<K, T>, idx: number) => void): void {
    for (const [item, idx] of this._keyed.entries()) {
      const v = item.value;
      const k = item.givenKey;
      if (!v.ready) {
        continue;
      }
      if (v.error) {
        fn({ key: k, value: Result.Err<T>(v.error) }, idx);
      } else {
        fn({ key: k, value: Result.Ok<T>(v.value as T) }, idx);
      }
    }
  }

  /**
   * Returns an iterable of all completed entries.
   *
   * Only yields entries that have been resolved. Values are wrapped in Result.
   *
   * @returns Iterable of KeyItem entries
   *
   * @example
   * ```typescript
   * for (const item of cache.entries()) {
   *   console.log(item.key, item.value.Ok);
   * }
   * ```
   */
  *entries(): Iterable<KeyItem<K, T>> {
    /* this is not optimal, but sufficient for now */
    for (const [item] of this._keyed.entries()) {
      const v = item.value;
      const k = item.givenKey;
      if (!v.ready) {
        continue;
      }
      if (v.error) {
        yield { key: k, value: Result.Err<T>(v.error) };
      } else {
        yield { key: k, value: Result.Ok<T>(v.value as T) };
      }
    }
  }
}

/**
 * Keyed collection of ResolveSeq instances.
 *
 * Manages a map of ResolveSeq instances indexed by keys, with optional LRU caching.
 * Each key gets its own ResolveSeq instance for sequential execution of operations.
 *
 * @template VALUEType - The return type of the ResolveSeq instances
 * @template KEYType - The key type
 * @template CTX - Optional context type
 *
 * @example
 * ```typescript
 * const sequences = new KeyedResolvSeq<number, string>();
 *
 * // Each key gets its own sequential executor
 * sequences.get('user1').add(() => updateUser1());
 * sequences.get('user2').add(() => updateUser2());
 * ```
 */
export class KeyedResolvSeq<
  VALUEType extends NonNullable<unknown>,
  KEYType = string,
  CTX extends NonNullable<object> = object,
> extends KeyedNg<KEYType, ResolveSeq<VALUEType, KeyedNgItemWithoutValue<KEYType, CTX>>, CTX> {
  /**
   * Creates a new KeyedResolvSeq instance.
   *
   * @param kp - Configuration options (key2string, ctx, lru)
   */
  constructor(kp: Partial<Omit<KeyedNgOptions<KEYType, VALUEType, CTX>, "createValue">> = {}) {
    super({
      createValue: (
        item: KeyedNgItem<KEYType, ResolveSeq<VALUEType, KeyedNgItemWithoutValue<KEYType, CTX>>, CTX>,
      ): ResolveSeq<VALUEType, KeyedNgItemWithoutValue<KEYType, CTX>> => {
        return new ResolveSeq<VALUEType, KeyedNgItemWithoutValue<KEYType, CTX>>({
          ...item,
          ctx: kp.ctx ?? item.ctx,
        });
      },
      key2string: kp.key2string,
      ctx: kp.ctx as CTX,
      lru: kp.lru,
    });
  }
}

/**
 * Internal helper class for the Lazy function.
 * @internal
 */
class LazyContainer<T> {
  readonly resolveOnce: ResolveOnce<T>;

  constructor(opts?: ResolveOnceOpts) {
    this.resolveOnce = new ResolveOnce<T>(undefined, opts);
  }
  call<Args extends readonly unknown[], Return>(fn: (...args: Args) => Return): () => Return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return (...args: Args) => this.resolveOnce.once(() => fn(...args) as any) as unknown as Return;
  }
}

/**
 * Creates a lazy-evaluated version of a function that executes only once and caches the result.
 *
 * The returned function will execute the original function on first call and return
 * the cached result for all subsequent calls, regardless of arguments. This is useful
 * for expensive computations or resource initialization.
 *
 * @template Args - The argument types of the function
 * @template Return - The return type of the function
 * @param fn - The function to make lazy
 * @returns A wrapped function that executes once and caches the result
 *
 * @example
 * ```typescript
 * const getConfig = Lazy(() => {
 *   console.log('Loading config...');
 *   return { apiKey: 'secret' };
 * });
 *
 * getConfig(); // Logs "Loading config..." and returns config
 * getConfig(); // Returns cached config without logging
 * ```
 */

export function Lazy<Args extends readonly unknown[], Return>(
  fn: (...args: Args) => Return,
  opts?: ResolveOnceOpts,
): (...args: Args) => Return {
  const lazy = new LazyContainer<Return>(opts);
  return lazy.call(fn);
}
