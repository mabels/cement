import { HttpHeader } from "./http_header.js";

describe("HttpHeader", () => {
  it("Add should join different case headings to case insensitive ", () => {
    const h = HttpHeader.from({
      "Content-Type": "application/json",
    });

    h.Add("content-Type", "application/xml");
    expect(h.Get("Content-Type")).toEqual("application/json");
    expect(h.Values("Content-Type")).toEqual(["application/json", "application/xml"]);
  });
  it("items should return all items", () => {
    const h = new HttpHeader();
    expect(h.Items()).toEqual([]);
    h.Add("key", []);
    expect(h.Items()).toEqual([]);
    h.Add("key", "value");
    expect(h.Items()).toEqual([["key", ["value"]]]);
  });
  it("Set and Get should be case insensitive", () => {
    const h = HttpHeader.from({
      "Content-Type": "application/json",
    });

    h.Set("content-Type", "application/xml");
    expect(h.Values("Content-Type")).toEqual(["application/xml"]);
    expect(h.Values("content-Type")).toEqual(["application/xml"]);
  });
  it("Get with empty values should return undefined and empty Items", () => {
    const h = new HttpHeader();
    h.Add("key", []);

    expect(h.Get("key")).toBe(undefined);
    expect(h.Values("key")).toEqual([]);

    expect(h.Items()).toEqual([]);
  });

  it("from Array", () => {
    const h = HttpHeader.from([
      ["Content-Type", "application/json"],
      ["Content-Type", "application/xml"],
      ["bla", "application/xml"],
      ["blub", ["bla", "blub"]],
    ] as HeadersInit);
    expect(h.SortItems()).toEqual([
      ["bla", ["application/xml"]],
      ["blub", ["bla", "blub"]],
      ["content-type", ["application/json", "application/xml"]],
    ]);
  });

  it("from Object", () => {
    const h = HttpHeader.from({
      "Content-Type": "application/json",
      "content-Type": "application/xml",
      bla: "application/xml",
      blub: ["bla", "blub"] as unknown as string,
    });
    expect(h.SortItems()).toEqual([
      ["bla", ["application/xml"]],
      ["blub", ["bla", "blub"]],
      ["content-type", ["application/json", "application/xml"]],
    ]);
  });

  it("from Headers", () => {
    const header = new Headers();
    header.append("Content-Type", "application/json");
    header.append("content-Type", "application/xml");
    header.append("bla", "application/xml");
    header.append("blub", "bla");
    header.append("bluB", "blub");
    const h = HttpHeader.from(header);
    expect(h.Items()).toEqual([
      ["bla", ["application/xml"]],
      ["blub", ["bla", "blub"]],
      ["content-type", ["application/json", "application/xml"]],
    ]);
  });

  it("AbstractHeaders", () => {
    const ah = new HttpHeader().AsHeaders();
    ah.append("a", "b");
    expect(Array.from(ah.keys())).toEqual(["a"]);
    expect(Array.from(ah.entries())).toEqual([["a", "b"]]);
    ah.append("a", "c");
    expect(Array.from(ah.keys())).toEqual(["a"]);
    expect(Array.from(ah.entries())).toEqual([["a", "b, c"]]);
    ah.append("a", "d, e");
    expect(Array.from(ah.keys())).toEqual(["a"]);
    expect(Array.from(ah.entries())).toEqual([["a", "b, c, d, e"]]);
    ah.append("v", "w");
    expect(Array.from(ah.keys())).toEqual(["a", "v"]);
    expect(Array.from(ah.values())).toEqual(["b, c, d, e", "w"]);
  });
});
