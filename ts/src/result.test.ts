import { exception2Result, Result, WithoutResult } from "@adviser/cement";
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

// it("Result.OK with void", () => {
//   const result = Result.Ok();
//   expect(result.isOk()).toBe(true);
//   expect(result.is_ok()).toBe(true);
//   expect(result.isErr()).toBe(false);
//   expect(result.is_err()).toBe(false);
// }
