import { it, expect } from "vitest";
import { JSONEnDecoderSingleton } from "@adviser/cement";

const jsonEnCoder = JSONEnDecoderSingleton();

it("should stringify", () => {
  expect(jsonEnCoder.stringify("abc")).toEqual('"abc"');
});
it("should unit8ify", () => {
  expect(jsonEnCoder.uint8ify("abc")).toEqual(new Uint8Array([34, 97, 98, 99, 34]));
});

it("should parse string", () => {
  expect(jsonEnCoder.parse('"abc"').Ok()).toEqual("abc");
});

it("should parse uint8", () => {
  expect(jsonEnCoder.parse(new Uint8Array([34, 97, 98, 99, 34])).Ok()).toEqual("abc");
});

it("should parse error", () => {
  expect(jsonEnCoder.parse("abc").Err().message).toMatch(/ not /);
});
