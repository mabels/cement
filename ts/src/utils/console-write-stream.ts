export class ConsoleWriterStreamDefaultWriter implements WritableStreamDefaultWriter<Uint8Array> {
  readonly desiredSize: number | null = null;
  readonly decoder: TextDecoder = new TextDecoder();

  closed: Promise<undefined>;
  ready: Promise<undefined>;
  readonly _stream: ConsoleWriterStream;

  constructor(private stream: ConsoleWriterStream) {
    this._stream = stream;
    this.ready = Promise.resolve(undefined);
    this.closed = Promise.resolve(undefined);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  abort(reason?: any): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async close(): Promise<void> {
    // noop
  }
  releaseLock(): void {
    this._stream.locked = false;
    this.ready = Promise.resolve(undefined);
    this.closed = Promise.resolve(undefined);
  }
  write(chunk?: Uint8Array): Promise<void> {
    let strObj: string | { level: string } = this.decoder.decode(chunk).trimEnd();
    let output = "log";
    try {
      strObj = JSON.parse(strObj) as { level: string };
      output = strObj.level;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      /* noop */
    }
    switch (output) {
      case "error":
        // eslint-disable-next-line no-console
        console.error(strObj);
        break;
      case "warn":
        // eslint-disable-next-line no-console
        console.warn(strObj);
        break;
      default:
        // eslint-disable-next-line no-console
        console.log(strObj);
    }
    return Promise.resolve();
  }
}

export class ConsoleWriterStream implements WritableStream<Uint8Array> {
  locked = false;
  _writer?: WritableStreamDefaultWriter<Uint8Array>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  abort(reason?: any): Promise<void> {
    throw new Error("Method not implemented.");
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
  getWriter(): WritableStreamDefaultWriter<Uint8Array> {
    if (this.locked) {
      throw new Error("Stream is locked");
    }
    this.locked = true;
    if (!this._writer) {
      this._writer = new ConsoleWriterStreamDefaultWriter(this);
    }
    return this._writer;
  }
}
