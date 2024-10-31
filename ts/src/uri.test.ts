import { BuildURI, HostURIObject, MutableURL, PathURIObject, URI } from "@adviser/cement";

describe("BuildURI", () => {
  let uri: BuildURI;
  beforeEach(() => {
    uri = BuildURI.from(new MutableURL("http://example.com"));
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
    expect(URI.from(new MutableURL("blix://example.com?key=value")).toString()).toBe("blix://example.com?key=value");
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
    expect(new MutableURL("http://example.com") instanceof URL).toBe(true);
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
      ["", "", "/"],
      ["/", "", "/"],
      ["", "/", "/"],
      ["/", "/", "/"],
      ["ab", "", "/ab"],
      ["ab", "/", "/ab"],
      ["cd", "/ab", "/ab/cd"],
      ["cd", "/ab", "/ab/cd"],
      ["/cd", "/ab", "/ab/cd"],
      ["/cd", "/ab", "/ab/cd"],
      ["/cd", "/ab/", "/ab/cd"],
      ["/cd/", "/ab/", "/ab/cd/"],
    ];
    for (const [relative, path, result] of cases) {
      it(`[${path}] [${relative}] -> ${result}`, () => {
        const noHost = BuildURI.from(`file://${path}`).appendRelative(relative).URI();
        expect(noHost.pathname).toBe(result);
        const host = BuildURI.from(`https://wurst`).pathname(path).appendRelative(relative).URI();
        expect(host.pathname).toBe(result);
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
});
