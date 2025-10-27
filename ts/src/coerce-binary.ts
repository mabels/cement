import { TxtEnDecoderSingleton } from "./txt-en-decoder.js";

export type CoerceBinaryInput = string | ArrayBufferLike | ArrayBufferView | Uint8Array; // | SharedArrayBuffer

export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer || Object.prototype.toString.call(value) === "[object ArrayBuffer]";
}

export function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array || Object.prototype.toString.call(value) === "[object Uint8Array]";
}

export async function top_uint8(input: CoerceBinaryInput | Blob): Promise<Uint8Array> {
  if (input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  return to_uint8(input);
}

export function to_uint8(input: CoerceBinaryInput, encoder?: TextEncoder): Uint8Array {
  if (typeof input === "string") {
    return (encoder ?? TxtEnDecoderSingleton()).encode(input);
  }
  if (isArrayBuffer(input)) {
    return new Uint8Array(input);
  }

  if (isUint8Array(input)) {
    return input;
  }
  // not nice but we make the cloudflare types happy
  return new Uint8Array(input as unknown as ArrayBufferLike);
}

export function to_blob(input: CoerceBinaryInput | Blob, encoder?: TextEncoder): Blob {
  if (input instanceof Blob) {
    return input;
  }
  const ab = to_arraybuf(to_uint8(input, encoder));
  return new Blob([ab]);
}

export function to_arraybuf(input: CoerceBinaryInput, encoder?: TextEncoder): ArrayBuffer {
  if (input instanceof ArrayBuffer) {
    return input;
  }
  const u8 = to_uint8(input, encoder);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  // return to_uint8(input).buffer; //  as ArrayBuffer;
}
