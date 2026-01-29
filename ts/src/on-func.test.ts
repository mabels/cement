import { OnFunc, OnFuncReturn, sleep, Future } from "@adviser/cement";
import { vi, it, expect } from "vitest";

// Base message interface
export interface FPCCMsgBase {
  readonly tid: string;
  readonly type: string;
  readonly src: string;
  readonly dst: string;
}

// FPCCEvtNeedsLogin interface
export interface FPCCEvtNeedsLogin extends FPCCMsgBase {
  readonly type: "FPCCEvtNeedsLogin";
  readonly devId: string;
  readonly loginURL: string;
  readonly loginTID: string;
  readonly loadDbNames: readonly {
    readonly appId: string;
    readonly dbName: string;
    readonly tenantId?: string;
    readonly ledgerId?: string;
  }[];
  readonly reason: "BindCloud" | "ConsumeAIToken" | "FreeAITokenEnd";
}

// FPCCError interface
export interface FPCCError extends FPCCMsgBase {
  readonly type: "FPCCError";
  readonly message: string;
  readonly cause?: string;
  readonly stack?: string;
}

// Union type for all message types
export type FPCCMessage = FPCCEvtNeedsLogin | FPCCError;

interface OnMessageBase {
  onMessage(fn: (event: MessageEvent<unknown>) => unknown): () => void;
  onFPCCMessage(fn: (msg: FPCCMessage, srcEvent: MessageEvent<unknown>) => void): () => void;
  onFPCCEvtNeedsLogin(fn: (msg: FPCCEvtNeedsLogin, srcEvent: MessageEvent<unknown>) => void): () => void;
}

class OnFunctionTest implements OnMessageBase {
  readonly onFunAction = OnFunc<(a: number, b: string) => unknown>();
  readonly onVoidAction = OnFunc<() => void>();

  readonly onMessage = OnFunc<(event: MessageEvent<unknown>) => unknown>();
  readonly onFPCCMessage = OnFunc<(msg: FPCCMessage, srcEvent: MessageEvent<unknown>) => void>();
  readonly onFPCCEvtNeedsLogin = OnFunc<(msg: FPCCEvtNeedsLogin, srcEvent: MessageEvent<unknown>) => void>();
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
  test.onFunAction.invoke(3, "26");
  for (const fn of [...asyncFns, ...fns]) {
    expect(fn.mock.calls).toEqual([
      [1, "23"],
      [3, "26"],
    ]);
    fn.mock.calls.length = 0;
  }
  const start = performance.now();
  await test.onFunAction.invokeAsync(2, "34");
  const duration = performance.now() - start;
  expect(duration).toBeGreaterThanOrEqual(9);
  for (const fn of [...asyncFns, ...fns]) {
    expect(fn.mock.calls).toEqual([[2, "34"]]);
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

it("OnFunctionTest clear", () => {
  const test = new OnFunctionTest();
  const fn = vi.fn((_a: number, _b: string) => 10);
  test.onFunAction(fn);
  test.onFunAction.clear();
  test.onFunAction.invoke(1, "23");
  expect(fn.mock.calls).toEqual([]);
});

it("OnFunctionTest unregister from the callback", async () => {
  const test = new OnFunctionTest();
  const fn2 = vi.fn();
  let fn1Stop = 2;
  const fn1 = vi.fn(() => {
    return --fn1Stop === 0 ? OnFuncReturn.UNREGISTER : undefined;
  });
  let fn3Stop = 2;
  const waitForFn3 = new Future<void>();
  const fn3 = vi.fn(() => {
    if (--fn3Stop === 0) {
      waitForFn3.resolve();
      return OnFuncReturn.UNREGISTER;
    }
  });
  test.onFunAction(fn1);
  test.onFunAction(fn2);
  test.onFunAction(fn3);

  test.onFunAction.invoke(1, "13");
  test.onFunAction.invoke(2, "23");
  test.onFunAction.invoke(3, "33");
  test.onFunAction.invoke(4, "43");
  await waitForFn3.asPromise();
  expect(fn1.mock.calls).toEqual([
    [1, "13"],
    [2, "23"],
  ]);
  expect(fn2.mock.calls).toEqual([
    [1, "13"],
    [2, "23"],
    [3, "33"],
    [4, "43"],
  ]);
  expect(fn3.mock.calls).toEqual([
    [1, "13"],
    [2, "23"],
  ]);
});

it("OnFunctionTest exception", () => {
  const test = new OnFunctionTest();
  const fn1 = vi.fn(() => {
    throw new Error("fn1 error");
  });
  test.onFunAction(fn1);
  const fn2 = vi.fn();
  test.onFunAction(fn2);
  const fn3 = vi.fn(() => {
    return Promise.reject(new Error("fn3 error"));
  });
  test.onFunAction(fn3);
  const fn4 = vi.fn();
  test.onFunAction(fn4);

  test.onFunAction.invoke(1, "13");
  expect(fn1.mock.calls).toEqual([[1, "13"]]);
  expect(fn2.mock.calls).toEqual([[1, "13"]]);
  expect(fn3.mock.calls).toEqual([[1, "13"]]);
  expect(fn4.mock.calls).toEqual([[1, "13"]]);
});

it("OnFunctionTest once", () => {
  const test = new OnFunctionTest();
  const fn1 = vi.fn();
  test.onFunAction.once(fn1);
  const fn2 = vi.fn();
  test.onFunAction(fn2);

  test.onFunAction.invoke(1, "13");
  test.onFunAction.invoke(2, "23");
  expect(fn1.mock.calls).toEqual([[1, "13"]]);
  expect(fn2.mock.calls).toEqual([
    [1, "13"],
    [2, "23"],
  ]);
});

it("invoke on register to emit history of events", () => {
  const test = new OnFunctionTest();
  const onReg0 = vi.fn();
  const onReg1 = vi.fn();
  const unreg0 = test.onFunAction.onRegister(onReg0);

  const onFunAction1 = vi.fn();
  test.onFunAction(onFunAction1);

  const unreg1 = test.onFunAction.onRegister(onReg1);
  const onFunAction2 = vi.fn();
  test.onFunAction(onFunAction2);

  unreg0();
  unreg1();
  const onReg2 = vi.fn();
  test.onFunAction.onRegister(onReg2);

  const onFunAction3 = vi.fn();
  test.onFunAction(onFunAction3);

  expect(onReg0.mock.calls).toEqual([
    [onFunAction1, []],
    [onFunAction2, [onFunAction1]],
  ]);
  expect(onReg1.mock.calls).toEqual([[onFunAction2, [onFunAction1]]]);
  expect(onReg2.mock.calls).toEqual([[onFunAction3, [onFunAction1, onFunAction2]]]);
});

it("type of onRegister are correct", () => {
  const test = new OnFunctionTest();
  test.onFunAction.onRegister((fn, fns) => {
    fn(1, "23");
    fns.forEach((f) => f(2, "34"));
  });
  test.onFunAction.onRegister((fn, fns) => {
    fn(1, "23");
    fns.forEach((f) => f(2, "34"));
    return { x: 9 };
  });
  test.onFunAction.onRegister((fn, fns) => {
    fn(1, "23");
    fns.forEach((f) => f(2, "34"));
    return OnFuncReturn.UNREGISTER;
  });
  test.onFunAction.onRegister((fn, fns) => {
    fn(1, "23");
    fns.forEach((f) => f(2, "34"));
    return OnFuncReturn.ONCE;
  });
});
