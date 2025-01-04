export class FanoutWriteStream implements WritableStreamDefaultWriter<Uint8Array> {
  readonly _writers: WritableStreamDefaultWriter<Uint8Array>[];
  readonly ready: Promise<undefined>;
  readonly closed: Promise<undefined>;
  readonly desiredSize: number | null = null;
  constructor(writers: WritableStreamDefaultWriter<Uint8Array>[]) {
    this._writers = writers;
    this.ready = Promise.all(this._writers.map((w) => w.ready)).then(() => undefined);
    this.closed = Promise.all(this._writers.map((w) => w.closed)).then(() => undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abort(reason?: any): Promise<void> {
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
