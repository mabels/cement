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

  entries(): IterableIterator<[T, T]> {
    return this._lruMap.entries();
  }
}

export class LRUMap<T, K> {
  private _map: Map<T, K> = new Map<T, K>();
  private param: LRUParam;

  constructor(c: Partial<LRUParam> = {}) {
    this.param = {
      maxEntries: c.maxEntries || 100,
      maxAge: c.maxAge || 0,
    };
  }

  private touch(key: T): K {
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
    if (this._map.has(key)) {
      return this.touch(key);
    }
    return this._map.get(key);
  }

  set(key: T, value: K): void {
    this._map.delete(key);
    if (this.param.maxEntries > 0 && this._map.size >= this.param.maxEntries) {
      // delete the least recently accessed
      // const key = Array.from(this.cache.keys())[0];
      // this.cache.delete(key) or
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this._map.delete(this._map.keys().next().value!);
      this._map.set(key, value);
    } else {
      this._map.set(key, value);
    }
  }

  delete(key: T): void {
    this._map.delete(key);
  }

  clear(): void {
    this._map.clear();
  }

  forEach(callbackfn: (value: K, key: T, map: Map<T, K>) => void): void {
    this._map.forEach(callbackfn);
  }

  entries(): IterableIterator<[T, K]> {
    return this._map.entries();
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
