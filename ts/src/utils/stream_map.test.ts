import { receiveFromStream, sendToStream, streamingTestState } from "./stream_test_helper";
import { array2stream, devnull, stream2array, streamMap } from "./stream_map";
import { vi as jest } from "vitest";

it("array2stream", async () => {
  const as = array2stream([1, 2, 3]);
  let i = 0;
  const reader = as.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    expect(1 + i++).toBe(value);
  }
});

it("stream2array", async () => {
  const as = await stream2array(
    new ReadableStream({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        controller.close();
      },
    }),
  );
  expect(as).toEqual([1, 2, 3]);
});

it("devnull", async () => {
  const cnt = await devnull(
    streamMap(array2stream([1, 2, 3]), {
      Map: (i, idx) => (idx + 1) * 10 + i + 1,
    }),
  );
  expect(cnt).toBe(3);
});

it("stream_map", async () => {
  const closeFn = jest.fn();
  const s = await stream2array(
    streamMap(array2stream([1, 2, 3]), {
      Map: (i, idx) => (idx + 1) * 10 + i + 1,
      Close: closeFn,
    }),
  );
  expect(closeFn).toBeCalledTimes(1);
  expect(s).toEqual([12, 23, 34]);
});

it("stream_map async", async () => {
  const closeFn = jest.fn();
  const s = await stream2array(
    streamMap(array2stream([1, 2, 3]), {
      Map: (i, idx) => Promise.resolve((idx + 1) * 10 + i + 1),
      Close: closeFn,
    }),
  );
  expect(closeFn).toBeCalledTimes(1);
  expect(s).toEqual([12, 23, 34]);
});

it("map types", async () => {
  const oo = await stream2array(
    streamMap(array2stream([1, 2, 3]), {
      Map: (chunk, idx) => {
        return "[" + chunk + "/" + idx + "]";
      },
    }),
  );
  expect(oo).toEqual(["[1/0]", "[2/1]", "[3/2]"]);
});

describe("test streaming through streamMap", () => {
  const state: streamingTestState = {
    sendChunks: 10000,
    sendChunkSize: 3,
    fillCalls: 0,
    CollectorFn: jest.fn(),
  };
  it("does streamMap respect backpressure", async () => {
    const ts = new TransformStream<Uint8Array, Uint8Array>(undefined, undefined, { highWaterMark: 2 });
    const reb = streamMap(ts.readable, {
      Map: (chunk) => {
        for (let i = 0; i < chunk.length; i++) {
          chunk[i] = (chunk[i] + 1) % 256;
        }
        return chunk;
      },
    });
    await Promise.all([receiveFromStream(reb, state), sendToStream(ts.writable, state)]);

    expect(state.CollectorFn).toBeCalledTimes(state.sendChunks + 1 /*done*/);
    expect(state.CollectorFn.mock.calls.slice(-1)[0][0].done).toBeTruthy();
    let lastfillCalls = 0;
    for (let i = 0; i < state.CollectorFn.mock.calls.length - 1 /*done*/; i++) {
      const { fillCalls, reBufferCalls, value } = state.CollectorFn.mock.calls[i][0];
      expect(value?.[0]).toBe((i + 1) % 256);
      expect(fillCalls * state.sendChunkSize).toBeGreaterThanOrEqual(
        (fillCalls - lastfillCalls) * state.sendChunkSize + reBufferCalls * state.sendChunkSize,
      );
      lastfillCalls = fillCalls;
    }
  });
});
