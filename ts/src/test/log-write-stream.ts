import { FanoutWriteStream } from "../utils/fanout-write-stream.js";
import { Future } from "../future.js";
import { TxtEnDecoder, TxtEnDecoderSingleton } from "../txt-en-decoder.js";

export class LogWriteStream implements WritableStreamDefaultWriter<Uint8Array> {
  private readonly _bufferArr: Uint8Array[];

  constructor(bufferArr: Uint8Array[]) {
    this._bufferArr = bufferArr;
  }

  readonly _resolveClosed: Future<undefined> = new Future<undefined>();
  readonly closed: Promise<undefined> = this._resolveClosed.asPromise();
  readonly desiredSize: number | null = null;
  readonly ready: Promise<undefined> = Promise.resolve(undefined);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  abort(reason?: any): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async close(): Promise<void> {
    await this.closed;
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

export class LogCollector implements WritableStream<Uint8Array> {
  readonly locked: boolean = false;
  private _writer?: FanoutWriteStream;
  private readonly _pass?: WritableStreamDefaultWriter<Uint8Array>;
  private readonly _bufferArr: Uint8Array[] = [];
  private readonly _txtEnDe: TxtEnDecoder;

  constructor(pass?: WritableStreamDefaultWriter<Uint8Array>, txtEnDe?: TxtEnDecoder) {
    this._pass = pass;
    this._txtEnDe = txtEnDe || TxtEnDecoderSingleton();
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
      const dests: WritableStreamDefaultWriter<Uint8Array>[] = [new LogWriteStream(this._bufferArr)];
      if (this._pass) {
        dests.push(this._pass);
      }
      this._writer = new FanoutWriteStream(dests);
    }
    return this._writer;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Logs(notJsonLine = false): any[] {
    if (!this._writer) {
      return [];
    }
    const jsonNlStr = this._txtEnDe.decode(
      new Uint8Array(
        (function* (res: Uint8Array[]): Generator<number, void, undefined> {
          for (const x of res) {
            yield* x;
          }
        })(this._bufferArr),
      ),
    );
    if (!notJsonLine) {
      const splitStr = jsonNlStr.split("\n");
      const filterStr = splitStr.filter((a) => a.length);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      const mapStr = filterStr.map((a) => JSON.parse(a));
      return mapStr;
    }
    return jsonNlStr.split("\n").filter((a) => a.length);
  }
}
