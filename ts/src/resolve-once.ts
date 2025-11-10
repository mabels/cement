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
import { UnPromisify } from "./is-promise.js";
import { isPromise } from "./is-promise.js";
import { LRUMap, LRUParam, UnregFn } from "./lru-map-set.js";
import { Result } from "./result.js";
import { Option } from "./option.js";

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
  state: ResolveState = "initial";

  #value?: T;
  #error?: Error;

  readonly queueLength = 0;

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
    return this.state === "processed";
  }

  readonly #ctx?: CTX;
  constructor(ctx?: CTX) {
    this.#ctx = ctx;
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
    if (this.state === "initial") {
      this.state = "processed";
      try {
        this.#value = fn(this.#ctx);
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
    return this.#value as T;
  }

  /**
   * Resets the cached state, allowing the function to be executed again.
   *
   * @param fn - Optional function to execute immediately after reset
   * @returns The result if fn provided, undefined otherwise
   */
  reset(fn?: (c?: CTX) => T): T | undefined {
    this.state = "initial";
    this.#value = undefined;
    this.#error = undefined;
    if (fn) {
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

  /**
   * Returns true if this item has completed and has no pending futures.
   */
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

  /**
   * Resolves the async operation, queuing the request if already in progress.
   */
  resolve(): T {
    if (this.#state === "initial") {
      this.#state = "waiting";
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
          this.#state = "processed";
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
      this.#queue.push(future);
      return future.asPromise() as T;
    }
    throw new Error("AsyncResolveItem.resolve impossible");
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
export class AsyncResolveOnce<T, CTX = void> {
  state: ResolveState = "initial";

  readonly #queue: AsyncResolveItem<T>[] = [];

  readonly #ctx?: CTX;
  constructor(ctx?: CTX) {
    this.#ctx = ctx;
  }

  #active(): AsyncResolveItem<T> {
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
   * Returns true if the async operation has started.
   */
  get ready(): boolean {
    return this.state !== "initial";
  }

  /**
   * Gets the cached resolved value if available.
   */
  get value(): UnPromisify<T> | undefined {
    if (this.state === "initial") {
      return undefined;
    }
    return this.#active().value;
  }

  /**
   * Gets the cached error if one occurred.
   */
  get error(): Error | undefined {
    if (this.state === "initial") {
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
      this.#queue.push(new AsyncResolveItem(promiseResult));
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
    this.state = "initial";
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
export class ResolveOnce<T, CTX = void> implements ResolveOnceIf<T, CTX> {
  #state: ResolveState = "initial";

  #syncOrAsync: Option<SyncResolveOnce<never, CTX> | AsyncResolveOnce<never, CTX>> = Option.None();

  readonly #ctx?: CTX;
  constructor(ctx?: CTX) {
    this.#ctx = ctx;
  }

  get ready(): boolean {
    return this.#state !== "initial" && this.#syncOrAsync.Unwrap().ready;
  }

  get value(): UnPromisify<T> | undefined {
    if (this.#state === "initial") {
      return undefined;
    }
    return this.#syncOrAsync.Unwrap().value as UnPromisify<T>;
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
      } catch (e) {
        this.#syncOrAsync = Option.Some(new SyncResolveOnce<never, CTX>(this.#ctx));
        resultFn = (): R => {
          throw e;
        };
      } finally {
        this.#state = "processed";
      }
    } else {
      resultFn = fn;
    }
    if (!this.#syncOrAsync) {
      throw new Error("ResolveOnce.once impossible");
    }
    return this.#syncOrAsync.Unwrap().resolve(resultFn as (c?: CTX) => never) as ResultOnce<R>;
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

/**
 * Configuration parameters for Keyed instances.
 * @template K - The key type
 * @template V - The value type
 */
export interface KeyedParam<K, V> {
  readonly lru: Partial<LRUParam<V, K>>;
}

/**
 * Extended configuration that includes context.
 * @template K - The key type
 * @template V - The value type
 * @template CTX - The context type
 */
export type AddKeyedParam<K, V, CTX extends NonNullable<object>> = KeyedParam<K, V> & { readonly ctx: CTX };

export interface KeyedIf<T extends { reset: () => void }, K = string> {
  /**
   * Registers a callback that fires when a new entry is added to the map.
   *
   * @param fn - Callback function receiving key and value
   * @returns Unregister function to remove the callback
   */
  onSet(fn: (key: K, value: T) => void): UnregFn;

  /**
   * Registers a callback that fires when an entry is deleted from the map.
   *
   * @param fn - Callback function receiving key and value
   * @returns Unregister function to remove the callback
   */
  onDelete(fn: (key: K, value: T) => void): UnregFn;

  /**
   * Updates the LRU parameters of the underlying map.
   *
   * @param params - New parameters to apply
   */
  setParam(params: KeyedParam<K, T>): void;

  /**
   * Async variant of get() that accepts a function returning a promise for the key.
   *
   * @param key - Function that returns a promise resolving to the key
   * @returns Promise resolving to the value
   */
  asyncGet(key: () => Promise<K>): Promise<T>;

  /**
   * Gets or creates a value for the given key.
   *
   * If the key doesn't exist, creates a new instance using the factory function.
   *
   * @param key - The key or function returning the key
   * @returns The value associated with the key
   */
  get(key: K | (() => K)): T;

  /**
   * Checks if a key exists in the map.
   *
   * @param key - The key or function returning the key
   * @returns True if the key exists
   */
  has(key: K | (() => K)): boolean;

  /**
   * Deletes an entry from the map.
   *
   * @param key - The key to delete
   */
  delete(key: K): void;

  /**
   * Resets and deletes an entry from the map.
   *
   * Calls the value's reset() method before removing it.
   *
   * @param key - The key to reset and delete
   */
  unget(key: K): void;

  /**
   * Resets all entries and clears the map.
   *
   * Calls reset() on all values before clearing.
   */
  reset(): void;

  /**
   * Returns all values in the map.
   *
   * @returns Array of all values
   */
  values(): T[];

  /**
   * Returns all keys in the map.
   *
   * @returns Array of all keys
   */
  keys(): K[];

  /**
   * Iterates over all entries in the map.
   *
   * @yields Key-value pairs
   */
  forEach(fn: (k: K, v: T, idx: number) => void): void;

  entries(): Iterable<[K, T]>;
}

/**
 * Base class for managing keyed instances with LRU caching.
 *
 * Keyed provides a map-like interface where values are lazily created via a factory function
 * and cached with optional LRU eviction. Values must have a `reset()` method for cleanup.
 *
 * @template T - The value type (must have a reset method)
 * @template K - The key type
 * @template CTX - Optional context type passed to the factory
 *
 * @example
 * ```typescript
 * const keyed = new Keyed(
 *   (ctx) => new ResolveOnce(ctx),
 *   { lru: { maxEntries: 100 } }
 * );
 *
 * const instance = keyed.get('myKey');
 * ```
 */
export class Keyed<T extends { reset: () => void }, K = string, CTX extends NonNullable<object> = object> implements KeyedIf<T, K> {
  protected readonly _map: LRUMap<K, T>;
  readonly #ctx: CTX;

  readonly factory: (ctx: AddKey<CTX, K>) => T;

  constructor(factory: (ctx: AddKey<CTX, K>) => T, ctx: Partial<AddKeyedParam<K, T, CTX>>) {
    this.#ctx = ctx.ctx || ({} as CTX);
    this.factory = factory;
    this._map = new LRUMap<K, T>(ctx?.lru ?? ({ maxEntries: -1 } as LRUParam<T, K>));
  }

  /**
   * Registers a callback that fires when a new entry is added to the map.
   *
   * @param fn - Callback function receiving key and value
   * @returns Unregister function to remove the callback
   */
  onSet(fn: (key: K, value: T) => void): UnregFn {
    return this._map.onSet(fn);
  }

  /**
   * Registers a callback that fires when an entry is deleted from the map.
   *
   * @param fn - Callback function receiving key and value
   * @returns Unregister function to remove the callback
   */
  onDelete(fn: (key: K, value: T) => void): UnregFn {
    return this._map.onDelete(fn);
  }

  /**
   * Updates the LRU parameters of the underlying map.
   *
   * @param params - New parameters to apply
   */
  setParam(params: KeyedParam<K, T>): void {
    this._map.setParam(params.lru);
  }

  /**
   * Async variant of get() that accepts a function returning a promise for the key.
   *
   * @param key - Function that returns a promise resolving to the key
   * @returns Promise resolving to the value
   */
  async asyncGet(key: () => Promise<K>): Promise<T> {
    return this.get(await key());
  }

  /**
   * Gets or creates a value for the given key.
   *
   * If the key doesn't exist, creates a new instance using the factory function.
   *
   * @param key - The key or function returning the key
   * @returns The value associated with the key
   */
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

  /**
   * Checks if a key exists in the map.
   *
   * @param key - The key or function returning the key
   * @returns True if the key exists
   */
  has(key: K | (() => K)): boolean {
    if (typeof key === "function") {
      key = (key as () => K)();
    }
    return this._map.has(key);
  }

  /**
   * Deletes an entry from the map.
   *
   * @param key - The key to delete
   */
  delete(key: K): void {
    this._map.delete(key);
  }

  /**
   * Resets and deletes an entry from the map.
   *
   * Calls the value's reset() method before removing it.
   *
   * @param key - The key to reset and delete
   */
  unget(key: K): void {
    const keyed = this._map.get(key);
    keyed?.reset();
    this._map.delete(key);
  }

  /**
   * Resets all entries and clears the map.
   *
   * Calls reset() on all values before clearing.
   */
  reset(): void {
    this._map.forEach((keyed) => keyed.reset());
    this._map.clear();
  }

  /**
   * Returns all values in the map.
   *
   * @returns Array of all values
   */
  values(): T[] {
    const results: T[] = [];
    this.forEach((_, v) => {
      results.push(v);
    });
    return results;
  }

  /**
   * Returns all keys in the map.
   *
   * @returns Array of all keys
   */
  keys(): K[] {
    const results: K[] = [];
    this.forEach((k) => {
      results.push(k);
    });
    return results;
  }

  /**
   * Iterates over all entries in the map.
   *
   * @yields Key-value pairs
   */
  forEach(fn: (k: K, v: T, idx: number) => void): void {
    let idx = 0;
    for (const [k, v] of this._map.entries()) {
      fn(k, v, idx++);
    }
  }

  *entries(): Iterable<[K, T]> {
    for (const [k, v] of this._map.entries()) {
      yield [k, v];
    }
  }
}

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
 * Keyed collection of ResolveOnce instances.
 *
 * Manages a map of ResolveOnce instances indexed by keys, with optional LRU caching.
 * Each key gets its own ResolveOnce instance that can be accessed and manipulated independently.
 *
 * @template T - The return type of the ResolveOnce instances
 * @template K - The key type
 * @template CTX - Optional context type
 *
 * @example
 * ```typescript
 * const cache = new KeyedResolvOnce<number, string>();
 *
 * // Each key gets its own ResolveOnce
 * const result1 = cache.get('key1').once(() => expensiveCalc1());
 * const result2 = cache.get('key2').once(() => expensiveCalc2());
 * ```
 */
export class KeyedResolvOnce<T, K = string, CTX extends NonNullable<object> = object>
  implements Omit<KeyedIf<ResolveOnce<T, AddKey<CTX, K>>, K>, "forEach" | "keys" | "values" | "entries">
{
  readonly _keyed: KeyedIf<ResolveOnce<T, AddKey<CTX, K>>, K>;
  constructor(kp: Partial<AddKeyedParam<K, ResolveOnce<T, CTX>, CTX>> = {}) {
    this._keyed = new Keyed(
      (ctx) => new ResolveOnce<T, AddKey<CTX, K>>(ctx),
      kp as AddKeyedParam<K, ResolveOnce<T, AddKey<CTX, K>>, CTX>,
    );
  }
  keys(): K[] {
    const results: K[] = [];
    this.forEach((k) => {
      results.push(k.key);
    });
    return results;
  }
  values(): KeyItem<K, T>[] {
    const results: KeyItem<K, T>[] = [];
    this.forEach((v) => {
      results.push(v);
    });
    return results;
  }
  onSet(fn: (key: K, value: ResolveOnce<T, AddKey<CTX, K>>) => void): UnregFn {
    return this._keyed.onSet(fn);
  }
  onDelete(fn: (key: K, value: ResolveOnce<T, AddKey<CTX, K>>) => void): UnregFn {
    return this._keyed.onDelete(fn);
  }
  setParam(params: KeyedParam<K, ResolveOnce<T, AddKey<CTX, K>>>): void {
    this._keyed.setParam(params);
  }
  asyncGet(key: () => Promise<K>): Promise<ResolveOnce<T, AddKey<CTX, K>>> {
    return this._keyed.asyncGet(key);
  }
  get(key: K | (() => K)): ResolveOnce<T, AddKey<CTX, K>> {
    return this._keyed.get(key);
  }
  has(key: K | (() => K)): boolean {
    return this._keyed.has(key);
  }
  delete(key: K): void {
    this._keyed.delete(key);
  }
  unget(key: K): void {
    this._keyed.unget(key);
  }
  reset(): void {
    this._keyed.reset();
  }

  /**
   * Iterates over all completed entries, yielding key-result pairs.
   *
   * Only yields entries that have been resolved (ready state).
   * Values are wrapped in Result to distinguish success from error.
   *
   * @yields Key-result pairs for completed entries
   */
  forEach(fn: (ki: KeyItem<K, T>, idx: number) => void): void {
    let idx = 0;
    for (const [k, v] of this._keyed.entries()) {
      if (!v.ready) {
        continue;
      }
      if (v.error) {
        fn({ key: k, value: Result.Err<T>(v.error) }, idx++);
      } else {
        fn({ key: k, value: Result.Ok<T>(v.value as T) }, idx++);
      }
    }
  }

  *entries(): Iterable<KeyItem<K, T>> {
    /* this is not optimal, but sufficient for now */
    for (const [k, v] of this._keyed.entries()) {
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
 * Type helper that adds a key property to a context object.
 *
 * Used by keyed collections to provide the current key to factory functions and callbacks.
 *
 * @template X - The context type
 * @template K - The key type
 *
 * @example
 * ```typescript
 * type MyContext = { userId: string };
 * type WithKey = AddKey<MyContext, number>;
 * // Result: { userId: string, key: number }
 * ```
 */
export type AddKey<X extends NonNullable<object>, K> = X & { key: K };

/**
 * Configuration type for KeyedResolvSeq.
 * @internal
 */
type WithCTX<K, T, CTX extends NonNullable<object>> = KeyedParam<K, ResolveSeq<T, AddKey<CTX, K>>> & { readonly ctx: CTX };

/**
 * Keyed collection of ResolveSeq instances.
 *
 * Manages a map of ResolveSeq instances indexed by keys, with optional LRU caching.
 * Each key gets its own ResolveSeq instance for sequential execution of operations.
 *
 * @template T - The return type of the ResolveSeq instances
 * @template K - The key type
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
export class KeyedResolvSeq<T extends NonNullable<unknown>, K = string, CTX extends NonNullable<object> = object> extends Keyed<
  ResolveSeq<T, AddKey<CTX, K>>,
  K,
  CTX
> {
  constructor(kp: Partial<WithCTX<K, T, CTX>> = {}) {
    super((ctx) => new ResolveSeq<T, AddKey<CTX, K>>(ctx), kp);
  }
}

/**
 * Internal helper class for the Lazy function.
 * @internal
 */
class LazyContainer<T> {
  readonly resolveOnce = new ResolveOnce<T>();

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
export function Lazy<Args extends readonly unknown[], Return>(fn: (...args: Args) => Return): (...args: Args) => Return {
  const lazy = new LazyContainer<Return>();
  return lazy.call(fn);
}
