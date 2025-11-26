import { exception2Result, Result } from "./result.js";
import { hasHostPartProtocols } from "./types.js";

// due to that the System URL class is has a strange behavior
// on different platforms, we need to implement our own URL class
const customInspectSymbol = Symbol.for("nodejs.util.inspect.custom");

const urlRegex = /^([a-z][a-z0-9_-]*):\/\/[^:]*$/i;

// there are deno which does not have URLSearchParams.entries() in types
export function* URLSearchParamsEntries(src: URLSearchParams): IterableIterator<[string, string]> {
  const entries: [string, string][] = [];
  src.forEach((v, k) => {
    entries.push([k, v]);
  });
  for (const [key, value] of entries) {
    yield [key, value];
  }
}

export class ReadonlyURL extends URL {
  protected readonly _sysURL: URL;
  // private readonly _urlStr: string;

  protected _protocol: string;
  protected _pathname: string;
  protected _hasHostpart: boolean;

  static readonly fromThrow = (urlStr: string): ReadonlyURL => {
    return new ReadonlyURL(urlStr);
  };

  static from(urlStr: string): Result<ReadonlyURL> {
    if (urlRegex.test(urlStr)) {
      return exception2Result(() => new ReadonlyURL(urlStr));
    }
    return Result.Err(`Invalid URL: ${urlStr}`);
  }

  protected constructor(urlStr: string) {
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
    // this.hash = this._sysURL.hash;
  }

  override set origin(h: string) {
    throw new Error("origin is readonly");
  }

  override get href(): string {
    return this.toString();
  }

  override set href(h: string) {
    throw new Error("href is readonly");
  }

  override get password(): string {
    return this._sysURL.password;
  }

  override set password(h: string) {
    throw new Error("password is readonly");
  }

  override get username(): string {
    return this._sysURL.username;
  }

  override set username(h: string) {
    throw new Error("username is readonly");
  }

  override toJSON(): string {
    return this.toString();
  }

  [customInspectSymbol](): string {
    // make node inspect to show the URL and not crash if URI is not http/https/file
    return this.toString();
  }

  clone(): ReadonlyURL {
    return this;
  }

  // Hash getter and setter
  override get hash(): string {
    return this._sysURL.hash;
  }

  override set hash(h: string) {
    throw new Error("hash is readonly");
  }

  // Host getter and setter
  override get host(): string {
    if (!this._hasHostpart) {
      throw new Error(
        `you can use hostname only if protocol is ${this.toString()} ${JSON.stringify(Array.from(hasHostPartProtocols.keys()))}`,
      );
    }
    return this._sysURL.host;
  }

  override set host(h: string) {
    throw new Error("host is readonly");
  }

  // Hostname getter and setter
  override get hostname(): string {
    if (!this._hasHostpart) {
      throw new Error(`you can use hostname only if protocol is ${JSON.stringify(Array.from(hasHostPartProtocols.keys()))}`);
    }
    return this._sysURL.hostname;
  }

  override set hostname(h: string) {
    throw new Error("hostname is readonly");
  }

  // Pathname getter and setter
  override get pathname(): string {
    return this._pathname;
  }

  override set pathname(h: string) {
    throw new Error("pathname is readonly");
  }

  // Port getter and setter
  override get port(): string {
    if (!this._hasHostpart) {
      throw new Error(`you can use hostname only if protocol is ${JSON.stringify(Array.from(hasHostPartProtocols.keys()))}`);
    }
    return this._sysURL.port;
  }

  override set port(h: string) {
    throw new Error("port is readonly");
  }

  // Protocol getter and setter
  override get protocol(): string {
    return this._protocol;
  }

  override set protocol(h: string) {
    throw new Error("protocol is readonly");
  }

  // Search getter and setter
  override get search(): string {
    let search = "";
    if (this._sysURL.searchParams.size) {
      for (const [key, value] of Array.from(URLSearchParamsEntries(this._sysURL.searchParams)).sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        search += `${!search.length ? "?" : "&"}${key}=${encodeURIComponent(value)}`;
      }
    }
    return search;
  }

  override set search(h: string) {
    throw new Error("search is readonly");
  }

  // SearchParams getter and setter
  override get searchParams(): URLSearchParams {
    return this._sysURL.searchParams;
  }

  override set searchParams(h: URLSearchParams) {
    throw new Error("searchParams is readonly");
  }

  override toString(): string {
    const search = this.search;
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
    if (this.username || this.password) {
      hostpart = `${this.username}:${this.password}@${hostpart}`;
    }
    return `${this._protocol}//${hostpart}${this._pathname}${search}${this.hash}`;
  }
}

export class WritableURL extends ReadonlyURL {
  // override readonly hash: string;

  static override readonly fromThrow = (urlStr: string): WritableURL => {
    return new WritableURL(urlStr);
  };

  static override from(urlStr: string): Result<WritableURL> {
    if (urlRegex.test(urlStr)) {
      return exception2Result(() => new WritableURL(urlStr));
    }
    return Result.Err(`Invalid URL: ${urlStr}`);
  }

  private constructor(urlStr: string) {
    super(urlStr);
  }

  override toJSON(): string {
    return this.toString();
  }

  override [customInspectSymbol](): string {
    // make node inspect to show the URL and not crash if URI is not http/https/file
    return this.toString();
  }

  override clone(): WritableURL {
    return new WritableURL(this.toString());
  }

  override set origin(_h: string) {
    throw new Error("don't use origin");
  }

  override get href(): string {
    return super.href;
  }

  override set href(h: string) {
    throw new Error("don't use href");
  }

  override get password(): string {
    return super.password;
  }

  override set password(h: string) {
    this._sysURL.password = h;
  }

  override get username(): string {
    return super.username;
  }

  override set username(h: string) {
    this._sysURL.username = h;
  }

  // Hash getter and setter
  override get hash(): string {
    return super.hash;
  }

  override set hash(h: string) {
    this._sysURL.hash = h;
  }

  // Host getter and setter
  override get host(): string {
    return super.host;
  }

  override set host(h: string) {
    this._sysURL.host = h;
  }

  // Hostname getter and setter
  override get hostname(): string {
    return super.hostname;
  }

  override set hostname(h: string) {
    if (!this._hasHostpart) {
      throw new Error(`you can use hostname only if protocol is ${JSON.stringify(Array.from(hasHostPartProtocols.keys()))}`);
    }
    this._sysURL.hostname = h;
  }

  // Pathname getter and setter
  override get pathname(): string {
    return super.pathname;
  }

  override set pathname(p: string) {
    this._pathname = p;
  }

  // Port getter and setter
  override get port(): string {
    return super.port;
  }

  override set port(p: string) {
    if (!this._hasHostpart) {
      throw new Error(`you can use port only if protocol is ${JSON.stringify(Array.from(hasHostPartProtocols.keys()))}`);
    }
    this._sysURL.port = p;
  }

  // Protocol getter and setter
  override get protocol(): string {
    return super.protocol;
  }

  override set protocol(p: string) {
    if (!p.endsWith(":")) {
      p = `${p}:`;
    }
    this._protocol = p;
  }

  // Search getter and setter
  override get search(): string {
    return super.search;
  }

  override set search(h: string) {
    this._sysURL.search = h;
  }

  // SearchParams getter and setter
  override get searchParams(): URLSearchParams {
    return super.searchParams;
  }

  override set searchParams(h: URLSearchParams) {
    const toDel = new Set<string>();
    for (const [key] of URLSearchParamsEntries(this._sysURL.searchParams)) {
      toDel.add(key);
    }
    for (const [key, value] of URLSearchParamsEntries(h)) {
      this._sysURL.searchParams.set(key, value);
      toDel.delete(key);
    }
    for (const key of toDel) {
      this._sysURL.searchParams.delete(key);
    }
  }
}
