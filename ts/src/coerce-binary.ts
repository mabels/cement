import { TxtEnDecoderSingleton } from "./txt-en-decoder.js";

export type CoerceBinaryInput = string | ArrayBufferLike | ArrayBufferView | Uint8Array; // | SharedArrayBuffer

/**
 * Type guard to check if a value is an ArrayBuffer.
 *
 * @param value - The value to check
 * @returns True if the value is an ArrayBuffer
 */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer || Object.prototype.toString.call(value) === "[object ArrayBuffer]";
}

/**
 * Type guard to check if a value is a Uint8Array.
 *
 * @param value - The value to check
 * @returns True if the value is a Uint8Array
 */
export function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array || Object.prototype.toString.call(value) === "[object Uint8Array]";
}

/**
 * Converts various binary input types (including Blob) to Uint8Array asynchronously.
 *
 * @param input - String, ArrayBuffer, ArrayBufferView, Uint8Array, or Blob to convert
 * @returns Promise resolving to Uint8Array
 */
export async function top_uint8(input: CoerceBinaryInput | Blob): Promise<Uint8Array> {
  if (input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  return to_uint8(input);
}

/**
 * Converts various binary input types to Uint8Array synchronously.
 *
 * Handles strings (encoding with TextEncoder), ArrayBuffers, and ArrayBufferViews.
 *
 * @param input - String, ArrayBuffer, ArrayBufferView, or Uint8Array to convert
 * @param encoder - Optional TextEncoder instance (uses singleton if not provided)
 * @returns Uint8Array representation of the input
 */
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

/**
 * Converts various binary input types to Blob.
 *
 * @param input - String, ArrayBuffer, ArrayBufferView, Uint8Array, or Blob to convert
 * @param encoder - Optional TextEncoder instance (uses singleton if not provided)
 * @returns Blob representation of the input
 */
export function to_blob(input: CoerceBinaryInput | Blob, encoder?: TextEncoder): Blob {
  if (input instanceof Blob) {
    return input;
  }
  const ab = to_arraybuf(to_uint8(input, encoder));
  return new Blob([ab]);
}

/**
 * Converts various binary input types to ArrayBuffer.
 *
 * @param input - String, ArrayBuffer, ArrayBufferView, or Uint8Array to convert
 * @param encoder - Optional TextEncoder instance (uses singleton if not provided)
 * @returns ArrayBuffer representation of the input
 */
export function to_arraybuf(input: CoerceBinaryInput, encoder?: TextEncoder): ArrayBuffer {
  if (input instanceof ArrayBuffer) {
    return input;
  }
  const u8 = to_uint8(input, encoder);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  // return to_uint8(input).buffer; //  as ArrayBuffer;
}
