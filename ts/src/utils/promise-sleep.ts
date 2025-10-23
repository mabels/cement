/**
 * Pause execution for the given number of milliseconds.
 *
 * Example:
 *   await sleep(500);
 *
 * Optionally accepts an AbortSignal to cancel the sleep (will reject with an AbortError).
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (ms <= 0) {
      resolve();
      return;
    }

    if (signal?.aborted) {
      const err = new Error("Aborted");
      (err as { name: string }).name = "AbortError";
      reject(err);
      return;
    }

    const id = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = (): void => {
      cleanup();
      const err = new Error("Aborted");
      (err as { name: string }).name = "AbortError";
      reject(err);
    };

    function cleanup(): void {
      clearTimeout(id);
      signal?.removeEventListener("abort", onAbort);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
