export class HeadersImpl extends Headers {
  readonly _headers: Map<string, string>;

  constructor(init: Map<string, string>) {
    super();
    this._headers = init;
  }

  override [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  override entries(): IterableIterator<[string, string]> {
    return this._headers.entries();
  }
  override keys(): IterableIterator<string> {
    return this._headers.keys();
  }
  override values(): IterableIterator<string> {
    return this._headers.values();
  }

  override append(key: string, value: string | string[] | undefined): HeadersImpl {
    const values = this._headers.get(key);
    if (typeof value === "undefined") {
      value = "";
    }
    if (Array.isArray(value)) {
      this._headers.set(key, [values, ...value].filter((i) => i).join(", "));
    } else {
      this._headers.set(key, [values, value].filter((i) => i).join(", "));
    }
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
        for (const [k, v] of headers as [string, string][]) {
          if (v) {
            h.Add(k, v);
          }
        }
      } else if (headers instanceof Headers) {
        for (const [k, v] of headers.entries()) {
          if (v) {
            h.Add(
              k,
              v.split(",").map((v) => v.trim()),
            );
          }
        }
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
  AsHeaders(): Headers {
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
