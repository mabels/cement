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
    try {
      strObj = JSON.parse(strObj) as { level: string };
      const output = strObj.level || "log";
      const cargs: unknown[] = [strObj];
      if ("msg" in strObj) {
        cargs.unshift(strObj.msg);
        delete strObj["msg"];
      }
      switch (output) {
        case "error":
          this._stream.params.error(...cargs);
          break;
        case "warn":
          this._stream.params.warn(...cargs);
          break;
        default:
          this._stream.params.log(...cargs);
      }
    } catch (e) {
      this._stream.params.log(strObj);
    }
    return Promise.resolve();
  }
}

export interface ConsoleWriterStreamParams {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

export class ConsoleWriterStream implements WritableStream<Uint8Array> {
  locked = false;
  _writer?: WritableStreamDefaultWriter<Uint8Array>;

  readonly params: ConsoleWriterStreamParams;

  constructor(params: Partial<ConsoleWriterStreamParams> = {}) {
    this.params = {
      // eslint-disable-next-line no-console
      error: (...a): void => (params.error || console.error)(...a),
      // eslint-disable-next-line no-console
      log: (...a): void => (params.log || console.log)(...a),
      // eslint-disable-next-line no-console
      warn: (...a): void => (params.warn || console.warn)(...a),
    };
  }
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
