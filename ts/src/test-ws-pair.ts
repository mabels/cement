import { CoerceBinaryInput, to_uint8 } from "./index.js";

export interface WSConnectionWrapper {
  onError(e: ErrorEvent): void;
  onMessage<T>(e: MessageEvent<T>): void;
  onClose(e: CloseEvent): void;
  send(data: CoerceBinaryInput): void;
}

export type OnErrorFn = (e: ErrorEvent) => void;
export type OnMessageFn = <T = unknown>(e: MessageEvent<T>) => void;
export type OnCloseFn = (e: CloseEvent) => void;

class TestWSConnection implements WSConnectionWrapper {
  #other!: TestWSConnection;
  readonly side: string;
  onMessage: OnMessageFn = <T>(_e: MessageEvent<T>): void => {
    throw new Error("OnMessage Method not implemented.");
  };
  onError: OnErrorFn = (_e: ErrorEvent): void => {
    throw new Error("OnError Method not implemented.");
  };
  onClose: OnCloseFn = (_e: CloseEvent): void => {
    throw new Error("OnClose Method not implemented.");
  };

  readonly calls: { from: string; data: Uint8Array }[];

  constructor(side: string, calls: { from: string; data: Uint8Array }[]) {
    this.side = side;
    this.calls = calls;
  }
  connect(other: TestWSConnection): void {
    this.#other = other;
  }

  send(data: CoerceBinaryInput): void {
    const uint8 = to_uint8(data);
    this.calls.push({ from: this.side, data: uint8 });
    this.#other.onMessage({
      data: uint8,
    } as unknown as MessageEvent<Uint8Array>);
  }
}

export class TestWSPair {
  readonly msgs: { from: string; data: Uint8Array }[] = [];
  public readonly p1: TestWSConnection = new TestWSConnection("p1", this.msgs);
  public readonly p2: TestWSConnection = new TestWSConnection("p2", this.msgs);

  static create(): TestWSPair {
    const pair = new TestWSPair();
    pair.p1.connect(pair.p2);
    pair.p2.connect(pair.p1);
    return pair;
  }

  private constructor() {
    /* empty */
  }
}
