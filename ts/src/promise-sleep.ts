import { Future } from "./future.js";

export interface SleepBase {
  readonly state: "sleeped" | "error" | "aborted";
  readonly isOk: boolean;
  readonly isErr: boolean;
  readonly isAborted: boolean;
}

export interface SleepOk extends SleepBase {
  readonly state: "sleeped";
  readonly isOk: true;
  readonly isErr: false;
  readonly isAborted: false;
}

export interface SleepErr extends SleepBase {
  readonly state: "error";
  readonly error: Error;
  readonly isOk: false;
  readonly isErr: true;
  readonly isAborted: false;
}

export interface SleepAbort extends SleepBase {
  readonly state: "aborted";
  readonly reason: Error;
  readonly isOk: false;
  readonly isErr: false;
  readonly isAborted: true;
}

export type SleepResult = SleepOk | SleepErr | SleepAbort;

/**
 * Pauses execution for a specified duration with optional abort support.
 *
 * Returns a SleepResult discriminated union indicating success, error, or abort.
 * Unlike a plain setTimeout promise, this provides detailed state information
 * through the result object. Negative durations resolve immediately as success.
 * When aborted via AbortSignal, cleans up the timer and returns abort state.
 *
 * @param ms - Duration to sleep in milliseconds (negative values resolve immediately)
 * @param signal - Optional AbortSignal to cancel the sleep early
 * @returns Promise resolving to SleepResult with state information
 *
 * @example
 * ```typescript
 * // Basic sleep
 * const result = await sleep(500);
 * if (result.isOk) {
 *   console.log('Slept for 500ms');
 * }
 *
 * // With abort signal
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 100);
 *
 * const result = await sleep(1000, controller.signal);
 * if (result.isAborted) {
 *   console.log('Sleep was aborted:', result.reason);
 * }
 *
 * // Check if already aborted
 * const aborted = new AbortController();
 * aborted.abort();
 * const result = await sleep(1000, aborted.signal);
 * // Immediately returns with isAborted: true
 * ```
 */
export async function sleep(ms: number, signal?: AbortSignal): Promise<SleepResult> {
  if (ms < 0) {
    return { state: "sleeped", isOk: true, isErr: false, isAborted: false };
  }
  if (signal?.aborted) {
    const err = new Error("sleep aborted");
    // (err as { name: string }).name = "AbortError";
    return { state: "aborted", reason: err, isOk: false, isErr: false, isAborted: true };
  }
  const sleepFuture = new Future<SleepOk>();
  const id = setTimeout(() => {
    // cleanup();
    sleepFuture.resolve({ state: "sleeped", isOk: true, isErr: false, isAborted: false });
  }, ms);

  const abortFuture = new Future<SleepAbort>();
  function onAbort(): void {
    abortFuture.resolve({
      state: "aborted",
      reason: new Error("sleep aborted"),
      isOk: false,
      isErr: false,
      isAborted: true,
    });
  }
  signal?.addEventListener("abort", onAbort, { once: true });
  return Promise.race([abortFuture.asPromise(), sleepFuture.asPromise()]).finally(() => {
    clearTimeout(id);
    signal?.removeEventListener("abort", onAbort);
  });
}
