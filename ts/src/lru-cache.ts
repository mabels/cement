export interface LRUCacheParam {
  readonly maxEntries: number;
  readonly maxAge: number;
}
export class LRUCache<T, K> {
  private cache: Map<T, K> = new Map<T, K>();
  private param: LRUCacheParam;

  constructor(c: Partial<LRUCacheParam> = {}) {
    this.param = {
      maxEntries: c.maxEntries || 100,
      maxAge: c.maxAge || 0,
    };
  }

  private touch(key: T): K {
    // there could be undefined or null in value
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  get size(): number {
    return this.cache.size;
  }

  async getPut(key: T, createFN: (key: T) => Promise<K>): Promise<K | undefined> {
    const val = this.get(key);
    if (val) {
      return val;
    } else {
      const val = await createFN(key);
      this.put(key, val as K);
      return val;
    }
  }

  get(key: T): K | undefined {
    if (this.cache.has(key)) {
      return this.touch(key);
    }
    return this.cache.get(key);
  }

  put(key: T, value: K): void {
    this.cache.delete(key);
    if (this.cache.size >= this.param.maxEntries) {
      // delete the least recently accessed
      // const key = Array.from(this.cache.keys())[0];
      // this.cache.delete(key) or
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, value);
    } else {
      this.cache.set(key, value);
    }
  }

  //   getLeastRecent(): K {
  //     return Array.from(this.cache)[0];
  //   }

  //   getMostRecent(): K {
  //     return Array.from(this.cache)[this.cache.size - 1];
  //   }
}
