import { describe, it, expect } from "vitest";
import { PartType, pathJoin, relativePath, splitPath } from "@adviser/cement";

describe("relativePath", () => {
  describe("splitPath", () => {
    it("empty - split path into parts", () => {
      expect(splitPath("").parts).toEqual([]);
    });
    it("/ - split path into parts", () => {
      expect(splitPath("/").parts).toEqual([PartType.Root]);
    });
    it("///./// - split path into parts", () => {
      expect(splitPath("///.///").parts).toEqual([PartType.Root]);
    });

    it("/a/b/c/./d/../u - split path into parts", () => {
      expect(splitPath("/abb/b/cdd/./ddkkd/../ukdd///..//.///..///bl/.///.//.//mmm").parts).toEqual([
        PartType.Root,
        "abb",
        PartType.Slash,
        "b",
        PartType.Slash,
        "cdd",
        PartType.Slash,
        "ddkkd",
        PartType.Slash,
        PartType.Up,
        PartType.Slash,
        "ukdd",
        PartType.Slash,
        PartType.Up,
        PartType.Slash,
        PartType.Up,
        PartType.Slash,
        "bl",
        PartType.Slash,
        "mmm",
      ]);
    });
    it("/a/b/c/./d/../u/ - split path into parts", () => {
      expect(splitPath("/abb/b/cdd/./ddkkd/../ukdd///..//.///..///bl/.///.//.//mmm/").parts).toEqual([
        PartType.Root,
        "abb",
        PartType.Slash,
        "b",
        PartType.Slash,
        "cdd",
        PartType.Slash,
        "ddkkd",
        PartType.Slash,
        PartType.Up,
        PartType.Slash,
        "ukdd",
        PartType.Slash,
        PartType.Up,
        PartType.Slash,
        PartType.Up,
        PartType.Slash,
        "bl",
        PartType.Slash,
        "mmm",
        PartType.Slash,
      ]);
    });

    it("/a/b/c/./d/../u/ - split path into parts", () => {
      expect(splitPath("/abb/b/cdd/./ddkkd/../ukdd///..//.///..///bl/.///.//.//mmm//.////").parts).toEqual([
        PartType.Root,
        "abb",
        PartType.Slash,
        "b",
        PartType.Slash,
        "cdd",
        PartType.Slash,
        "ddkkd",
        PartType.Slash,
        PartType.Up,
        PartType.Slash,
        "ukdd",
        PartType.Slash,
        PartType.Up,
        PartType.Slash,
        PartType.Up,
        PartType.Slash,
        "bl",
        PartType.Slash,
        "mmm",
        PartType.Slash,
      ]);
    });

    it("aaa - split path into parts", () => {
      expect(splitPath("aaa").parts).toEqual(["aaa"]);
    });
    it("aa/..", () => {
      expect(splitPath("aa/..").parts).toEqual(["aa", PartType.Slash, PartType.Up]);
    });

    it("../aa/..", () => {
      expect(splitPath("aa/..").parts).toEqual(["aa", PartType.Slash, PartType.Up]);
    });

    it("./aaa - split path into parts", () => {
      expect(splitPath("./aaa").parts).toEqual(["aaa"]);
    });
    it("aaa/ - split path into parts", () => {
      expect(splitPath("aaa/").parts).toEqual(["aaa", PartType.Slash]);
    });
    it("relative ./aaa - split path into parts", () => {
      expect(splitPath(".////././aaa/").parts).toEqual(["aaa", PartType.Slash]);
    });

    it("../aaa - split path into parts", () => {
      expect(splitPath(".////././../././aaa/").parts).toEqual([PartType.Up, PartType.Slash, "aaa", PartType.Slash]);
    });

    it("../../aaa - split path into parts", () => {
      expect(splitPath(".././..////aaa/").parts).toEqual([
        PartType.Up,
        PartType.Slash,
        PartType.Up,
        PartType.Slash,
        "aaa",
        PartType.Slash,
      ]);
    });
  });
  describe("relativePath", () => {
    it("append relative to abs", () => {
      expect(relativePath("b/c/d", "/y/z/w")).toEqual("/y/z/w");
    });

    it("append relative to relative", () => {
      expect(relativePath("b/c/d", "y/z/w")).toEqual("b/c/d/y/z/w");
    });

    it("append up to relative", () => {
      expect(relativePath("../b/c/d", "y/z/w")).toEqual("../b/c/d/y/z/w");
    });

    it("append up to relative", () => {
      expect(relativePath("./b/c/d", "y/z/w")).toEqual("b/c/d/y/z/w");
    });

    it("override root", () => {
      expect(relativePath("/b/c/d", "/y/z/w")).toEqual("/y/z/w");
    });

    it("simple attach ", () => {
      expect(relativePath("/b/c/./d/./", "y/./z/w")).toEqual("/b/c/d/y/z/w");
    });

    it("simple with slash attach ", () => {
      expect(relativePath("/b/c/./d/././////", "./////y/./z/w")).toEqual("/b/c/d/y/z/w");
    });

    it("simple with .. attach ", () => {
      expect(relativePath("/b/c/./../d/././////", "../////y/./../z/w")).toEqual("/b/z/w");
    });

    it("simple simple .. attach ", () => {
      expect(relativePath("/b/top/", "../oo")).toEqual("/b/oo");
    });

    it("simple simple .. attach ", () => {
      expect(relativePath("/b/bb/../../../../hh", "")).toEqual("../../hh");
    });

    it("top over ../ attach ", () => {
      expect(relativePath("/b/bb/../../../hh/", "")).toEqual("../hh/");
    });

    it("simple simple .. attach ", () => {
      expect(relativePath("/b/top/", "../../oo")).toEqual("/oo");
    });
  });

  describe("pathJoin", () => {
    it("empty pathjoin", () => {
      expect(pathJoin("", "")).toEqual("");
    });

    it("both relative pathjoin", () => {
      expect(pathJoin("a/b", "c/d")).toEqual("a/b/c/d");
    });

    it("abs empty pathjoin", () => {
      expect(pathJoin("/a/b", "")).toEqual("/a/b");
    });

    it("empty abs pathjoin", () => {
      expect(pathJoin("", "/a/b")).toEqual("/a/b");
    });

    it("empty rel pathjoin", () => {
      expect(pathJoin("", "a/b")).toEqual("a/b");
    });

    it("abs abs pathjoin", () => {
      expect(pathJoin("/a/b", "//mm/dd")).toEqual("/a/b//mm/dd");
    });

    it("abs rel pathjoin", () => {
      expect(pathJoin("/a/b//", "mm/dd")).toEqual("/a/b//mm/dd");
    });

    it("abs// abs// pathjoin", () => {
      expect(pathJoin("/a/b//", "//mm/dd")).toEqual("/a/b////mm/dd");
    });

    it('kaputt "/b/c/./d", "y/./z/w"', () => {
      expect(pathJoin("/b/c/./d", "y/./z/w")).toEqual("/b/c/./d/y/./z/w");
    });
  });
});
