import { Result } from "../result.js";

/**
 * Pause execution for the given number of milliseconds.
 *
 * Example:
 *   await sleep(500);
 *
 * Optionally accepts an AbortSignal to cancel the sleep (will resolve with Result.Err on abort).
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<Result<void>> {
  return new Promise<Result<void>>((resolve) => {
    if (ms <= 0) {
      resolve(Result.Ok());
      return;
    }
    if (signal?.aborted) {
      const err = new Error("sleep aborted");
      // (err as { name: string }).name = "AbortError";
      resolve(Result.Err(err));
      return;
    }

    function cleanup(): void {
      clearTimeout(id);
      signal?.removeEventListener("abort", onAbort);
    }

    const id = setTimeout(() => {
      cleanup();
      resolve(Result.Ok());
    }, ms);

    const onAbort = (): void => {
      cleanup();
      const err = new Error("sleep aborted");
      // (err as { name: string }).name = "AbortError";
      resolve(Result.Err(err));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
