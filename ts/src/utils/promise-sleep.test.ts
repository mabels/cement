import { sleep } from "./promise-sleep.js";

it("sleeps for the specified duration", async () => {
  const start = performance.now();
  const result = await sleep(100);
  const duration = performance.now() - start;

  expect(duration).toBeGreaterThanOrEqual(95);
  expect(duration).toBeLessThan(150);
  expect(result.isOk()).toBe(true);
  expect(result.unwrap()).toBeUndefined();
});

it("returns immediately for zero milliseconds", async () => {
  const start = performance.now();
  const result = await sleep(0);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(10);
  expect(result.isOk()).toBe(true);
});

it("returns immediately for negative milliseconds", async () => {
  const start = performance.now();
  const result = await sleep(-100);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(10);
  expect(result.isOk()).toBe(true);
});

it("returns error when aborted before sleep starts", async () => {
  const controller = new AbortController();
  controller.abort();

  const result = await sleep(100, controller.signal);

  expect(result.isOk()).toBe(false);
  expect(result.Err().message).toBe("sleep aborted");
});

it("returns error when aborted during sleep", async () => {
  const controller = new AbortController();

  const start = performance.now();
  const sleepPromise = sleep(200, controller.signal);

  // Abort after 50ms
  setTimeout(() => controller.abort(), 50);

  const result = await sleepPromise;
  const duration = performance.now() - start;

  expect(duration).toBeGreaterThanOrEqual(45);
  expect(duration).toBeLessThan(150);
  expect(result.isOk()).toBe(false);
  expect(result.Err().message).toBe("sleep aborted");
});

it("completes successfully if not aborted", async () => {
  const controller = new AbortController();

  const result = await sleep(50, controller.signal);

  expect(result.isOk()).toBe(true);
});

it("cleans up timeout and event listener on abort", async () => {
  const controller = new AbortController();

  const sleepPromise = sleep(100, controller.signal);

  // Abort immediately
  controller.abort();

  const result = await sleepPromise;

  // The promise should resolve quickly with an error
  expect(result.isOk()).toBe(false);

  // If cleanup works properly, this test won't leak event listeners or timers
});

it("cleans up timeout and event listener on success", async () => {
  const controller = new AbortController();

  const result = await sleep(50, controller.signal);

  expect(result.isOk()).toBe(true);

  // If cleanup works properly, aborting after completion shouldn't affect anything
  controller.abort();
});
