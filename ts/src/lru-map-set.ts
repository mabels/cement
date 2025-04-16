import { AppContext } from "./app-context.js";

export interface LRUParam {
  readonly maxEntries: number;
  readonly maxAge: number; // not implemented
}

export class LRUSet<T> {
  private readonly _lruMap: LRUMap<T, T>;

  constructor(param: Partial<LRUParam> = {}) {
    this._lruMap = new LRUMap<T, T>(param);
  }

  setParam(param: Partial<LRUParam> = {}): void {
    this._lruMap.setParam(param);
  }

  get size(): number {
    return this._lruMap.size;
  }

  has(key: T): boolean {
    return this._lruMap.has(key);
  }

  add(key: T): void {
    this._lruMap.set(key, key);
  }

  delete(key: T): void {
    this._lruMap.delete(key);
  }

  clear(): void {
    this._lruMap.clear();
  }

  forEach(callbackfn: (value: T, key: T) => void): void {
    this._lruMap.forEach((value) => callbackfn(value, value));
  }

  entries(): IterableIterator<[T, T, LRUCtx<T, T>]> {
    return this._lruMap.entries();
  }
}

export interface LRUCtx<T, K> {
  readonly update: boolean;
  readonly ref: LRUMap<T, K>;
  readonly stats: LRUMap<T, K>["stats"];
  readonly item: LRUItem<K>;
}

export interface LRUItem<K> {
  readonly value: K;
  ctx?: AppContext;
}

export type LRUMapFn<K, T> = (key: K, value: T, meta: LRUCtx<K, T>) => void;
export type UnregFn = () => void;

export class LRUMap<T, K> {
  private _map: Map<T, LRUItem<K>> = new Map<T, LRUItem<K>>();
  private param: LRUParam;

  readonly stats = {
    gets: 0,
    puts: 0,
    deletes: 0,
  };

  constructor(c: Partial<LRUParam> = {}) {
    this.param = {
      maxEntries: c.maxEntries || 100,
      maxAge: c.maxAge || 0,
    };
  }

  private _onSetFns: Map<string, LRUMapFn<T, K>> = new Map<string, LRUMapFn<T, K>>();
  onSet(fn: LRUMapFn<T, K>): UnregFn {
    const id = Math.random().toString(36);
    this._onSetFns.set(id, fn);
    return () => {
      this._onSetFns.delete(id);
    };
  }
  private _onDeleteFns: Map<string, LRUMapFn<T, K>> = new Map<string, LRUMapFn<T, K>>();
  onDelete(fn: LRUMapFn<T, K>): UnregFn {
    const id = Math.random().toString(36);
    this._onDeleteFns.set(id, fn);
    return () => {
      this._onDeleteFns.delete(id);
    };
  }

  private touch(key: T): LRUItem<K> {
    if (!this._map.has(key)) {
      throw new Error(`key not found in cache: ${key as unknown as string}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const value = this._map.get(key)!;
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  setParam(param: Partial<LRUParam> = {}): void {
    if (typeof param.maxEntries === "number") {
      (this.param as { maxEntries: number }).maxEntries = param.maxEntries;
      if (param.maxEntries > 0 && this._map.size > param.maxEntries) {
        const toDelete: T[] = [];
        let cacheSize = this._map.size;
        for (const key of this._map.keys()) {
          if (cacheSize > param.maxEntries) {
            toDelete.push(key);
            cacheSize--;
          } else {
            break;
          }
        }
        for (const key of toDelete) {
          this._map.delete(key);
        }
      }
    }
  }

  has(key: T): boolean {
    return this._map.has(key);
  }

  get size(): number {
    return this._map.size;
  }

  async getSet(key: T, createFN: (key: T) => Promise<K>): Promise<K | undefined> {
    const val = this.get(key);
    if (val) {
      return val;
    } else {
      const val = await createFN(key);
      this.set(key, val as K);
      return val;
    }
  }

  get(key: T): K | undefined {
    return this.getItem(key)?.value;
  }

  getItem(key: T): LRUItem<K> | undefined {
    if (this._map.has(key)) {
      this.stats.gets++;
      return this.touch(key);
    }
    return undefined;
  }

  private buildItem(item: LRUItem<K> | undefined, value: K): LRUItem<K> {
    return {
      ...item,
      value,
    };
  }

  set(key: T, value: K): void {
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
    if (this.param.maxEntries > 0 && this._map.size >= this.param.maxEntries) {
      // delete the least recently accessed
      // const key = Array.from(this.cache.keys())[0];
      // this.cache.delete(key) or
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this._map.delete(this._map.keys().next().value!);
    }
    this._map.set(key, item);
    this.stats.puts++;
    this._onSetFns.forEach((fn) => fn(key, item?.value, this.buildItemCtx(item, update)));
  }

  private buildItemCtx(item: LRUItem<K>, update: boolean): LRUCtx<T, K> {
    return {
      update,
      ref: this,
      stats: this.stats,
      item,
    };
  }

  delete(key: T): void {
    if (this._map.has(key)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const item = this._map.get(key)!;
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

  forEach(fn: (value: K, key: T, ctx: LRUCtx<T, K>) => void): void {
    this._map.forEach((v, k) => {
      fn(v.value, k, this.buildItemCtx(v, false));
    });
  }

  *entries(): IterableIterator<[T, K, LRUCtx<T, K>]> {
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
