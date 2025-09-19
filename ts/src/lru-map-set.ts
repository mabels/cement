import { AppContext } from "./app-context.js";

interface MutableLRUParam<T, K> {
  evict: (param: LRUParam<T, K>, newItem: T, map: LRUMap<K, T>) => boolean;
  // is called if the params are changed
  // default it removes the least recently accessed
  refresh: (param: LRUParam<T, K>, map: LRUMap<K, T>) => void;
  maxEntries: number;
  maxAge: number; // not implemented
}

export type LRUParam<T = string, K = string> = Readonly<MutableLRUParam<T, K>>;

export class LRUSet<T> {
  readonly #lruMap: LRUMap<T, T>;

  constructor(param: Partial<LRUParam<T, T>> = {}) {
    this.#lruMap = new LRUMap<T, T>(param);
  }

  setParam(param: Partial<LRUParam<T, T>> = {}): void {
    this.#lruMap.setParam(param);
  }

  get size(): number {
    return this.#lruMap.size;
  }

  has(key: T): boolean {
    return this.#lruMap.has(key);
  }

  add(key: T): void {
    this.#lruMap.set(key, key);
  }

  delete(key: T): void {
    this.#lruMap.delete(key);
  }

  clear(): void {
    this.#lruMap.clear();
  }

  forEach(callbackfn: (value: T, key: T) => void): void {
    this.#lruMap.forEach((value) => callbackfn(value, value));
  }

  entries(): IterableIterator<[T, T, LRUCtx<T, T>]> {
    return this.#lruMap.entries();
  }
}

export interface LRUCtx<T, K> {
  readonly update: boolean;
  readonly ref: LRUMap<K, T>;
  readonly stats: LRUMap<T, K>["stats"];
  readonly item: LRUItem<T>;
}

export interface LRUItem<V> {
  readonly value: V;
  ctx?: AppContext;
}

export type LRUMapFn<K, T> = (value: T, key: K, meta: LRUCtx<K, T>) => void;
export type UnregFn = () => void;

function defaultRefresh<V, K>(param: LRUParam<V, K>, map: LRUMap<K, V>): void {
  if (param.maxEntries > 0 && map.size > param.maxEntries) {
    const toDelete: K[] = [];
    let cacheSize = map.size;
    for (const key of map.keys()) {
      if (cacheSize > param.maxEntries) {
        toDelete.push(key);
        cacheSize--;
      } else {
        break;
      }
    }
    for (const key of toDelete) {
      map.delete(key);
    }
  }
}

export class LRUMap<K, V> {
  private _map: Map<K, LRUItem<V>> = new Map<K, LRUItem<V>>();
  private param: MutableLRUParam<V, K>;

  readonly stats = {
    gets: 0,
    puts: 0,
    deletes: 0,
  };

  constructor(c: Partial<LRUParam<V, K>> = {}) {
    this.param = {
      maxEntries: c.maxEntries || 100,
      maxAge: c.maxAge || 0,
      evict: c.evict || ((param, _newItem, map): boolean => param.maxEntries > 0 && map.size >= param.maxEntries),
      refresh: c.refresh || ((param: LRUParam<V, K>, map: LRUMap<K, V>): void => defaultRefresh(param, map)),
    };
  }

  private _onSetFns: Map<string, LRUMapFn<V, K>> = new Map<string, LRUMapFn<V, K>>();
  onSet(fn: LRUMapFn<V, K>): UnregFn {
    const id = Math.random().toString(36);
    this._onSetFns.set(id, fn);
    return () => {
      this._onSetFns.delete(id);
    };
  }
  private _onDeleteFns: Map<string, LRUMapFn<V, K>> = new Map<string, LRUMapFn<V, K>>();
  onDelete(fn: LRUMapFn<V, K>): UnregFn {
    const id = Math.random().toString(36);
    this._onDeleteFns.set(id, fn);
    return () => {
      this._onDeleteFns.delete(id);
    };
  }

  private touch(key: K): LRUItem<V> {
    if (!this._map.has(key)) {
      throw new Error(`key not found in cache: ${key as unknown as string}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const value = this._map.get(key) as LRUItem<V>;
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  setParam(param: Partial<LRUParam<V, K>> = {}): void {
    if (param.evict) {
      this.param.evict = param.evict;
    }
    if (param.refresh) {
      this.param.refresh = param.refresh;
    }
    if (typeof param.maxEntries === "number") {
      this.param.maxEntries = param.maxEntries;
    }
    if (typeof param.maxAge === "number") {
      this.param.maxAge = param.maxAge;
    }

    this.param.refresh(this.param, this);
  }

  keys(): IterableIterator<K> {
    return this._map.keys();
  }

  has(key: K): boolean {
    return this._map.has(key);
  }

  get size(): number {
    return this._map.size;
  }

  async getSet(key: K, createFN: (key: K) => Promise<V>): Promise<V | undefined> {
    const val = this.get(key);
    if (val) {
      return val;
    } else {
      const val = await createFN(key);
      this.set(key, val as V);
      return val;
    }
  }

  get(key: K): V | undefined {
    return this.getItem(key)?.value;
  }

  getItem(key: K): LRUItem<V> | undefined {
    if (this._map.has(key)) {
      this.stats.gets++;
      return this.touch(key);
    }
    return undefined;
  }

  private buildItem(item: LRUItem<V> | undefined, value: V): LRUItem<V> {
    return {
      ...item,
      value,
    };
  }

  set(key: K, value: V): void {
    const update = this._map.has(key);
    let item = this._map.get(key);
    if (update) {
      if (item?.value === value) {
        return;
      }
      // simulate touch
      this._map.delete(key);
    }
    item = this.buildItem(item, value);
    if (this.param.evict(this.param, value, this)) {
      // delete the least recently accessed
      // const key = Array.from(this.cache.keys())[0];
      // this.cache.delete(key) or
      const k = this._map.keys().next();
      if (!k.done) {
        this._map.delete(k.value as K);
      }
    }
    this._map.set(key, item);
    this.stats.puts++;
    this._onSetFns.forEach((fn) => fn(key, item?.value, this.buildItemCtx(item, update)));
  }

  private buildItemCtx(item: LRUItem<V>, update: boolean): LRUCtx<V, K> {
    return {
      update,
      ref: this,
      stats: this.stats,
      item,
    };
  }

  delete(key: K): void {
    if (this._map.has(key)) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const item = this._map.get(key) as LRUItem<V>;
      this._onDeleteFns.forEach((fn) => fn(key, item?.value, this.buildItemCtx(item, true)));
      this._map.delete(key);
      this.stats.deletes++;
    }
  }

  clear(): void {
    this._map.forEach((value, key) => {
      const item = this.buildItemCtx(value, true);
      this._onDeleteFns.forEach((fn) => fn(key, item.item.value, item));
      this.stats.deletes++;
    });
    this._map.clear();
  }

  forEach(fn: (value: V, key: K, ctx: LRUCtx<V, K>) => void): void {
    this._map.forEach((v, k) => {
      fn(v.value, k, this.buildItemCtx(v, false));
    });
  }

  *entries(): IterableIterator<[K, V, LRUCtx<V, K>]> {
    for (const [key, value] of this._map.entries()) {
      yield [key, value.value, this.buildItemCtx(value, true)];
    }
  }
  // *entries(): IterableIterator<[T, K]> {
  //   for (const x of this._cache.entries()) {
  //     yield x;
  //   }
  // }

  //   getLeastRecent(): K {
  //     return Array.from(this.cache)[0];
  //   }

  //   getMostRecent(): K {
  //     return Array.from(this.cache)[this.cache.size - 1];
  //   }
}
