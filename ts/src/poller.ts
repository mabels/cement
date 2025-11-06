import { Future } from "./future.js";
import { sleep } from "./utils/promise-sleep.js";
import { Writable } from "ts-essentials";

export interface PollerStats {
  readonly attempts: number;
  readonly lastIntervalMs: number;
  readonly totalElapsedMs: number;
}

interface PollWithStats {
  readonly stats: PollerStats;
}

export interface PurPollWaitingActionResult {
  readonly state: "waiting";
}

export type PollWaitingActionResult = PurPollWaitingActionResult & PollWithStats;

export interface PurPollSuccessActionResult<T> {
  readonly state: "success";
  readonly result: T;
}

export type PollSuccessActionResult<T> = PurPollSuccessActionResult<T> & PollWithStats;

export interface PurPollErrorActionResult {
  readonly state: "error";
  readonly error: Error;
}

export type PollErrorActionResult = PurPollErrorActionResult & PollWithStats;

export interface PurPollTimeoutActionResult {
  readonly state: "timeout";
}

export type PollTimeoutActionResult = PurPollTimeoutActionResult & PollWithStats;

export interface PurPollAbortActionResult {
  readonly state: "aborted";
  readonly reason: unknown;
}
export type PollAbortActionResult = PurPollAbortActionResult & PollWithStats;

export type PollActionResult<T> =
  | PurPollWaitingActionResult
  | PurPollSuccessActionResult<T>
  | PurPollErrorActionResult
  | PurPollTimeoutActionResult
  | PurPollAbortActionResult;

export const FOREVER = 2147483647; // Maximum setTimeout delay
export interface PollerOptions {
  readonly intervalMs: number;
  readonly actionTimeoutMs: number; // not -1 it means if a timeout occures the action is retried in the next interval
  readonly timeoutMs: number;
  readonly exponentialBackoff: boolean;
  readonly abortSignal?: AbortSignal;
}

export type PollerResult<T> = PollSuccessActionResult<T> | PollErrorActionResult | PollTimeoutActionResult | PollAbortActionResult;

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
  options: Writable<Omit<PollerOptions, "abortSignal">>,
  stats: Writable<PollerStats> & { readonly startTime: number },
  abortController: AbortController,
): Promise<PollerResult<T>> {
  do {
    // let result: PollActionResult<T>;
    try {
      stats.attempts += 1;

      const abortCheck = new Future<PurPollAbortActionResult>();
      function onAbort(): void {
        abortCheck.resolve({
          state: "aborted",
          reason: abortController.signal.reason,
        });
      }
      const fnAbortController = new AbortController();
      fnAbortController.signal.addEventListener("abort", onAbort, { once: true });

      const races = [
        fn(fnAbortController.signal).finally(() => {
          // abort all other waits
          fnAbortController.abort();
        }),
        abortCheck.asPromise().finally(() => {
          // abort all other waits
          fnAbortController.abort();
        }),
      ];
      if (options.actionTimeoutMs > 0) {
        races.push(
          sleep(options.actionTimeoutMs, fnAbortController.signal).then((res): PollActionResult<T> => {
            // abort all other waits
            fnAbortController.abort(new Error("poller action timeout"));
            switch (res.state) {
              case "sleeped":
                // timeout occurred but we retry
                return { state: "waiting" as const };
              case "error":
                return { state: "error" as const, error: res.error };
              case "aborted":
                return { state: "aborted" as const, reason: res.reason };
            }
            throw new Error("Unreachable code in poller action timeout");
          }),
        );
      }
      const result = await Promise.race<PollActionResult<T>>(races).finally(() => {
        fnAbortController.signal.removeEventListener("abort", onAbort);
      });
      switch (result.state) {
        case "waiting":
          {
            if (options.exponentialBackoff) {
              options.intervalMs = Math.min(options.intervalMs * 2, FOREVER);
            }
            stats.lastIntervalMs = options.intervalMs;
            const res = await sleep(options.intervalMs, abortController.signal);
            switch (true) {
              case res.isAborted:
                return {
                  state: "aborted" as const,
                  reason: res.reason,
                  stats: doneStats(stats),
                };
              case res.isOk:
                break;
              case res.isErr:
                return {
                  state: "error",
                  error: res.error,
                  stats: doneStats(stats),
                };
              default:
                throw new Error("poller interrupted during sleep");
            }
          }
          break;
        case "aborted":
          return {
            state: "aborted" as const,
            reason: result.reason,
            stats: doneStats(stats),
          };
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
    timeoutMs: 30000, // -1 means forever
    actionTimeoutMs: -1, // forever
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
  const abortController = new AbortController();
  const toRemoveEventListeners: (() => void)[] = [];
  if (options.abortSignal) {
    if (options.abortSignal.aborted) {
      abortController.abort(options.abortSignal.reason);
    } else {
      function dispatchAbort(): void {
        abortController.abort(options.abortSignal?.reason);
      }
      toRemoveEventListeners.push(() => {
        options.abortSignal?.removeEventListener("abort", dispatchAbort);
      });
      options.abortSignal.addEventListener("abort", dispatchAbort, { once: true });
    }
  }
  const races = [interPoller(fn, options, stats, abortController)];
  if (options.timeoutMs > 0) {
    races.push(
      sleep(options.timeoutMs, abortController.signal)
        .then(() => ({ state: "timeout" as const, stats: doneStats(stats) }))
        .catch((e: Error) => ({ state: "error" as const, error: e, stats: doneStats(stats) })),
    );
  }
  return Promise.race(races).finally(() => {
    toRemoveEventListeners.forEach((fn) => fn());
    toRemoveEventListeners.length = 0;
  });
}
