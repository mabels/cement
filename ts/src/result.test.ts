import { exception2Result, Result, WithoutResult, Option } from "@adviser/cement";
import { it, expect, expectTypeOf } from "vitest";
// import { it } from "vitest/globals";

it("ResultOk", () => {
  const result = Result.Ok(1);
  expect(result.isOk()).toBe(true);
  expect(result.is_ok()).toBe(true);
  expect(result.Ok()).toBe(1);
  expect(result.unwrap()).toBe(1);

  expect(result.isErr()).toBe(false);
  expect(result.is_err()).toBe(false);
  expect(() => result.Err()).toThrow();
  expect(() => result.unwrap_err()).toThrow();
});

it("ResultOk-void", () => {
  const result = Result.Ok();
  expect(result.isOk()).toBe(true);
  expect(result.Ok()).toBeFalsy();
});

it("ResultErr", () => {
  const result = Result.Err("xxx");
  expect(result.isOk()).toBe(false);
  expect(result.is_ok()).toBe(false);
  expect(result.Err().message).toEqual("xxx");
  expect(result.unwrap_err().message).toBe("xxx");

  expect(result.isErr()).toBe(true);
  expect(result.is_err()).toBe(true);
  expect(() => result.Ok()).toThrow();
  expect(() => result.unwrap()).toThrow();
});

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class xResult {}
class fakeResult {
  is_ok(): boolean {
    return true;
  }
  is_err(): boolean {
    return false;
  }
  unwrap(): number {
    return 1;
  }
  unwrap_err(): Error {
    throw new Error("Result is Ok");
  }
}
it("is Result", () => {
  expect(Result.Is(Result.Ok(1))).toBe(true);
  expect(Result.Is(Result.Err("xxx"))).toEqual(true);
  expect(Result.Is(new fakeResult())).toBe(true);
  expect(Result.Is(new xResult())).toBe(false);
});

it("WithoutResult", () => {
  const result = Result.Ok({ a: 1 });
  const a1: Partial<WithoutResult<typeof result>> = {};
  a1.a = 1;
  expect(a1.a).toEqual(1);
  expect(result.Ok().a).toEqual(1);
});

it("sync exception2Result ok", () => {
  expect(exception2Result(() => 1)).toEqual(Result.Ok(1));
});

it("sync exception2Result throw", () => {
  expect(
    exception2Result(() => {
      throw new Error("x");
    }),
  ).toEqual(Result.Err("x"));
});

it("async exception2Result ok", async () => {
  expect(await exception2Result(() => Promise.resolve(1))).toEqual(Result.Ok(1));
});

it("async exception2Result throw", async () => {
  expect(await exception2Result(() => Promise.reject(new Error("x")))).toEqual(Result.Err("x"));
});

it("avoid double wrap", () => {
  expect(exception2Result(() => Result.Ok(1))).toEqual(Result.Ok(1));
  expect(exception2Result(() => Result.Err("xxx"))).toEqual(Result.Err("xxx"));
});

it("async avoid double wrap", async () => {
  expect(await exception2Result(() => Promise.resolve(Result.Ok(1)))).toEqual(Result.Ok(1));
  expect(await exception2Result(() => Promise.resolve(Result.Err("xxx")))).toEqual(Result.Err("xxx"));
});

it("result typ", () => {
  function ok(): Result<number> {
    return Result.Ok(1);
  }
  function err(): Result<number> {
    return Result.Err("x");
  }
  expect(ok().Ok()).toBe(1);
  expect(err().Err().message).toBe("x");
});

it("Result.Err receive Result", () => {
  expect(Result.Err(Result.Ok(1)).Err().message).toBe("Result Error is Ok");
  const err = Result.Err("xxx");
  expect(Result.Err(err)).toBe(err);
  expect(Result.Err(err.Err())).toStrictEqual(err);
});

it("Result.OK with void", () => {
  const result = Result.Ok();
  expect(result.isOk()).toBe(true);
  expect(result.is_ok()).toBe(true);
  expect(result.isErr()).toBe(false);
  expect(result.is_err()).toBe(false);
});

it("Option.Some with void", () => {
  const result = Option.Some();
  expect(result.IsSome()).toBe(true);
  expect(result.IsNone()).toBe(false);
  expect(result.Unwrap()).toBeUndefined();
});

it("Option.From with void", () => {
  const result = Option.From();
  expect(result.IsNone()).toBe(true);
  expect(result.IsSome()).toBe(false);
});

it("Option.From with value", () => {
  const result = Option.None();
  expect(result.IsSome()).toBe(false);
  expect(result.IsNone()).toBe(true);
});

// Type-level tests for exception2Result to ensure no double wrapping
it("exception2Result type safety - sync function returning value", () => {
  const fn = (): number => 42;
  const result = exception2Result(fn);

  // Type check: result should be Result<number>, not Result<Result<number>>
  expect(result.isOk()).toBe(true);
  expect(result.unwrap()).toBe(42);

  // Verify the type at compile time
  type Expected = Result<number>;
  type Actual = typeof result;
  const typeCheck: Actual extends Expected ? true : false = true;
  expect(typeCheck).toBe(true);
});

it("exception2Result type safety - sync function returning Result", () => {
  const fn = (): Result<number> => Result.Ok(42);
  const result = exception2Result(fn);

  // Type check: result should be Result<number>, not Result<Result<number>>
  expect(result.isOk()).toBe(true);
  expect(result.unwrap()).toBe(42);

  // Should not be double-wrapped
  const unwrapped = result.unwrap();
  expect(typeof unwrapped).toBe("number");
  expect(Result.Is(unwrapped)).toBe(false);
});

it("exception2Result type safety - async function returning value", async () => {
  const fn = (): Promise<number> => Promise.resolve(42);
  const resultPromise = exception2Result(fn);

  // Type check: resultPromise should be Promise<Result<number>>, not Promise<Result<Result<number>>>
  const result = await resultPromise;
  expect(result.isOk()).toBe(true);
  expect(result.unwrap()).toBe(42);

  // Verify the type at compile time
  type Expected = Promise<Result<number>>;
  type Actual = typeof resultPromise;
  const typeCheck: Actual extends Expected ? true : false = true;
  expect(typeCheck).toBe(true);
});

it("exception2Result type safety - async function returning Result", async () => {
  const fn = (): Promise<Result<number>> => Promise.resolve(Result.Ok(42));
  const resultPromise = exception2Result(fn);

  // Type check: resultPromise should be Promise<Result<number>>, not Promise<Result<Result<number>>>
  const result = await resultPromise;
  expect(result.isOk()).toBe(true);
  expect(result.unwrap()).toBe(42);

  // Should not be double-wrapped
  const unwrapped = result.unwrap();
  expect(typeof unwrapped).toBe("number");
  expect(Result.Is(unwrapped)).toBe(false);
});

it("exception2Result type safety - complex return types", () => {
  interface User {
    id: number;
    name: string;
  }

  const fn = (): Result<User> => Result.Ok({ id: 1, name: "Alice" });
  const result = exception2Result(fn);

  // Should preserve the inner type without double wrapping
  expect(result.isOk()).toBe(true);
  const user = result.unwrap();
  expect(user.id).toBe(1);
  expect(user.name).toBe("Alice");
  expect(Result.Is(user)).toBe(false);
});

it("exception2Result type safety - error cases", () => {
  async function request<S, Q>(_req: Q): Promise<Result<S>> {
    return exception2Result(async () => {
      const response = await fetch("http://example.com/api");
      if (response.ok) {
        return {} as S;
      }
      throw new Error(`Request failed`);
    });
  }
  const resultPromise = request<{ x: string }, { y: string }>({ y: "test" });
  expectTypeOf(resultPromise).toEqualTypeOf<Promise<Result<{ x: string }>>>();
});
