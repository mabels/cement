export class HeadersImpl implements Headers {
  // readonly _headers: Map<string, string>;
  readonly impl: Headers = new Headers();

  constructor(init: Map<string, string | string[]>) {
    // super();
    for (const [k, v] of init) {
      this.append(k, v);
    }
  }
  // toKey(key: string): string {
  //   return key.toLowerCase();
  // }

  forEach(callbackfn: (value: string, key: string, parent: this) => void): void {
    this.impl.forEach((v, k) => {
      callbackfn(v, k, this);
    });
  }

  delete(name: string): void {
    this.impl.delete(name);
  }
  get(name: string): string | null {
    return this.impl.get(name);
  }
  getSetCookie(): string[] {
    return this.impl.getSetCookie();
  }
  has(name: string): boolean {
    return this.impl.has(name);
  }
  set(name: string, value: string): void {
    this.impl.set(name, value);
  }

  *[Symbol.iterator](): IterableIterator<[string, string]> {
    const keys: [string, string][] = [];
    this.impl.forEach((v, k) => {
      keys.push([k, v]);
    });
    for (const k of keys) {
      yield k;
    }
  }

  entries(): IterableIterator<[string, string]> {
    return this[Symbol.iterator]();
  }
  *keys(): IterableIterator<string> {
    const keys: string[] = [];
    this.impl.forEach((_, k) => {
      keys.push(k);
    });
    for (const k of keys) {
      yield k;
    }
  }
  *values(): IterableIterator<string> {
    for (const k of this.keys()) {
      const v = this.impl.get(k);
      if (!v) {
        continue;
      }
      yield v;
    }
  }

  append(key: string, value?: string | string[]): HeadersImpl {
    if (!(typeof value === "string" || Array.isArray(value))) {
      return this;
    }
    const existingValues = this.impl.get(key) || "";
    const newValues = Array.isArray(value) ? value : [value];
    const allValues = existingValues ? [...existingValues.split(", ").map((v) => v.trim()), ...newValues] : newValues;
    // Remove empty strings and duplicates while preserving order
    const uniqueValues = [...new Set(allValues.filter((v) => v !== ""))];
    this.impl.set(key, uniqueValues.join(", "));
    return this;
  }
}

export class HttpHeader {
  readonly _headers: Map<string, Set<string>> = new Map<string, Set<string>>();

  static from(...headersArgs: (HeadersInit | Headers | HttpHeader)[]): HttpHeader {
    return headersArgs
      .map((headers) => {
        const h = new HttpHeader();
        if (headers instanceof HttpHeader) {
          return headers.Clone();
        }
        if (headers) {
          if (Array.isArray(headers)) {
            for (const [k, v] of headers) {
              if (v) {
                h.Add(k, v);
              }
            }
          } else if (headers instanceof Headers) {
            headers.forEach((v, k) => {
              if (v) {
                h.Add(
                  k,
                  v.split(",").map((v) => v.trim()),
                );
              }
            });
          } else {
            for (const k in headers) {
              const v = (headers as Record<string, string | string[]>)[k];
              (Array.isArray(v) ? v : [v]).forEach((v) => {
                h.Add(k, v);
              });
            }
          }
        }
        return h;
      })
      .reduce((acc, cur) => acc.Merge(cur), new HttpHeader());
  }

  _asStringString(): Map<string, string> {
    const ret = new Map<string, string>();
    for (const [key, values] of this._headers) {
      ret.set(key, Array.from(values).join(", "));
    }
    return ret;
  }

  _key(key: string): string {
    return key.toLowerCase();
  }
  Values(key: string): string[] {
    const values = this._headers.get(this._key(key));
    return values ? Array.from(values) : [];
  }
  Get(key: string): string | undefined {
    const values = this._headers.get(this._key(key));
    if (values === undefined || values.size === 0) {
      return undefined;
    }
    return values.values().next().value as string;
  }
  Set(key: string, valueOr: string | string[]): HttpHeader {
    const value = new Set((Array.isArray(valueOr) ? valueOr : [valueOr]).map((v) => v.trim()).filter((v) => v !== ""));
    if (value.size > 0) {
      this._headers.set(this._key(key), value);
    } else {
      this._headers.delete(this._key(key));
    }
    return this;
  }
  Add(key: string, value: string | string[] | undefined): HttpHeader {
    if (typeof value === "undefined") {
      return this;
    }
    let values = this._headers.get(this._key(key));
    if (!values) {
      values = new Set<string>();
      this._headers.set(this._key(key), values);
    }
    (Array.isArray(value) ? value : [value])
      .map((v) => v.trim())
      .filter((v) => v !== "")
      .reduce((acc, v) => {
        acc.add(v);
        return acc;
      }, values);
    return this;
  }
  Del(ey: string): HttpHeader {
    this._headers.delete(this._key(ey));
    return this;
  }
  Items(): [string, string[]][] {
    return Array.from(this._headers)
      .filter(([_, vs]) => vs.size > 0)
      .map(([k, vs]) => [k, Array.from(vs)]);
  }
  SortItems(): [string, string[]][] {
    return this.Items().sort(([[a]], [[b]]) => a.localeCompare(b));
  }
  Clone(): HttpHeader {
    const clone = new HttpHeader();
    for (const [key, values] of this._headers.entries()) {
      clone._headers.set(key, new Set(values));
    }
    return clone;
  }
  AsRecordStringStringArray(): Record<string, string[]> {
    const obj: Record<string, string[]> = {};
    for (const [key, values] of this._headers.entries()) {
      obj[key] = [...values];
    }
    return obj;
  }
  AsRecordStringString(): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const [key, values] of this._headers.entries()) {
      obj[key] = Array.from(values).join(", ");
    }
    return obj;
  }
  // Need for CF own HeadersInit type
  AsHeaderInit<H extends HeadersInit>(): H {
    const obj = {} as H;
    for (const [key, values] of this._headers.entries()) {
      const vs = values.values().next();
      if (vs.value) {
        obj[key] = vs.value as string;
      }
    }
    return obj;
  }
  AsHeaders(): HeadersImpl {
    return new HeadersImpl(this._asStringString());
  }
  Merge(other?: HttpHeader): HttpHeader {
    const ret = this.Clone();
    if (other) {
      for (const [key, values] of other.Items()) {
        ret.Add(key, values);
      }
    }
    return ret;
  }
}
