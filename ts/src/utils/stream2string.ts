/**
 * Converts a ReadableStream of Uint8Array chunks to a string.
 *
 * Reads the entire stream (or up to maxSize bytes) and decodes it as UTF-8 text.
 * Useful for consuming response bodies, file streams, etc.
 *
 * @param stream - The ReadableStream to convert (returns empty string if null/undefined)
 * @param maxSize - Optional maximum bytes to read before stopping
 * @returns Promise resolving to the decoded string
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/data');
 * const text = await stream2string(response.body);
 * console.log(text);
 *
 * // With size limit
 * const preview = await stream2string(response.body, 1000); // First 1KB
 * ```
 */
export async function stream2string(stream?: ReadableStream<Uint8Array> | null, maxSize?: number): Promise<string> {
  if (!stream) {
    return Promise.resolve("");
  }
  const reader = stream.getReader();
  let res = "";
  const decoder = new TextDecoder(); // we use stream: true so no TxtEnDecoderSingleton
  let rSize = 0;
  while (typeof maxSize === "undefined" || rSize < maxSize) {
    try {
      const read = await reader.read();
      if (read.done) {
        break;
      }
      if (maxSize && rSize + read.value.length > maxSize) {
        read.value = read.value.slice(0, maxSize - rSize);
      }
      const block = decoder.decode(read.value, { stream: true });
      rSize += read.value.length;
      res += block;
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject(err);
    }
  }
  return Promise.resolve(res);
}

/**
 * Binary stream helpers live in `./stream2uint8array.js` and are re-exported
 * here for backwards compatibility.
 */
export * from "./stream2uint8array.js";
