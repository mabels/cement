import { FOREVER, PollActionResult, poller, PollerResult, PollErrorActionResult } from "./poller.js";
import { sleep } from "./utils/promise-sleep.js";

it("polls until success", async () => {
  const seq = vi
    .fn()
    .mockResolvedValueOnce({ state: "waiting" })
    .mockResolvedValueOnce({ state: "waiting" })
    .mockResolvedValueOnce({ state: "waiting" })
    .mockResolvedValueOnce({ state: "waiting" })
    .mockImplementationOnce(async () => {
      await sleep(50);
      return {
        state: "success",
        result: "final result",
      };
    })
    .mockImplementationOnce(() => {
      throw new Error("should not be called");
    });

  const start = performance.now();
  const result = await poller(seq, {
    intervalMs: 10,
  });
  const duration = performance.now() - start;
  expect(duration).toBeGreaterThanOrEqual(80);
  expect(result).toEqual({
    state: "success",
    result: "final result",
    stats: {
      attempts: expect.any(Number) as number,
      lastIntervalMs: expect.any(Number) as number,
      totalElapsedMs: expect.any(Number) as number,
    },
  });
});

it("polls action throws error", async () => {
  const seq = vi
    .fn()
    .mockResolvedValueOnce({ state: "waiting" })
    .mockResolvedValueOnce({ state: "waiting" })
    .mockResolvedValueOnce({ state: "waiting" })
    .mockResolvedValueOnce({ state: "waiting" })
    .mockImplementationOnce(async () => {
      await sleep(50);
      throw new Error("action error");
    })
    .mockImplementationOnce(() => {
      throw new Error("should not be called");
    });
  const start = performance.now();
  const result = await poller(seq, {
    intervalMs: 10,
  });
  const duration = performance.now() - start;
  expect(duration).toBeGreaterThanOrEqual(80);
  expect(result).toEqual({
    state: "error",
    error: new Error("action error"),
    stats: {
      attempts: expect.any(Number) as number,
      lastIntervalMs: expect.any(Number) as number,
      totalElapsedMs: expect.any(Number) as number,
    },
  });
});

it("polls until error", async () => {
  const seq = vi
    .fn()
    .mockResolvedValueOnce({ state: "waiting" })
    .mockResolvedValueOnce({ state: "waiting" })
    .mockResolvedValueOnce({ state: "waiting" })
    .mockResolvedValueOnce({ state: "waiting" })
    .mockImplementationOnce(async () => {
      await sleep(50);
      return {
        state: "error",
        error: new Error("final error"),
      };
    })
    .mockImplementationOnce((): Promise<PollErrorActionResult> => {
      throw new Error("should not be called");
    });
  const start = performance.now();
  const result = await poller(seq, {
    intervalMs: 10,
  });
  const duration = performance.now() - start;
  expect(duration).toBeGreaterThanOrEqual(80);

  expect(result).toEqual({
    state: "error",
    error: new Error("final error"),
    stats: {
      attempts: expect.any(Number) as number,
      lastIntervalMs: expect.any(Number) as number,
      totalElapsedMs: expect.any(Number) as number,
    },
  });
});

it("pass result type", async () => {
  const result = await poller((): Promise<PollActionResult<{ foo: string }>> => {
    return Promise.resolve({
      state: "success",
      result: { foo: "bar" },
    });
  });
  expectTypeOf(result).toEqualTypeOf<PollerResult<{ foo: string }>>();
});

it("times out", async () => {
  const called = vi.fn();
  const start = performance.now();
  const result = await poller(
    (): Promise<PollActionResult<{ foo: string }>> => {
      called();
      return Promise.resolve({
        state: "waiting",
      });
    },
    {
      intervalMs: 10,
      timeoutMs: 50,
    },
  );
  const duration = performance.now() - start;
  expect(duration).toBeGreaterThanOrEqual(48);
  expect(result).toEqual({
    state: "timeout",
    stats: {
      attempts: called.mock.calls.length,
      lastIntervalMs: expect.any(Number) as number,
      totalElapsedMs: expect.any(Number) as number,
    },
  });
  expect(called.mock.calls.length).toBeGreaterThanOrEqual(5);
});

it("has infinite polling", async () => {
  const called = vi.fn();
  const abortController = new AbortController();
  const awaitResult = poller(
    (): Promise<PollActionResult<{ foo: string }>> => {
      called();
      return Promise.resolve({
        state: "waiting",
      });
    },
    {
      intervalMs: 10,
      exponentialBackoff: true,
      timeoutMs: FOREVER,
      abortSignal: abortController.signal,
    },
  );
  await sleep(200);
  expect(called.mock.calls.length).toBe(4);
  abortController.abort();
  const result = await awaitResult;
  expect(result).toEqual({
    state: "aborted",
    reason: new Error("sleep aborted"),
    stats: {
      attempts: called.mock.calls.length,
      lastIntervalMs: expect.any(Number) as number,
      totalElapsedMs: expect.any(Number) as number,
    },
  });
  await sleep(200);
  expect(called.mock.calls.length).toBe(4);
});
