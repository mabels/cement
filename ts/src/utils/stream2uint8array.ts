import { concatUint8 } from "./concat-uint8.js";

/**
 * A strategy that consumes a stream and returns all of its bytes.
 *
 * All strategies accept `undefined` and resolve to an empty `Uint8Array`.
 */
export type Stream2Uint8ArrayStrategy = (stream?: ReadableStream<Uint8Array>) => Promise<Uint8Array>;

/**
 * Upper bound used by {@link stream2uint8arrayGrowResizable}.
 *
 * `ArrayBuffer` is resizable, but the maximum byte length has to be known up
 * front, so this is a pragmatic default cap for binary stream consumption.
 */
export const STREAM2UINT8ARRAY_RESIZABLE_MAX_BYTES = 1024 * 1024 * 1024;

/**
 * Returns whether the runtime supports resizable `ArrayBuffer`s (ES2024).
 *
 * Runtimes without support fall back to
 * {@link stream2uint8arrayChunkAndJoin} as the default strategy.
 */
export const supportsResizableArrayBuffer: boolean = (function (): boolean {
  try {
    const buffer = new ArrayBuffer(0, { maxByteLength: 16 });
    buffer.resize(0);
    return true;
  } catch {
    return false;
  }
})();

function assertChunk(value: Uint8Array): void {
  if (!ArrayBuffer.isView(value)) {
    throw new TypeError("stream2uint8array: stream chunk is not an ArrayBufferView");
  }
}

/**
 * Original implementation: rebuilds the accumulated buffer on every chunk.
 *
 * This spreads every byte read so far into a JS number array and copies it into
 * a new `Uint8Array`, so total work grows quadratically with the stream size.
 * Kept as a baseline for benchmarks and as an explicit strategy.
 */
export async function stream2uint8arraySimple(stream?: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  if (!stream) {
    return Promise.resolve(new Uint8Array());
  }
  const reader = stream.getReader();
  let res = new Uint8Array();
  // eslint-disable-next-line no-constant-condition
  while (1) {
    try {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      res = new Uint8Array([...res, ...value]);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject(err);
    }
  }
  return Promise.resolve(res);
}

/**
 * Copies every chunk, then allocates the exact result size once and copies each
 * chunk into it. Runtime is O(n); peak memory is roughly input + output.
 */
export async function stream2uint8arrayChunkAndJoin(stream?: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  if (!stream) {
    return new Uint8Array();
  }
  const reader = stream.getReader();
  try {
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      assertChunk(value);
      chunks.push(value.slice());
    }
    return concatUint8(...chunks);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Grows a regular `Uint8Array` by doubling its capacity while reading.
 *
 * Chunks are copied into the growing buffer and can be released immediately.
 * Growth copies the previously accumulated bytes, so runtime stays amortized
 * O(n), but the returned view keeps the over-allocated backing buffer.
 */
export async function stream2uint8arrayGrowBuffer(stream?: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  if (!stream) {
    return new Uint8Array();
  }
  const reader = stream.getReader();
  let buffer = new Uint8Array(0);
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      assertChunk(value);
      const needed = length + value.byteLength;
      if (needed > buffer.length) {
        let next = buffer.length === 0 ? Math.max(4096, value.byteLength) : buffer.length;
        while (next < needed) {
          next *= 2;
        }
        const grown = new Uint8Array(next);
        grown.set(buffer.subarray(0, length));
        buffer = grown;
      }
      buffer.set(value, length);
      length = needed;
    }
    return buffer.subarray(0, length);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Creates a resizable-buffer strategy with a custom maximum byte length.
 *
 * The strategy grows a resizable `ArrayBuffer` in place while reading. On
 * runtimes that resize without copying, peak memory stays close to the final
 * stream size instead of the input + output doubling of
 * {@link stream2uint8arrayChunkAndJoin}. The returned `Uint8Array` is a
 * length-tracking view whose buffer may still be flagged as resizable.
 *
 * Throws a `RangeError` when the stream exceeds `maxBuf`.
 *
 * @param maxBuf - Maximum number of bytes the strategy accepts
 * @returns A strategy suitable for the second argument of {@link stream2uint8array}
 *
 * @example
 * ```typescript
 * const bytes = await stream2uint8array(response.body, fnStream2uint8arrayGrowResizable(8 * 1024 * 1024));
 * ```
 */
export function fnStream2uint8arrayGrowResizable(
  maxBuf: number = STREAM2UINT8ARRAY_RESIZABLE_MAX_BYTES,
): Stream2Uint8ArrayStrategy {
  if (!Number.isFinite(maxBuf) || maxBuf < 0) {
    throw new RangeError(`stream2uint8array: maxBuf must be a non-negative finite number, got ${maxBuf}`);
  }
  const maxBytes = Math.floor(maxBuf);
  return async (stream?: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
    if (!stream) {
      return new Uint8Array();
    }
    const ab = new ArrayBuffer(0, { maxByteLength: maxBytes });
    const buffer = new Uint8Array(ab);
    let length = 0;
    const reader = stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        assertChunk(value);
        const needed = length + value.byteLength;
        if (needed > maxBytes) {
          throw new RangeError(`stream2uint8array: stream exceeds resizable buffer cap of ${maxBytes} bytes`);
        }
        if (needed > ab.byteLength) {
          let next = ab.byteLength === 0 ? Math.min(Math.max(4096, value.byteLength), maxBytes) : ab.byteLength;
          while (next < needed) {
            next = Math.min(next * 2, maxBytes);
          }
          ab.resize(next);
        }
        buffer.set(value, length);
        length = needed;
      }
      ab.resize(length);
      return buffer;
    } finally {
      reader.releaseLock();
    }
  };
}

/**
 * Default resizable-buffer strategy, capped at
 * {@link STREAM2UINT8ARRAY_RESIZABLE_MAX_BYTES}.
 *
 * Use {@link fnStream2uint8arrayGrowResizable} to choose a different cap.
 */
export const stream2uint8arrayGrowResizable: Stream2Uint8ArrayStrategy = fnStream2uint8arrayGrowResizable();

function defaultStream2Uint8ArrayStrategy(): Stream2Uint8ArrayStrategy {
  return supportsResizableArrayBuffer ? stream2uint8arrayGrowResizable : stream2uint8arrayChunkAndJoin;
}

/**
 * Converts a `ReadableStream` of `Uint8Array` chunks to a single `Uint8Array`.
 *
 * Delegates to the given strategy so callers can trade runtime against memory
 * footprint. Defaults to {@link stream2uint8arrayGrowResizable} when the runtime
 * supports resizable `ArrayBuffer`s, otherwise to
 * {@link stream2uint8arrayChunkAndJoin}.
 *
 * @param stream - The stream to consume (returns an empty array if undefined)
 * @param strategy - Implementation used to consume the stream
 * @returns Promise resolving to the concatenated bytes
 *
 * @example
 * ```typescript
 * const bytes = await stream2uint8array(response.body);
 *
 * // Cap the resizable buffer explicitly
 * const capped = await stream2uint8array(response.body, fnStream2uint8arrayGrowResizable(8 * 1024 * 1024));
 * ```
 */
export async function stream2uint8array(
  stream?: ReadableStream<Uint8Array>,
  strategy: Stream2Uint8ArrayStrategy = defaultStream2Uint8ArrayStrategy(),
): Promise<Uint8Array> {
  return strategy(stream);
}
