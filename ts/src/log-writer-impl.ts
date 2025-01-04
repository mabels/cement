export class LogWriterStream {
  readonly _out: WritableStream<Uint8Array>;
  readonly _toFlush: (() => Promise<void>)[] = [];

  constructor(out: WritableStream<Uint8Array>) {
    this._out = out;
  }

  write(encoded: Uint8Array): void {
    const my = async (): Promise<void> => {
      // const val = Math.random();
      // console.log(">>>My:", encoded)
      try {
        const writer = this._out.getWriter();
        await writer.ready;
        await writer.write(encoded);
        writer.releaseLock();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Chunk error:", err);
      }
      // console.log("<<<My:", val)
    };
    this._toFlush.push(my);
    this._flush();
  }

  _flushIsRunning = false;
  _flushDoneFns: (() => void)[] = [];
  _flush(toFlush: (() => Promise<void>)[] | undefined = undefined, done?: () => void): void {
    if (done) {
      this._flushDoneFns.push(done);
    }

    if (this._toFlush.length == 0) {
      // console.log("Flush is stopped", this._toFlush.length)
      this._flushIsRunning = false;
      this._flushDoneFns.forEach((fn) => fn());
      this._flushDoneFns = [];
      return;
    }

    if (!toFlush && this._toFlush.length == 1 && !this._flushIsRunning) {
      this._flushIsRunning = true;
      // console.log("Flush is started", this._toFlush.length)
    } else if (!toFlush) {
      // console.log("flush queue check but is running", this._toFlush.length)
      return;
    }

    // console.log(">>>Msg:", this._toFlush.length)
    const my = this._toFlush.shift();
    my?.()
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("Flush error:", e);
      })
      .finally(() => {
        // console.log("<<<Msg:", this._toFlush.length)
        this._flush(this._toFlush);
      });
  }
}
