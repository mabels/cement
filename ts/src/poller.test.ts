import { poller, PollerResult, PollErrorActionResult } from "./poller.js";
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
  });
});

it("pass result type", async () => {
  const result = await poller((): Promise<PollerResult<{ foo: string }>> => {
    return Promise.resolve({
      state: "success",
      result: { foo: "bar" },
    });
  });
  expectTypeOf(result).toEqualTypeOf<PollerResult<{ foo: string }>>();
});
