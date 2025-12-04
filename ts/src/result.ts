import { isPromise } from "./is-promise.js";

/**
 * Result type for representing success (Ok) or failure (Err) values.
 *
 * Result is a type-safe way to handle operations that can fail, similar to Rust's
 * Result type. It forces explicit handling of both success and error cases without
 * throwing exceptions.
 *
 * @template T - The type of the success value
 * @template E - The type of the error (default: Error)
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number> {
 *   if (b === 0) {
 *     return Result.Err('Division by zero');
 *   }
 *   return Result.Ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.isOk()) {
 *   console.log('Result:', result.unwrap());
 * } else {
 *   console.error('Error:', result.unwrap_err());
 * }
 * ```
 */
export abstract class Result<T, E = Error> {
  static Ok<T = void, E = Error>(...args: T[]): Result<T, E> {
    return args.length >= 1 ? new ResultOK<T, E>(args[0]) : new ResultOK<T, E>(undefined as unknown as T);
  }
  static Err<T, E extends Error = Error>(t: E | string | Result<unknown, E>): Result<T, E> {
    if (typeof t === "string") {
      return new ResultError(new Error(t) as E);
    }
    if (Result.Is(t)) {
      if (t.is_ok()) {
        return new ResultError(new Error("Result Error is Ok") as E);
      }
      return t as Result<T, E>;
    }
    return new ResultError(t);
  }
  static Is<T>(t: unknown): t is Result<T> {
    if (!t) {
      return false;
    }
    if (t instanceof Result) {
      return true;
    }
    const rt = t as Result<T>;
    if ([typeof rt.is_ok, typeof rt.is_err, typeof rt.unwrap, typeof rt.unwrap_err].every((x) => x === "function")) {
      return true;
    }
    return false;
  }

  static AsyncOk<T = void, E = Error>(...args: T[]): Promise<Result<T, E>> {
    return Promise.resolve(Result.Ok<T, E>(...args));
  }
  static AsyncErr<T, E extends Error = Error>(t: E | string | Result<unknown, E>): Promise<Result<T, E>> {
    return Promise.resolve(Result.Err<T, E>(t));
  }

  isOk(): boolean {
    return this.is_ok();
  }
  isErr(): boolean {
    return this.is_err();
  }

  Ok(): T {
    return this.unwrap();
  }
  Err(): E {
    return this.unwrap_err();
  }

  abstract is_ok(): boolean;
  abstract is_err(): boolean;
  abstract unwrap(): T;
  abstract unwrap_err(): E;
}

export class ResultOK<T, E = unknown> extends Result<T, E> {
  private _t: T;
  constructor(t: T) {
    super();
    this._t = t;
  }
  is_ok(): boolean {
    return true;
  }
  is_err(): boolean {
    return false;
  }
  unwrap_err(): E {
    throw new Error("Result is Ok");
  }
  unwrap(): T {
    return this._t;
  }
}

export class ResultError<T extends Error> extends Result<never, T> {
  private _error: T;
  constructor(t: T) {
    super();
    this._error = t;
  }
  is_ok(): boolean {
    return false;
  }
  is_err(): boolean {
    return true;
  }
  unwrap(): never {
    throw new Error(`Result is Err: ${this._error}`);
  }
  unwrap_err(): T {
    return this._error;
  }
}

export type WithoutResult<T> = T extends Result<infer U> ? U : T;

// type WithoutPromise<T> = T extends Promise<infer U> ? U : T;
type WithResult<T> = T extends Promise<infer U> ? Promise<Result<U>> : Result<T>;

/**
 * Wraps a function to convert thrown exceptions into Result.Err values.
 *
 * Executes the provided function and returns Result.Ok on success or Result.Err
 * on thrown exceptions. Supports both synchronous and asynchronous functions.
 *
 * @template FN - Function type that returns T or Promise<T>
 * @template T - The return type of the function
 * @param fn - Function to execute with exception handling
 * @returns Result<T> for sync functions, Promise<Result<T>> for async functions
 *
 * @example
 * ```typescript
 * const result = exception2Result(() => {
 *   return JSON.parse('invalid json');
 * });
 * // result is Result.Err with parse error
 *
 * const asyncResult = await exception2Result(async () => {
 *   return await fetch('/api/data');
 * });
 * ```
 */
export function exception2Result<FN extends () => Promise<T> | T, T>(fn: FN): WithResult<ReturnType<FN>> {
  try {
    const res = fn();
    if (isPromise(res)) {
      return res.then((value) => Result.Ok(value)).catch((e) => Result.Err(e)) as WithResult<ReturnType<FN>>;
    }
    return Result.Ok(res) as WithResult<ReturnType<FN>>;
  } catch (e) {
    return Result.Err(e as Error) as WithResult<ReturnType<FN>>;
  }
}

/*

type FinalizedResult<T> = {
  result: T;
  scopeResult?: Result<void>;
  finally: () => Promise<void>;
}

type exection2ResultParam<T> = {
  init: () => Promise<T>;
  inScope?: (t: T) => Promise<void>;
  cleanup: (t: T) => Promise<void>;

}

async function expection2Result<T>({fn, inScope, cleanup}: exection2ResultParam<T>): Promise<Result<FinalizedResult<T>>> {
  try {
    const res = await fn();
    if (inScope) {
      try {
        await inScope?.(res)
      } catch (err) {
        return Result.Err(err as Error)
      }
      await cleanup(res)
      return Result.Ok({
        result: res,
        finally: async () => { }
      })
    }
    return Result.Ok({
      result: res ,
      finally: async () => {
        return cleanup(res)
      }
    })
  } catch (err) {
    return Result.Err(err as Error)
  }
}
*/

// await expection2Result({
//   init: openDB,
//   inScope: (res) => {
//     res.query()
//   },
//   cleanup: async (y) => {
//     await y.close()
//  }
// })
// async function openDB() {
//   try {
//     const opendb = await openDB()
//     return Result.Ok({
//       openDB,
//       finally: async () => {
//         await opendb.close()
//     }})
//   } catch (err) {
//     return Result.Err(err)
//   }
// }
// }
