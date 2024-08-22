import { WritableStreamDefaultWriter } from "stream/web";
import { Future } from "../future";

export class LogWriterCollector implements WritableStreamDefaultWriter<Uint8Array> {
  private readonly _bufferArr: Uint8Array[]

  constructor(bufferArr: Uint8Array[]) {
    this._bufferArr = bufferArr;
  }

  readonly _resolveClosed = new Future<undefined>();
  readonly closed: Promise<undefined> = this._resolveClosed.asPromise();
  readonly desiredSize: number | null = null;
  readonly ready: Promise<undefined> = Promise.resolve(undefined);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  abort(reason?: any): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async close(): Promise<void> {
    await this.closed
    return Promise.resolve(undefined);
  }
  releaseLock(): void {
    // do nothing
  }
  async write(chunk?: Uint8Array): Promise<void> {
    if (chunk) {
      this._bufferArr.push(chunk);
    }
    return Promise.resolve(undefined);
  }
}

export class FanoutWriter implements WritableStreamDefaultWriter<Uint8Array> {
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
    return Promise.all(this._writers.map((w) => w.abort(reason))).then(() => { /* do nothing */ });
  }
  close(): Promise<void> {
    return Promise.all(this._writers.map((w) => w.close())).then(() => { /* do nothing */ });
  }
  releaseLock(): void {
    this._writers.map((w) => w.releaseLock())
  }

  write(chunk?: Uint8Array | undefined): Promise<void> {
    return Promise.all(this._writers.map((w) => w.write(chunk))).then(() => { /* do nothing */ });
  }
}

export class LogCollector implements WritableStream<Uint8Array> {
  readonly locked: boolean = false;
  private _writer?: FanoutWriter
  private readonly _pass?: WritableStreamDefaultWriter<Uint8Array>
  private readonly _bufferArr: Uint8Array[] = []

  constructor(pass?: WritableStreamDefaultWriter<Uint8Array>) {
    this._pass = pass;
  }

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
      const dests: WritableStreamDefaultWriter[] = [new LogWriterCollector(this._bufferArr)];
      if (this._pass) {
        dests.push(this._pass);
      }
      this._writer = new FanoutWriter(dests);
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
        })(this._bufferArr),
      ),
    );
    const splitStr = jsonNlStr.split("\n");
    const filterStr = splitStr.filter((a) => a.length);
    const mapStr = filterStr.map((a) => JSON.parse(a));
    return mapStr;
  }
}
