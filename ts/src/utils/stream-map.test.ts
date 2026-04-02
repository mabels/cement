import { it, expect, vitest, describe } from "vitest";
import { array2stream, devnull, stream2array, streamMap, coerceStreamUint8, coerceStreamString } from "@adviser/cement";
import { receiveFromStream, sendToStream, streamingTestState } from "./stream-test-helper.js";

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
      start(controller): void {
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
  const closeFn = vitest.fn();
  const s = await stream2array(
    streamMap(array2stream([1, 2, 3]), {
      Map: (i, idx) => (idx + 1) * 10 + i + 1,
      Close: closeFn,
    }),
  );
  expect(closeFn).toHaveBeenCalledTimes(1);
  expect(s).toEqual([12, 23, 34]);
});

it("stream_map async", async () => {
  const closeFn = vitest.fn();
  const s = await stream2array(
    streamMap(array2stream([1, 2, 3]), {
      Map: (i, idx) => Promise.resolve((idx + 1) * 10 + i + 1),
      Close: closeFn,
    }),
  );
  expect(closeFn).toHaveBeenCalledTimes(1);
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
    CollectorFn: vitest.fn(),
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

    expect(state.CollectorFn).toHaveBeenCalledTimes(state.sendChunks + 1 /*done*/);
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

describe("coerceStreamUint8", () => {
  it("default: encodes string chunks to Uint8Array", async () => {
    const result = await stream2array(coerceStreamUint8(array2stream<Uint8Array | string>(["Hello", " ", "World"])));
    expect(new TextDecoder().decode(new Uint8Array(result.flatMap((c) => [...c])))).toBe("Hello World");
  });

  it("default: passes Uint8Array chunks through unchanged", async () => {
    const chunks = ["foo", "bar"].map((s) => new TextEncoder().encode(s));
    const result = await stream2array(coerceStreamUint8(array2stream<Uint8Array | string>(chunks)));
    expect(result).toEqual(chunks);
  });

  it("default: handles mixed string and Uint8Array chunks", async () => {
    const stream = array2stream<Uint8Array | string>(["Hello", new TextEncoder().encode(" World")]);
    const result = await stream2array(coerceStreamUint8(stream));
    expect(new TextDecoder().decode(new Uint8Array(result.flatMap((c) => [...c])))).toBe("Hello World");
  });

  it("custom encoder: is called for string chunks", async () => {
    const encodeSpy = vitest.fn((x: unknown): Uint8Array<ArrayBuffer> => {
      return new TextEncoder().encode(x as string);
    });
    await stream2array(coerceStreamUint8(array2stream<Uint8Array | string>(["a", "b", new Uint8Array([99])]), encodeSpy));
    expect(encodeSpy).toHaveBeenCalledTimes(2);
  });
});

describe("coerceStreamString", () => {
  it("default: decodes Uint8Array chunks to string", async () => {
    const enc = new TextEncoder();
    const result = await stream2array(
      coerceStreamString(array2stream<Uint8Array | string>([enc.encode("Hello"), enc.encode(" World")])),
    );
    expect(result.join("")).toBe("Hello World");
  });

  it("default: passes string chunks through unchanged", async () => {
    const result = await stream2array(coerceStreamString(array2stream<Uint8Array | string>(["foo", "bar"])));
    expect(result).toEqual(["foo", "bar"]);
  });

  it("default: handles mixed Uint8Array and string chunks", async () => {
    const stream = array2stream<Uint8Array | string>([new TextEncoder().encode("Hello"), " World"]);
    const result = await stream2array(coerceStreamString(stream));
    expect(result.join("")).toBe("Hello World");
  });

  it("custom decoder: is called for Uint8Array chunks", async () => {
    const decodeSpy = vitest.fn((x: unknown): string => {
      if (x instanceof Uint8Array) {
        return new TextDecoder().decode(x);
      }
      return x as string;
    });
    const enc = new TextEncoder();
    await stream2array(coerceStreamString(array2stream<Uint8Array | string>([enc.encode("a"), enc.encode("b"), "c"]), decodeSpy));
    expect(decodeSpy).toHaveBeenCalledTimes(3);
  });
});
