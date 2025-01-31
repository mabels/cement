import { Result } from "./result.js";
import { Utf8EnDecoderSingleton } from "./txt-en-decoder.js";

it("there should be one Utf8EnDecoder", () => {
  expect(Utf8EnDecoderSingleton()).toBe(Utf8EnDecoderSingleton());
});

it("should encode", () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(utf8.encode("abc")).toEqual(new Uint8Array([97, 98, 99]));
});

it("should decode uint8", () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(utf8.decode(new Uint8Array([97, 98, 99]))).toEqual("abc");
});

it("should decode string", () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(utf8.decode("abc")).toEqual("abc");
});

it("should decode ArrayBuffer", () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(utf8.decode(new Uint8Array([97, 98, 99]).buffer)).toEqual("abc");
});

it("should decode ArrayBufferView", () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(utf8.decode(new DataView(new Uint8Array([97, 98, 99]).buffer))).toEqual("abc");
});

it("should decode Blob", async () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(await utf8.asyncDecode(new Blob([new Uint8Array([97, 98, 99])]))).toEqual("abc");
});

it("should decode coercePromise Uint8Array", async () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(await utf8.asyncDecode(new Uint8Array([97, 98, 99]))).toEqual("abc");
});

it("should decode Promise.Uint8Array", async () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(await utf8.asyncDecode(Promise.resolve(new Uint8Array([97, 98, 99])))).toEqual("abc");
});

it("should decode Promise.Result.Uint8Array", async () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(await utf8.asyncDecode(Promise.resolve(Result.Ok(new Uint8Array([97, 98, 99]))))).toEqual("abc");
});

it("should decode Buffer", () => {
  if (!globalThis.Buffer) return;
  const utf8 = Utf8EnDecoderSingleton();
  expect(utf8.decode(Buffer.from("abc"))).toEqual("abc");
});

it("should decode Result<Uint8Array>", () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(utf8.decode(Result.Ok(new Uint8Array([97, 98, 99])))).toEqual("abc");
});

it("should decode Result<String>", () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(utf8.decode(Result.Ok("abc"))).toEqual("abc");
});

it("should decode Result.Error -> exception", () => {
  const utf8 = Utf8EnDecoderSingleton();
  expect(() => utf8.decode(Result.Err<string>("x"))).toThrow("x");
});
