import { exception2Result, Result } from "./result.js";

/**
 * Base configuration options shared by both sync and async chunky processing.
 *
 * @template T - The type of items in the input iterable
 */
export interface ChunkyBaseOptions<T> {
  /**
   * The input iterable to process. Can be an array, generator, or any iterable.
   */
  readonly input: Iterable<T>;

  /**
   * Predicate function that determines when to commit a chunk.
   * Called after each item is added to the current chunk.
   * When it returns true, the chunk is committed and a new chunk starts.
   *
   * @param chunked - The current accumulated chunk
   * @returns true to commit the chunk, false to continue accumulating
   *
   * @example
   * ```typescript
   * // Commit when chunk reaches 10 items
   * splitCondition: (chunked) => chunked.length >= 10
   * ```
   */
  splitCondition(chunked: T[]): boolean;

  /**
   * Optional callback invoked after each commit completes (success or failure).
   * Receives the result wrapped in a Result type and the commit index.
   *
   * @param result - Result.Ok() on success, Result.Err(error) on failure
   * @param idx - Zero-based index of the commit (0 for first chunk, 1 for second, etc.)
   *
   * @example
   * ```typescript
   * onCommit: (result, idx) => {
   *   if (result.isOk()) {
   *     console.log(`Chunk ${idx} committed successfully`)
   *   } else {
   *     console.error(`Chunk ${idx} failed:`, result.Err())
   *   }
   * }
   * ```
   */
  onCommit?(result: Result<void>, idx: number): void;
}

/**
 * Configuration options for synchronous chunky processing.
 *
 * @template T - The type of items in the input iterable
 */
export type ChunkySyncOptions<T> = ChunkyBaseOptions<T> & {
  /**
   * Synchronous function called to process each chunk.
   *
   * @param chunked - The chunk to commit
   *
   * @example
   * ```typescript
   * commit: (chunk) => { console.log('Processing', chunk.length, 'items') }
   * ```
   */
  commit(chunked: T[]): void;
};

/**
 * Configuration options for asynchronous chunky processing.
 * Supports infinite iterables - each chunk is awaited before consuming the next item.
 *
 * @template T - The type of items in the input iterable
 */
export type ChunkyAsyncOptions<T> = ChunkyBaseOptions<T> & {
  /**
   * Asynchronous function called to process each chunk.
   * Each commit is awaited before the next item is consumed from the input.
   *
   * @param chunked - The chunk to commit
   * @returns Promise that resolves when the chunk is processed
   *
   * @example
   * ```typescript
   * commit: async (chunk) => { await saveToDatabase(chunk) }
   * ```
   */
  commit(chunked: T[]): Promise<void>;
};

/**
 * Processes an iterable in chunks synchronously, committing each chunk when a condition is met.
 *
 * This function accumulates items from an iterable into chunks and commits them
 * based on a split condition. Commits are executed synchronously as the iteration progresses.
 *
 * ## Key Features
 *
 * - **Simple and fast**: No async overhead
 * - **Error resilience**: Uses exception2Result to wrap errors without aborting
 * - **Sequential processing**: Chunks are processed in order
 *
 * @template T - The type of items in the input iterable
 *
 * @param options - Configuration object containing input, splitCondition, commit, and onCommit
 *
 * @example
 * ```typescript
 * chunkySync({
 *   input: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
 *   splitCondition: (chunked) => chunked.length >= 3,
 *   commit: (chunk) => {
 *     console.log('Chunk:', chunk)
 *   }
 * })
 * // Output:
 * // Chunk: [1, 2, 3]
 * // Chunk: [4, 5, 6]
 * // Chunk: [7, 8, 9]
 * // Chunk: [10]
 * ```
 */
export function chunkySync<T>(options: ChunkySyncOptions<T>): void {
  let chunked: T[] = [];
  let commitIdx = 0;

  const doCommit = (chunk: T[]): void => {
    if (chunk.length === 0) return;

    const idx = commitIdx++;
    const result = exception2Result(() => options.commit(chunk));
    options.onCommit?.(result, idx);
  };

  for (const item of options.input) {
    chunked.push(item);
    if (options.splitCondition(chunked)) {
      doCommit(chunked);
      chunked = [];
    }
  }

  doCommit(chunked);
}

/**
 * Processes an iterable in chunks asynchronously, committing each chunk when a condition is met.
 *
 * This function accumulates items from an iterable into chunks and commits them
 * based on a split condition. Each commit is awaited before consuming the next item,
 * making it safe for infinite iterables.
 *
 * ## Key Features
 *
 * - **Infinite iterable support**: Awaits each commit before consuming next item
 * - **Sequential processing**: Commits execute one at a time in order
 * - **Error resilience**: Uses exception2Result to wrap errors without aborting
 * - **Memory efficient**: No unbounded queue buildup
 *
 * @template T - The type of items in the input iterable
 *
 * @param options - Configuration object containing input, splitCondition, commit, and onCommit
 * @returns Promise that resolves when all chunks are processed
 *
 * @example
 * ```typescript
 * await chunkyAsync({
 *   input: messages,
 *   splitCondition: (chunked) => chunked.length >= 100,
 *   commit: async (chunk) => {
 *     await api.batchSend(chunk)
 *   },
 *   onCommit: (result, idx) => {
 *     if (result.isErr()) {
 *       console.error(`Batch ${idx} failed:`, result.Err().message)
 *     }
 *   }
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Processing infinite generator
 * function* infiniteStream() {
 *   let i = 0
 *   while (true) yield i++
 * }
 *
 * // Safely processes chunks one at a time
 * await chunkyAsync({
 *   input: infiniteStream(),
 *   splitCondition: (chunked) => chunked.length >= 1000,
 *   commit: async (chunk) => {
 *     await processChunk(chunk)
 *   }
 * })
 * ```
 */
export async function chunkyAsync<T>(options: ChunkyAsyncOptions<T>): Promise<void> {
  let chunked: T[] = [];
  let commitIdx = 0;

  const doCommit = async (chunk: T[]): Promise<void> => {
    if (chunk.length === 0) return;

    const idx = commitIdx++;
    const result = await exception2Result(() => options.commit(chunk));
    options.onCommit?.(result, idx);
  };

  for (const item of options.input) {
    chunked.push(item);
    if (options.splitCondition(chunked)) {
      await doCommit(chunked);
      chunked = [];
    }
  }

  await doCommit(chunked);
}
