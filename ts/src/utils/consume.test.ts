import { describe, it, expect, vi } from "vitest";
import { consumeStream, consumeIterator } from "./consume.js";

describe("consumeStream", () => {
  it("should consume an empty stream", async () => {
    const stream = new ReadableStream({
      start(controller): void {
        controller.close();
      },
    });

    const result = await consumeStream(stream, (x: number) => x * 2);
    expect(result).toEqual([]);
  });

  it("should consume a stream with single element", async () => {
    const stream = new ReadableStream({
      start(controller): void {
        controller.enqueue(5);
        controller.close();
      },
    });

    const result = await consumeStream(stream, (x: number) => x * 2);
    expect(result).toEqual([10]);
  });

  it("should consume a stream with multiple elements", async () => {
    const stream = new ReadableStream({
      start(controller): void {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        controller.close();
      },
    });

    const result = await consumeStream(stream, (x: number) => x * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("should handle callback that returns promises", async () => {
    const stream = new ReadableStream({
      start(controller): void {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.close();
      },
    });

    const result = await consumeStream(stream, async (x: number) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return x * 3;
    });
    expect(result).toEqual([3, 6]);
  });

  it("should handle callback that transforms types", async () => {
    const stream = new ReadableStream({
      start(controller): void {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.enqueue(3);
        controller.close();
      },
    });

    const result = await consumeStream(stream, (x: number) => `value-${x}`);
    expect(result).toEqual(["value-1", "value-2", "value-3"]);
  });

  it("should handle string stream", async () => {
    const stream = new ReadableStream({
      start(controller): void {
        controller.enqueue("hello");
        controller.enqueue("world");
        controller.close();
      },
    });

    const result = await consumeStream(stream, (x: string) => x.toUpperCase());
    expect(result).toEqual(["HELLO", "WORLD"]);
  });

  it("should handle callback errors gracefully", async () => {
    const stream = new ReadableStream({
      start(controller): void {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.close();
      },
    });

    await expect(
      consumeStream(stream, (x: number) => {
        if (x === 2) throw new Error("Test error");
        return x * 2;
      }),
    ).rejects.toThrow("Test error");
  });
});

describe("consumeIterator", () => {
  it("should consume an empty sync iterator", async () => {
    function* emptyGen(): Generator<number, void, unknown> {
      // Empty generator
    }

    const result = await consumeIterator(emptyGen(), (x: number) => x * 2);
    expect(result).toEqual([]);
  });

  it("should consume a sync iterator with single element", async () => {
    function* singleGen(): Generator<number, void, unknown> {
      yield 5;
    }

    const result = await consumeIterator(singleGen(), (x: number) => x * 2);
    expect(result).toEqual([10]);
  });

  it("should consume a sync iterator with multiple elements", async () => {
    function* multiGen(): Generator<number, void, unknown> {
      yield 1;
      yield 2;
      yield 3;
    }

    const result = await consumeIterator(multiGen(), (x: number) => x * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("should consume an async iterator", async () => {
    async function* asyncGen(): AsyncGenerator<number, void, unknown> {
      yield 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield 2;
      yield 3;
    }

    const result = await consumeIterator(asyncGen(), (x: number) => x * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("should handle callback that returns promises with sync iterator", async () => {
    function* gen(): Generator<number, void, unknown> {
      yield 1;
      yield 2;
    }

    const result = await consumeIterator(gen(), async (x: number) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return x * 3;
    });
    expect(result).toEqual([3, 6]);
  });

  it("should handle callback that returns promises with async iterator", async () => {
    async function* asyncGen(): AsyncGenerator<number, void, unknown> {
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield 2;
    }

    const result = await consumeIterator(asyncGen(), async (x: number) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return x * 3;
    });
    expect(result).toEqual([3, 6]);
  });

  it("should handle type transformation", async () => {
    function* gen(): Generator<number, void, unknown> {
      yield 1;
      yield 2;
      yield 3;
    }

    const result = await consumeIterator(gen(), (x: number) => `item-${x}`);
    expect(result).toEqual(["item-1", "item-2", "item-3"]);
  });

  it("should handle large iterators with chunking", async () => {
    function* largeGen(): Generator<number, void, unknown> {
      for (let i = 0; i < 100; i++) {
        yield i;
      }
    }

    const result = await consumeIterator(largeGen(), (x: number) => x * 2);
    expect(result).toHaveLength(100);
    expect(result[0]).toBe(0);
    expect(result[99]).toBe(198);
  });

  it("should handle callback errors gracefully", async () => {
    function* gen(): Generator<number, void, unknown> {
      yield 1;
      yield 2;
    }

    await expect(
      consumeIterator(gen(), (x: number) => {
        if (x === 2) throw new Error("Test error");
        return x * 2;
      }),
    ).rejects.toThrow("Test error");
  });

  it("should handle array iterator", async () => {
    const arr = [1, 2, 3, 4, 5];
    const result = await consumeIterator(arr[Symbol.iterator](), (x: number) => x * 2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it("should handle string iterator", async () => {
    const str = "hello";
    const result = await consumeIterator(str[Symbol.iterator](), (char: string) => char.toUpperCase());
    expect(result).toEqual(["H", "E", "L", "L", "O"]);
  });
});

describe("consumeIterator chunking behavior", () => {
  it("should handle chunking with async iterator", async () => {
    async function* largeAsyncGen(): AsyncGenerator<number, void, unknown> {
      for (let i = 0; i < 53; i++) {
        yield i;
        if (i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    const setTimeoutFn = vi.fn().mockImplementation((fn) => fn());
    const result = await consumeIterator(largeAsyncGen(), (x: number) => x, { setTimeoutFn, chunkSize: 10 });

    expect(result).toHaveLength(53);
    expect(setTimeoutFn).toBeCalledTimes(4); // Should have used setTimeout for chunking
  });
});
