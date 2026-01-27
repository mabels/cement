import { CoerceBinaryInput, to_uint8 } from "./index.js";

export type WebSocketSimple = Pick<WebSocket, "onerror" | "onmessage" | "onclose" | "send" | "onopen">;

export type OnErrorFn = (e: Event) => void;
export type OnMessageFn = <T = unknown>(e: MessageEvent<T>) => void;
export type OnCloseFn = (e: CloseEvent) => void;

export type EventType = "message" | "error" | "close";

export class TestWSConnection<WS extends WebSocketSimple = WebSocket> implements WebSocketSimple {
  #other!: TestWSConnection<WS>;
  #onopen!: () => void;
  readonly side: string;
  readonly #events: Map<EventType, Set<EventListenerOrEventListenerObject>> = new Map<
    EventType,
    Set<EventListenerOrEventListenerObject>
  >();
  readonly transfers?: { from: string; data: Uint8Array }[];

  constructor(side: string, transfers?: { from: string; data: Uint8Array }[]) {
    this.side = side;
    this.transfers = transfers;
  }

  get onopen(): () => void {
    return this.#onopen;
  }
  set onopen(fn: () => void) {
    this.#onopen = fn;
    fn(); // immediately invoke for testing purposes
  }
  onmessage: OnMessageFn = <T>(_e: MessageEvent<T>): void => {
    throw new Error("OnMessage Method not implemented.");
  };
  onerror: OnErrorFn = (_e: Event): void => {
    throw new Error("OnError Method not implemented.");
  };
  onclose: OnCloseFn = (_e: CloseEvent): void => {
    throw new Error("OnClose Method not implemented.");
  };

  removeEventListener(key: EventType, listener: EventListenerOrEventListenerObject): void {
    this.#events.get(key)?.delete(listener);
  }
  addEventListener(key: EventType, listener: EventListenerOrEventListenerObject): void {
    this.#events.set(key, (this.#events.get(key) ?? new Set()).add(listener));
  }

  accept(): void {
    // no-op for testing
  }
  connect(other: TestWSConnection<WS>): void {
    this.#other = other;
  }
  send = (data: CoerceBinaryInput): void => {
    const uint8 = to_uint8(data);
    this.transfers?.push({ from: this.side, data: uint8 });
    const msg = {
      data: uint8,
    } as unknown as MessageEvent<Uint8Array>;
    this.#other.onmessage(msg);
    this.#other.#events
      .get("message")
      ?.forEach((listener) => (typeof listener === "function" ? listener(msg) : listener.handleEvent(msg)));
  };
}

export class TestWSPair<WS extends WebSocketSimple = WebSocket> {
  readonly msgs: { from: string; data: Uint8Array }[] = [];
  public readonly p1: TestWSConnection<WS> = new TestWSConnection<WS>("p1", this.msgs);
  public readonly p2: TestWSConnection<WS> = new TestWSConnection<WS>("p2", this.msgs);

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
