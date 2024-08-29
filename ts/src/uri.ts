type NullOrUndef = null | undefined;

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
    this._hasHostpart = ["http", "https"].includes(urlStr.split(":")[0]);
    const prefix = this._hasHostpart ? "" : "cement-";
    try {
      this._sysURL = new URL(prefix + urlStr);
    } catch (ie) {
      const e = ie as Error;
      e.message = `${e.message} for URL: ${urlStr}`;
      throw e;
    }
    this._protocol = this._sysURL.protocol.replace(new RegExp("^cement-"), "");
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

  get hostname(): string {
    if (!this._hasHostpart) {
      throw new Error("you can use hostname only if protocol is http or https");
    }
    return this._sysURL.hostname;
  }

  set hostname(h: string) {
    if (!this._hasHostpart) {
      throw new Error("you can use hostname only if protocol is http or https");
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

  hostname(h: string) {
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

  protocol(p: string) {
    this._url.protocol = p;
    // if (!p.endsWith(":")) {
    //   p = `${p}:`;
    // }
    // const mySrc = this._url.toString();
    // const myDst = mySrc.replace(new RegExp(`^${this._url.protocol}`), `${p}`);
    // this._url = new URL(myDst);
    return this;
  }

  pathname(p: string) {
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

  delParam(key: string) {
    this._url.searchParams.delete(key);
    return this;
  }

  defParam(key: string, str: string) {
    if (!this._url.searchParams.has(key)) {
      this._url.searchParams.set(key, str);
    }
    return this;
  }

  setParam(key: string, str: string) {
    this._url.searchParams.set(key, str);
    return this;
  }

  toString(): string {
    this._url.searchParams.sort();
    return this._url.toString();
  }
  toJSON(): string {
    return this.toString();
  }

  URI(): URI {
    return URI.from(this._url);
  }
}

export type CoerceURI = string | URI | MutableURL | URL | BuildURI | NullOrUndef;

// non mutable URL Implementation
export class URI {
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

  // get port(): string {
  //   return this._url.port;
  // }

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
    return this._url
      .toString()
      .replace(/^.*:\/\//, "")
      .replace(/\?.*$/, "");
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
}
