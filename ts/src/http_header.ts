export class HeadersImpl implements Headers {
  readonly impl: Headers = new Headers();

  constructor(init: Map<string, string | string[]>) {
    for (const [k, v] of init) {
      this.append(k, v);
    }
  }

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

export interface HeaderForeach {
  forEach(callbackfn: (value: string | string[], key: string, parent: this) => void): void;
}
export type CoercedHeadersInit = HeadersInit | HeaderForeach | HttpHeader;

function hasForEach(unk: unknown): unk is HeaderForeach {
  return typeof (unk as Headers).forEach == "function";
}

/**
 * HTTP header container with multi-value support and type-safe operations.
 *
 * HttpHeader provides a comprehensive API for managing HTTP headers with
 * support for multiple values per header name. All header names are normalized
 * to lowercase for case-insensitive comparison. Supports conversion to/from
 * various formats including native Headers, plain objects, and arrays.
 *
 * @example
 * ```typescript
 * const headers = new HttpHeader();
 * headers.Add('Content-Type', 'application/json');
 * headers.Add('Accept', ['application/json', 'text/html']);
 *
 * const value = headers.Get('content-type'); // Case-insensitive
 * const allAccept = headers.Values('accept'); // ['application/json', 'text/html']
 *
 * // Merge multiple header sources
 * const merged = HttpHeader.from(
 *   { 'User-Agent': 'MyApp/1.0' },
 *   new Headers({ 'Authorization': 'Bearer token' })
 * );
 * ```
 */
export class HttpHeader {
  readonly _headers: Map<string, Set<string>> = new Map<string, Set<string>>();

  /**
   * Converts various header formats to HttpHeader instance.
   *
   * Accepts Headers, arrays, objects, or existing HttpHeader instances.
   * Automatically handles comma-separated values and normalizes header names.
   *
   * @param headers - Headers in any supported format
   * @returns HttpHeader instance
   */
  static coerce(headers: CoercedHeadersInit): HttpHeader {
    if (headers instanceof HttpHeader) {
      return headers;
    }
    const h = new HttpHeader();
    if (headers) {
      switch (true) {
        case Array.isArray(headers):
          for (const [k, v] of headers) {
            if (v) {
              h.Add(k, v);
            }
          }
          break;
        case hasForEach(headers):
          headers.forEach((v, k) => {
            if (v) {
              const arrayV = (typeof v === "string" ? [v] : v)
                .map((vv) => vv.split(",").map((v) => v.trim()))
                .flat()
                .filter((v) => !!v);
              h.Add(k, arrayV);
            }
          });
          break;
        default:
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

  /**
   * Creates HttpHeader by merging multiple header sources.
   *
   * @param headersArgs - One or more header sources to merge
   * @returns New HttpHeader with all headers merged
   *
   * @example
   * ```typescript
   * const headers = HttpHeader.from(
   *   { 'Content-Type': 'application/json' },
   *   new Headers({ 'Authorization': 'Bearer token' }),
   *   [['X-Custom', 'value']]
   * );
   * ```
   */
  static from(...headersArgs: CoercedHeadersInit[]): HttpHeader {
    return headersArgs.map((headers) => HttpHeader.coerce(headers)).reduce((acc, cur) => acc.MergeInplace(cur), new HttpHeader());
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

  /**
   * Gets all values for a header (case-insensitive).
   *
   * @param key - Header name
   * @returns Array of all values for the header
   */
  Values(key: string): string[] {
    const values = this._headers.get(this._key(key));
    return values ? Array.from(values) : [];
  }

  /**
   * Gets the first value for a header (case-insensitive).
   *
   * @param key - Header name
   * @returns First value or undefined if not present
   */
  Get(key: string): string | undefined {
    const values = this._headers.get(this._key(key));
    if (values === undefined || values.size === 0) {
      return undefined;
    }
    return values.values().next().value as string;
  }

  /**
   * Sets a header, replacing any existing values.
   *
   * @param key - Header name
   * @param valueOr - Single value or array of values
   * @returns This HttpHeader instance for chaining
   */
  Set(key: string, valueOr: string | string[]): HttpHeader {
    const value = new Set((Array.isArray(valueOr) ? valueOr : [valueOr]).map((v) => v.trim()).filter((v) => v !== ""));
    if (value.size > 0) {
      this._headers.set(this._key(key), value);
    } else {
      this._headers.delete(this._key(key));
    }
    return this;
  }

  /**
   * Adds value(s) to a header, preserving existing values.
   *
   * @param key - Header name
   * @param value - Single value, array of values, or undefined
   * @returns This HttpHeader instance for chaining
   */
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

  /**
   * Deletes a header.
   *
   * @param ey - Header name to delete
   * @returns This HttpHeader instance for chaining
   */
  Del(ey: string): HttpHeader {
    this._headers.delete(this._key(ey));
    return this;
  }

  /**
   * Returns all headers as key-value array pairs.
   *
   * Each entry is a tuple of [headerName, values[]] where headerName is
   * lowercase and values is an array of all values for that header.
   * Headers with no values are excluded.
   *
   * @returns Array of [name, values] tuples
   *
   * @example
   * ```typescript
   * const headers = new HttpHeader();
   * headers.Add('Accept', ['application/json', 'text/html']);
   * headers.Add('Content-Type', 'application/json');
   *
   * const items = headers.Items();
   * // [
   * //   ['accept', ['application/json', 'text/html']],
   * //   ['content-type', ['application/json']]
   * // ]
   * ```
   */
  Items(): [string, string[]][] {
    return Array.from(this._headers)
      .filter(([_, vs]) => vs.size > 0)
      .map(([k, vs]) => [k, Array.from(vs)]);
  }

  /**
   * Returns all headers as sorted key-value array pairs.
   *
   * Same as Items() but sorted alphabetically by header name.
   *
   * @returns Array of [name, values] tuples sorted by name
   *
   * @example
   * ```typescript
   * const headers = new HttpHeader();
   * headers.Add('Content-Type', 'application/json');
   * headers.Add('Accept', 'text/html');
   *
   * const sorted = headers.SortItems();
   * // [
   * //   ['accept', ['text/html']],
   * //   ['content-type', ['application/json']]
   * // ]
   * ```
   */
  SortItems(): [string, string[]][] {
    return this.Items().sort(([[a]], [[b]]) => a.localeCompare(b));
  }

  /**
   * Creates a deep copy of the HttpHeader instance.
   *
   * @returns New HttpHeader with the same headers
   *
   * @example
   * ```typescript
   * const original = new HttpHeader();
   * original.Add('Content-Type', 'application/json');
   *
   * const copy = original.Clone();
   * copy.Add('Accept', 'text/html');
   *
   * // original is unchanged
   * original.Get('Accept'); // undefined
   * copy.Get('Accept'); // 'text/html'
   * ```
   */
  Clone(): HttpHeader {
    const clone = new HttpHeader();
    for (const [key, values] of this._headers.entries()) {
      clone._headers.set(key, new Set(values));
    }
    return clone;
  }
  /**
   * Converts headers to a plain object with string array values.
   *
   * Each header name maps to an array of all its values. Useful for
   * serialization or when working with APIs that expect this format.
   *
   * @returns Object with header names as keys and string arrays as values
   *
   * @example
   * ```typescript
   * const headers = new HttpHeader();
   * headers.Add('Accept', ['application/json', 'text/html']);
   * headers.Add('Content-Type', 'application/json');
   *
   * const obj = headers.AsRecordStringStringArray();
   * // {
   * //   'accept': ['application/json', 'text/html'],
   * //   'content-type': ['application/json']
   * // }
   * ```
   */
  AsRecordStringStringArray(): Record<string, string[]> {
    const obj: Record<string, string[]> = {};
    for (const [key, values] of this._headers.entries()) {
      obj[key] = [...values];
    }
    return obj;
  }

  /**
   * Converts headers to a plain object with comma-separated string values.
   *
   * Multiple values for the same header are joined with ", ". Useful for
   * compatibility with APIs that expect single string values per header.
   *
   * @returns Object with header names as keys and comma-separated strings as values
   *
   * @example
   * ```typescript
   * const headers = new HttpHeader();
   * headers.Add('Accept', ['application/json', 'text/html']);
   * headers.Add('Content-Type', 'application/json');
   *
   * const obj = headers.AsRecordStringString();
   * // {
   * //   'accept': 'application/json, text/html',
   * //   'content-type': 'application/json'
   * // }
   * ```
   */
  AsRecordStringString(): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const [key, values] of this._headers.entries()) {
      obj[key] = Array.from(values).join(", ");
    }
    return obj;
  }

  /**
   * Converts headers to HeadersInit format with only first value per header.
   *
   * Only the first value is used when multiple values exist for a header.
   * Needed for Cloudflare Workers' HeadersInit type compatibility.
   *
   * @template H - HeadersInit type (for type compatibility)
   * @returns Object compatible with HeadersInit
   *
   * @example
   * ```typescript
   * const headers = new HttpHeader();
   * headers.Add('Accept', ['application/json', 'text/html']);
   * headers.Add('Content-Type', 'application/json');
   *
   * const init = headers.AsHeaderInit();
   * // {
   * //   'accept': 'application/json',  // only first value
   * //   'content-type': 'application/json'
   * // }
   * ```
   */
  AsHeaderInit<H extends HeadersInit>(): H {
    const obj: Record<string, string> = {};
    for (const [key, values] of this._headers.entries()) {
      const vs = values.values().next();
      if (vs.value) {
        obj[key] = vs.value;
      }
    }
    return obj as H;
  }

  /**
   * Converts to native Headers implementation.
   *
   * Multiple values are joined with ", " as per HTTP spec.
   *
   * @returns HeadersImpl instance compatible with standard Headers interface
   *
   * @example
   * ```typescript
   * const headers = new HttpHeader();
   * headers.Add('Content-Type', 'application/json');
   *
   * const nativeHeaders = headers.AsHeaders();
   * nativeHeaders.get('content-type'); // 'application/json'
   * ```
   */
  AsHeaders(): HeadersImpl {
    return new HeadersImpl(this._asStringString());
  }

  /**
   * Merges other headers into this instance (in-place mutation).
   *
   * Adds all headers from the provided sources to this instance.
   * If headers already exist, values are added (not replaced).
   *
   * @param other - One or more header sources to merge
   * @returns This HttpHeader instance for chaining
   *
   * @example
   * ```typescript
   * const headers = new HttpHeader();
   * headers.Add('Content-Type', 'application/json');
   *
   * headers.MergeInplace(
   *   { 'Accept': 'text/html' },
   *   new Headers({ 'Authorization': 'Bearer token' })
   * );
   *
   * // headers now contains all three headers
   * ```
   */
  MergeInplace(...other: CoercedHeadersInit[]): HttpHeader {
    for (const h of other.map((h) => HttpHeader.coerce(h))) {
      for (const [key, values] of h.Items()) {
        this.Add(key, values);
      }
    }
    return this;
  }

  /**
   * Merges other headers, returning a new instance.
   *
   * Creates a clone of this instance and merges the provided headers into it.
   * The original instance remains unchanged.
   *
   * @param other - One or more header sources to merge
   * @returns New HttpHeader with merged headers
   *
   * @example
   * ```typescript
   * const headers1 = new HttpHeader();
   * headers1.Add('Content-Type', 'application/json');
   *
   * const headers2 = headers1.Merge({ 'Accept': 'text/html' });
   *
   * // headers1 is unchanged
   * headers1.Get('Accept'); // undefined
   * headers2.Get('Accept'); // 'text/html'
   * ```
   */
  Merge(...other: CoercedHeadersInit[]): HttpHeader {
    return this.Clone().MergeInplace(...other);
  }
}
