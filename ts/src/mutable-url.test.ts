import { ReadonlyURL, WritableURL, URLSearchParamsEntries } from "./mutable-url.js";

describe("URLSearchParamsEntries", () => {
  it("should iterate over URLSearchParams entries", () => {
    const params = new URLSearchParams();
    params.set("key1", "value1");
    params.set("key2", "value2");

    const entries = Array.from(URLSearchParamsEntries(params));
    expect(entries).toEqual([
      ["key1", "value1"],
      ["key2", "value2"],
    ]);
  });

  it("should handle empty URLSearchParams", () => {
    const params = new URLSearchParams();
    const entries = Array.from(URLSearchParamsEntries(params));
    expect(entries).toEqual([]);
  });

  it("should handle multiple values for same key", () => {
    const params = new URLSearchParams();
    params.append("key", "value1");
    params.append("key", "value2");

    const entries = Array.from(URLSearchParamsEntries(params));
    // URLSearchParams.set() overwrites, but append() adds multiple
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some(([k, v]) => k === "key" && (v === "value1" || v === "value2"))).toBe(true);
  });
});

describe("ReadonlyURL", () => {
  describe("constructor and basic properties", () => {
    it("should create ReadonlyURL with http protocol", () => {
      const url = ReadonlyURL.fromThrow("http://example.com/path");
      expect(url.protocol).toBe("http:");
      expect(url.hostname).toBe("example.com");
      expect(url.pathname).toBe("/path");
    });

    it("should create ReadonlyURL with https protocol", () => {
      const url = ReadonlyURL.fromThrow("https://example.com:8080/path");
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("example.com");
      expect(url.port).toBe("8080");
      expect(url.pathname).toBe("/path");
    });

    it("should create ReadonlyURL with custom protocol without host part", () => {
      const url = ReadonlyURL.fromThrow("file://path/to/file");
      expect(url.protocol).toBe("file:");
      expect(url.pathname).toBe("path/to/file");
    });

    it("should throw error for invalid URL", () => {
      expect(() => ReadonlyURL.fromThrow("invalid-url")).toThrow();
    });
  });

  describe("readonly setters", () => {
    let url: ReadonlyURL;

    beforeEach(() => {
      url = ReadonlyURL.fromThrow("http://example.com/path");
    });

    it("should throw error when setting origin", () => {
      expect(() => {
        url.origin = "http://other.com";
      }).toThrow("origin is readonly");
    });

    it("should throw error when setting href", () => {
      expect(() => {
        url.href = "http://other.com";
      }).toThrow("href is readonly");
    });

    it("should throw error when setting password", () => {
      expect(() => {
        url.password = "pass";
      }).toThrow("password is readonly");
    });

    it("should throw error when setting username", () => {
      expect(() => {
        url.username = "user";
      }).toThrow("username is readonly");
    });

    it("should throw error when setting hash", () => {
      expect(() => {
        url.hash = "#test";
      }).toThrow("hash is readonly");
    });

    it("should throw error when setting host", () => {
      expect(() => {
        url.host = "other.com";
      }).toThrow("host is readonly");
    });

    it("should throw error when setting hostname", () => {
      expect(() => {
        url.hostname = "other.com";
      }).toThrow("hostname is readonly");
    });

    it("should throw error when setting pathname", () => {
      expect(() => {
        url.pathname = "/other";
      }).toThrow("pathname is readonly");
    });

    it("should throw error when setting port", () => {
      expect(() => {
        url.port = "8080";
      }).toThrow("port is readonly");
    });

    it("should throw error when setting protocol", () => {
      expect(() => {
        url.protocol = "https:";
      }).toThrow("protocol is readonly");
    });

    it("should throw error when setting search", () => {
      expect(() => {
        url.search = "?test=1";
      }).toThrow("search is readonly");
    });

    it("should throw error when setting searchParams", () => {
      expect(() => {
        url.searchParams = new URLSearchParams();
      }).toThrow("searchParams is readonly");
    });
  });

  describe("host-related properties for non-host protocols", () => {
    let url: ReadonlyURL;

    beforeEach(() => {
      url = ReadonlyURL.fromThrow("file://path/to/file");
    });

    it("should throw error when accessing host for non-host protocol", () => {
      expect(() => url.host).toThrow("you can use hostname only if protocol is");
    });

    it("should throw error when accessing hostname for non-host protocol", () => {
      expect(() => url.hostname).toThrow("you can use hostname only if protocol is");
    });

    it("should throw error when accessing port for non-host protocol", () => {
      expect(() => url.port).toThrow("you can use hostname only if protocol is");
    });
  });

  describe("search and searchParams", () => {
    it("should handle empty search params", () => {
      const url = ReadonlyURL.fromThrow("http://example.com/path");
      expect(url.search).toBe("");
    });

    it("should handle search params", () => {
      const url = ReadonlyURL.fromThrow("http://example.com/path?b=2&a=1");
      expect(url.search).toBe("?a=1&b=2"); // Should be sorted
    });

    it("should encode search param values", () => {
      const url = ReadonlyURL.fromThrow("http://example.com/path");
      url.searchParams.set("key", "value with spaces");
      expect(url.search).toBe("?key=value%20with%20spaces");
    });
  });

  describe("toString", () => {
    it("should return correct string for host-based URL", () => {
      const url = ReadonlyURL.fromThrow("http://example.com:8080/path?a=1#hash");
      expect(url.toString()).toBe("http://example.com:8080/path?a=1#hash");
    });

    it("should return correct string for non-host URL", () => {
      const url = ReadonlyURL.fromThrow("file://path/to/file");
      expect(url.toString()).toBe("file://path/to/file");
    });

    it("should handle URL without leading slash in pathname", () => {
      const url = ReadonlyURL.fromThrow("http://example.com");
      expect(url.toString()).toContain("http://example.com/");
    });
  });

  describe("utility methods", () => {
    let url: ReadonlyURL;

    beforeEach(() => {
      url = ReadonlyURL.fromThrow("http://example.com/path");
    });

    it("test serialization", () => {
      const url = ReadonlyURL.fromThrow("http://example.com/path");
      expect(JSON.stringify(url)).toBe(`"${url.toString()}"`);
    });

    it("should return JSON string", () => {
      expect(url.toJSON()).toBe(url.toString());
    });

    it("should return string for custom inspect", () => {
      const customInspectSymbol = Symbol.for("nodejs.util.inspect.custom");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      expect(url[customInspectSymbol]()).toBe(url.toString());
    });

    it("should clone and return same instance", () => {
      const cloned = url.clone();
      expect(cloned).toBe(url);
    });
  });
});

describe("WritableURL", () => {
  describe("static factory methods", () => {
    it("should create WritableURL with fromThrow", () => {
      const url = WritableURL.fromThrow("http://example.com/path");
      expect(url).toBeInstanceOf(WritableURL);
      expect(url.toString()).toBe("http://example.com/path");
    });

    it("should throw error with fromThrow for invalid URL", () => {
      expect(() => WritableURL.fromThrow("invalid-url")).toThrow();
    });

    it("should create Result.Ok with from for valid URL", () => {
      const result = WritableURL.from("http://example.com/path");
      expect(result.isOk()).toBe(true);
      expect(result.Ok()).toBeInstanceOf(WritableURL);
    });

    it("should create Result.Err with from for invalid URL", () => {
      const result = WritableURL.from("invalid-url");
      expect(result.isErr()).toBe(true);
      expect(result.Err().message).toContain("Invalid URL");
    });
  });

  describe("mutable setters", () => {
    let url: WritableURL;

    beforeEach(() => {
      url = WritableURL.fromThrow("http://example.com/path");
    });

    it("should throw error when setting origin", () => {
      expect(() => {
        url.origin = "http://other.com";
      }).toThrow("don't use origin");
    });

    it("should set href", () => {
      expect(() => {
        url.href = "http://other.com/other";
      }).toThrow("don't use href");
    });

    it("should set password", () => {
      url.password = "newpass";
      expect(url.password).toBe("newpass");
    });

    it("should set username", () => {
      url.username = "newuser";
      expect(url.username).toBe("newuser");
    });

    it("should set hash", () => {
      url.hash = "#newhash";
      expect(url.hash).toBe("#newhash");
    });

    it("should set host", () => {
      url.host = "other.com:9000";
      expect(url.host).toBe("other.com:9000");
    });

    it("should set hostname", () => {
      url.hostname = "other.com";
      expect(url.hostname).toBe("other.com");
    });

    it("should set pathname", () => {
      url.pathname = "/newpath";
      expect(url.pathname).toBe("/newpath");
    });

    it("should set port", () => {
      url.port = "9000";
      expect(url.port).toBe("9000");
    });

    it("should set protocol with colon", () => {
      url.protocol = "https:";
      expect(url.protocol).toBe("https:");
    });

    it("should set protocol without colon", () => {
      url.protocol = "https";
      expect(url.protocol).toBe("https:");
    });

    it("should set search", () => {
      url.search = "?new=param";
      expect(url.search).toBe("?new=param");
    });

    it("should verify state change when setting username and password", () => {
      url.username = "testuser";
      url.password = "testpass";

      expect(url.username).toBe("testuser");
      expect(url.password).toBe("testpass");
      expect(url.href).toContain("testuser:testpass@");
    });

    it("should verify state change when setting empty values", () => {
      url.hash = "#test";
      url.search = "?test=value";

      // Verify they were set
      expect(url.hash).toBe("#test");
      expect(url.search).toBe("?test=value");

      // Now set them to empty
      url.hash = "";
      url.search = "";

      expect(url.hash).toBe("");
      expect(url.search).toBe("");
    });
  });

  describe("host-related setters for non-host protocols", () => {
    let url: WritableURL;

    beforeEach(() => {
      url = WritableURL.fromThrow("file://path/to/file");
    });

    it("should throw error when setting hostname for non-host protocol", () => {
      expect(() => {
        url.hostname = "example.com";
      }).toThrow("you can use hostname only if protocol is");
    });

    it("should throw error when setting port for non-host protocol", () => {
      expect(() => {
        url.port = "8080";
      }).toThrow("you can use port only if protocol is");
    });
  });

  describe("searchParams setter", () => {
    let url: WritableURL;

    beforeEach(() => {
      url = WritableURL.fromThrow("http://example.com/path?existing=param");
    });

    it("should replace searchParams completely", () => {
      const originalSearch = url.search;
      const newParams = new URLSearchParams();
      newParams.set("new", "value");
      newParams.set("another", "param");

      url.searchParams = newParams;

      // Verify the state change through getter
      expect(url.searchParams.get("new")).toBe("value");
      expect(url.searchParams.get("another")).toBe("param");
      expect(url.searchParams.get("existing")).toBeNull();

      // Verify search string also changed
      expect(url.search).not.toBe(originalSearch);
      expect(url.search).toContain("new=value");
      expect(url.search).toContain("another=param");
    });

    it("should handle empty searchParams", () => {
      const originalSearch = url.search;
      url.searchParams = new URLSearchParams();

      expect(url.search).toBe("");
      expect(url.search).not.toBe(originalSearch);
      expect(url.searchParams.toString()).toBe("");
    });
  });

  describe("comprehensive state change verification", () => {
    let url: WritableURL;

    beforeEach(() => {
      url = WritableURL.fromThrow("http://example.com/path?existing=param");
    });

    it("should verify all mutable setters change state correctly", () => {
      // Store original values
      const originalHash = url.hash;
      const originalHost = url.host;
      const originalHostname = url.hostname;
      const originalPathname = url.pathname;
      const originalPort = url.port;
      const originalProtocol = url.protocol;
      const originalSearch = url.search;
      const originalUsername = url.username;
      const originalPassword = url.password;

      // Apply changes
      url.hash = "#newHash";
      url.host = "newhost.com:8080";
      url.pathname = "/newpath";
      url.protocol = "https";
      url.search = "?new=value";
      url.username = "newuser";
      url.password = "newpass";

      // Verify all changes took effect
      expect(url.hash).toBe("#newHash");
      expect(url.hash).not.toBe(originalHash);

      expect(url.host).toBe("newhost.com:8080");
      expect(url.host).not.toBe(originalHost);

      expect(url.hostname).toBe("newhost.com");
      expect(url.hostname).not.toBe(originalHostname);

      expect(url.pathname).toBe("/newpath");
      expect(url.pathname).not.toBe(originalPathname);

      expect(url.port).toBe("8080");
      expect(url.port).not.toBe(originalPort);

      expect(url.protocol).toBe("https:");
      expect(url.protocol).not.toBe(originalProtocol);

      expect(url.search).toBe("?new=value");
      expect(url.search).not.toBe(originalSearch);

      expect(url.username).toBe("newuser");
      expect(url.username).not.toBe(originalUsername);

      expect(url.password).toBe("newpass");
      expect(url.password).not.toBe(originalPassword);

      // Verify the complete URL reflects all changes
      expect(url.toString()).toContain("https://");
      expect(url.toString()).toContain("newuser:newpass@");
      expect(url.toString()).toContain("newhost.com:8080");
      expect(url.toString()).toContain("/newpath");
      expect(url.toString()).toContain("?new=value");
      expect(url.toString()).toContain("#newHash");
    });
  });

  describe("clone method", () => {
    it("should create new instance with same URL", () => {
      const url = WritableURL.fromThrow("http://example.com/path?param=value#hash");
      const cloned = url.clone();

      expect(cloned).toBeInstanceOf(WritableURL);
      expect(cloned).not.toBe(url);
      expect(cloned.toString()).toBe(url.toString());
    });
  });

  describe("utility methods", () => {
    let url: WritableURL;

    beforeEach(() => {
      url = WritableURL.fromThrow("http://example.com/path");
    });

    it("test serialization", () => {
      const url = WritableURL.fromThrow("http://example.com/path");
      expect(JSON.stringify(url)).toBe(`"${url.toString()}"`);
    });

    it("should return JSON string", () => {
      expect(url.toJSON()).toBe(url.toString());
    });

    it("should return string for custom inspect", () => {
      const customInspectSymbol = Symbol.for("nodejs.util.inspect.custom");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      expect(url[customInspectSymbol]()).toBe(url.toString());
    });
  });
});

describe("ReadonlyURL.from", () => {
  it("should return Ok for valid url with protocol", () => {
    const result = ReadonlyURL.from("http://example.com/foo");
    expect(result.isOk()).toBe(true);
    expect(result.Ok().toString()).toBe("http://example.com/foo");
  });

  it("should return Err for invalid url", () => {
    const result = ReadonlyURL.from("not-a-url");
    expect(result.isErr()).toBe(true);
  });

  it("should return Err for invalid url 1", () => {
    const result = ReadonlyURL.from("not-a-url:");
    expect(result.isErr()).toBe(true);
  });

  it("should return Err for invalid url 2", () => {
    const result = ReadonlyURL.from("not-a-url:/");
    expect(result.isErr()).toBe(true);
  });

  it("should return Err for invalid urll 3", () => {
    const result = ReadonlyURL.from("not-a-url://kdkkef/df:dkdkfkdk");
    expect(result.isErr()).toBe(true);
  });

  it("should return Ok for custom protocol", () => {
    const result = ReadonlyURL.from("b0lix://foo/bar");
    expect(result.isOk()).toBe(true);
    expect(result.Ok().toString()).toBe("b0lix://foo/bar");
  });
});

describe("WritableURL.from", () => {
  it("should return Ok for valid url with protocol", () => {
    const result = WritableURL.from("http://example.com/foo");
    expect(result.isOk()).toBe(true);
    expect(result.Ok().toString()).toBe("http://example.com/foo");
  });

  it("should return Err for invalid url", () => {
    const result = WritableURL.from("not-a-url");
    expect(result.isErr()).toBe(true);
  });

  it("should return Err for invalid url 1", () => {
    const result = WritableURL.from("not-a-url:");
    expect(result.isErr()).toBe(true);
  });

  it("should return Err for invalid url 2", () => {
    const result = WritableURL.from("not-a-url:/");
    expect(result.isErr()).toBe(true);
  });

  it("should return Err for invalid urll 3", () => {
    const result = WritableURL.from("not-a-url://kdkkef/df:dkdkfkdk");
    expect(result.isErr()).toBe(true);
  });

  it("should return Ok for custom protocol", () => {
    const result = WritableURL.from("b0lix://foo/bar");
    expect(result.isOk()).toBe(true);
    expect(result.Ok().toString()).toBe("b0lix://foo/bar");
  });
});
