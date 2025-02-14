export interface LRUCacheParam {
  readonly maxEntries: number;
  readonly maxAge: number;
}
export class LRUCache<T, K> {
  private _cache: Map<T, K> = new Map<T, K>();
  private param: LRUCacheParam;

  constructor(c: Partial<LRUCacheParam> = {}) {
    this.param = {
      maxEntries: c.maxEntries || 100,
      maxAge: c.maxAge || 0,
    };
  }

  private touch(key: T): K {
    if (!this._cache.has(key)) {
      throw new Error(`key not found in cache: ${key as unknown as string}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const value = this._cache.get(key)!;
    this._cache.delete(key);
    this._cache.set(key, value);
    return value;
  }

  setParam(param: Partial<LRUCacheParam> = {}): void {
    if (typeof param.maxEntries === "number") {
      (this.param as { maxEntries: number }).maxEntries = param.maxEntries;
      if (param.maxEntries > 0 && this._cache.size > param.maxEntries) {
        const toDelete: T[] = [];
        let cacheSize = this._cache.size;
        for (const key of this._cache.keys()) {
          if (cacheSize > param.maxEntries) {
            toDelete.push(key);
            cacheSize--;
          } else {
            break;
          }
        }
        for (const key of toDelete) {
          this._cache.delete(key);
        }
      }
    }
  }

  get size(): number {
    return this._cache.size;
  }

  async getPut(key: T, createFN: (key: T) => Promise<K>): Promise<K | undefined> {
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
    if (this._cache.has(key)) {
      return this.touch(key);
    }
    return this._cache.get(key);
  }

  set(key: T, value: K): void {
    this._cache.delete(key);
    if (this.param.maxEntries > 0 && this._cache.size >= this.param.maxEntries) {
      // delete the least recently accessed
      // const key = Array.from(this.cache.keys())[0];
      // this.cache.delete(key) or
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this._cache.delete(this._cache.keys().next().value!);
      this._cache.set(key, value);
    } else {
      this._cache.set(key, value);
    }
  }

  delete(key: T): void {
    this._cache.delete(key);
  }

  clear(): void {
    this._cache.clear();
  }

  forEach(callbackfn: (value: K, key: T, map: Map<T, K>) => void): void {
    this._cache.forEach(callbackfn);
  }

  entries(): IterableIterator<[T, K]> {
    return this._cache.entries();
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
