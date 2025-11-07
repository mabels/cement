/**
 * WritableStreamDefaultWriter that multiplexes writes to multiple underlying writers.
 *
 * FanoutWriteStream broadcasts all write operations to an array of writers simultaneously.
 * All operations (write, close, abort, releaseLock) are applied to all underlying writers.
 * Useful for scenarios like logging to multiple destinations, streaming to multiple
 * consumers, or maintaining redundant copies of stream data.
 *
 * @example
 * ```typescript
 * // Write to both file and console simultaneously
 * const fileStream = new WritableStream({ ... });
 * const consoleStream = new ConsoleWriterStream();
 *
 * const fanout = new FanoutWriteStream([
 *   fileStream.getWriter(),
 *   consoleStream.getWriter()
 * ]);
 *
 * // This writes to both destinations
 * await fanout.write(new TextEncoder().encode('Log message'));
 *
 * // Close all writers
 * await fanout.close();
 * ```
 *
 * @example
 * ```typescript
 * // Mirror stream data to multiple endpoints
 * const backupWriter = backupStream.getWriter();
 * const primaryWriter = primaryStream.getWriter();
 * const metricsWriter = metricsStream.getWriter();
 *
 * const fanout = new FanoutWriteStream([
 *   primaryWriter,
 *   backupWriter,
 *   metricsWriter
 * ]);
 *
 * // All three streams receive the data
 * for (const chunk of dataChunks) {
 *   await fanout.write(chunk);
 * }
 * ```
 */
export class FanoutWriteStream implements WritableStreamDefaultWriter<Uint8Array> {
  readonly _writers: WritableStreamDefaultWriter<Uint8Array>[];
  readonly ready: Promise<never>;
  readonly closed: Promise<never>;
  readonly desiredSize: number | null = null;
  constructor(writers: WritableStreamDefaultWriter<Uint8Array>[]) {
    this._writers = writers;
    this.ready = Promise.all(this._writers.map((w) => w.ready)) as Promise<never>;
    this.closed = Promise.all(this._writers.map((w) => w.closed)) as Promise<never>;
  }

  abort(reason?: unknown): Promise<void> {
    return Promise.all(this._writers.map((w) => w.abort(reason))).then(() => {
      /* do nothing */
    });
  }
  close(): Promise<void> {
    return Promise.all(this._writers.map((w) => w.close())).then(() => {
      /* do nothing */
    });
  }
  releaseLock(): void {
    this._writers.map((w) => w.releaseLock());
  }

  write(chunk?: Uint8Array): Promise<void> {
    return Promise.all(this._writers.map((w) => w.write(chunk))).then(() => {
      /* do nothing */
    });
  }
}
