class LogWriter implements WritableStreamDefaultWriter<Uint8Array> {
  readonly _bufferArr: Uint8Array[] = [];

  _resolveClosed: (value?: PromiseLike<undefined>) => void;
  closed: Promise<undefined>;
  desiredSize: number | null = null;
  ready: Promise<undefined> = Promise.resolve(undefined);

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this._resolveClosed = () => {};
    this.closed = new Promise((resolve) => {
      this._resolveClosed = resolve;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  abort(reason?: any): Promise<void> {
    throw new Error("Method not implemented.");
  }
  close(): Promise<void> {
    this._resolveClosed();
    return Promise.resolve(undefined);
  }
  releaseLock(): void {
    // do nothing
  }
  write(chunk?: Uint8Array): Promise<void> {
    chunk && this._bufferArr.push(chunk);
    return Promise.resolve(undefined);
  }
}

export class LogCollector implements WritableStream<Uint8Array> {
  readonly locked: boolean = false;
  _writer?: LogWriter;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  abort(reason?: Uint8Array): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async close(): Promise<void> {
    if (this._writer) {
      const ret = await this._writer.close();
      this._writer = undefined;
      return ret;
    }
    return Promise.resolve(undefined);
  }

  getWriter(): WritableStreamDefaultWriter<Uint8Array> {
    if (!this._writer) {
      this._writer = new LogWriter();
    }
    return this._writer;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Logs(): any[] {
    if (!this._writer) {
      return [];
    }
    const jsonNlStr = new TextDecoder().decode(
      new Uint8Array(
        (function* (res: Uint8Array[]) {
          for (const x of res) {
            yield* x;
          }
        })(this._writer._bufferArr),
      ),
    );
    const splitStr = jsonNlStr.split("\n");
    const filterStr = splitStr.filter((a) => a.length);
    const mapStr = filterStr.map((a) => JSON.parse(a));
    return mapStr;
  }
}
