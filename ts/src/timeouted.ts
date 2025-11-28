import { Future } from "./future.js";
import { isPromise } from "./is-promise.js";
import { sleep } from "./promise-sleep.js";

export interface IsTimeouted<T, CTX> {
  isSuccess(): this is TimeoutResultSuccess<T, CTX>;
  isTimeout(): this is TimeoutResultTimeout<CTX>;
  isAborted(): this is TimeoutResultAborted<CTX>;
  isError(): this is TimeoutResultError<CTX>;
}

function isTimeoutedMixin<T, CTX, R extends PurTimeoutResult<T>>(obj: R): R & IsTimeouted<T, CTX> {
  return Object.assign(obj, {
    isSuccess: () => isSuccess(obj),
    isTimeout: () => isTimeout(obj),
    isAborted: () => isAborted(obj),
    isError: () => isError(obj),
  }) as R & IsTimeouted<T, CTX>;
}

export interface PurTimeoutState {
  readonly state: "success" | "timeout" | "aborted" | "error";
}

export interface PurTimeoutResultSuccess<T> extends PurTimeoutState {
  readonly state: "success";
  readonly value: T;
}

export interface PurTimeoutResultTimeout extends PurTimeoutState {
  readonly state: "timeout";
}
export interface PurTimeoutResultAborted extends PurTimeoutState {
  readonly state: "aborted";
  readonly reason: unknown;
}
export interface PurTimeoutResultError extends PurTimeoutState {
  readonly state: "error";
  readonly error: Error;
}

export interface TimeoutState<CTX> {
  readonly duration: number;
  readonly ctx: CTX;
}

type PurTimeoutResult<T> = PurTimeoutResultSuccess<T> | PurTimeoutResultTimeout | PurTimeoutResultAborted | PurTimeoutResultError;

export type TimeoutResultSuccess<T, CTX = unknown> = PurTimeoutResultSuccess<T> & TimeoutState<CTX> & IsTimeouted<T, CTX>;
export type TimeoutResultTimeout<CTX = unknown> = PurTimeoutResultTimeout & TimeoutState<CTX> & IsTimeouted<unknown, CTX>;
export type TimeoutResultAborted<CTX = unknown> = PurTimeoutResultAborted & TimeoutState<CTX> & IsTimeouted<unknown, CTX>;
export type TimeoutResultError<CTX = unknown> = PurTimeoutResultError & TimeoutState<CTX> & IsTimeouted<unknown, CTX>;

export type TimeoutResult<T, CTX> =
  | TimeoutResultSuccess<T, CTX>
  | TimeoutResultTimeout<CTX>
  | TimeoutResultAborted<CTX>
  | TimeoutResultError<CTX>;

export function createTimeoutResult<T, CTX>(t: PurTimeoutResult<T> & TimeoutState<CTX>): TimeoutResult<T, CTX> {
  return { ...isTimeoutedMixin(t), ...t } as TimeoutResult<T, CTX>;
}

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
  // onAbortAction: (reason: unknown) => void;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a TimeoutResult represents a successful completion.
 *
 * @template T - The type of the result value
 * @param result - The TimeoutResult to check
 * @returns True if the result state is "success"
 */
export function isSuccess<T>(result: PurTimeoutResult<T>): result is TimeoutResultSuccess<T> {
  return result.state === "success";
}

/**
 * Type guard to check if a TimeoutResult represents a timeout.
 *
 * @template T - The type of the result value
 * @param result - The TimeoutResult to check
 * @returns True if the result state is "timeout"
 */
export function isTimeout<T>(result: PurTimeoutResult<T>): result is TimeoutResultTimeout<T> {
  return result.state === "timeout";
}

/**
 * Type guard to check if a TimeoutResult was aborted via AbortSignal.
 *
 * @template T - The type of the result value
 * @param result - The TimeoutResult to check
 * @returns True if the result state is "aborted"
 */
export function isAborted<T>(result: PurTimeoutResult<T>): result is TimeoutResultAborted<T> {
  return result.state === "aborted";
}

/**
 * Type guard to check if a TimeoutResult represents an error during execution.
 *
 * @template T - The type of the result value
 * @param result - The TimeoutResult to check
 * @returns True if the result state is "error"
 */
export function isError<T>(result: PurTimeoutResult<T>): result is TimeoutResultError<T> {
  return result.state === "error";
}

/**
 * Extracts the value from a successful TimeoutResult or throws an error.
 *
 * @template T - The type of the result value
 * @param result - The TimeoutResult to unwrap
 * @returns The success value
 * @throws Error if the result is not in success state
 */
export function unwrap<T, CTX>(result: TimeoutResult<T, CTX>): T {
  if (isSuccess(result)) {
    return result.value;
  }
  throw new Error(`TimeoutResult is not success: ${result.state}`);
}

/**
 * Extracts the value from a successful TimeoutResult or returns a default value.
 *
 * @template T - The type of the result value
 * @param result - The TimeoutResult to unwrap
 * @param defaultValue - The value to return if result is not successful
 * @returns The success value or the default value
 */
export function unwrapOr<T, CTX>(result: TimeoutResult<T, CTX>, defaultValue: T): T {
  return isSuccess(result) ? result.value : defaultValue;
}

/**
 * Executes an action with comprehensive timeout and abort handling.
 *
 * Wraps a promise or async function with timeout, abort signal, and error handling capabilities.
 * The action can be controlled via AbortController and will properly clean up resources.
 *
 * @template T - The type of the action's result value
 * @template CTX - Optional context type passed through to callbacks
 * @param action - Either a Promise or a function that receives an AbortController and returns a Promise
 * @param options - Optional configuration:
 *   - timeout: Timeout duration in milliseconds (default: 30000). Set to 0 or negative to disable.
 *   - signal: External AbortSignal to link for cancellation
 *   - controller: External AbortController to use instead of creating a new one
 *   - ctx: Context object passed through in the result
 *   - onTimeout: Callback invoked when timeout occurs
 *   - onAbort: Callback invoked when aborted (with abort reason)
 *   - onError: Callback invoked when action throws an error
 *   - onAbortAction: Callback for cleanup when action needs to be aborted
 *
 * @returns Promise resolving to a TimeoutResult containing:
 *   - state: "success" | "timeout" | "aborted" | "error"
 *   - value (if success), error (if error), or reason (if aborted)
 *   - duration: Elapsed time in milliseconds
 *   - ctx: The context object if provided
 *
 * @example
 * ```typescript
 * // With a function that can be aborted
 * const result = await timeouted(
 *   async (controller) => {
 *     return fetch(url, { signal: controller.signal });
 *   },
 *   { timeout: 5000 }
 * );
 *
 * if (isSuccess(result)) {
 *   console.log('Request completed:', result.value);
 * } else if (isTimeout(result)) {
 *   console.log('Request timed out after', result.duration, 'ms');
 * }
 *
 * // With a direct promise
 * const result2 = await timeouted(
 *   fetch(url),
 *   { timeout: 3000 }
 * );
 * ```
 */
export async function timeouted<T, CTX = void>(
  action: TimeoutAction<T>,
  options: Partial<TimeoutActionOptions<CTX>> = {},
): Promise<TimeoutResult<T, CTX>> {
  const { timeout = 30000, signal, controller: externalController, ctx, onTimeout, onAbort, onError } = options;

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
      // void onAbortAction?.(signal?.reason);
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
      return cleanup(
        createTimeoutResult<T, CTX>({
          state: "error",
          error: error instanceof Error ? error : new Error(error as string),
          duration: Date.now() - startTime,
          ctx: ctx as CTX,
        }),
      );
    }
  }

  const abortToAwait = new Future<TimeoutResult<T, CTX>>();
  function onAbortHandler(): void {
    abortToAwait.resolve(
      createTimeoutResult<T, CTX>({
        state: "aborted" as const,
        reason: controller.signal.reason as unknown,
        duration: Date.now() - startTime,
        ctx: ctx as CTX,
      }),
    );
  }
  controller.signal.addEventListener("abort", onAbortHandler);
  toRemoveEventListeners.push(() => {
    controller.signal.removeEventListener("abort", onAbortHandler);
  });

  const toRace: Promise<PurTimeoutResult<T>>[] = [
    toAwait
      .then((value) =>
        createTimeoutResult<T, CTX>({ state: "success" as const, value, duration: Date.now() - startTime, ctx: ctx as CTX }),
      )
      .catch((error: Error) =>
        createTimeoutResult<T, CTX>({ state: "error" as const, error, duration: Date.now() - startTime, ctx: ctx as CTX }),
      ),
    abortToAwait.asPromise(),
  ];
  if (timeout > 0) {
    toRace.push(
      sleep(timeout, controller.signal).then((r): PurTimeoutResult<T> => {
        switch (true) {
          case r.isOk:
            return createTimeoutResult<T, CTX>({ state: "timeout" as const, duration: Date.now() - startTime, ctx: ctx as CTX });
          case r.isErr:
            return createTimeoutResult<T, CTX>({
              state: "error" as const,
              error: r.error,
              duration: Date.now() - startTime,
              ctx: ctx as CTX,
            });
          case r.isAborted:
            return createTimeoutResult<T, CTX>({
              state: "aborted" as const,
              reason: r.reason,
              duration: Date.now() - startTime,
              ctx: ctx as CTX,
            });
        }
        throw new Error("Unreachable code in timeoutAction");
      }),
    );
  }

  const res = await Promise.race(toRace);
  switch (true) {
    case res.state === "success":
      return cleanup(res);
    case res.state === "aborted":
      onAbort?.(res.reason);
      return cleanup(res, true);
    case res.state === "error":
      onError?.(res.error);
      return cleanup(res);
    case res.state === "timeout":
      onTimeout?.();
      return cleanup(res, true);
  }
  throw new Error("Unreachable code in timeoutAction");
}
