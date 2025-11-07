import { isPromise } from "../is-promise.js";

export interface StreamMap<T, U> {
  Map(s: T, idx: number): U | Promise<U>;
  readonly Close?: () => void;
}

/**
 * Transforms a ReadableStream by applying a mapping function to each chunk.
 *
 * Similar to Array.map() but for streams. Supports both sync and async
 * mapping functions. Calls optional Close callback when stream ends.
 *
 * @template T - Input chunk type
 * @template U - Output chunk type
 * @param s - The input ReadableStream
 * @param sm - StreamMap object with Map function and optional Close callback
 * @returns ReadableStream with transformed chunks
 *
 * @example
 * ```typescript
 * const numberStream = getNumberStream();
 * const doubled = streamMap(numberStream, {
 *   Map: (n) => n * 2,
 *   Close: () => console.log('Stream ended')
 * });
 *
 * // Async transformation
 * const enriched = streamMap(userStream, {
 *   Map: async (user) => {
 *     const details = await fetchUserDetails(user.id);
 *     return { ...user, ...details };
 *   }
 * });
 * ```
 */
export function streamMap<T, U>(s: ReadableStream<T>, sm: StreamMap<T, U>): ReadableStream<U> {
  const state = { reader: s.getReader(), streamMap: sm, idx: 0 };
  return new ReadableStream<U>({
    async pull(controller): Promise<void> {
      const { done, value } = await state.reader.read();
      if (done) {
        if (state.streamMap.Close) {
          state.streamMap.Close();
        }
        controller.close();
        return;
      }
      const promiseOrU = state.streamMap.Map(value, state.idx++);
      let mapped: U;
      if (isPromise(promiseOrU)) {
        mapped = await promiseOrU;
      } else {
        mapped = promiseOrU;
      }
      controller.enqueue(mapped);
    },
  });
}

/**
 * Consumes a ReadableStream without processing, counting the number of chunks.
 *
 * Reads and discards all chunks from the stream, returning only the count.
 * Useful for testing, benchmarking, or draining streams when you only need
 * to know how many items were produced.
 *
 * @template T - Stream element type
 * @param a - ReadableStream to consume
 * @returns Promise resolving to the number of chunks read
 *
 * @example
 * ```typescript
 * const stream = createDataStream();
 * const count = await devnull(stream);
 * console.log(`Stream produced ${count} chunks`);
 *
 * // Useful for benchmarking stream production
 * const start = Date.now();
 * const chunks = await devnull(dataGenerator());
 * console.log(`Generated ${chunks} chunks in ${Date.now() - start}ms`);
 * ```
 */
export async function devnull<T>(a: ReadableStream<T>): Promise<number> {
  const reader = a.getReader();
  let cnt = 0;
  while (true) {
    const { done } = await reader.read();
    if (done) {
      break;
    }
    cnt++;
  }
  return cnt;
}

/**
 * Converts an array to a ReadableStream.
 *
 * Each array element becomes a stream chunk. Useful for testing or
 * converting in-memory data to streaming format.
 *
 * @template T - The type of array elements
 * @param a - The array to convert
 * @returns ReadableStream emitting each array element
 *
 * @example
 * ```typescript
 * const stream = array2stream([1, 2, 3, 4, 5]);
 * await processStream(stream, (n) => console.log(n));
 * ```
 */
export function array2stream<T>(a: T[]): ReadableStream<T> {
  let i = 0;
  return new ReadableStream<T>({
    pull(controller): void {
      if (i >= a.length) {
        controller.close();
        return;
      }
      controller.enqueue(a[i]);
      i++;
    },
  });
}

/**
 * Converts a ReadableStream to an array by collecting all chunks.
 *
 * Reads the entire stream into memory, collecting all chunks into an array.
 * Use with caution on large or infinite streams as it loads everything into memory.
 *
 * @template T - Stream element type
 * @param a - ReadableStream to convert
 * @returns Promise resolving to array of all stream chunks
 *
 * @example
 * ```typescript
 * const stream = fetchDataStream();
 * const items = await stream2array(stream);
 * console.log(`Received ${items.length} items`);
 *
 * // Process stream as array
 * const numbers = await stream2array(numberStream);
 * const sum = numbers.reduce((a, b) => a + b, 0);
 * ```
 */
export async function stream2array<T>(a: ReadableStream<T>): Promise<T[]> {
  const ret: T[] = [];
  const reader = a.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    ret.push(value);
  }
  return ret;
}
