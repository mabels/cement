import { it, expect, vi } from "vitest";
import { TestWSConnection, TestWSPair } from "./test-ws-pair.js";

it("should record messages from both sides in the msgs array", () => {
  const pair = TestWSPair.create();

  const receivedByP1: Uint8Array[] = [];
  const receivedByP2: Uint8Array[] = [];

  pair.p1.onmessage = (e): void => {
    receivedByP1.push(e.data as Uint8Array);
  };
  pair.p2.onmessage = (e): void => {
    receivedByP2.push(e.data as Uint8Array);
  };

  pair.p1.send(new Uint8Array([1, 2, 3]));
  pair.p2.send(new Uint8Array([4, 5, 6]));
  pair.p1.send(new Uint8Array([7, 8, 9]));

  expect(pair.msgs).toHaveLength(3);

  expect(pair.msgs[0].from).toBe("p1");
  expect(pair.msgs[0].data).toEqual(new Uint8Array([1, 2, 3]));

  expect(pair.msgs[1].from).toBe("p2");
  expect(pair.msgs[1].data).toEqual(new Uint8Array([4, 5, 6]));

  expect(pair.msgs[2].from).toBe("p1");
  expect(pair.msgs[2].data).toEqual(new Uint8Array([7, 8, 9]));

  expect(receivedByP2).toHaveLength(2);
  expect(receivedByP2[0]).toEqual(new Uint8Array([1, 2, 3]));
  expect(receivedByP2[1]).toEqual(new Uint8Array([7, 8, 9]));

  expect(receivedByP1).toHaveLength(1);
  expect(receivedByP1[0]).toEqual(new Uint8Array([4, 5, 6]));
});

it("should emit onopen events upon setting the handler", () => {
  const pair = new TestWSConnection("p1", []);
  pair.onopen = vi.fn(() => {
    /* empty */
  });
  expect(pair.onopen).toHaveBeenCalledTimes(1);
});

it("should handle string data via CoerceBinaryInput", () => {
  const pair = TestWSPair.create();

  pair.p1.onmessage = (_e): void => {
    /* empty */
  };
  pair.p2.onmessage = (_e): void => {
    /* empty */
  };

  pair.p1.send("hello");
  pair.p2.send("world");

  expect(pair.msgs).toHaveLength(2);
  expect(pair.msgs[0].from).toBe("p1");
  expect(new TextDecoder().decode(pair.msgs[0].data)).toBe("hello");
  expect(pair.msgs[1].from).toBe("p2");
  expect(new TextDecoder().decode(pair.msgs[1].data)).toBe("world");
});

it("should start with empty msgs array", () => {
  const pair = TestWSPair.create();
  expect(pair.msgs).toEqual([]);
});

it("should work when send method is passed without bind", () => {
  const pair = TestWSPair.create();

  const receivedByP2: Uint8Array[] = [];
  pair.p1.onmessage = (_e): void => {
    /* empty */
  };
  pair.p2.onmessage = (e): void => {
    receivedByP2.push(e.data as Uint8Array);
  };

  const unboundSend = pair.p1.send;

  unboundSend(new Uint8Array([10, 20, 30]));

  expect(pair.msgs).toHaveLength(1);
  expect(pair.msgs[0].from).toBe("p1");
  expect(pair.msgs[0].data).toEqual(new Uint8Array([10, 20, 30]));

  expect(receivedByP2).toHaveLength(1);
  expect(receivedByP2[0]).toEqual(new Uint8Array([10, 20, 30]));
});

it("ws pair addEventListener integration test", () => {
  const { p1, p2 } = TestWSPair.create();
  const msgFn = vi.fn();
  const onMsgFn = vi.fn();
  const closeFn = vi.fn();
  const errorFn = vi.fn();

  p1.addEventListener("message", msgFn);
  p1.addEventListener("close", closeFn);
  p1.addEventListener("error", errorFn);
  p1.onmessage = onMsgFn;

  p2.send(new Uint8Array([1, 2, 3]));

  expect(msgFn).toHaveBeenCalledTimes(1);
  expect((msgFn.mock.calls[0][0] as MessageEvent).data).toEqual(new Uint8Array([1, 2, 3]));
  expect((onMsgFn.mock.calls[0][0] as MessageEvent).data).toEqual(new Uint8Array([1, 2, 3]));
  expect(closeFn).toHaveBeenCalledTimes(0);
  expect(errorFn).toHaveBeenCalledTimes(0);

  p1.removeEventListener("message", msgFn);
  p1.removeEventListener("close", closeFn);
  p1.removeEventListener("error", errorFn);

  p2.send(new Uint8Array([1, 2, 3]));
  expect(msgFn).toHaveBeenCalledTimes(1);
  expect(onMsgFn).toHaveBeenCalledTimes(2);
});
