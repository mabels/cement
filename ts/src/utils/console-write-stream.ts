export class ConsoleWriterStreamDefaultWriter implements WritableStreamDefaultWriter<Uint8Array> {
  readonly desiredSize: number | null = null;
  readonly decoder: TextDecoder = new TextDecoder();

  closed: Promise<never>;
  ready: Promise<never>;
  readonly _stream: ConsoleWriterStream;

  constructor(private stream: ConsoleWriterStream) {
    this._stream = stream;
    this.ready = Promise.resolve() as Promise<never>;
    this.closed = Promise.resolve() as Promise<never>;
  }
  abort(_reason?: unknown): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async close(): Promise<void> {
    // noop
  }
  releaseLock(): void {
    this._stream.locked = false;
    this.ready = Promise.resolve() as Promise<never>;
    this.closed = Promise.resolve() as Promise<never>;
  }
  write(chunk?: Uint8Array): Promise<void> {
    let strObj: string | { level: string } = this.decoder.decode(chunk).trimEnd();
    let output = "log";
    try {
      strObj = JSON.parse(strObj) as { level: string };
      output = strObj.level;
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
  abort(_reason?: unknown): Promise<void> {
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
