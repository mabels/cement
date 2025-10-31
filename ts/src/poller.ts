import { sleep } from "./utils/promise-sleep.js";
import { Writable } from "ts-essentials";

export interface PollWaitingActionResult {
  readonly state: "waiting";
}

export interface PollSuccessActionResult<T> {
  readonly state: "success";
  readonly result: T;
}

export interface PollErrorActionResult {
  readonly state: "error";
  readonly error: Error;
}

export type PollActionResult<T> = PollWaitingActionResult | PollSuccessActionResult<T> | PollErrorActionResult;

export const FOREVER = 2147483647; // Maximum setTimeout delay
export interface PollerOptions {
  readonly intervalMs: number;
  readonly timeoutMs: number;
  readonly exponentialBackoff: boolean;
  readonly abortSignal?: AbortSignal;
}

export type PollerResult<T> = PollSuccessActionResult<T> | PollErrorActionResult;

async function interPoller<T>(
  fn: (abortSignal?: AbortSignal) => Promise<PollActionResult<T>>,
  options: Writable<PollerOptions>,
): Promise<PollerResult<T>> {
  do {
    let result: PollActionResult<T>;
    try {
      result = await fn(options.abortSignal);
      switch (result.state) {
        case "waiting":
          {
            if (options.exponentialBackoff) {
              options.intervalMs = Math.min(options.intervalMs * 2, FOREVER);
            }
            const err = await sleep(options.intervalMs, options.abortSignal);
            if (err.isErr()) {
              return {
                state: "error",
                error: err.Err(),
              };
            }
          }
          break;
        case "success":
          return result;
        case "error":
          return result;
      }
    } catch (err) {
      return {
        state: "error",
        error: err as Error,
      };
    }
    // eslint-disable-next-line no-constant-condition
  } while (true);
}

export async function poller<T>(
  fn: () => Promise<PollActionResult<T>>,
  ioptions: Partial<PollerOptions> = {},
): Promise<PollerResult<T>> {
  const options = {
    intervalMs: 1000,
    timeoutMs: 30000,
    ...ioptions,
    exponentialBackoff:
      typeof ioptions.exponentialBackoff === "boolean" ? ioptions.exponentialBackoff : ioptions.timeoutMs === FOREVER,
  };
  return Promise.race([
    interPoller(fn, options),
    sleep(options.timeoutMs, options.abortSignal)
      .then(() => ({ state: "error" as const, error: new Error("Polling timed out") }))
      .catch((e: Error) => ({ state: "error" as const, error: e })),
  ]);
}
