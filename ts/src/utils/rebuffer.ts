import { array2stream, stream2array } from "./stream-map.js";

interface ReChunkResult {
  readonly rest: Uint8Array;
  readonly chunk: Uint8Array;
}

/**
 * Rebuffers an array of Uint8Arrays to a specific chunk size.
 *
 * Convenience wrapper around rebuffer stream for array inputs/outputs.
 *
 * @param a - Array of Uint8Arrays to rebuffer
 * @param chunkSize - Target size for output chunks
 * @returns Promise resolving to array of rebuffered chunks
 *
 * @example
 * ```typescript
 * const chunks = [
 *   new Uint8Array([1, 2]),
 *   new Uint8Array([3, 4, 5]),
 *   new Uint8Array([6])
 * ];
 * const rebuffered = await rebufferArray(chunks, 3);
 * // [Uint8Array([1,2,3]), Uint8Array([4,5,6])]
 * ```
 */
export async function rebufferArray(a: Uint8Array[], chunkSize: number): Promise<Uint8Array[]> {
  return stream2array(rebuffer(array2stream(a), chunkSize));
}

function reChunk(cs: Uint8Array[], chunkSize: number): ReChunkResult {
  const len = cs.reduce((acc, v) => acc + v.length, 0);
  const last = cs[cs.length - 1];
  const lastOfs = len - last.length;
  // console.log("reChunk", len, lastOfs, last.length, chunkSize, chunkSize - lastOfs)
  const rest = last.subarray(chunkSize - lastOfs);
  cs[cs.length - 1] = last.subarray(0, chunkSize - lastOfs);
  const chunk = new Uint8Array(chunkSize);
  let ofs = 0;
  for (const c of cs) {
    chunk.set(c, ofs);
    ofs += c.length;
  }
  return { rest, chunk };
}

interface pumpState {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  tmp: Uint8Array[];
  tmpLen: number;
  readonly chunkSize: number;
}

function pump(ps: pumpState, controller: ReadableStreamDefaultController<Uint8Array>, next: () => void): void {
  ps.reader
    .read()
    .then(({ done, value }) => {
      if (done) {
        if (ps.tmpLen > 0) {
          controller.enqueue(reChunk(ps.tmp, ps.tmpLen).chunk);
        }
        controller.close();
        next();
        return;
      }
      if (ps.tmpLen + value.length > ps.chunkSize) {
        ps.tmp.push(value);
        const res = reChunk(ps.tmp, ps.chunkSize);
        controller.enqueue(res.chunk);
        ps.tmp = [res.rest];
        ps.tmpLen = res.rest.length;
        next();
        return;
      } else if (value.length) {
        ps.tmp.push(value);
        ps.tmpLen += value.length;
      }
      pump(ps, controller, next);
    })
    .catch((err) => {
      controller.error(err);
      next();
    });
}

/**
 * Transforms a stream of Uint8Arrays into fixed-size chunks.
 *
 * Rebuffers variable-sized chunks from the input stream into consistent
 * chunk sizes. The final chunk may be smaller if there's insufficient data.
 * Useful for network protocols, file formats, or APIs requiring specific
 * chunk sizes.
 *
 * @param a - Input ReadableStream with variable-sized Uint8Array chunks
 * @param chunkSize - Target size for output chunks in bytes
 * @returns ReadableStream emitting fixed-size chunks
 *
 * @example
 * ```typescript
 * // Stream has chunks: [10 bytes], [25 bytes], [5 bytes]
 * const fixedChunks = rebuffer(inputStream, 16);
 * // Output chunks: [16 bytes], [16 bytes], [8 bytes]
 *
 * // Useful for protocol framing
 * const framedStream = rebuffer(rawStream, 1024); // 1KB chunks
 * ```
 */
export function rebuffer(a: ReadableStream<Uint8Array>, chunkSize: number): ReadableStream<Uint8Array> {
  const state: pumpState = {
    reader: a.getReader(),
    tmp: [],
    tmpLen: 0,
    chunkSize,
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller): Promise<void> {
      return new Promise<void>((resolve) => {
        pump(state, controller, resolve);
      });
    },
  });
}
