import { describe, expect, it, vi } from "vitest";
import {
  fnStream2uint8arrayGrowResizable,
  stream2uint8array,
  stream2uint8arrayChunkAndJoin,
  stream2uint8arrayGrowBuffer,
  stream2uint8arrayGrowResizable,
  stream2uint8arraySimple,
  supportsResizableArrayBuffer,
  type Stream2Uint8ArrayStrategy,
} from "@adviser/cement";

interface StrategyCase {
  readonly name: string;
  readonly strategy: Stream2Uint8ArrayStrategy;
  readonly supported: boolean;
}

const strategies: StrategyCase[] = [
  { name: "simple", strategy: stream2uint8arraySimple, supported: true },
  { name: "chunk-and-join", strategy: stream2uint8arrayChunkAndJoin, supported: true },
  { name: "grow-buffer", strategy: stream2uint8arrayGrowBuffer, supported: true },
  { name: "grow-resizable", strategy: stream2uint8arrayGrowResizable, supported: supportsResizableArrayBuffer },
];

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller): void {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

describe.each(strategies)("stream2uint8array strategy $name", ({ strategy, supported }) => {
  it.skipIf(!supported)("returns an empty array for undefined", async () => {
    expect(await strategy()).toEqual(new Uint8Array());
  });

  it.skipIf(!supported)("returns an empty array for an empty stream", async () => {
    expect(await strategy(streamOf([]))).toEqual(new Uint8Array());
  });

  it.skipIf(!supported)("concatenates chunks in order", async () => {
    const out = await strategy(streamOf([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5, 6])]));
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(out.length).toBe(6);
  });

  it.skipIf(!supported)("honours subarray views", async () => {
    const backing = new Uint8Array([9, 1, 2, 9, 3, 9]);
    const out = await strategy(streamOf([backing.subarray(1, 3), backing.subarray(4, 5)]));
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
});

describe("stream2uint8array", () => {
  it.skipIf(!supportsResizableArrayBuffer)("uses the grow-resizable strategy by default", async () => {
    const out = await stream2uint8array(streamOf([new Uint8Array([7, 8])]));
    expect(Array.from(out)).toEqual([7, 8]);
  });

  it("delegates to the provided strategy", async () => {
    const strategy = vi.fn<Stream2Uint8ArrayStrategy>(() => Promise.resolve(new Uint8Array([42])));
    const out = await stream2uint8array(streamOf([new Uint8Array([0])]), strategy);
    expect(strategy).toHaveBeenCalledTimes(1);
    expect(Array.from(out)).toEqual([42]);
  });
});

describe("fnStream2uint8arrayGrowResizable", () => {
  it.skipIf(!supportsResizableArrayBuffer)("accepts a stream within the cap", async () => {
    const strategy = fnStream2uint8arrayGrowResizable(64);
    const out = await strategy(streamOf([new Uint8Array(32), new Uint8Array(32)]));
    expect(out.length).toBe(64);
  });

  it.skipIf(!supportsResizableArrayBuffer)("rejects a stream larger than the cap", async () => {
    const strategy = fnStream2uint8arrayGrowResizable(64);
    await expect(strategy(streamOf([new Uint8Array(32), new Uint8Array(33)]))).rejects.toThrow(RangeError);
  });

  it("validates maxBuf", () => {
    expect(() => fnStream2uint8arrayGrowResizable(-1)).toThrow(RangeError);
    expect(() => fnStream2uint8arrayGrowResizable(Number.NaN)).toThrow(RangeError);
  });
});
