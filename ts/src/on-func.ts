import { isPromise } from "./is-promise.js";
import { exception2Result, Result } from "./result.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class OnFuncInstanceBase<Args extends any[]> {
  readonly _fns = new Set<(...a: Args) => unknown>();

  addFunction(fn: (...a: Args) => unknown): () => void {
    this._fns.add(fn);
    return () => {
      this.unreg(OnFuncReturn.UNREGISTER, fn);
    };
  }

  once(fn: (...a: Args) => void): () => void {
    return this.addFunction((...a: Args): OnFuncReturn => {
      exception2Result(() => fn(...a));
      return OnFuncReturn.ONCE;
    });
  }

  private unreg(ret: unknown, fn: (...a: Args) => unknown): unknown {
    if (Result.Is(ret)) {
      if (ret.isErr()) {
        return undefined;
      }
      ret = ret.unwrap();
    }
    // console.log("unreg", ret, OnFuncReturn, OnFuncReturn[ret as keyof typeof OnFuncReturn]);
    if (ret === OnFuncReturn.UNREGISTER || ret === OnFuncReturn.ONCE) {
      this._fns.delete(fn);
      return undefined;
    }
    return ret;
  }

  public invoke(...a: Args): void {
    for (const fn of this._fns) {
      try {
        const couldByPlainOrPromise = exception2Result(() => fn(...a));
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
    this._fns.clear();
  }

  public async invokeAsync(...a: Args): Promise<void> {
    await Promise.allSettled(Array.from(this._fns).map((fn) => Promise.resolve(fn(...a)).then((ret) => this.unreg(ret, fn))));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class OnFuncInstance<Args extends any[]> extends OnFuncInstanceBase<Args> {
  readonly onRegister = new OnFuncInstanceBase<[fn: (...a0: Args) => unknown, fns: ((...a1: Args) => unknown)[]]>();
  // (a: number, b: string) => unknown
  addFunction(fn: (...a: Args) => unknown): () => void {
    this.onRegister.invoke(fn, Array.from(this._fns));
    return super.addFunction(fn);
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
  once(fn: (...a: Args) => void): () => unknown;
  onRegister(fn: (fn: (...a: Args) => unknown, fns: ((...a: Args) => unknown)[]) => OnFuncReturn): () => unknown;
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
 *
 * // Auto-unregister with ONCE (listener runs only once)
 * const onDataLoad = OnFunc<(data: string) => void>();
 * onDataLoad((data) => {
 *   console.log(`Data loaded: ${data}`);
 *   return OnFuncReturn.ONCE; // Automatically unregisters after first invocation
 * });
 * onDataLoad.invoke('first'); // Logs "Data loaded: first"
 * onDataLoad.invoke('second'); // No output - listener already removed
 *
 * // Conditional unregister with UNREGISTER
 * const onMessage = OnFunc<(msg: string) => void>();
 * onMessage((msg) => {
 *   console.log(`Received: ${msg}`);
 *   if (msg === 'stop') {
 *     return OnFuncReturn.UNREGISTER; // Unregisters when condition is met
 *   }
 * });
 * onMessage.invoke('hello'); // Logs "Received: hello"
 * onMessage.invoke('world'); // Logs "Received: world"
 * onMessage.invoke('stop');  // Logs "Received: stop" and unregisters
 * onMessage.invoke('ignored'); // No output - listener was unregistered
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function OnFunc<Fn extends (...args: any[]) => OnFuncReturn | X, X = unknown>(): ReturnOnFunc<ExtractArgs<Fn, X>> {
  const instance = new OnFuncInstance<ExtractArgs<Fn, X>>();
  const ret = instance.addFunction.bind(instance) as ReturnOnFunc<ExtractArgs<Fn, X>>;
  ret.invoke = instance.invoke.bind(instance) as ReturnOnFunc<ExtractArgs<Fn, X>>["invoke"];
  ret.invokeAsync = instance.invokeAsync.bind(instance) as ReturnOnFunc<ExtractArgs<Fn, X>>["invokeAsync"];
  ret.clear = instance.clear.bind(instance) as ReturnOnFunc<ExtractArgs<Fn, X>>["clear"];
  ret.once = instance.once.bind(instance) as ReturnOnFunc<ExtractArgs<Fn, X>>["once"];
  ret.onRegister = instance.onRegister.addFunction.bind(instance.onRegister) as ReturnOnFunc<ExtractArgs<Fn, X>>["onRegister"];
  return ret;
}
