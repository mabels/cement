import { Result } from "./result.js";
import { TxtEnDecoderSingleton } from "./txt-en-decoder.js";

const utf8 = TxtEnDecoderSingleton();
it("there should be one Utf8EnDecoder", () => {
  expect(utf8).toBe(TxtEnDecoderSingleton());
});

it("should encode", () => {
  expect(utf8.encode("abc")).toEqual(new Uint8Array([97, 98, 99]));
});

it("should decode uint8", () => {
  expect(utf8.decode(new Uint8Array([97, 98, 99]))).toEqual("abc");
});

it("should decode string", () => {
  expect(utf8.decode("abc")).toEqual("abc");
});

it("should decode ArrayBuffer", () => {
  expect(utf8.decode(new Uint8Array([97, 98, 99]).buffer)).toEqual("abc");
});

it("should decode ArrayBufferView", () => {
  expect(utf8.decode(new DataView(new Uint8Array([97, 98, 99]).buffer))).toEqual("abc");
});

it("should decode Blob", async () => {
  expect(await utf8.asyncDecode(new Blob([new Uint8Array([97, 98, 99])]))).toEqual("abc");
});

it("should decode coercePromise Uint8Array", async () => {
  expect(await utf8.asyncDecode(new Uint8Array([97, 98, 99]))).toEqual("abc");
});

it("should decode Promise.Uint8Array", async () => {
  expect(await utf8.asyncDecode(Promise.resolve(new Uint8Array([97, 98, 99])))).toEqual("abc");
});

it("should decode Promise.Result.Uint8Array", async () => {
  expect(await utf8.asyncDecode(Promise.resolve(Result.Ok(new Uint8Array([97, 98, 99]))))).toEqual("abc");
});

it("should decode Buffer", () => {
  if (!globalThis.Buffer) return;
  expect(utf8.decode(Buffer.from("abc"))).toEqual("abc");
});

it("should decode Result<Uint8Array>", () => {
  expect(utf8.decode(Result.Ok(new Uint8Array([97, 98, 99])))).toEqual("abc");
});

it("should decode Result<String>", () => {
  expect(utf8.decode(Result.Ok("abc"))).toEqual("abc");
});

it("should decode Result.Error -> exception", () => {
  expect(() => utf8.decode(Result.Err<string>("x"))).toThrow("x");
});
