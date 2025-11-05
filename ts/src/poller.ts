import { sleep } from "./utils/promise-sleep.js";
import { Writable } from "ts-essentials";

export interface PollerStats {
  readonly attempts: number;
  readonly lastIntervalMs: number;
  readonly totalElapsedMs: number;
}

export interface PollWaitingActionResult {
  readonly state: "waiting";
  readonly stats: PollerStats;
}

export interface PollSuccessActionResult<T> {
  readonly state: "success";
  readonly result: T;
  readonly stats: PollerStats;
}

export interface PollErrorActionResult {
  readonly state: "error";
  readonly error: Error;
  readonly stats: PollerStats;
}

export interface PollTimeoutActionResult {
  readonly state: "timeout";
  readonly stats: PollerStats;
}

export type PollActionResult<T> =
  | Omit<PollWaitingActionResult, "stats">
  | Omit<PollSuccessActionResult<T>, "stats">
  | Omit<PollErrorActionResult, "stats">;

export const FOREVER = 2147483647; // Maximum setTimeout delay
export interface PollerOptions {
  readonly intervalMs: number;
  readonly timeoutMs: number;
  readonly exponentialBackoff: boolean;
  readonly abortSignal?: AbortSignal;
}

export type PollerResult<T> = PollSuccessActionResult<T> | PollErrorActionResult | PollTimeoutActionResult;

function doneStats(stats: Writable<PollerStats> & { startTime: number }): PollerStats {
  stats.totalElapsedMs = Date.now() - stats.startTime;
  return {
    attempts: stats.attempts,
    lastIntervalMs: stats.lastIntervalMs,
    totalElapsedMs: stats.totalElapsedMs,
  };
}

async function interPoller<T>(
  fn: (abortSignal?: AbortSignal) => Promise<PollActionResult<T>>,
  options: Writable<PollerOptions>,
  stats: Writable<PollerStats> & { readonly startTime: number },
): Promise<PollerResult<T>> {
  do {
    let result: PollActionResult<T>;
    try {
      stats.attempts += 1;
      result = await fn(options.abortSignal);
      switch (result.state) {
        case "waiting":
          {
            if (options.exponentialBackoff) {
              options.intervalMs = Math.min(options.intervalMs * 2, FOREVER);
            }
            stats.lastIntervalMs = options.intervalMs;
            const err = await sleep(options.intervalMs, options.abortSignal);
            if (err.isErr()) {
              return {
                state: "error",
                error: err.Err(),
                stats: doneStats(stats),
              };
            }
          }
          break;
        case "success":
          return { ...result, stats: doneStats(stats) };
        case "error":
          return { ...result, stats: doneStats(stats) };
      }
    } catch (err) {
      return {
        state: "error",
        error: err as Error,
        stats: doneStats(stats),
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
  const stats = {
    attempts: 0,
    startTime: Date.now(),
    lastIntervalMs: 0,
    totalElapsedMs: 0,
  };
  return Promise.race([
    interPoller(fn, options, stats),
    sleep(options.timeoutMs, options.abortSignal)
      .then(() => ({ state: "timeout" as const, stats: doneStats(stats) }))
      .catch((e: Error) => ({ state: "error" as const, error: e, stats: doneStats(stats) })),
  ]);
}
