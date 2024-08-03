type NullOrUndef = null | undefined;

function falsy2undef<T>(value: T | NullOrUndef): T | undefined {
  return value === undefined || value === null ? undefined : value;
}

function ensureURLWithDefaultProto(url: string | URL, defaultProtocol: string): URL {
  if (!url) {
    return new URL(`${defaultProtocol}//`);
  }
  if (typeof url === "string") {
    try {
      return new URL(url);
    } catch (e) {
      return new URL(`${defaultProtocol}//${url}`);
    }
  } else {
    return url;
  }
}

export class BuildURI {
  private _url: URL;
  constructor(url: URL) {
    this._url = url;
  }

  hostname(h: string) {
    this._url.hostname = h;
    return this;
  }

  password(p: string) {
    this._url.password = p;
    return this;
  }

  port(p: string) {
    this._url.port = p;
    return this;
  }

  username(u: string) {
    this._url.username = u;
    return this;
  }

  search(s: string) {
    this._url.search = s;
    return this;
  }

  protocol(p: string) {
    this._url.protocol = p;
    return this;
  }

  pathname(p: string) {
    this._url.pathname = p;
    return this;
  }

  hash(h: string) {
    this._url.hash = h;
    return this;
  }

  host(h: string) {
    this._url.host = h;
    return this;
  }

  delParam(key: string) {
    this._url.searchParams.delete(key);
    return this;
  }

  setParam(key: string, str: string) {
    this._url.searchParams.set(key, str);
    return this;
  }

  toString(): string {
    return this._url.toString();
  }

  build(): URI {
    return URI.from(this._url);
  }
}

// non mutable URL Implementation
export class URI {
  // if no protocol is provided, default to file:
  static from(strURLUri: string | URL | URI | NullOrUndef, defaultProtocol = "file:"): URI {
    switch (typeof falsy2undef(strURLUri)) {
      case "undefined":
        return new URI(new URL(`${defaultProtocol}//`));
      case "string":
        return new URI(ensureURLWithDefaultProto(strURLUri as string, defaultProtocol));
      case "object":
        if (strURLUri instanceof URI) {
          return new URI(new URL(strURLUri._url.toString()));
        } else if (strURLUri instanceof URL) {
          return new URI(new URL(strURLUri.toString()));
        }
        throw new Error(`unknown object type: ${strURLUri}`);
      default:
        throw new Error(`Invalid argument: ${typeof strURLUri}`);
    }
  }

  readonly _url: URL;
  private constructor(url: URL) {
    this._url = url;
  }

  build(): BuildURI {
    return new BuildURI(this.asURL());
  }

  get hostname(): string {
    return this._url.hostname;
  }

  get password(): string {
    return this._url.password;
  }

  get port(): string {
    return this._url.port;
  }

  get username(): string {
    return this._url.username;
  }

  get search(): string {
    return this._url.search;
  }

  get protocol(): string {
    return this._url.protocol;
  }

  get pathname(): string {
    return this._url
      .toString()
      .replace(/^.*:\/\//, "")
      .replace(/\?.*$/, "");
  }

  get hash(): string {
    return this._url.hash;
  }

  get host(): string {
    return this._url.host;
  }

  hasParam(key: string): boolean {
    return this._url.searchParams.has(key);
  }
  getParam(key: string): string | undefined {
    return falsy2undef(this._url.searchParams.get(key));
  }

  clone(): URI {
    return new URI(this.asURL());
  }

  asURL(): URL {
    const url = new URL(this._url.toString());
    url.searchParams.sort();
    return url;
  }

  toString(): string {
    return this._url.toString();
  }
}
