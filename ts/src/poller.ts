import { Future } from "./future.js";
import { sleep } from "./promise-sleep.js";
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
export interface PollerOptions<CTX> {
  readonly intervalMs: number;
  readonly actionTimeoutMs: number; // not -1 it means if a timeout occures the action is retried in the next interval
  readonly timeoutMs: number;
  readonly exponentialBackoff: boolean;
  readonly abortSignal?: AbortSignal;
  readonly ctx: CTX;
}

export type PollerResult<T> = PollSuccessActionResult<T> | PollErrorActionResult | PollTimeoutActionResult | PollAbortActionResult;
export interface PollerCtx<CTX> {
  readonly ctx: CTX;
  readonly stats: PollerStats;
  readonly abortSignal: AbortSignal;
}

export type PollerFunc<T, CTX> = (state: PollerCtx<CTX>) => Promise<PollActionResult<T>>;

function doneStats(stats: Writable<PollerStats> & { startTime: number }): PollerStats {
  stats.totalElapsedMs = Date.now() - stats.startTime;
  return {
    attempts: stats.attempts,
    lastIntervalMs: stats.lastIntervalMs,
    totalElapsedMs: stats.totalElapsedMs,
  };
}

async function interPoller<R, CTX>(
  fn: PollerFunc<R, CTX>,
  options: Writable<Omit<PollerOptions<CTX>, "abortSignal">>,
  stats: Writable<PollerStats> & { readonly startTime: number },
  abortController: AbortController,
): Promise<PollerResult<R>> {
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

      const races: Promise<PollActionResult<R>>[] = [
        fn({
          ctx: options.ctx,
          stats,
          abortSignal: fnAbortController.signal,
        }).finally(() => {
          // abort all other waits
          fnAbortController.abort("action: kill other waits");
        }),
        abortCheck.asPromise().finally(() => {
          // abort all other waits
          fnAbortController.abort("abortcheck: kill other waits");
        }),
      ];
      if (options.actionTimeoutMs > 0) {
        races.push(
          sleep(options.actionTimeoutMs, fnAbortController.signal).then((res): PollActionResult<R> => {
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
      const result = await Promise.race<PollActionResult<R>>(races).finally(() => {
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

/**
 * Repeatedly polls an asynchronous function until a terminal state is reached.
 *
 * The poller executes the provided function at regular intervals and supports:
 * - Exponential backoff for retry intervals
 * - Timeouts for individual actions and overall polling
 * - Abort signal for cancellation
 * - Detailed statistics tracking (attempts, intervals, elapsed time)
 *
 * @template R - The type of the successful result value
 * @param fn - Function to poll that returns a PollActionResult indicating whether to continue waiting, succeed, error, timeout, or abort
 * @param ioptions - Optional configuration:
 *   - intervalMs: Time between poll attempts in milliseconds (default: 1000)
 *   - timeoutMs: Total timeout in milliseconds, -1 for forever (default: 30000)
 *   - actionTimeoutMs: Timeout for each individual action attempt, -1 for forever (default: -1)
 *   - exponentialBackoff: Whether to double the interval after each attempt (default: auto-enabled if timeoutMs is FOREVER)
 *   - abortSignal: Optional AbortSignal to cancel polling
 *
 * @returns Promise resolving to a PollerResult with state, statistics, and result/error/reason depending on the outcome
 *
 * @example
 * ```typescript
 * const result = await poller(async () => {
 *   const status = await checkStatus();
 *   if (status.ready) {
 *     return { state: 'success', result: status.data };
 *   }
 *   return { state: 'waiting' };
 * }, { intervalMs: 2000, timeoutMs: 60000 });
 *
 * if (result.state === 'success') {
 *   console.log('Got result:', result.result);
 * }
 * ```
 */
export async function poller<R, CTX = void>(
  fn: PollerFunc<R, CTX>,
  ioptions: Partial<PollerOptions<CTX>> = {},
): Promise<PollerResult<R>> {
  const options: PollerOptions<CTX> = {
    intervalMs: 1000,
    timeoutMs: 30000, // -1 means forever
    actionTimeoutMs: -1, // forever
    ctx: undefined as unknown as CTX,
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
  const races = [interPoller<R, CTX>(fn, options, stats, abortController)];
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
