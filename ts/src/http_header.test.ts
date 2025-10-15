import { HttpHeader } from "./http_header.js";
import { describe, it, expect } from "vitest";

class OnlyForEach {
  readonly _my: Record<string, string | string[]>;
  constructor(init: Record<string, string | string[]> = {}) {
    this._my = { ...init };
  }
  forEach<This = unknown>(callback: (this: This, value: string, key: string, parent: OnlyForEach) => void, thisArg?: This): void {
    for (const [k, v] of Object.entries(this._my)) {
      if (Array.isArray(v)) {
        for (const vv of v) {
          callback.call(thisArg, vv, k, this);
        }
      } else {
        callback.call(thisArg, v, k, this);
      }
    }
  }
}

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

  it("From receives HttpHeader", () => {
    const sh = HttpHeader.from(HttpHeader.from({ "Content-Type": "application/json" }));
    const h = HttpHeader.from(sh);
    expect(h).not.toBe(sh);
    expect(h.Items()).toEqual([["content-type", ["application/json"]]]);
  });

  it("Merge two HttpHeaders", () => {
    const CORS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE",
      "Access-Control-Allow-Headers": "Origin, Content-Type, Accept",
      "Access-Control-Max-Age": "86400",
    };
    const headers = HttpHeader.from(
      Object.fromEntries(
        Object.entries({
          ...CORS,
        }).map(([k, v]) => [k.toUpperCase(), v]),
      ),
      CORS,
    ).AsRecordStringString();
    expect(headers).toEqual(Object.fromEntries(Object.entries(CORS).map(([k, v]) => [k.toLowerCase(), v])));
  });

  it("OnlyForEach Headers", () => {
    const h = HttpHeader.from(
      new OnlyForEach({
        "Content-Type": "application/json",
        Array: ["a", "b"],
        String: "string,with,commas",
        ArrayWithCommas: ["string,with,commas", "and,more,,commas", ""],
      }),
    );
    expect(h.Items()).toEqual([
      ["content-type", ["application/json"]],
      ["array", ["a", "b"]],
      ["string", ["string", "with", "commas"]],
      ["arraywithcommas", ["string", "with", "commas", "and", "more"]],
    ]);
  });
});
