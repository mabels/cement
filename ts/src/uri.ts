import type { DeepWritable } from "ts-essentials";
import { exception2Result, Result } from "./result.js";
import { ReadonlyURL, URLSearchParamsEntries, WritableURL } from "./mutable-url.js";
import { KeyedResolvOnce } from "./resolve-once.js";
import { KeysParam, getParamsResult, hasHostPartProtocols } from "./index.js";
import { relativePath } from "./utils/relative-path.js";
import { StripCommand, stripper } from "./utils/stripper.js";
// import { param } from "./types.js";

type NullOrUndef = null | undefined;

type OneKey<K extends string, V = string> = Record<K, V>;

export interface IsURIResult {
  readonly isURI: boolean;
  readonly uri?: URI;
}

/*
  if KeyParam is a Object
     if the right side is a string, it is the default value
     if the right side is a !string | REQUIRED, it is required
*/

// type ReturnType<T extends (...args: KeysParam) => unknown> = T extends (...args: KeysParam) => infer R ? R : unknown;

// function fetchData<T extends (...args: any[]) => Promise<any>>(fn: T): ReturnType<T> {
//   return fn();
// }
// type ReturnObject<T extends KeysParam> = {
//   [K in keyof T]: string;
// };

export interface URIInterface<R extends URIInterface<R>> {
  readonly getParams: Iterable<[string, string]>;

  hasParam(key: string): boolean;
  getParam<T extends string | undefined>(key: string | OneKey<string>, def?: T): T extends string ? string : string | undefined;
  getParamResult(key: string, msgFn?: (key: string) => string): Result<string>;
  getParamsResult(...keys: KeysParam): Result<Record<string, string>>;
  match(other: CoerceURI): MatchResult;
  clone(): R;
  asURL(): URL;
  toString(): string;
  toJSON(): string;
  asObj(...strips: StripCommand[]): Partial<HostURIObject | PathURIObject>;
}

export interface MatchResult {
  readonly score: number;
  readonly protocol: boolean;
  readonly hostname: boolean;
  readonly port: boolean;
  readonly pathname: boolean;
  readonly pathParts: string[];
  readonly params: Record<string, string>;
}

function match(iref: CoerceURI, ioth: CoerceURI): MatchResult {
  const mr: DeepWritable<MatchResult> = {
    score: 0,
    protocol: false,
    hostname: false,
    port: false,
    pathname: false,
    pathParts: [],
    params: {},
  };
  const ref = URI.from(iref);
  const oth = URI.from(ioth);
  if (ref.protocol === oth.protocol) {
    mr.score += 1;
    mr.protocol = true;
  }
  try {
    const refH = ref.hostname;
    const refP = ref.port;
    if (refH === oth.hostname) {
      mr.score += 1;
      mr.hostname = true;
    }
    if (refP.length && refP === oth.port) {
      mr.score += 1;
      mr.port = true;
    }
  } catch (_e) {
    // ignore
  }
  if (ref.pathname.length && ref.pathname !== "/") {
    const pref = ref.pathname.split("/").filter((p) => p.length);
    const poth = oth.pathname.split("/").filter((p) => p.length);
    for (let i = 0; i < pref.length && i < poth.length; i++) {
      if (poth[i] === pref[i]) {
        mr.score += 1;
        mr.pathname = true;
        mr.pathParts.push(pref[i]);
      }
    }
  }
  for (const [key, value] of ref.getParams) {
    if (oth.getParam(key) === value) {
      mr.score += 1;
      mr.params[key] = value;
    }
  }
  return mr;
}

function coerceKey(key: string | OneKey<string>, def?: string): { key: string; def?: string } {
  if (typeof key === "object") {
    const keys = Object.keys(key);
    if (keys.length !== 1) {
      throw new Error(`Invalid key: ${JSON.stringify(key)}`);
    }
    return { key: keys[0], def: key[keys[0]] };
  }
  return { key, def: def };
}

function resolveHash(hash: string): { getParam: (k: string) => string | undefined } {
  const searchParams = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    getParam: (k): string | undefined => {
      const ret = searchParams.get(k);
      return ret === null ? undefined : ret;
    },
  };
}

export interface URIObject {
  readonly style: "host" | "path";
  readonly protocol: string;
  readonly pathname: string;
  readonly searchParams: Record<string, string>;
}

export interface PathURIObject extends URIObject {
  readonly style: "path";
}

export interface HostURIObject extends URIObject {
  readonly style: "host";
  readonly hostname: string;
  readonly port: string;
}

function falsy2undef<T>(value: T | NullOrUndef): T | undefined {
  return value === undefined || value === null ? undefined : value;
}

function ensureURLWithDefaultProto<T>(
  url: string | URL,
  defaultProtocol: string,
  action: {
    fromThrow: (urlStr: string) => T;
  },
): T {
  if (!url) {
    return action.fromThrow(`${defaultProtocol}//`);
  }
  if (typeof url === "string") {
    try {
      return action.fromThrow(url);
    } catch (_e) {
      return action.fromThrow(`${defaultProtocol}//${url}`);
    }
  } else {
    return action.fromThrow(url.toString());
  }
}

/**
 * Type guard to check if a value is a URL object.
 *
 * Checks both for instanceof URL and for objects with URL-like properties
 * (searchParams object with sort method, hash string), allowing it to work
 * with URL objects from different execution contexts.
 *
 * @param value - The value to check
 * @returns True if the value is a URL or URL-like object
 *
 * @example
 * ```typescript
 * const value: unknown = new URL('https://example.com');
 * if (isURL(value)) {
 *   console.log(value.hostname); // "example.com"
 * }
 * ```
 */
export function isURL(value: unknown): value is URL {
  return (
    value instanceof URL ||
    (!!value &&
      typeof (value as URL).searchParams === "object" &&
      typeof (value as URL).searchParams.sort === "function" &&
      typeof (value as URL).hash === "string")
  );
}

function from<R, T extends ReadonlyURL | WritableURL>(
  fac: (url: T) => R,
  strURLUri: CoerceURI | undefined,
  defaultProtocol: string,
  action: {
    fromThrow: (urlStr: string) => T;
  },
): R {
  switch (typeof falsy2undef(strURLUri)) {
    case "undefined":
      return fac(action.fromThrow(`${defaultProtocol}///`));
    case "string":
      return fac(ensureURLWithDefaultProto(strURLUri as string, defaultProtocol, action));
    case "object":
      if (BuildURI.is(strURLUri)) {
        return fac(action.fromThrow(strURLUri._url.toString()));
      } else if (URI.is(strURLUri)) {
        return fac(action.fromThrow(strURLUri._url.toString()));
      } else if (isURL(strURLUri)) {
        return fac(action.fromThrow(strURLUri.toString()));
      }
      throw new Error(`unknown object type: ${strURLUri}`);
    default:
      throw new Error(`Invalid argument: ${typeof strURLUri}`);
  }
}

function getParamResult(
  key: string,
  val: string | undefined,
  msgFn: (key: string) => string = (key) => {
    return `missing parameter: ${key}`;
  },
): Result<string> {
  if (val === undefined) {
    return Result.Err(msgFn(key));
  }
  return Result.Ok(val);
}

function setParams(
  src: string,
  val: Record<string, string | number | boolean | Date | null | undefined>,
  mode: "reset" | "merge" = "reset",
  out: URLSearchParams = new URLSearchParams(""),
): string {
  let preset: Record<string, string>;
  switch (mode) {
    case "reset":
      preset = {};
      break;
    case "merge":
    default:
      preset = Object.fromEntries(URLSearchParamsEntries(new URLSearchParams(src)));
      break;
  }
  // const out = new URLSearchParams("");
  for (const [key, value] of Object.entries({ ...preset, ...val }).sort((a, b) => a[0].localeCompare(b[0]))) {
    switch (typeof value) {
      case "string":
        out.set(key, value);
        break;
      case "number":
        out.set(key, value.toString());
        break;
      case "boolean":
        out.set(key, value ? "true" : "false");
        break;
      default:
        if (value instanceof Date) {
          out.set(key, value.toISOString());
        } else {
          // eslint-disable-next-line no-console
          console.error(`unsupported type: ${typeof value} ignore key: ${key}`);
        }
        break;
    }
  }
  return out.toString();
}

/**
 * Mutable builder for constructing and manipulating URIs.
 *
 * BuildURI provides a fluent API for constructing URIs by chaining method calls.
 * Unlike URI, BuildURI is mutable and allows modification of all URI components
 * (protocol, hostname, port, pathname, search params, hash).
 *
 * @example
 * ```typescript
 * const uri = BuildURI.from('https://example.com')
 *   .pathname('/api/users')
 *   .setParam('page', '1')
 *   .setParam('limit', '10')
 *   .toString();
 * // Result: "https://example.com/api/users?limit=10&page=1"
 *
 * // Building from scratch
 * const uri2 = BuildURI.from()
 *   .protocol('https')
 *   .hostname('api.example.com')
 *   .port('8080')
 *   .pathname('/v1/data')
 *   .URI(); // Convert to immutable URI
 * ```
 */
export class BuildURI implements URIInterface<BuildURI> {
  _url: WritableURL; // pathname needs this
  private constructor(url: WritableURL) {
    this._url = url;
  }

  static is(value: unknown): value is BuildURI {
    return (
      value instanceof BuildURI ||
      (!!value && typeof (value as BuildURI).delParam === "function" && typeof (value as BuildURI).setParam === "function")
    );
  }
  static from(strURLUri?: CoerceURI, defaultProtocol = "file:"): BuildURI {
    return from((url) => new BuildURI(url), strURLUri, defaultProtocol, { fromThrow: WritableURL.fromThrow });
  }

  match(other: CoerceURI): MatchResult {
    return match(this.URI(), URI.from(other));
  }

  port(p: string): BuildURI {
    this._url.port = p;
    return this;
  }

  hostname(h: string): BuildURI {
    this._url.hostname = h;
    return this;
  }

  protocol(p: string): BuildURI {
    if (!p.endsWith(":")) {
      p = `${p}:`;
    }
    this._url.protocol = p;
    return this;
  }

  pathname(p: string): BuildURI {
    this._url.pathname = p;
    return this;
  }

  hash(h: string): BuildURI {
    this._url.hash = h;
    return this;
  }

  // could pass a relative path or a full URL
  // if relative path, it will be appended to the current path
  resolve(p: CoerceURI): BuildURI {
    if (!p) {
      return this;
    }
    if (typeof p === "string") {
      // relative path
      if (!p.match(/^[a-zA-Z0-9]+:/)) {
        if (p.startsWith("/")) {
          this.pathname(p);
          return this;
        }
        return this.appendRelative(p);
      }
    }
    this._url = WritableURL.fromThrow(p.toString());
    return this;
  }

  appendRelative(p: CoerceURI): BuildURI {
    const appendUrl = URI.from(p);
    const pathname = "./" + appendUrl.pathname;
    const basePath = this._url.pathname;
    /*
     * cases
     *  pathname "" basePAth "" -> ""
     *  pathname "/" basePath "" -> "/"
     *  pathname "" basePath "/" -> "/"
     *  pathname "/" basePath "/" -> "/"
     *  pathname "ab" basePath "" -> "/ab"
     *  pathname "ab" basePath "/" -> "/ab"
     *  pathname "ab" basePath "/ab/" -> "/ab/ab"
     *  pathname "/ab/" basePath "/ab/" -> "/ab/ab/"
     */
    this.pathname(relativePath(basePath, pathname));
    // if (pathname.startsWith("/")) {
    //   pathname = pathname.replace(/^\//, "");
    // }
    // if (basePath.length > 0) {
    //   basePath = basePath.replace(/\/$/, "");
    // }
    // this.pathname(basePath + "/" + pathname);
    for (const [key, value] of appendUrl.getParams) {
      this.setParam(key, value);
    }
    return this;
  }

  cleanParams(...remove: (string | string[])[]): BuildURI {
    const keys = new Set(remove.flat());
    for (const [key] of Array.from(URLSearchParamsEntries(this._url.searchParams))) {
      if (keys.size === 0 || keys.has(key)) {
        this._url.searchParams.delete(key);
      }
    }
    return this;
  }

  searchParams(
    val: Record<string, string | number | boolean | Date | null | undefined>,
    mode: "reset" | "merge" = "reset",
  ): BuildURI {
    // this._url.searchParams = setParams(this._url.hash.replace(/^#/, ''), val, mode);
    setParams(this._url.search, val, mode, this._url.searchParams);
    return this;
  }

  hashParams(
    val: Record<string, string | number | boolean | Date | null | undefined>,
    mode: "reset" | "merge" = "reset",
  ): BuildURI {
    this._url.hash = setParams(this._url.hash.replace(/^#/, ""), val, mode);
    return this;
  }

  delParam(key: string): BuildURI {
    this._url.searchParams.delete(key);
    return this;
  }

  defParam(key: string, str: string): BuildURI {
    if (!this._url.searchParams.has(key)) {
      this._url.searchParams.set(key, str);
    }
    return this;
  }

  setParam(key: string, str: string): BuildURI {
    this._url.searchParams.set(key, str);
    return this;
  }

  hasParam(key: string): boolean {
    return this._url.searchParams.has(key);
  }

  get getParams(): Iterable<[string, string]> {
    return URLSearchParamsEntries(this._url.searchParams);
  }

  getParam<T extends string | undefined>(key: string | OneKey<string>, def?: T): T extends string ? string : string | undefined {
    const { key: k, def: d } = coerceKey(key, def);
    let val = this._url.searchParams.get(k);
    if (!falsy2undef(val) && d) {
      val = d;
    }
    return falsy2undef(val) as T extends string ? string : string | undefined;
  }

  getParamResult(key: string, msgFn?: (key: string) => string): Result<string> {
    return getParamResult(key, this.getParam(key), msgFn);
  }

  getParamsResult(...keys: KeysParam): Result<Record<string, string>> {
    return getParamsResult(keys, this);
  }

  getHashParams(...keys: KeysParam): Result<Record<string, string>> {
    return getParamsResult(keys, resolveHash(this._url.hash));
  }

  toString(): string {
    this._url.searchParams.sort();
    return this._url.toString();
  }
  toJSON(): string {
    return this.toString();
  }

  asURL(): URL {
    return this.URI().asURL();
  }

  asObj(...strips: StripCommand[]): Partial<HostURIObject | PathURIObject> {
    return this.URI().asObj(...strips);
  }

  clone(): BuildURI {
    return BuildURI.from(this.toString());
  }

  get onlyHostAndSchema(): string {
    return this.clone().pathname("").cleanParams().hash("").toString();
  }

  get withoutHostAndSchema(): string {
    return this._url.pathname + this._url.search + this._url.hash;
  }

  URI(): URI {
    return URI.from(this._url);
  }
}

export type CoerceURI = string | URI | ReadonlyURL | WritableURL | URL | BuildURI | NullOrUndef;

export function isCoerceURI(value: unknown): value is CoerceURI {
  if (!value) {
    return false;
  }
  if (isURL(value)) {
    // includes MutableURL
    return true;
  }
  if (URI.is(value)) {
    return true;
  }
  if (BuildURI.is(value)) {
    return true;
  }
  if (typeof value === "string") {
    return true;
  }
  return false;
}

const uriInstances = new KeyedResolvOnce<URI>({
  lru: { maxEntries: 1000 },
});

/**
 * Immutable URI representation with type-safe parameter handling.
 *
 * URI provides a read-only view of a URL with convenient methods for accessing
 * components and query parameters. All URI instances are cached for performance.
 * Use BuildURI for mutable construction and URI for immutable references.
 *
 * @example
 * ```typescript
 * const uri = URI.from('https://example.com/path?key=value&foo=bar');
 *
 * // Access components
 * console.log(uri.protocol);  // "https:"
 * console.log(uri.hostname);  // "example.com"
 * console.log(uri.pathname);  // "/path"
 *
 * // Query parameters
 * const key = uri.getParam('key');  // "value"
 * const missing = uri.getParam('missing', 'default');  // "default"
 *
 * // Type-safe parameter extraction with Result
 * const result = uri.getParamsResult('key', 'foo');
 * if (result.isOk()) {
 *   const { key, foo } = result.unwrap();
 * }
 *
 * // Build a modified version
 * const modified = uri.build()
 *   .setParam('new', 'param')
 *   .URI();
 * ```
 */
export class URI implements URIInterface<URI> {
  static protocolHasHostpart(protocol: string): () => void {
    protocol = protocol.replace(/:$/, "");
    hasHostPartProtocols.add(protocol);
    return () => {
      hasHostPartProtocols.delete(protocol);
    };
  }

  match(other: CoerceURI): MatchResult {
    return match(this, other);
  }

  // if no protocol is provided, default to file:
  static merge(into: CoerceURI, from: CoerceURI, defaultProtocol = "file:"): URI {
    const intoUrl = BuildURI.from(into, defaultProtocol);
    const fromUrl = URI.from(from, defaultProtocol);

    intoUrl.protocol(fromUrl.protocol);
    const fPath = fromUrl.pathname;
    if (!(fPath.length === 0 || fPath === "/" || fPath === "./")) {
      intoUrl.pathname(fromUrl.pathname);
    }
    for (const [key, value] of fromUrl.getParams) {
      intoUrl.setParam(key, value);
    }
    return intoUrl.URI();
  }

  static is(value: unknown): value is URI {
    return (
      value instanceof URI ||
      (!!value &&
        typeof (value as URI).asURL === "function" &&
        typeof (value as URI).getParam === "function" &&
        typeof (value as URI).hasParam === "function")
    );
  }

  // if no protocol is provided, default to file:
  static from(strURLUri?: CoerceURI, defaultProtocol = "file:"): URI {
    // this is not optimal, but it is a start
    // the problem is that from creates ReadonlyURLs which we then use to sort
    // the params and render as string --> this instance is only shortlived but
    // it's some extra cost.
    return from((url) => uriInstances.get(url.toString()).once(() => new URI(url)), strURLUri, defaultProtocol, {
      fromThrow: ReadonlyURL.fromThrow,
    });
  }

  static fromResult(strURLUri?: CoerceURI, defaultProtocol = "file:"): Result<URI> {
    return exception2Result(() =>
      from((url) => uriInstances.get(url.toString()).once(() => new URI(url)), strURLUri, defaultProtocol, {
        fromThrow: ReadonlyURL.fromThrow,
      }),
    ); //as Result<URI>;
  }

  readonly _url: ReadonlyURL;
  private constructor(url: ReadonlyURL) {
    this._url = url.clone();
  }

  build(): BuildURI {
    return BuildURI.from(this._url);
  }

  get hostname(): string {
    return this._url.hostname;
  }

  get onlyHostAndSchema(): string {
    return this.build().pathname("").cleanParams().hash("").toString();
  }

  get withoutHostAndSchema(): string {
    return this._url.pathname + this._url.search + this._url.hash;
  }

  // get password(): string {
  //   return this._url.password;
  // }

  get port(): string {
    return this._url.port;
  }

  get host(): string {
    return this._url.host;
  }

  // get username(): string {
  //   return this._url.username;
  // }

  get search(): string {
    return this._url.search;
  }

  get protocol(): string {
    return this._url.protocol;
  }

  get pathname(): string {
    return this._url.pathname;
    // return this._url
    //   .toString()
    //   .replace(/^.*:\/\//, "")
    //   .replace(/\?.*$/, "");
  }

  get hash(): string {
    return this._url.hash;
  }

  // get host(): string {
  //   return this._url.host;
  // }

  get getParams(): Iterable<[string, string]> {
    return URLSearchParamsEntries(this._url.searchParams);
  }

  get getHashes(): Iterable<[string, string]> {
    return URLSearchParamsEntries(new URLSearchParams(this._url.hash.slice("#".length)));
  }

  hasParam(key: string): boolean {
    return this._url.searchParams.has(key);
  }

  getParam<T extends string | undefined>(key: string | OneKey<string>, def?: T): T extends string ? string : string | undefined {
    const { key: k, def: d } = coerceKey(key, def);
    let val = this._url.searchParams.get(k);
    if (!falsy2undef(val) && d) {
      val = d;
    }
    return falsy2undef(val) as T extends string ? string : string | undefined;
  }

  getParamResult(key: string, msgFn?: (key: string) => string): Result<string> {
    return getParamResult(key, this.getParam(key), msgFn);
  }

  getParamsResult(...keys: KeysParam): Result<Record<string, string>> {
    return getParamsResult(keys, this);
  }

  getHashParams(...keys: KeysParam): Result<Record<string, string>> {
    return getParamsResult(keys, resolveHash(this._url.hash));
  }

  clone(): URI {
    return new URI(this._url);
  }

  asURL(): URL {
    // const url = new URL(this._url.toString());
    // url.searchParams.sort();
    return this._url.clone(); // as unknown as URL;
  }

  toString(): string {
    // this._url.searchParams.sort();
    return this._url.toString();
  }
  toJSON(): string {
    return this.toString();
  }
  asObj(...strips: StripCommand[]): Partial<HostURIObject | PathURIObject> {
    const pathURI: PathURIObject = {
      style: "path",
      protocol: this.protocol,
      pathname: this.pathname,
      searchParams: Object.fromEntries(this.getParams),
    };
    if (hasHostPartProtocols.has(this.protocol.replace(/:$/, ""))) {
      return stripper(strips, {
        ...pathURI,
        style: "host",
        hostname: this.hostname,
        port: this.port,
      }) as Partial<HostURIObject>;
    }
    return stripper(strips, pathURI) as Partial<PathURIObject>;
  }
}
