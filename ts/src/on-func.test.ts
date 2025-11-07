import { OnFunc } from "./on-func.js";
import { sleep } from "./promise-sleep.js";

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
  onMessage(fn: (event: MessageEvent<unknown>) => void): () => void;
  onFPCCMessage(fn: (msg: FPCCMessage, srcEvent: MessageEvent<unknown>) => void): () => void;
  onFPCCEvtNeedsLogin(fn: (msg: FPCCEvtNeedsLogin, srcEvent: MessageEvent<unknown>) => void): () => void;
}

class OnFunctionTest implements OnMessageBase {
  readonly onFunAction = OnFunc<(a: number, b: string) => void>();
  readonly onVoidAction = OnFunc<() => void>();

  readonly onMessage = OnFunc<(event: MessageEvent<unknown>) => void>();
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
