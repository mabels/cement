import { exception2Result, Result } from "./result.js";
import { StripCommand, stripper } from "./utils/stripper.js";

type NullOrUndef = null | undefined;

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

function ensureURLWithDefaultProto(url: string | URL, defaultProtocol: string): MutableURL {
  if (!url) {
    return new MutableURL(`${defaultProtocol}//`);
  }
  if (typeof url === "string") {
    try {
      return new MutableURL(url);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return new MutableURL(`${defaultProtocol}//${url}`);
    }
  } else {
    return new MutableURL(url.toString());
  }
}

export function isURL(value: unknown): value is URL {
  return (
    value instanceof URL ||
    (!!value &&
      typeof (value as URL).searchParams === "object" &&
      typeof (value as URL).searchParams.sort === "function" &&
      typeof (value as URL).hash === "string")
  );
}

// due to that the System URL class is has a strange behavior
// on different platforms, we need to implement our own URL class
export class MutableURL extends URL {
  private readonly _sysURL: URL;
  // private readonly _urlStr: string;

  private _protocol: string;
  private _pathname: string;
  private _hasHostpart: boolean;

  readonly hash: string;

  constructor(urlStr: string) {
    super("defect://does.not.exist");
    const partedURL = urlStr.split(":");
    this._hasHostpart = hasHostPartProtocols.has(partedURL[0]);
    let hostPartUrl = ["http", ...partedURL.slice(1)].join(":");
    if (!this._hasHostpart) {
      const pathname = hostPartUrl.replace(/http:\/\/[/]*/, "").replace(/[#?].*$/, "");
      hostPartUrl = hostPartUrl.replace(/http:\/\//, `http://localhost/${pathname}`);
    }
    try {
      this._sysURL = new URL(hostPartUrl);
    } catch (ie) {
      const e = ie as Error;
      e.message = `${e.message} for URL: ${urlStr}`;
      throw e;
    }
    this._protocol = `${partedURL[0]}:`; // this._sysURL.protocol.replace(new RegExp("^cement-"), "");
    if (this._hasHostpart) {
      this._pathname = this._sysURL.pathname;
    } else {
      this._pathname = urlStr.replace(new RegExp(`^${this._protocol}//`), "").replace(/[#?].*$/, "");
    }
    this.hash = this._sysURL.hash;
  }

  clone(): MutableURL {
    return new MutableURL(this.toString());
  }

  get host(): string {
    if (!this._hasHostpart) {
      throw new Error(
        `you can use hostname only if protocol is ${this.toString()} ${JSON.stringify(Array.from(hasHostPartProtocols.keys()))}`,
      );
    }
    return this._sysURL.host;
  }

  get port(): string {
    if (!this._hasHostpart) {
      throw new Error(`you can use hostname only if protocol is ${JSON.stringify(Array.from(hasHostPartProtocols.keys()))}`);
    }
    return this._sysURL.port;
  }

  set port(p: string) {
    if (!this._hasHostpart) {
      throw new Error(`you can use port only if protocol is ${JSON.stringify(Array.from(hasHostPartProtocols.keys()))}`);
    }
    this._sysURL.port = p;
  }

  get hostname(): string {
    if (!this._hasHostpart) {
      throw new Error(`you can use hostname only if protocol is ${JSON.stringify(Array.from(hasHostPartProtocols.keys()))}`);
    }
    return this._sysURL.hostname;
  }

  set hostname(h: string) {
    if (!this._hasHostpart) {
      throw new Error(`you can use hostname only if protocol is ${JSON.stringify(Array.from(hasHostPartProtocols.keys()))}`);
    }
    this._sysURL.hostname = h;
  }

  set pathname(p: string) {
    this._pathname = p;
  }

  get pathname(): string {
    return this._pathname;
  }

  get protocol(): string {
    return this._protocol;
  }

  set protocol(p: string) {
    if (!p.endsWith(":")) {
      p = `${p}:`;
    }
    this._protocol = p;
  }

  get searchParams(): URLSearchParams {
    return this._sysURL.searchParams;
  }

  toString(): string {
    let search = "";
    if (this._sysURL.searchParams.size) {
      for (const [key, value] of Array.from(this._sysURL.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        search += `${!search.length ? "?" : "&"}${key}=${encodeURIComponent(value)}`;
      }
    }
    let hostpart = "";
    if (this._hasHostpart) {
      hostpart = this._sysURL.hostname;
      if (this._sysURL.port) {
        hostpart += `:${this._sysURL.port}`;
      }
      if (!this._pathname.startsWith("/")) {
        hostpart += "/";
      }
    }
    return `${this._protocol}//${hostpart}${this._pathname}${search}`;
  }
}

function from<T>(fac: (url: MutableURL) => T, strURLUri: CoerceURI | undefined, defaultProtocol: string): T {
  switch (typeof falsy2undef(strURLUri)) {
    case "undefined":
      return fac(new MutableURL(`${defaultProtocol}///`));
    case "string":
      return fac(ensureURLWithDefaultProto(strURLUri as string, defaultProtocol));
    case "object":
      if (BuildURI.is(strURLUri)) {
        return fac(new MutableURL(strURLUri._url.toString()));
      } else if (URI.is(strURLUri)) {
        return fac(new MutableURL(strURLUri._url.toString()));
      } else if (isURL(strURLUri)) {
        return fac(new MutableURL(strURLUri.toString()));
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

type keysParam = (string | ((...keys: string[]) => string))[];

function getParamsResult(
  keys: keysParam,
  getParam: { getParam: (key: string) => string | undefined },
): Result<Record<string, string>> {
  const keyStrs = keys.flat().filter((k) => typeof k === "string");
  const msgFn =
    keys.find((k) => typeof k === "function") ||
    ((...keys: string[]): string => {
      const msg = keys.join(",");
      return `missing parameters: ${msg}`;
    });
  const errors: string[] = [];
  const result: Record<string, string> = {};
  for (const key of keyStrs) {
    const val = getParam.getParam(key);
    if (val === undefined) {
      errors.push(key);
    } else {
      result[key] = val;
    }
  }
  if (errors.length) {
    return Result.Err(msgFn(...errors));
  }
  return Result.Ok(result);
}

export class BuildURI {
  _url: MutableURL; // pathname needs this
  private constructor(url: MutableURL) {
    this._url = url;
  }

  static is(value: unknown): value is BuildURI {
    return (
      value instanceof BuildURI ||
      (!!value && typeof (value as BuildURI).delParam === "function" && typeof (value as BuildURI).setParam === "function")
    );
  }
  static from(strURLUri?: CoerceURI, defaultProtocol = "file:"): BuildURI {
    return from((url) => new BuildURI(url), strURLUri, defaultProtocol);
  }

  port(p: string): BuildURI {
    this._url.port = p;
    return this;
  }

  hostname(h: string): BuildURI {
    this._url.hostname = h;
    return this;
  }

  // password(p: string) {
  //   this._url.password = p;
  //   return this;
  // }

  // port(p: string) {
  //   this._url.port = p;
  //   return this;
  // }

  // username(u: string) {
  //   this._url.username = u;
  //   return this;
  // }

  // search(s: string) {
  //   this._url.search = s;
  //   return this;
  // }

  protocol(p: string): BuildURI {
    this._url.protocol = p;
    // if (!p.endsWith(":")) {
    //   p = `${p}:`;
    // }
    // const mySrc = this._url.toString();
    // const myDst = mySrc.replace(new RegExp(`^${this._url.protocol}`), `${p}`);
    // this._url = new URL(myDst);
    return this;
  }

  pathname(p: string): BuildURI {
    // const myp = this.URI().pathname;
    // const mySrc = this._url.toString();
    // const myDst = mySrc.replace(new RegExp(`^${this._url.protocol}//${myp}`), `${this._url.protocol}//${p}`);
    // this._url = new URL(myDst);
    this._url.pathname = p;
    return this;
  }

  // hash(h: string) {
  //   this._url.hash = h;
  //   return this;
  // }

  // host(h: string) {
  //   this._url.host = h;
  //   return this;
  // }

  appendRelative(p: CoerceURI): BuildURI {
    const appendUrl = URI.from(p);
    let pathname = appendUrl.pathname;
    let basePath = this._url.pathname;
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
    if (pathname.startsWith("/")) {
      pathname = pathname.replace(/^\//, "");
    }
    if (basePath.length > 0) {
      basePath = basePath.replace(/\/$/, "");
    }
    this.pathname(basePath + "/" + pathname);
    for (const [key, value] of appendUrl.getParams) {
      this.setParam(key, value);
    }
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

  getParam(key: string): string | undefined {
    return falsy2undef(this._url.searchParams.get(key));
  }

  getParamResult(key: string, msgFn?: (key: string) => string): Result<string> {
    return getParamResult(key, this.getParam(key), msgFn);
  }

  getParamsResult(...keys: keysParam): Result<Record<string, string>> {
    return getParamsResult(keys, this);
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

  asObj(...strips: StripCommand[]): HostURIObject | PathURIObject {
    return this.URI().asObj(...strips);
  }

  URI(): URI {
    return URI.from(this._url);
  }
}

export type CoerceURI = string | URI | MutableURL | URL | BuildURI | NullOrUndef;

export const hasHostPartProtocols: Set<string> = new Set<string>(["http", "https", "ws", "wss"]);

// non mutable URL Implementation
export class URI {
  static protocolHasHostpart(protocol: string): () => void {
    protocol = protocol.replace(/:$/, "");
    hasHostPartProtocols.add(protocol);
    return () => {
      hasHostPartProtocols.delete(protocol);
    };
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
    return from((url) => new URI(url), strURLUri, defaultProtocol);
  }

  static fromResult(strURLUri?: CoerceURI, defaultProtocol = "file:"): Result<URI> {
    return exception2Result(() => from((url) => new URI(url), strURLUri, defaultProtocol)) as Result<URI>;
  }

  readonly _url: MutableURL;
  private constructor(url: MutableURL) {
    this._url = url.clone();
  }

  build(): BuildURI {
    return BuildURI.from(this._url);
  }

  get hostname(): string {
    return this._url.hostname;
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

  // get search(): string {
  //   return this._url.search;
  // }

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

  // get hash(): string {
  //   return this._url.hash;
  // }

  // get host(): string {
  //   return this._url.host;
  // }

  get getParams(): Iterable<[string, string]> {
    return this._url.searchParams.entries();
  }

  hasParam(key: string): boolean {
    return this._url.searchParams.has(key);
  }
  getParam(key: string): string | undefined {
    return falsy2undef(this._url.searchParams.get(key));
  }

  getParamResult(key: string, msgFn?: (key: string) => string): Result<string> {
    return getParamResult(key, this.getParam(key), msgFn);
  }

  getParamsResult(...keys: keysParam): Result<Record<string, string>> {
    return getParamsResult(keys, this);
  }

  clone(): URI {
    return new URI(this._url);
  }

  asURL(): URL {
    // const url = new URL(this._url.toString());
    // url.searchParams.sort();
    return this._url.clone() as unknown as URL;
  }

  toString(): string {
    // this._url.searchParams.sort();
    return this._url.toString();
  }
  toJSON(): string {
    return this.toString();
  }
  asObj(...strips: StripCommand[]): HostURIObject | PathURIObject {
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
      }) as HostURIObject;
    }
    return stripper(strips, pathURI) as PathURIObject;
  }
}
