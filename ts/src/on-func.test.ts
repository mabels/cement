import { OnFunc } from "./on-func.js";
import { sleep } from "./utils/promise-sleep.js";

class OnFunctionTest {
  readonly onFunAction = OnFunc<(a: number, b: string) => void>();
  readonly onVoidAction = OnFunc<() => void>();
}

it("OnFunctionTest", async () => {
  const test = new OnFunctionTest();
  expect(typeof test.onFunAction).toBe("function");
  test.onVoidAction.invoke();

  const unregs: (() => void)[] = [];
  const asyncFns = new Array(3).fill(0).map(() => vi.fn((_a: number, _b: string) => sleep(10)));
  for (const fn of asyncFns) {
    unregs.push(test.onFunAction(fn));
  }

  const fns = new Array(3).fill(0).map(() => vi.fn((_a: number, _b: string) => 10));
  for (const fn of fns) {
    unregs.push(test.onFunAction(fn));
  }

  test.onFunAction.invoke(1, "23");
  for (const fn of [...asyncFns, ...fns]) {
    expect(fn.mock.calls).toEqual([[[1, "23"]]]);
    fn.mock.calls.length = 0;
  }
  const start = Date.now();
  await test.onFunAction.invokeAsync(2, "34");
  const duration = Date.now() - start;
  expect(duration).toBeGreaterThanOrEqual(10);
  for (const fn of [...asyncFns, ...fns]) {
    expect(fn.mock.calls).toEqual([[[2, "34"]]]);
    fn.mock.calls.length = 0;
  }
  for (const unreg of unregs) {
    unreg();
  }

  test.onFunAction.invoke(3, "45");
  for (const fn of [...asyncFns, ...fns]) {
    expect(fn.mock.calls).toEqual([]);
  }
});
