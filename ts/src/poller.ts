import { sleep } from "./utils/promise-sleep.js";

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
export interface PollerOptions {
  readonly intervalMs: number;
  readonly timeoutMs: number;
}

export type PollerResult<T> = PollSuccessActionResult<T> | PollErrorActionResult;

async function interPoller<T>(fn: () => Promise<PollActionResult<T>>, options: PollerOptions): Promise<PollerResult<T>> {
  do {
    let result: PollActionResult<T>;
    try {
      result = await fn();
      switch (result.state) {
        case "waiting":
          await sleep(options.intervalMs);
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
  };
  return Promise.race([
    interPoller(fn, options),
    (async (): Promise<PollErrorActionResult> => {
      await sleep(options.timeoutMs);
      return {
        state: "error",
        error: new Error("Polling timed out"),
      };
    })(),
  ]);
}
