import { isPromise } from "@adviser/cement";

/**
 * Consumes a ReadableStream, applying a callback to each chunk and collecting results.
 *
 * Processes each chunk through the callback and returns an array of all results.
 * Waits for async callbacks to complete before processing the next chunk.
 *
 * @template E - Stream element type
 * @template R - Callback return type
 * @param stream - The ReadableStream to consume
 * @param cb - Callback function applied to each chunk
 * @returns Promise resolving to array of all callback results
 *
 * @example
 * ```typescript
 * const results = await consumeStream(numberStream, (n) => n * 2);
 * console.log(results); // [2, 4, 6, 8, ...]
 * ```
 */
export function consumeStream<E, R>(stream: ReadableStream<E>, cb: (msg: E) => R): Promise<R[]> {
  const ret: R[] = [];
  return processStream(stream, (msg) =>
    Promise.resolve(cb(msg)).then((r) => {
      ret.push(r);
    }),
  ).then(() => ret);
}

/**
 * Processes a ReadableStream with a callback function and optional context.
 *
 * Similar to consumeStream but doesn't collect results - just processes each
 * chunk sequentially. Useful for side effects like logging, writing to files, etc.
 *
 * @template E - Stream element type
 * @template CTX - Context type passed to callback
 * @param stream - The ReadableStream to process
 * @param cb - Callback function applied to each chunk (receives chunk and context)
 * @param ctx - Optional context object passed to each callback invocation
 * @returns Promise that resolves when stream is fully processed
 *
 * @example
 * ```typescript
 * await processStream(logStream, (entry, ctx) => {
 *   ctx.count++;
 *   console.log(`[${ctx.count}]`, entry);
 * }, { count: 0 });
 * ```
 */
export function processStream<E, CTX = object>(
  stream: ReadableStream<E>,
  cb: (msg: E, ctx: CTX) => Promise<void> | void,
  ctx: CTX = {} as CTX,
): Promise<void> {
  const reader = stream.getReader();
  function readNext(ctx: CTX): Promise<void> {
    return reader.read().then(({ done, value }) => {
      if (done) {
        return;
      }
      return Promise.resolve(cb(value, ctx)).then(() => readNext(ctx));
    });
  }
  return readNext(ctx);
}

export interface StepCfg<CTX = object> {
  readonly chunkSize: number;
  readonly setTimeoutFn: (fn: () => void, delay: number) => void;
  readonly ctx: CTX;
}

interface StepArgs<I extends IterableIterator<E> | AsyncIterableIterator<E>, E, CTX> extends StepCfg<CTX> {
  readonly iter: I;
  readonly cb: (msg: E, ctx: CTX) => Promise<void> | void;
  readonly resolve: () => void;
  readonly reject: (reason: Error) => void;
  chunk: number;
}

function step<I extends IterableIterator<E> | AsyncIterableIterator<E>, R, E>(args: StepArgs<I, E, R>): Promise<void> {
  const item = args.iter.next();
  return Promise.resolve(item).then(({ done, value }: { done?: boolean; value: E }) => {
    if (done) {
      args.resolve();
      return Promise.resolve();
    }
    try {
      return Promise.resolve(args.cb(value, args.ctx)).then(() => {
        if (isPromise(item) && args.chunk >= args.chunkSize) {
          args.setTimeoutFn(() => {
            args.chunk = 0;
            void step(args);
          }, 0);
          return Promise.resolve();
        } else {
          args.chunk++;
          return step(args);
        }
      });
    } catch (e) {
      args.reject(e as Error);
      return Promise.resolve();
    }
  });
}

/**
 * Consumes an iterator, applying a callback to each item and collecting results.
 *
 * Processes sync or async iterators, calling the callback for each item and
 * returning an array of all results. Supports chunked processing with configurable
 * chunk size to yield control back to the event loop periodically.
 *
 * @template T - Iterator element type
 * @template R - Callback return type
 * @param iter - Iterator or async iterator to consume
 * @param cb - Callback function applied to each item
 * @param params - Optional configuration (chunkSize, setTimeoutFn, ctx)
 * @returns Promise resolving to array of all callback results
 *
 * @example
 * ```typescript
 * function* numbers() {
 *   yield 1; yield 2; yield 3;
 * }
 *
 * const results = await consumeIterator(numbers(), (n) => n * 2);
 * console.log(results); // [2, 4, 6]
 *
 * // Async iterator with custom chunk size
 * const data = await consumeIterator(asyncIterator, processItem, {
 *   chunkSize: 32 // Yield to event loop every 32 items
 * });
 * ```
 */
export function consumeIterator<T, R>(
  iter: IterableIterator<T> | AsyncIterableIterator<T>,
  cb: (msg: T) => R,
  params: Partial<StepCfg<R[]>> = {},
): Promise<R[]> {
  const ret: R[] = [];
  return processIterator<T, R[]>(
    iter,
    (value) =>
      Promise.resolve(cb(value)).then((r) => {
        ret.push(r);
      }),
    { ...params, ctx: params.ctx ?? ret },
  ).then(() => ret);
}

/**
 * Processes an iterator with a callback function for side effects.
 *
 * Similar to consumeIterator but doesn't collect results - just processes each
 * item sequentially. Supports chunked processing to avoid blocking the event loop
 * during long-running iterations. Useful for side effects like logging, writing
 * to files, or updating UI.
 *
 * @template T - Iterator element type
 * @template CTX - Context type passed to callback
 * @param iter - Iterator or async iterator to process
 * @param cb - Callback function applied to each item
 * @param params - Optional configuration (chunkSize, setTimeoutFn, ctx)
 * @returns Promise that resolves when iteration is complete
 *
 * @example
 * ```typescript
 * function* logs() {
 *   yield 'Starting...';
 *   yield 'Processing...';
 *   yield 'Complete!';
 * }
 *
 * await processIterator(logs(), (msg) => console.log(msg));
 *
 * // With context and chunked processing
 * const ctx = { count: 0 };
 * await processIterator(
 *   largeDataIterator,
 *   (item, ctx) => {
 *     ctx.count++;
 *     processItem(item);
 *   },
 *   { ctx, chunkSize: 100 } // Yield every 100 items
 * );
 * console.log(`Processed ${ctx.count} items`);
 * ```
 */
export function processIterator<T, CTX = object>(
  iter: IterableIterator<T> | AsyncIterableIterator<T>,
  cb: (msg: T) => Promise<void> | void,
  params: Partial<StepCfg<CTX>> = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    void step({
      setTimeoutFn: setTimeout,
      chunkSize: 16,
      ctx: {} as CTX,
      ...params,
      iter,
      cb,
      reject,
      resolve,
      chunk: 0,
    });
  });
}
