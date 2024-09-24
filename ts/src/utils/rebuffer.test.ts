import { utils } from "@adviser/cement";
import { receiveFromStream, sendToStream, streamingTestState } from "./stream-test-helper.js";

it("rechunk empty", async () => {
  const chunks = await utils.rebufferArray([], 10);
  expect(chunks.length).toEqual(0);
});

it("rechunk 0 size", async () => {
  const chunks = await utils.rebufferArray([new Uint8Array(0)], 10);
  expect(chunks.length).toEqual(0);
});

it("rechunk smaller 10", async () => {
  const chunks = await utils.rebufferArray([new Uint8Array(3)], 10);
  expect(chunks.length).toEqual(1);
  expect(chunks[0].length).toEqual(3);
});

it("rechunk smaller 10 pack smaller chunks", async () => {
  const chunks = await utils.rebufferArray(
    Array(7)
      .fill(0)
      .map((_, i) => {
        const o = new Uint8Array(3);
        for (let j = 0; j < o.length; j++) {
          o[j] = i * o.length + j;
        }
        return o;
      }),
    10,
  );
  expect(chunks.length).toEqual(3);
  expect(chunks[0].length).toEqual(10);
  expect(Array.from(chunks[0]).map((i) => i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(chunks[1].length).toEqual(10);
  expect(Array.from(chunks[1]).map((i) => i)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  expect(chunks[2].length).toEqual(1);
  expect(Array.from(chunks[2]).map((i) => i)).toEqual([20]);
});

it("rechunk smaller 10 pack bigger chunks", async () => {
  const chunks = await utils.rebufferArray(
    Array(3)
      .fill(0)
      .map((_, i) => {
        const o = new Uint8Array(11);
        for (let j = 0; j < o.length; j++) {
          o[j] = i * o.length + j;
        }
        return o;
      }),
    10,
  );
  expect(chunks.length).toEqual(4);
  expect(chunks[0].length).toEqual(10);
  expect(Array.from(chunks[0]).map((i) => i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(chunks[1].length).toEqual(10);
  expect(Array.from(chunks[1]).map((i) => i)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  expect(chunks[2].length).toEqual(10);
  expect(Array.from(chunks[2]).map((i) => i)).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
  expect(chunks[3].length).toEqual(3);
  expect(Array.from(chunks[3]).map((i) => i)).toEqual([30, 31, 32]);
});

describe("test streaming through rebuffer", () => {
  const state: streamingTestState = {
    sendChunks: 10000,
    sendChunkSize: 3,
    fillCalls: 0,
    CollectorFn: vitest.fn(),
  };
  const reBufferSize = 11;

  it("does rebuffer respect backpressure", async () => {
    const ts = new TransformStream<Uint8Array, Uint8Array>(undefined, undefined, { highWaterMark: 2 });
    const reb = utils.rebuffer(ts.readable, reBufferSize);
    await Promise.all([receiveFromStream(reb, state), sendToStream(ts.writable, state)]);

    expect(state.CollectorFn).toBeCalledTimes(~~((state.sendChunkSize * state.sendChunks) / reBufferSize) + 1 + 1 /*done*/);
    expect(state.CollectorFn.mock.calls.slice(-1)[0][0].done).toBeTruthy();
    let lastfillCalls = 0;
    for (let i = 0; i < state.CollectorFn.mock.calls.length - 1 /*done*/; i++) {
      const { fillCalls, reBufferCalls, value } = state.CollectorFn.mock.calls[i][0];
      expect(value?.[0]).toBe(~~((reBufferSize * i) / state.sendChunkSize) % 256);
      expect(fillCalls * state.sendChunkSize).toBeGreaterThanOrEqual(
        (fillCalls - lastfillCalls) * state.sendChunkSize + reBufferCalls * reBufferSize,
      );
      lastfillCalls = fillCalls;
    }
  });
});
