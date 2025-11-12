/**
 * Generic keyed factory and collection management with LRU caching support.
 *
 * This module provides a flexible system for managing keyed collections where values
 * are created on-demand through factory functions. The KeyedNg class serves as a base
 * for creating type-safe keyed collections with built-in LRU eviction support.
 *
 * ## Core Concepts
 *
 * - **KeyedNgItem**: A structured container holding the key, value, and context
 * - **KeyedNg**: Base class for managing keyed collections with factory-based value creation
 * - **KeyedIf**: Interface defining the contract for keyed collection implementations
 *
 * ## Features
 *
 * - Factory-based value creation on first access
 * - Optional LRU caching with automatic eviction
 * - Type-safe key-to-string conversion
 * - Context passing for value creation
 * - Event callbacks for set/delete operations
 *
 * @module keyed-ng
 */

import { LRUParam, LRUMap, UnregFn } from "./lru-map-set.js";
import { toSortedObject } from "./utils/sorted-object.js";

/**
 * Interface defining the contract for keyed collection implementations.
 *
 * Provides a common interface for managing keyed collections with lifecycle callbacks,
 * LRU support, and flexible key handling. Implementations should provide type-safe
 * access to values indexed by keys.
 *
 * @template ITEM - The item type stored in the collection (typically KeyedNgItem)
 * @template V - The value type extracted from items
 * @template K - The key type (defaults to string)
 * @template CTX - The context type (defaults to unknown)
 *
 * @example
 * ```typescript
 * class MyKeyed implements KeyedIf<MyItem, MyValue, string, MyContext> {
 *   // Implementation...
 * }
 * ```
 */
export interface KeyedIf<ITEM, V, K = string, CTX = unknown> {
  /**
   * Registers a callback that fires when a new entry is added to the map.
   *
   * @param fn - Callback function receiving key and value
   * @returns Unregister function to remove the callback
   */
  onSet(fn: (value: ITEM) => void): UnregFn;

  /**
   * Registers a callback that fires when an entry is deleted from the map.
   *
   * @param fn - Callback function receiving key and value
   * @returns Unregister function to remove the callback
   */
  onDelete(fn: (value: ITEM) => void): UnregFn;

  /**
   * Updates the LRU parameters of the underlying map.
   *
   * @param params - New parameters to apply
   */
  setParam(params: Partial<KeyedNgOptions<K, ITEM, CTX>>): void;

  /**
   * Async variant of get() that accepts a function returning a promise for the key.
   *
   * @param key - Function that returns a promise resolving to the key
   * @returns Promise resolving to the value
   */
  asyncGet(key: () => Promise<K>): Promise<V>;

  /**
   * Gets or creates a value for the given key.
   *
   * If the key doesn't exist, creates a new instance using the factory function.
   *
   * @param key - The key or function returning the key
   * @returns The value associated with the key
   */
  get(key: K | (() => K)): V;

  getItem(key: K, ctx?: unknown): ITEM;

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
   * Returns all values in the map.
   *
   * @returns Array of all values
   */
  values(): ITEM[];

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
  forEach(fn: (v: ITEM, idx: number) => void): void;

  entries(): Iterable<[ITEM, number]>;
}

/**
 * Utility type that makes the 'value' property of a type writable.
 *
 * This is useful for internal implementations that need to construct items
 * with initially undefined values that are later populated.
 *
 * @template T - The type to make writable
 *
 * @example
 * ```typescript
 * type ReadOnly = { readonly value: number };
 * type Writable = WritableValue<ReadOnly>;
 * // Result: { value: number }
 * ```
 */
export type WritableValue<T> = Omit<T, "value"> & { value: T extends { value: infer V } ? V : unknown };

/**
 * Configuration options for creating a KeyedNg instance.
 *
 * @template K - The key type
 * @template V - The value type
 * @template CTX - The context type
 *
 * @example
 * ```typescript
 * const options: KeyedNgOptions<string, MyValue, MyContext> = {
 *   createValue: (item) => new MyValue(item.givenKey),
 *   key2string: (key) => key.toLowerCase(),
 *   ctx: { config: 'default' },
 *   lru: { max: 100 }
 * };
 * ```
 */
export interface KeyedNgOptions<K, V, CTX> {
  /**
   * Factory function that creates a value for a given key.
   *
   * Called once per unique key when the value is first accessed.
   * The function receives a KeyedNgItem with value initially undefined.
   *
   * @param keyItem - The item containing key, context, and placeholder for value
   * @returns The created value instance
   */
  readonly createValue: (keyItem: KeyedNgItem<K, V, CTX>) => V;

  /**
   * Optional function to convert keys to strings for internal storage.
   *
   * If not provided, uses default conversion:
   * - strings: as-is
   * - numbers: toString()
   * - booleans: "true" or "false"
   * - objects: JSON.stringify with sorted keys
   *
   * @param key - The key to convert
   * @returns A string representation of the key
   */
  readonly key2string?: (key: K) => string;

  /**
   * Optional default context passed to value creation.
   *
   * Can be overridden on a per-get basis. Defaults to empty object.
   */
  readonly ctx?: CTX;

  /**
   * Optional LRU cache configuration.
   *
   * When provided, the collection will automatically evict least-recently-used
   * items when size limits are exceeded.
   */
  readonly lru?: Partial<LRUParam<unknown, string>>;
}

/**
 * A structured item containing a key, value, and context.
 *
 * This is the fundamental container type used throughout the keyed-ng system.
 * Items are created by KeyedNg and passed to factory functions and callbacks.
 *
 * @template K - The key type
 * @template V - The value type
 * @template CTX - The context type
 *
 * @example
 * ```typescript
 * const item: KeyedNgItem<string, number, MyContext> = {
 *   refKey: "user-123",
 *   givenKey: "user-123",
 *   value: 42,
 *   ctx: { config: 'production' }
 * };
 * ```
 */
export interface KeyedNgItem<K, V, CTX> {
  /**
   * The normalized string key used for internal storage.
   *
   * This is the result of applying key2string to the givenKey.
   */
  readonly refKey: string;

  /**
   * The original key as provided by the caller.
   *
   * This preserves the original key type and value, even if it's
   * been converted to a string for storage.
   */
  readonly givenKey: K;

  /**
   * The value associated with this key.
   *
   * Created by the factory function on first access.
   */
  readonly value: V;

  /**
   * The context provided when this item was created.
   *
   * Can be used to pass configuration or state to value factories.
   */
  readonly ctx: CTX;
}

/**
 * Type helper that represents a KeyedNgItem without its value property.
 *
 * Useful for contexts where the value is not yet available or not needed,
 * such as in callback signatures.
 *
 * @template K - The key type
 * @template CTX - The context type
 *
 * @example
 * ```typescript
 * function process(item: KeyedNgItemWithoutValue<string, MyContext>) {
 *   console.log(item.refKey, item.givenKey, item.ctx);
 *   // item.value is not available
 * }
 * ```
 */
export type KeyedNgItemWithoutValue<K, CTX> = Omit<KeyedNgItem<K, never, CTX>, "value">;

/**
 * Generic keyed factory and collection with LRU caching support.
 *
 * KeyedNg manages a map of values indexed by keys, where values are created
 * on-demand using a factory function. It provides type-safe key handling,
 * optional LRU eviction, and lifecycle callbacks for monitoring changes.
 *
 * This class serves as the foundation for more specialized keyed collections
 * like KeyedResolvOnce and KeyedResolvSeq.
 *
 * @template K - The key type (can be any type with string conversion)
 * @template V - The value type created by the factory
 * @template CTX - The context type passed to factory and callbacks
 *
 * @example
 * ```typescript
 * // Simple factory for objects
 * const cache = new KeyedNg({
 *   createValue: (item) => ({
 *     id: item.refKey,
 *     created: Date.now()
 *   }),
 *   lru: { max: 100 }
 * });
 *
 * const obj1 = cache.get('key1');
 * const obj2 = cache.get('key2');
 * ```
 *
 * @example
 * ```typescript
 * // With complex keys and context
 * interface UserKey { org: string; userId: string; }
 * interface UserContext { apiKey: string; }
 *
 * const users = new KeyedNg<UserKey, User, UserContext>({
 *   createValue: (item) => new User(item.givenKey, item.ctx),
 *   key2string: (key) => `${key.org}:${key.userId}`,
 *   ctx: { apiKey: 'default' }
 * });
 *
 * const user = users.get(
 *   { org: 'acme', userId: '123' },
 *   { apiKey: 'custom' }
 * );
 * ```
 */
export class KeyedNg<K, V, CTX> implements KeyedIf<KeyedNgItem<K, V, CTX>, V, K, CTX> {
  /**
   * The resolved options with defaults applied.
   * @internal
   */
  readonly opts: Required<Omit<KeyedNgOptions<K, V, CTX>, "lru">>;

  /**
   * Internal LRU map for storing items.
   * @internal
   */
  readonly #map: LRUMap<string, KeyedNgItem<K, V, CTX>>;

  /**
   * Creates a new KeyedNg instance.
   *
   * @param opts - Configuration options
   */
  constructor(opts: KeyedNgOptions<K, V, CTX>) {
    this.opts = {
      ...opts,
      key2string:
        opts.key2string ??
        ((key: K): string => {
          if (typeof key === "string") {
            return key;
          }
          if (typeof key === "number") {
            return key.toString();
          }
          if (typeof key === "boolean") {
            return key ? "true" : "false";
          }
          return JSON.stringify(toSortedObject(key as unknown as Record<string, unknown>));
        }),
      ctx: opts.ctx ?? ({} as CTX),
    };
    this.#map = new LRUMap(opts.lru as LRUParam<KeyedNgItem<K, V, CTX>, string>);
  }

  /**
   * Registers a callback that fires when a new item is added to the collection.
   *
   * The callback is invoked after the item is created and stored. Multiple
   * callbacks can be registered.
   *
   * @param fn - Callback function receiving the new item
   * @returns Unregister function to remove the callback
   *
   * @example
   * ```typescript
   * const unregister = keyed.onSet((item) => {
   *   console.log('Added:', item.givenKey, item.value);
   * });
   *
   * // Later: remove the callback
   * unregister();
   * ```
   */
  onSet(fn: (value: KeyedNgItem<K, V, CTX>) => void): UnregFn {
    return this.#map.onSet((_keyStr: string, item: KeyedNgItem<K, V, CTX>) => {
      fn(item);
    });
  }

  /**
   * Registers a callback that fires when an item is deleted from the collection.
   *
   * The callback is invoked before the item is removed. This includes both
   * explicit deletions and LRU evictions.
   *
   * @param fn - Callback function receiving the deleted item
   * @returns Unregister function to remove the callback
   *
   * @example
   * ```typescript
   * const unregister = keyed.onDelete((item) => {
   *   console.log('Removed:', item.givenKey);
   *   item.value.cleanup?.(); // Perform cleanup if needed
   * });
   * ```
   */
  onDelete(fn: (value: KeyedNgItem<K, V, CTX>) => void): UnregFn {
    return this.#map.onDelete((_keyStr: string, item: KeyedNgItem<K, V, CTX>) => {
      fn(item);
    });
  }

  /**
   * Updates the LRU parameters of the underlying collection.
   *
   * Allows dynamic adjustment of caching behavior without recreating
   * the entire collection.
   *
   * @param params - New parameters to apply (partial update)
   *
   * @example
   * ```typescript
   * keyed.setParam({ lru: { max: 200 } });
   * ```
   */
  setParam(params: Partial<KeyedNgOptions<K, KeyedNgItem<K, V, CTX>, CTX>>): void {
    this.#map.setParam(params.lru as LRUParam<KeyedNgItem<K, V, CTX>, string>);
  }

  /**
   * Asynchronously gets or creates a value for a key resolved from a promise.
   *
   * Useful when the key itself needs to be computed asynchronously, such as
   * from a database lookup or API call.
   *
   * @param key - Function returning a promise that resolves to the key
   * @returns Promise resolving to the value
   *
   * @example
   * ```typescript
   * const value = await keyed.asyncGet(async () => {
   *   const id = await fetchUserId();
   *   return id;
   * });
   * ```
   */
  asyncGet(key: () => Promise<K>): Promise<V> {
    return key().then((k) => this.get(k));
  }

  /**
   * Checks if a key exists in the collection.
   *
   * Does not create a new value if the key doesn't exist.
   *
   * @param keyOfFnKey - The key or function returning the key
   * @returns True if the key exists in the collection
   *
   * @example
   * ```typescript
   * if (keyed.has('myKey')) {
   *   console.log('Key exists');
   * }
   *
   * // With function
   * if (keyed.has(() => computeKey())) {
   *   console.log('Computed key exists');
   * }
   * ```
   */
  has(keyOfFnKey: K | (() => K)): boolean {
    if (typeof keyOfFnKey === "function") {
      keyOfFnKey = (keyOfFnKey as () => K)();
    }
    return this.#map.has(this.opts.key2string(keyOfFnKey));
  }

  /**
   * Deletes an item from the collection.
   *
   * Triggers onDelete callbacks before removal. The item will need to be
   * recreated if accessed again.
   *
   * @param key - The key to delete
   *
   * @example
   * ```typescript
   * keyed.delete('myKey');
   * ```
   */
  delete(key: K): void {
    this.#map.delete(this.opts.key2string(key));
  }

  /**
   * Returns all keys currently in the collection.
   *
   * Returns the original keys (givenKey), not the normalized string versions.
   *
   * @returns Array of all keys
   *
   * @example
   * ```typescript
   * const keys = keyed.keys();
   * console.log(keys); // ['key1', 'key2', 'key3']
   * ```
   */
  keys(): K[] {
    return Array.from(this.#map.entries()).map(([_, item]) => item.givenKey);
  }

  /**
   * Iterates over all items in the collection.
   *
   * The callback receives each item and its index.
   *
   * @param fn - Callback function receiving item and index
   *
   * @example
   * ```typescript
   * keyed.forEach((item, idx) => {
   *   console.log(idx, item.givenKey, item.value);
   * });
   * ```
   */
  forEach(fn: (v: KeyedNgItem<K, V, CTX>, idx: number) => void): void {
    return this.#map.forEach((item, _, ctx) => {
      fn(item, ctx.idx);
    });
  }

  /**
   * Returns an iterable of all items with their indices.
   *
   * @returns Iterable of [item, index] pairs
   *
   * @example
   * ```typescript
   * for (const [item, idx] of keyed.entries()) {
   *   console.log(idx, item.givenKey, item.value);
   * }
   * ```
   */
  entries(): Iterable<[KeyedNgItem<K, V, CTX>, number]> {
    let idx = 0;
    return Array.from(this.#map.entries()).map(([_, item]) => [item, idx++]);
  }

  /**
   * Gets or creates the full KeyedNgItem for a given key.
   *
   * Returns the complete item structure including key, value, and context.
   * If the key doesn't exist, creates it using the factory function.
   *
   * @param key - The key to get
   * @param ctx - Optional context override for this get operation
   * @returns The complete KeyedNgItem
   *
   * @example
   * ```typescript
   * const item = keyed.getItem('myKey', { custom: 'context' });
   * console.log(item.refKey, item.givenKey, item.value, item.ctx);
   * ```
   */
  getItem(key: K, ctx?: CTX): KeyedNgItem<K, V, CTX> {
    const keyStr = this.opts.key2string(key);
    let item = this.#map.get(keyStr);
    if (!item) {
      item = {
        refKey: keyStr,
        givenKey: key,
        ctx: ctx ?? this.opts.ctx,
        value: undefined as unknown as V,
      };
      (item as { value: V }).value = this.opts.createValue(item);
      this.#map.set(keyStr, item);
    }
    return item;
  }

  /**
   * Gets or creates a value for the given key.
   *
   * This is the primary method for accessing values. If the key doesn't exist,
   * the factory function is called to create the value. Subsequent calls with
   * the same key return the cached value.
   *
   * @param key - The key or function returning the key
   * @param ctx - Optional context override for this get operation
   * @returns The value associated with the key
   *
   * @example
   * ```typescript
   * // Simple key
   * const value1 = keyed.get('myKey');
   *
   * // With function
   * const value2 = keyed.get(() => computeKey());
   *
   * // With custom context
   * const value3 = keyed.get('myKey', { custom: 'context' });
   * ```
   */
  get(key: K | (() => K), ctx?: CTX): V {
    if (typeof key === "function") {
      key = (key as () => K)();
    }
    const item = this.getItem(key, ctx);
    return item.value;
  }

  /**
   * Returns all items currently in the collection.
   *
   * Returns complete KeyedNgItem objects, not just the values.
   *
   * @returns Array of all items
   *
   * @example
   * ```typescript
   * const items = keyed.values();
   * items.forEach(item => {
   *   console.log(item.givenKey, item.value);
   * });
   * ```
   */
  values(): KeyedNgItem<K, V, CTX>[] {
    return Array.from(this.#map.entries()).map(([_, item]) => item);
  }
}
