import { BuildURI, MutableURL, URI } from "@adviser/cement";

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
});
