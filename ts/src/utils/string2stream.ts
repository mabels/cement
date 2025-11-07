import { TxtEnDecoder, TxtEnDecoderSingleton } from "../txt-en-decoder.js";

/**
 * Converts a string to a ReadableStream of Uint8Array chunks.
 *
 * Encodes the string as UTF-8 and creates a stream with a single chunk.
 * Useful for creating request bodies or piping string data through streams.
 *
 * @param str - The string to convert to a stream
 * @param ende - Optional TextEncoder (uses singleton if not provided)
 * @returns ReadableStream containing the encoded string
 *
 * @example
 * ```typescript
 * const stream = string2stream('Hello, World!');
 * await stream.pipeTo(writable);
 * ```
 */
export function string2stream(str: string, ende: TxtEnDecoder = TxtEnDecoderSingleton()): ReadableStream<Uint8Array> {
  return uint8array2stream(ende.encode(str));
}

/**
 * Converts a Uint8Array to a ReadableStream.
 *
 * Creates a stream that emits the Uint8Array as a single chunk then closes.
 *
 * @param str - The Uint8Array to convert to a stream
 * @returns ReadableStream containing the Uint8Array
 *
 * @example
 * ```typescript
 * const bytes = new Uint8Array([72, 101, 108, 108, 111]);
 * const stream = uint8array2stream(bytes);
 * ```
 */
export function uint8array2stream(str: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller): void {
      controller.enqueue(str);
      controller.close();
    },
  });
}
