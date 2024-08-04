import { BuildURI, isURI, URI } from "./uri";

describe("BuildURI", () => {
  let uri: BuildURI;
  beforeEach(() => {
    uri = new BuildURI(new URL("http://example.com"));
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
    expect(URI.from(new URL("blix://example.com?key=value")).toString()).toBe("blix://example.com?key=value");
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
    expect(URI.merge("blix://example.com?key=value", "murk://bla.com?key=from&z=value").toString()).toBe(
      "blix://example.com?key=value&z=value",
    );
  });

  it("isURI real", () => {
    expect(isURI(URI.from())).toBe(true);
  });
  it("isURI fake", () => {
    expect(
      isURI({
        asURL: () => new URL("http://example.com"),
      }),
    ).toBe(true);
  });
});
