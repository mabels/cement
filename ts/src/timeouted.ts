import { Future } from "./future.js";
import { isPromise } from "./is-promise.js";
import { sleep } from "./utils/promise-sleep.js";

export interface PurTimeoutResultSuccess<T> {
  readonly state: "success";
  readonly value: T;
}

export interface PurTimeoutResultTimeout {
  readonly state: "timeout";
}
export interface PurTimeoutResultAborted {
  readonly state: "aborted";
  readonly reason: unknown;
}
export interface PurTimeoutResultError {
  readonly state: "error";
  readonly error: Error;
}

export interface TimeoutState<CTX> {
  readonly duration: number;
  readonly ctx: CTX;
}

type PurTimeoutResult<T> = PurTimeoutResultSuccess<T> | PurTimeoutResultTimeout | PurTimeoutResultAborted | PurTimeoutResultError;

export type TimeoutResultSuccess<T, CTX = unknown> = PurTimeoutResultSuccess<T> & TimeoutState<CTX>;
export type TimeoutResultTimeout<CTX = unknown> = PurTimeoutResultTimeout & TimeoutState<CTX>;
export type TimeoutResultAborted<CTX = unknown> = PurTimeoutResultAborted & TimeoutState<CTX>;
export type TimeoutResultError<CTX = unknown> = PurTimeoutResultError & TimeoutState<CTX>;

export type TimeoutResult<T, CTX = unknown> =
  | TimeoutResultSuccess<T, CTX>
  | TimeoutResultTimeout<CTX>
  | TimeoutResultAborted<CTX>
  | TimeoutResultError<CTX>;

export type ActionFunc<T> = (controller: AbortController) => Promise<T>;

// Action item in arrays - can be function or promise
export type ActionItem<T> = ActionFunc<T> | Promise<T>;

// Main action type - function, promise, or mixed array
export type TimeoutAction<T> = ActionItem<T>;

// Configuration options
export interface TimeoutActionOptions<CTX> {
  readonly timeout: number;
  readonly signal: AbortSignal;
  readonly controller: AbortController;
  readonly ctx: CTX;
  onTimeout: () => void;
  onAbort: (reason: unknown) => void;
  onError: (error: Error) => void;
  onAbortAction: (reason: unknown) => void;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isSuccess<T>(result: TimeoutResult<T>): result is TimeoutResultSuccess<T> {
  return result.state === "success";
}

export function isTimeout<T>(result: TimeoutResult<T>): result is TimeoutResultTimeout<T> {
  return result.state === "timeout";
}

export function isAborted<T>(result: TimeoutResult<T>): result is TimeoutResultAborted<T> {
  return result.state === "aborted";
}

export function isError<T>(result: TimeoutResult<T>): result is TimeoutResultError<T> {
  return result.state === "error";
}

export function unwrap<T>(result: TimeoutResult<T>): T {
  if (isSuccess(result)) {
    return result.value;
  }
  throw new Error(`TimeoutResult is not success: ${result.state}`);
}

export function unwrapOr<T>(result: TimeoutResult<T>, defaultValue: T): T {
  return isSuccess(result) ? result.value : defaultValue;
}

export async function timeouted<T, CTX = void>(
  action: TimeoutAction<T>,
  options: Partial<TimeoutActionOptions<CTX>> = {},
): Promise<TimeoutResult<T>> {
  const { timeout = 30000, signal, controller: externalController, ctx, onTimeout, onAbort, onError, onAbortAction } = options;

  const controller = externalController || new AbortController();
  const startTime = Date.now();

  const toRemoveEventListeners: (() => void)[] = [];

  // Link external signal to internal controller
  if (signal) {
    function abortAction(): void {
      controller.abort(signal?.reason);
    }
    toRemoveEventListeners.push(() => {
      signal?.removeEventListener("abort", abortAction);
    });
    signal.addEventListener("abort", abortAction);
  }
  function cleanup<X extends PurTimeoutResult<T>>(result: X, skipCleanupAction = false): TimeoutResult<T, CTX> {
    for (const evtFn of toRemoveEventListeners) {
      evtFn();
    }
    toRemoveEventListeners.length = 0;
    if (!skipCleanupAction) {
      void onAbortAction?.(signal?.reason);
      controller.abort(new Error("Timeouted Abort Action"));
    }
    return {
      ...result,
      duration: Date.now() - startTime,
      ctx: ctx as CTX,
    } as TimeoutResult<T, CTX>;
  }

  let toAwait: Promise<T>;
  if (isPromise(action)) {
    toAwait = action;
  } else {
    try {
      toAwait = action(controller);
    } catch (error) {
      return cleanup({
        state: "error",
        error: error instanceof Error ? error : new Error(error as string),
      });
    }
  }

  const abortToAwait = new Future<PurTimeoutResultAborted>();
  function onAbortHandler(): void {
    abortToAwait.resolve({ state: "aborted" as const, reason: controller.signal.reason as unknown });
  }
  controller.signal.addEventListener("abort", onAbortHandler);
  toRemoveEventListeners.push(() => {
    controller.signal.removeEventListener("abort", onAbortHandler);
  });

  const toRace: Promise<PurTimeoutResult<T>>[] = [
    toAwait.then((value) => ({ state: "success" as const, value })).catch((error: Error) => ({ state: "error" as const, error })),
    abortToAwait.asPromise(),
  ];
  if (timeout > 0) {
    toRace.push(
      sleep(timeout, controller.signal).then((r): PurTimeoutResult<T> => {
        switch (true) {
          case r.isOk:
            return { state: "timeout" as const };
          case r.isErr:
            return { state: "error" as const, error: r.error };
          case r.isAborted:
            return { state: "aborted" as const, reason: r.reason };
        }
        throw new Error("Unreachable code in timeoutAction");
      }),
    );
  }

  const res = await Promise.race(toRace);
  switch (true) {
    case res.state === "success":
      return cleanup(res, true);
    case res.state === "aborted":
      onAbort?.(res.reason);
      return cleanup(res);
    case res.state === "error":
      onError?.(res.error);
      return cleanup(res);
    case res.state === "timeout":
      onTimeout?.();
      return cleanup(res);
  }
  throw new Error("Unreachable code in timeoutAction");
}
