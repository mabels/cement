import { Result, WithoutResult } from "./result";
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
  is_ok() {
    return true;
  }
  is_err() {
    return false;
  }
  unwrap() {
    return 1;
  }
  unwrap_err() {
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

// this is a wish --- look into the declaration of Promise.resolve
// it("Result.OK with void", () => {
//   const result = Result.Ok();
// })
