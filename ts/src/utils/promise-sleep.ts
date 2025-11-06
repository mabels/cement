import { Future } from "../future.js";

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
 * Pause execution for the given number of milliseconds.
 *
 * Example:
 *   await sleep(500);
 *
 * Optionally accepts an AbortSignal to cancel the sleep (will resolve with Result.Err on abort).
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
