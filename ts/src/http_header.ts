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
      yield* k;
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
    let values = "";
    if (this.impl.has(key)) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      values = this.impl.get(key) as string;
    }
    if (Array.isArray(value)) {
      values = [values, value.join(", ")].join(", ");
    } else {
      values = [values, value].join(", ");
    }
    const vs = new Set(
      values
        .split(", ")
        .map((i) => i.trim())
        .filter((i) => i !== ""),
    );
    this.impl.set(key, Array.from(vs).join(", "));
    return this;
  }
}

export class HttpHeader {
  readonly _headers: Map<string, string[]> = new Map<string, string[]>();

  static from(headers?: HeadersInit | Headers | HttpHeader): HttpHeader {
    if (headers instanceof HttpHeader) {
      return headers.Clone();
    }
    const h = new HttpHeader();
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
  }

  _asStringString(): Map<string, string> {
    const ret = new Map<string, string>();
    for (const [key, values] of this._headers) {
      ret.set(key, values.join(", "));
    }
    return ret;
  }

  _key(key: string): string {
    return key.toLowerCase();
  }
  Values(key: string): string[] {
    const values = this._headers.get(this._key(key));
    return values || [];
  }
  Get(key: string): string | undefined {
    const values = this._headers.get(this._key(key));
    if (values === undefined || values.length === 0) {
      return undefined;
    }
    return values[0];
  }
  Set(key: string, valueOr: string | string[]): HttpHeader {
    const value = Array.isArray(valueOr) ? valueOr : [valueOr];
    this._headers.set(this._key(key), value);
    return this;
  }
  Add(key: string, value: string | string[] | undefined): HttpHeader {
    if (typeof value === "undefined") {
      return this;
    }
    const vs = Array.isArray(value) ? value : [value];
    const values = this._headers.get(this._key(key));
    if (values === undefined) {
      this._headers.set(this._key(key), vs);
    } else {
      values.push(...vs);
    }
    return this;
  }
  Del(ey: string): HttpHeader {
    this._headers.delete(this._key(ey));
    return this;
  }
  Items(): [string, string[]][] {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return Array.from(this._headers).filter(([_, vs]) => vs.length > 0);
  }
  SortItems(): [string, string[]][] {
    return this.Items().sort(([[a]], [[b]]) => a.localeCompare(b));
  }
  Clone(): HttpHeader {
    const clone = new HttpHeader();
    for (const [key, values] of this._headers.entries()) {
      clone._headers.set(key, values.slice());
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
      obj[key] = values.join(", ");
    }
    return obj;
  }
  AsHeaderInit(): HeadersInit {
    const obj: HeadersInit = {};
    for (const [key, values] of this._headers.entries()) {
      obj[key] = values[0];
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
