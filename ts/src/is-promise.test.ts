import { it, expect } from "vitest";
import { isPromise, UnPromisify, runtimeFn } from "@adviser/cement";

it("unpromisify", () => {
  type T1 = UnPromisify<Promise<number>>;
  type T2 = UnPromisify<number>;
  type T3 = UnPromisify<Promise<string>>;
  type T4 = UnPromisify<string>;

  const a: T1 = 1;
  const b: T2 = 1;
  const c: T3 = "1";
  const d: T4 = "1";

  expect(a).toBe(1);
  expect(b).toBe(1);
  expect(c).toBe("1");
  expect(d).toBe("1");
});

// function myPromise(): void {
//     /* */
// }
// function newMyPromise(): void {
//   const x = new myPromise();
//   x.then = () => { /* */ };
//   x.catch() = () => { /* */ };
//     x.finally() = () => { /* */ };
//     return x;
// }

it("isPromise", () => {
  if (!runtimeFn().isCFWorker) {
    // eval is evil -> but i did not found a way to use new on a function in ts
    // i know that i could use a class but i wanted to use a function for this test
    expect(
      isPromise(
        eval(`
         function myPromise() {
            return { then: ()=> { /* */ }, catch: () => { /* */ }, finally: () => { /* */ } };
         }
         new myPromise();`),
      ),
    ).toBe(true);
  }
  expect(
    isPromise(
      new Promise(() => {
        /* */
      }),
    ),
  ).toBe(true);
  expect(
    isPromise({
      then: () => {
        /* */
      },
      catch: () => {
        /* */
      },
      finally: () => {
        /* */
      },
    }),
  ).toBe(true);
  expect(
    isPromise({
      then: () => {
        /* */
      },
      catch: () => {
        /* */
      },
    }),
  ).toBe(false);
  expect(
    isPromise({
      then: () => {
        /* */
      },
    }),
  ).toBe(false);
  expect(isPromise({})).toBe(false);
  expect(
    isPromise(() => {
      /**/
    }),
  ).toBe(false);
  expect(isPromise(7)).toBe(false);
  expect(isPromise(null)).toBe(false);
  expect(isPromise(undefined)).toBe(false);
});
