import { isPromise } from "./is-promise.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class OnFuncInstance<Args extends any[]> {
  readonly #fns = new Set<(...a: Args) => unknown>();

  addFunction(fn: (...a: Args) => unknown): () => void {
    this.#fns.add(fn);
    return () => {
      this.unreg(OnFuncReturn.UNREGISTER, fn);
    };
  }

  private unreg(ret: unknown, fn: (...a: Args) => unknown): unknown {
    // console.log("unreg", ret, OnFuncReturn, OnFuncReturn[ret as keyof typeof OnFuncReturn]);
    if (ret === OnFuncReturn.UNREGISTER || ret === OnFuncReturn.ONCE) {
      this.#fns.delete(fn);
      return undefined;
    }
    return ret;
  }

  public invoke(...a: Args): void {
    for (const fn of this.#fns) {
      try {
        const couldByPlainOrPromise = fn(...a);
        if (isPromise(couldByPlainOrPromise)) {
          void couldByPlainOrPromise.then((ret) => {
            this.unreg(ret, fn);
          });
        } else {
          this.unreg(couldByPlainOrPromise, fn);
        }
      } catch (e) {
        // ignore errors
      }
    }
  }

  public clear(): void {
    this.#fns.clear();
  }

  public async invokeAsync(...a: Args): Promise<void> {
    await Promise.allSettled(Array.from(this.#fns).map((fn) => Promise.resolve(fn(...a)).then((ret) => this.unreg(ret, fn))));
  }
}

export const OnFuncReturn: {
  readonly UNREGISTER: symbol;
  readonly ONCE: symbol;
} = {
  UNREGISTER: Symbol("ONFUNC_UNREGISTER"),
  ONCE: Symbol("ONFUNC_ONCE"),
} as const;
export type OnFuncReturn = (typeof OnFuncReturn)[keyof typeof OnFuncReturn];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ReturnOnFunc<Args extends any[], X = unknown> {
  (fn: (...a: Args) => OnFuncReturn | X): () => unknown; // returns unregister function
  invoke(...a: Args): void;
  invokeAsync(...a: Args): Promise<void>;
  clear(): void;
}

type ExtractArgs<T, X> = T extends (...args: infer A) => OnFuncReturn | X ? A : never;

/**
 * Creates a type-safe event emitter for a specific function signature.
 *
 * OnFunc provides a simple pub/sub pattern where multiple listeners can be
 * registered for a specific function signature. All listeners are invoked
 * when the event is triggered, with errors caught and ignored. Supports
 * both synchronous and asynchronous invocation.
 *
 * @template Fn - The function signature that listeners must match
 * @returns Event emitter with register, invoke, invokeAsync, and clear methods
 *
 * @example
 * ```typescript
 * // Create emitter for specific function signature
 * const onUserLogin = OnFunc<(userId: string, timestamp: Date) => void>();
 *
 * // Register listeners (returns unregister function)
 * const unsubscribe1 = onUserLogin((userId, timestamp) => {
 *   console.log(`User ${userId} logged in at ${timestamp}`);
 * });
 *
 * const unsubscribe2 = onUserLogin((userId) => {
 *   trackAnalytics('login', userId);
 * });
 *
 * // Trigger all listeners
 * onUserLogin.invoke('user123', new Date());
 *
 * // Async invocation
 * await onUserLogin.invokeAsync('user456', new Date());
 *
 * // Unregister specific listener
 * unsubscribe1();
 *
 * // Clear all listeners
 * onUserLogin.clear();
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function OnFunc<Fn extends (...args: any[]) => OnFuncReturn | X, X = unknown>(): ReturnOnFunc<ExtractArgs<Fn, X>> {
  const instance = new OnFuncInstance<ExtractArgs<Fn, X>>();
  const ret = instance.addFunction.bind(instance) as ReturnOnFunc<ExtractArgs<Fn, X>>;
  ret.invoke = instance.invoke.bind(instance) as ReturnOnFunc<ExtractArgs<Fn, X>>["invoke"];
  ret.invokeAsync = instance.invokeAsync.bind(instance) as ReturnOnFunc<ExtractArgs<Fn, X>>["invokeAsync"];
  ret.clear = instance.clear.bind(instance) as ReturnOnFunc<ExtractArgs<Fn, X>>["clear"];
  return ret;
}
