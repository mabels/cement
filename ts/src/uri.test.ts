import { ReadonlyURL, BuildURI, HostURIObject, PathURIObject, URI, isCoerceURI, param } from "@adviser/cement";
import { describe, beforeEach, it, expect, expectTypeOf } from "vitest";

describe("BuildURI", () => {
  let uri: BuildURI;
  beforeEach(() => {
    uri = BuildURI.from(ReadonlyURL.fromThrow("http://example.com"));
    uri.hostname("example");
    uri.setParam("key", "value");
  });

  it("toString", () => {
    expect(uri.toString()).toBe("http://example/?key=value");
  });

  it("build", () => {
    expect(uri.URI().toString()).toBe("http://example/?key=value");
  });

  it("defParam", () => {
    uri.defParam("key", "value2");
    uri.defParam("key2", "value2");
    expect(uri.toString()).toBe("http://example/?key=value&key2=value2");
  });

  it("searchParams sorted in toString", () => {
    uri.setParam("z", "value");
    uri.setParam("a", "value");
    uri.setParam("m", "value");
    expect(uri.toString()).toBe("http://example/?a=value&key=value&m=value&z=value");
  });
});

describe("URI", () => {
  // static from(strURLUri: string | URL | URI | NullOrUndef, defaultProtocol = "file:"): URI {
  it("from str with default", () => {
    const uri = URI.from("/example/wurst");
    expect(uri.toString()).toBe("file:///example/wurst");
  });
  // it("from str defect", () => {
  //   expect(URI.from("doof:meno")).toBe(null);
  // })
  it("from URL str", () => {
    expect(URI.from("bla://example/com?key=value").toString()).toBe("bla://example/com?key=value");
  });
  it("from URL", () => {
    expect(URI.from(ReadonlyURL.fromThrow("blix://example.com?key=value")).toString()).toBe("blix://example.com?key=value");
  });
  it("from URI", () => {
    expect(URI.from(URI.from("blix://example.com?key=value")).toString()).toBe("blix://example.com?key=value");
  });
  it("from undef", () => {
    expect(URI.from(null).toString()).toBe("file:///");
  });

  it("build", () => {
    expect(URI.from("blix://example.com?key=value").build().toString()).toBe("blix://example.com?key=value");
  });

  it("clone", () => {
    expect(URI.from("blix://example.com?key=value").clone().toString()).toBe("blix://example.com?key=value");
  });

  it("asURL", () => {
    expect(URI.from("blix://example.com?key=value").asURL().toString()).toBe("blix://example.com?key=value");
  });

  it("toString", () => {
    expect(URI.from("blix://example.com?key=value").toString()).toBe("blix://example.com?key=value");
  });

  it("searchParams sorted in toString", () => {
    expect(URI.from("blix://example.com?z=value&a=value&m=value").toString()).toBe("blix://example.com?a=value&m=value&z=value");
  });
  it("searchParams sorted in asURL", () => {
    expect(URI.from("blix://example.com?z=value&a=value&m=value").asURL().toString()).toBe(
      "blix://example.com?a=value&m=value&z=value",
    );
  });

  it("merge", () => {
    expect(URI.merge("blix://example.com?key=value&into=4", "murk://bla/com?key=from&z=value").toString()).toBe(
      "murk://bla/com?into=4&key=from&z=value",
    );
  });

  it("merge empty", () => {
    expect(URI.merge("blix://example/com?key=value&into=4", "murk://?key=from&z=value").toString()).toBe(
      "murk://example/com?into=4&key=from&z=value",
    );
  });

  it("firefox file relative into", () => {
    expect(URI.from("file://./dist/tests/key.bag").toString()).toBe("file://./dist/tests/key.bag");
  });

  it("from empty", () => {
    expect(URI.merge(`file://./dist/tests/key.bag`, "").toString()).toBe("file://./dist/tests/key.bag");
  });

  it("merge thing about", () => {
    const result = URI.merge("./dist/what?byKey=4444", "murk://bla.com?key=from&z=value");
    expect(result.toString()).toBe("murk://bla.com?byKey=4444&key=from&z=value");
  });

  it("isURI real", () => {
    expect(URI.is(URI.from())).toBe(true);
  });
  it("isURI fake", () => {
    expect(
      URI.is({
        asURL: () => new URL("http://example.com"),
        hasParam: () => false,
        getParam: () => "",
      }),
    ).toBe(true);
  });

  it("safari has a different pathname behavior", () => {
    // chrome -> new URL("indexdb://fp/?name=test&store=meta").pathname -> //fp/
    // safari -> new URL("indexdb://fp/?name=test&store=meta").pathname -> /
    const uri = URI.from("indexdb://fp/?name=test&store=meta");
    expect(uri.pathname).toBe("fp/");
  });

  it("passing URL to fetch", async () => {
    const uri = URI.from("https://jsonplaceholder.typicode.com/todos/1");
    const res = await fetch(uri.asURL());
    expect(res.status).toBeGreaterThan(199);
  });

  it("MutableURL is instance of URL", () => {
    expect(ReadonlyURL.fromThrow("http://example.com") instanceof URL).toBe(true);
  });

  it("file url", () => {
    const uri = URI.from("file://fp?storagekey=zTvTPEPQRWij8rfb3FrFqBm");
    expect(uri.pathname).toBe("fp");
  });

  it("unregistered protocol with hostPart", () => {
    const withoutHostpart = URI.from("indexdb://fp:bla/test/?name=test&store=meta");
    expect(() => withoutHostpart.hostname).toThrowError('you can use hostname only if protocol is ["http","https","ws","wss"]');
  });

  it("register protocol with hostPart", () => {
    const unreg = URI.protocolHasHostpart("indexdb:");
    const withHostpart = URI.from("indexdb://fp1:88/test/wurst?name=test&store=meta");
    expect(withHostpart.host).toBe("fp1:88");
    expect(withHostpart.pathname).toBe("/test/wurst");
    const withHostpartNoPath = URI.from("indexdb://fp2:88?name=test&store=meta");
    expect(withHostpartNoPath.host).toBe("fp2:88");
    expect(withHostpartNoPath.pathname).toBe("/");
    unreg();
  });

  it("host uri as json with omit", () => {
    const uri = URI.from("http://example.com:8000/bla/blub?name=test&store=meta&key=%40bla");
    expect(uri.asObj()).toEqual({
      style: "host",
      protocol: "http:",
      hostname: "example.com",
      port: "8000",
      pathname: "/bla/blub",
      searchParams: {
        store: "meta",
        name: "test",
        key: "@bla",
      },
    } as HostURIObject);
  });

  it("path uri as json with omit", () => {
    const uri = URI.from("blix://bla/blub?name=test&store=meta&key=%40bla");
    expect(uri.asObj()).toEqual({
      style: "path",
      protocol: "blix:",
      pathname: "bla/blub",
      searchParams: {
        store: "meta",
        name: "test",
        key: "@bla",
      },
    } as PathURIObject);
  });
  it("URI getParamResult", () => {
    const uri = URI.from("blix://bla/blub?name=test&store=meta&key=%40bla");
    expect(uri.getParamResult("key").Ok()).toBe("@bla");
    expect(uri.getParamResult("key2", (k) => `${k} not found`).Err().message).toBe("key2 not found");
    expect(uri.getParamResult("key2").Err().message).toBe("missing parameter: key2");
  });
  it("BuildURI getParamResult", () => {
    const uri = BuildURI.from("blix://bla/blub?name=test&store=meta&key=%40bla");
    expect(uri.getParamResult("key").Ok()).toBe("@bla");
    expect(uri.getParamResult("key2", (k) => `${k} not found`).Err().message).toBe("key2 not found");
    expect(uri.getParamResult("key2").Err().message).toBe("missing parameter: key2");
  });

  it("URI append Params Path", () => {
    const uri = BuildURI.from("blix://bla/blub?name=test&store=meta&key=%40bla").appendRelative(
      "/murks/blub?name=append&work=hard",
    );
    expect(uri.asObj()).toEqual({
      pathname: "bla/blub/murks/blub",
      protocol: "blix:",
      searchParams: {
        key: "@bla",
        name: "append",
        store: "meta",
        work: "hard",
      },
      style: "path",
    });
  });

  it("URI append Params Host", () => {
    const uri = BuildURI.from("http://host/bla/blub?name=test&store=meta&key=%40bla").appendRelative(
      "/murks/blub?name=append&work=hard",
    );
    expect(uri.asObj()).toEqual({
      pathname: "/bla/blub/murks/blub",
      hostname: "host",
      port: "",
      protocol: "http:",
      searchParams: {
        key: "@bla",
        name: "append",
        store: "meta",
        work: "hard",
      },
      style: "host",
    });
  });

  it("URI append Params Host Flat", () => {
    const uri = BuildURI.from("https://fp1-uploads-201698179963.s3.us-east-2.amazonaws.com/").appendRelative(`/data/name/key.car`);

    expect(uri.asObj()).toEqual({
      pathname: "/data/name/key.car",
      hostname: "fp1-uploads-201698179963.s3.us-east-2.amazonaws.com",
      port: "",
      protocol: "https:",
      searchParams: {},
      style: "host",
    });
  });

  it("URI getParamsResult ok", () => {
    const rParams = BuildURI.from("http://host/bla/blub?name=test&store=meta&key=%40bla").getParamsResult("key", "name", "store");
    expect(rParams.Ok()).toEqual({
      key: "@bla",
      name: "test",
      store: "meta",
    });
  });

  it("BuildURI getParamsResult fail", () => {
    const url = BuildURI.from("http://host/bla/blub?name=test&store=meta&key=%40bla");
    const rParams = url.getParamsResult("key", "name", "store", "key2", "name2");
    expect(rParams.Err().message).toEqual(`missing parameters: key2,name2`);
    const rParams2 = url.getParamsResult(
      "key",
      "name",
      "store",
      "key2",
      "name2",
      (...keys: string[]) => `keys not found: ${keys.join(",")}`,
    );
    expect(rParams2.Err().message).toEqual(`keys not found: key2,name2`);
  });

  describe("URI appendRelative", () => {
    const cases = [
      ["", "", "", "/"],
      ["/", "", "", "/"],
      ["", "/", "/"],
      ["/", "/", "/"],
      ["ab", "", "ab", "/ab"],
      ["ab", "/", "/ab"],
      ["cd", "/ab", "/ab/cd"],
      ["cd", "/ab", "/ab/cd"],
      ["/cd", "/ab", "/ab/cd"],
      ["/cd", "/ab", "/ab/cd"],
      ["/cd", "/ab/", "/ab/cd"],
      ["/cd/", "/ab/", "/ab/cd/"],
    ];
    for (const [relative, path, result, httpResult] of cases) {
      it(`[${path}] [${relative}] -> ${result}`, () => {
        const noHost = BuildURI.from(`file://${path}`).appendRelative(relative).URI();
        expect(noHost.pathname).toBe(result);
        const host = BuildURI.from(`https://wurst`).pathname(path).appendRelative(relative).URI();
        expect(host.pathname).toBe(httpResult || result);
      });
    }
  });

  it("URI getParamsResult fail", () => {
    const url = URI.from("http://host/bla/blub?name=test&store=meta&key=%40bla");
    const rParams = url.getParamsResult("key", "name", "store", "key2", {
      name2: undefined as unknown as string,
    });
    expect(rParams.Err().message).toEqual(`missing parameters: key2,name2`);
    const rParams2 = url.getParamsResult(
      "key",
      "name",
      "store",
      "key2",
      "name2",
      (...keys: string[]) => `keys not found: ${keys.join(",")}`,
    );
    expect(rParams2.Err().message).toEqual(`keys not found: key2,name2`);
  });
  for (const url of [
    URI.from("http://host/bla/blub?name=test&store=meta&key=%40bla"),
    BuildURI.from("http://host/bla/blub?name=test&store=meta&key=%40bla"),
  ]) {
    it(`getParam default ${url.constructor.name}`, () => {
      const rstring = url.getParam("key2", "default");
      expectTypeOf(rstring).toEqualTypeOf<string>();
      const xstring = url.getParam("key2");
      expectTypeOf(xstring).toEqualTypeOf<string | undefined>();

      expect(url.getParam("key2", "default")).toBe("default");
      expect(url.getParam("key2")).toBeFalsy();
      expect(url.getParam("key")).toBe("@bla");
      expect(url.getParam("key", "default")).toBe("@bla");

      expect(url.getParam({ key: "default" })).toBe("@bla");
      expect(url.getParam({ key2: "default" })).toBe("default");

      expect(() => url.getParam({})).toThrowError("Invalid key: {}");
      expect(() => url.getParam({ key: "x", key2: "y" })).toThrowError('Invalid key: {"key":"x","key2":"y"}');
    });
  }
  it("dashed getParamsResult", () => {
    const url = URI.from("http://host/bla/blub?name=test&email=a@b.de&clock-id=123&server-id=456");
    const res = url.getParamsResult("name", "email", "clock-id", {
      "server-id": "defServer",
      bla: "defBla",
    });
    expect(res.isOk()).toBe(true);
    expect(res.Ok()).toEqual({
      bla: "defBla",
      name: "test",
      email: "a@b.de",
      "clock-id": "123",
      "server-id": "456",
    });
  });

  it("recorded getParamsResult", () => {
    const url = URI.from("http://host/bla/blub?name=test&email=a@b.de&clock-id=123&server-id=456");
    const res = url.getParamsResult({
      name: "defName",
      email: "defEmail",
      "clock-id": "defClock-id",
      "server-id": "defServer",
      bla: "defBla",
    });
    expect(res.isOk()).toBe(true);
    expect(res.Ok()).toEqual({
      name: "test",
      email: "a@b.de",
      "clock-id": "123",
      "server-id": "456",
      bla: "defBla",
    });
  });

  it("recorded getParamsResult with default", () => {
    const url = URI.from("http://host/bla/blub?name=test&email=a@b.de&clock-id=123&server-id=456");
    const res = url.getParamsResult({
      name: "defName",
      email: param.REQUIRED,
      "clock-id": false,
      "server-id": undefined,
      bla: "defBla",
    });
    expect(res.isOk()).toBe(true);
    expect(res.Ok()).toEqual({
      name: "test",
      email: "a@b.de",
      "clock-id": "123",
      "server-id": "456",
      bla: "defBla",
    });
  });

  it("recorded getParamsResult with default to empty string", () => {
    const url = URI.from("http://host/bla/blub?name=test&email=a@b.de&clock-id=123&server-id=456");
    const res = url.getParamsResult({
      name: "defName",
      email: param.REQUIRED,
      "clock-id": false,
      "server-id": undefined,
      bla: "",
    });
    expect(res.isOk()).toBe(true);
    expect(res.Ok()).toEqual({
      name: "test",
      email: "a@b.de",
      "clock-id": "123",
      "server-id": "456",
      bla: "",
    });
  });

  it("recorded getParamsResult with required default", () => {
    const url = URI.from("http://host/bla/blub?name=test&email=a@b.de&clock-id=123&server-id=456");
    const res = url.getParamsResult({
      name: "defName",
      email: true,
      "clock-id": false,
      "server-id": undefined,
      bla: param.REQUIRED,
    });
    expect(res.isErr()).toBe(true);
  });

  it("recorded getParamsResult optional", () => {
    const url = URI.from("http://host/bla/blub?name=test&email=a@b.de&clock-id=123&server-id=456");
    const res = url.getParamsResult({
      name: "defName",
      huhu: "defHuhu",
      "clock-id": param.REQUIRED,
      email: param.OPTIONAL,
      maler: param.OPTIONAL,
    });
    expect(res.isOk()).toBeTruthy();
    expect(res.Ok()).toEqual({
      "clock-id": "123",
      name: "test",
      huhu: "defHuhu",
      email: "a@b.de",
    });
  });

  it("cleanParams", () => {
    const url = BuildURI.from("http://host/bla/blub?name=test&email=a@b.de&clock-id=123&server-id=456");
    expect(url.cleanParams().toString()).toBe("http://host/bla/blub");
  });

  it("illegal url relative", () => {
    expect(URI.from("bla").toString()).equal("file://bla");
  });
  it("illegal url absolute", () => {
    expect(URI.from("/bla").toString()).equal("file:///bla");
  });

  describe("applyBase", () => {
    let base: BuildURI;
    let ref: BuildURI;
    beforeEach(() => {
      base = BuildURI.from("http://example.com/blabla?sock=4");
      ref = base.clone();
    });
    it("toResolv empty -> base", () => {
      expect(base.resolve("").toString()).toBe(base.toString());
    });
    it("toResolv absolute -> absolute", () => {
      expect(base.resolve("http://murks.com/huhu?sock=4").toString()).toBe("http://murks.com/huhu?sock=4");
    });
    it("toResolv relative with out leading / -> base + relative", () => {
      expect(base.resolve("/meno/huhu").toString()).toBe(ref.pathname("/meno/huhu").toString());
    });
    it("toResolv relative without leading / -> base - path + relative", () => {
      expect(base.resolve("meno/huhu").toString()).toBe(ref.appendRelative("/meno/huhu").toString());
    });
    it("toResolv relative with leading ./ -> base - path + relative", () => {
      expect(base.resolve("./meno/huhu").toString()).toBe(ref.appendRelative("/meno/huhu").toString());
    });
  });

  it("CoerceURI.is", () => {
    expect(isCoerceURI(0)).toBe(false);
    expect(isCoerceURI(null)).toBe(false);
    expect(isCoerceURI(undefined)).toBe(false);
    expect(isCoerceURI(new URL("http://example.com"))).toBe(true);
    expect(isCoerceURI(ReadonlyURL.fromThrow("http://example.com"))).toBe(true);
    expect(isCoerceURI(URI.from("http://example.com"))).toBe(true);
    expect(isCoerceURI(BuildURI.from("http://example.com"))).toBe(true);
    expect(isCoerceURI("http://example.com")).toBe(true);
  });

  it("matchScore total", () => {
    const ref = URI.from("http://example.com/blabla?sock=4");
    expect(ref.match("http://example.com/blabla?sock=4").score).toBe(4);
  });
  it("matchScore nothing", () => {
    const ref = URI.from("xttp://xample.com/labla?ock=4");
    expect(ref.match("http://example.com/blabla?sock=4").score).toBe(0);
  });

  it("matchScore protocol", () => {
    const ref = URI.from("http://a.com");
    expect(ref.match("http://b.com").score).toBe(1);
  });

  it("host", () => {
    const ref = URI.from("https://a.com");
    expect(ref.match("http://a.com").score).toBe(1);
  });
  it("host-port", () => {
    const ref = URI.from("https://a.com:4711");
    expect(ref.match("http://b.com:4711").score).toBe(1);
  });

  it("no host-port", () => {
    const ref = URI.from("yttp://a.com/4711");
    expect(ref.match("xttp://a.com/4711").score).toBe(2);
  });
  it("mix host-port", () => {
    const ref = URI.from("http://a.com/bla/qq/kk");
    expect(ref.match("xttp://bla/oo/kk").score).toBe(2);
  });

  it("mix path", () => {
    const ref = URI.from("xttp://ab/cd/ed");
    expect(ref.match("yttp://ab/cd/ed").score).toBe(3);
  });
  it("mix path", () => {
    const ref = URI.from("xttp://ab/Xd/ed");
    expect(ref.match("yttp://ab/cd/ed").score).toBe(2);
  });

  it("not-params", () => {
    const ref = URI.from("yttp://ed?x=3");
    expect(ref.match("xttp://ab/cd?x=4").score).toBe(0);
  });
  it("one-params", () => {
    const ref = URI.from("yttp://ed?x=3&y=4");
    expect(ref.match("xttp://ab/cd?x=4&y=4").score).toBe(1);
  });
  it("one-params", () => {
    const ref = URI.from("yttp://ed?x=3&y=4&o=4");
    expect(ref.match("xttp://ab/cd?x=4&y=4&o=4").score).toBe(2);
  });

  it("cleanParams all", () => {
    const uri = BuildURI.from("http://key.bag?a=1&b=2&c=3").cleanParams();
    expect(Array.from(uri.getParams)).toEqual([]);
  });

  it("cleanParams not matching", () => {
    const uri = BuildURI.from("http://key.bag?a=1&b=2&c=3").cleanParams(["A"], "B");
    expect(Array.from(uri.getParams)).toEqual([
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
    ]);
  });

  it("cleanParams not matching", () => {
    const uri = BuildURI.from("http://key.bag?a=1&b=2&c=3").cleanParams(["A"], "B", "a", "a", "b");
    expect(Array.from(uri.getParams)).toEqual([["c", "3"]]);
  });

  it("cleanParams not matching", () => {
    const uri = BuildURI.from("http://key.bag?a=1&b=2&c=3").cleanParams(["c", "b", "a"]);
    expect(Array.from(uri.getParams)).toEqual([]);
  });

  it("common hash", () => {
    const uri = URI.from("http://key.bag?a=1&b=2&c=3#hash");
    expect(uri.hash).toBe("#hash");

    const buri = BuildURI.from("http://key.bag?a=1&b=2&c=3").hash("hash").URI();
    expect(buri.hash).toBe("#hash");

    const hashuri = BuildURI.from("http://key.bag?a=1&b=2&c=3").hash("#hash").URI();
    expect(hashuri.hash).toBe("#hash");
  });

  it("get hashParams", () => {
    const uri = BuildURI.from("http://key.bag?a=1&b=2&c=3")
      .hashParams({
        c: true,
        a: 1,
        b: "5",
        d: new Date("2021-01-01T00:00:00.000Z"),
      })
      .URI();
    expect(uri.hash).toBe("#a=1&b=5&c=true&d=2021-01-01T00%3A00%3A00.000Z");

    const mergeUri = BuildURI.from("http://key.bag?a=1&b=2&c=3#c=true&a=4&d=9")
      .hashParams(
        {
          a: 1,
          b: "5",
          d: new Date("2021-01-01T00:00:00.000Z"),
        },
        "merge",
      )
      .URI();
    expect(mergeUri.hash).toBe("#a=1&b=5&c=true&d=2021-01-01T00%3A00%3A00.000Z");
  });

  it("get hashParams", () => {
    const buri = BuildURI.from("http://key.bag?a=1&b=2&c=3").hashParams({
      c: true,
      a: 1,
      b: "5",
      d: new Date("2021-01-01T00:00:00.000Z"),
    });
    expect(buri.toString()).toBe("http://key.bag/?a=1&b=2&c=3#a=1&b=5&c=true&d=2021-01-01T00%3A00%3A00.000Z");

    const rbParam = buri.getHashParams({
      d: param.REQUIRED,
      e: "default",
      f: param.OPTIONAL,
    });
    expect(rbParam.Ok()).toEqual({
      d: "2021-01-01T00:00:00.000Z",
      e: "default",
    });

    const rParam = buri.URI().getHashParams({
      d: param.REQUIRED,
      e: "default",
      f: param.OPTIONAL,
    });
    expect(rParam.Ok()).toEqual({
      d: "2021-01-01T00:00:00.000Z",
      e: "default",
    });
  });

  it("error hashParams", () => {
    const buri = BuildURI.from("http://key.bag?a=1&b=2&c=3").hashParams({
      c: true,
      a: 1,
      b: "5",
      d: new Date("2021-01-01T00:00:00.000Z"),
    });
    const rerrParam = buri.getHashParams({
      a: param.REQUIRED,
      e: "default",
      f: param.OPTIONAL,
      g: param.REQUIRED,
    });
    expect(rerrParam.Err().message).toBe("missing parameters: g");
  });

  it("local", () => {
    const fUri = URI.from("file:///ed/bla?x=3&y=4#doof");
    expect(fUri.withoutHostAndSchema).toBe("/ed/bla?x=3&y=4#doof");

    const hUri = URI.from("http://bla.com:44/ed/bla?x=3&y=4#doof");
    expect(hUri.withoutHostAndSchema).toBe("/ed/bla?x=3&y=4#doof");
  });

  it("without hash local", () => {
    const fUri = URI.from("file:///ed/bla?x=3&y=4");
    expect(fUri.withoutHostAndSchema).toBe("/ed/bla?x=3&y=4");

    const hUri = URI.from("http://bla.com:44/ed/bla?x=3&y=4");
    expect(hUri.withoutHostAndSchema).toBe("/ed/bla?x=3&y=4");
  });

  it("without search local", () => {
    const fUri = URI.from("file:///ed/bla");
    expect(fUri.withoutHostAndSchema).toBe("/ed/bla");

    const hUri = URI.from("http://bla.com:44/ed/bla");
    expect(hUri.withoutHostAndSchema).toBe("/ed/bla");
  });

  it("without search but hash local", () => {
    const fUri = URI.from("file:///ed/bla#doof");
    expect(fUri.withoutHostAndSchema).toBe("/ed/bla#doof");

    const hUri = URI.from("http://bla.com:44/ed/bla#doof");
    expect(hUri.withoutHostAndSchema).toBe("/ed/bla#doof");
  });

  it("pathname + search + hash", () => {
    const refUnk = URI.from("yttp://ed/bla?y=4&x=3");
    expect(refUnk.withoutHostAndSchema).toBe("ed/bla?x=3&y=4");

    const refHttp = URI.from("http://host/ed/bla?x=3&y=4");
    expect(refHttp.withoutHostAndSchema).toBe("/ed/bla?x=3&y=4");

    const refFile = URI.from("file:///ed/bla?x=3&y=4");
    expect(refFile.withoutHostAndSchema).toBe("/ed/bla?x=3&y=4");
  });

  it("onlyHostAndSchema", () => {
    const fUri = URI.from("file:///ed/bla#doof");
    expect(fUri.onlyHostAndSchema).toBe("file://");

    const hUri = URI.from("http://bla.com:44/ed/bla#doof");
    expect(hUri.onlyHostAndSchema).toBe("http://bla.com:44/");

    const hplainUri = URI.from("http://bla.com:44");
    expect(hplainUri.onlyHostAndSchema).toBe("http://bla.com:44/");

    const fplainUri = URI.from("file:///bla.com");
    expect(fplainUri.onlyHostAndSchema).toBe("file://");
  });

  it("getParams", () => {
    const uri = URI.from("http://key.bag?a=1&b=2&c=3");
    expect(Array.from(uri.getParams)).toEqual([
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
    ]);
  });

  it("getHashes", () => {
    const euri = URI.from("http://key.bag#");
    expect(Array.from(euri.getHashes)).toEqual([]);

    const nouri = URI.from("http://key.bag#kddkdkd");
    expect(Array.from(nouri.getHashes)).toEqual([["kddkdkd", ""]]);

    const uri = URI.from("http://key.bag#a=1&b=2&c=3");
    expect(Array.from(uri.getHashes)).toEqual([
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
    ]);
  });

  // it("repair url encoding", () => {
  //   const uri = URI.from("http://key.bag?b=http://meno?x=y#a=http://meno?x=3&y=4#doof");
  //   expect(uri.toString()).toBe("http://key.bag/?b=http%3A%2F%2Fmeno%3Fx%3Dy#a=http%://meno?x=3&y=4%#doof");
  // })

  it("never geencoding", () => {
    const uri = URI.from("http://localhost:3002/fp/cloud/api/token#back_url=http%3A%2F%2Flocalhost%3A3001%2F");
    expect(Array.from(uri.getHashes)).toEqual([["back_url", "http://localhost:3001/"]]);

    const xuri = URI.from("http://localhost:3002/fp/cloud/api/token");
    expect(Array.from(xuri.getHashes)).toEqual([]);
  });

  it("search ", () => {
    const uri = URI.from("http://key.bag?a=1&b=2&c=3");
    expect(uri.search).toEqual("?a=1&b=2&c=3");

    const buri = BuildURI.from("http://key.bag").setParam("a", "1").setParam("c", "3").setParam("b", "2").URI();
    expect(buri.search).toEqual("?a=1&b=2&c=3");
  });

  it("setParams", () => {
    const uri = BuildURI.from("http://key.bag")
      .searchParams({
        a: 1,
        b: "2",
        c: "3",
      })
      .hashParams({
        a: 1,
        b: "2",
        c: "3",
      });
    expect(uri.URI().search).toEqual("?a=1&b=2&c=3");
    expect(uri.URI().hash).toEqual("#a=1&b=2&c=3");
  });

  it("URI is NonMutable", () => {
    const ruriFromString = URI.from("http://key.bag");
    const ruriFromURL = URI.from(new URL("http://key.bag"));
    const ruriFromURI = URI.from(ruriFromString.clone());
    const ruriFromBuildURI = URI.from(ruriFromString.clone().build());
    expect(ruriFromString).toBeInstanceOf(URI);
    expect(ruriFromString).toBe(ruriFromURL);
    expect(ruriFromString).toBe(ruriFromURI);
    expect(ruriFromString).toBe(ruriFromBuildURI);
    for (let i = 0; i < 10; i++) {
      const uriFromString = URI.from("http://key.bag");
      const uriFromURL = URI.from(new URL("http://key.bag"));
      const uriFromURI = URI.from(uriFromString);
      const uriFromBuildURI = URI.from(uriFromString.build());
      expect(uriFromString).toBe(ruriFromString);
      expect(uriFromURL).toBe(ruriFromURL);
      expect(uriFromURI).toBe(ruriFromURI);
      expect(uriFromBuildURI).toBe(ruriFromBuildURI);
    }
  });

  it("Test Host", () => {
    const uri = URI.from("http://example.com:8080/path/name?key=value#hash");
    expect(uri.host).toBe("example.com:8080");
    expect(uri.hostname).toBe("example.com");
    expect(uri.port).toBe("8080");
    const buri = uri.build();
    buri.port("9090");
    buri.hostname("example.org");
    expect(buri.toString()).toBe("http://example.org:9090/path/name?key=value#hash");

    const bhuri = uri.build();
    bhuri.host("example.net:7070");
    expect(bhuri.toString()).toBe("http://example.net:7070/path/name?key=value#hash");
  });

  it("vibes calculate preset Port", () => {
    const protocol = "https";
    const hostnameBase = ".localhost:8099";
    const port = "8080";
    const bindings = {
      appSlug: "myapp",
      userSlug: "myuser",
      fsId: "12345",
    };
    const hostname = `${bindings.appSlug}--${bindings.userSlug}.${hostnameBase.replace(/^\./, "")}`;
    const buri = BuildURI.from(`http://template`);
    // if (port && port !== "80" && port !== "443") {
    buri.port(port);
    // }
    const urlStr = buri.protocol(protocol).hostname(hostname).pathname(`~${bindings.fsId}~`).toString();
    expect(urlStr).toBe(`https://${hostname.replace(/:.*$/, "")}:8080/~${bindings.fsId}~`);
  });

  it("vibes calculate implict port", () => {
    const protocol = "https";
    const hostnameBase = "localhost:8099";
    const bindings = {
      appSlug: "myapp",
      userSlug: "myuser",
      fsId: "12345",
    };
    const hostname = `${bindings.appSlug}--${bindings.userSlug}.${hostnameBase.replace(/^\./, "")}`;
    const buri = BuildURI.from(`http://template`);
    // if (port && port !== "80" && port !== "443") {
    // buri.port(port);
    // }
    expect(buri.protocol(protocol).hostname(hostname).pathname(`~${bindings.fsId}~`).toString()).toBe(
      `https://${hostname}/~${bindings.fsId}~`,
    );
  });
});
