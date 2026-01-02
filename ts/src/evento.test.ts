import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EventoEnDecoder,
  Evento,
  EventoResultType,
  EventoResult,
  EventoOp,
  EventoType,
  ValidateTriggerCtx,
  HandleTriggerCtx,
  EventoSend,
} from "./evento.js";
import { Result } from "./result.js";
import { Option } from "./option.js";

interface ReqTestType {
  step: string;
  validated: boolean;
  x: number;
  stop?: boolean;
}

interface ResType {
  response: string;
  req: ReqTestType;
  encoderInfo?: string;
}

class ReqResEventoEnDecoder implements EventoEnDecoder<Request, string> {
  async encode(args: Request): Promise<Result<unknown>> {
    const body = (await args.json()) as unknown;
    return Result.Ok(body);
  }
  decode(data: unknown): Promise<Result<string>> {
    return Promise.resolve(Result.Ok(JSON.stringify(data)));
  }
}

class TestSend implements EventoSend<Request, ReqTestType, ResType> {
  readonly fn = vi.fn();

  async start(trigger: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<void>> {
    this.fn("start", trigger);
    return Promise.resolve(Result.Ok(undefined));
  }
  async send<IS, OS>(trigger: HandleTriggerCtx<Request, ReqTestType, ResType>, data: IS): Promise<Result<OS>> {
    const resData = data as unknown as ResType;
    resData.encoderInfo = "test-encoder";
    this.fn("send", trigger, resData);
    return Promise.resolve(Result.Ok(resData as unknown as OS));
  }
  async done(trigger: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<void>> {
    this.fn("done", trigger);
    return Promise.resolve(Result.Ok(undefined));
  }
}

describe("Evento", () => {
  it("register ops push", () => {
    const evo = new Evento(new ReqResEventoEnDecoder());
    let r1: (() => void)[] = [],
      r2: (() => void)[] = [];
    for (let i = 0; i < 5; i++) {
      r1 = evo.push({
        hash: "h1",
        handle: async (): Promise<Result<EventoResultType>> => {
          return Promise.resolve(Result.Ok(EventoResult.Continue));
        },
      });
      r2 = evo.push({
        hash: "h2",
        handle: async (): Promise<Result<EventoResultType>> => {
          return Promise.resolve(Result.Ok(EventoResult.Continue));
        },
      });
    }
    expect(evo.handlers().actions.map((h) => h.hash)).toEqual(["h1", "h2"]);
    expect(evo.handlers().wildcards.length).toBe(0);
    r1[0]();
    expect(evo.handlers().actions.map((h) => h.hash)).toEqual(["h2"]);
    expect(evo.handlers().wildcards.length).toBe(0);
    r1[0]();
    r2[0]();
    expect(evo.handlers().actions.length).toBe(0);
    expect(evo.handlers().wildcards.length).toBe(0);
  });

  it("register ops unshift", () => {
    const evo = new Evento(new ReqResEventoEnDecoder());
    for (let i = 0; i < 5; i++) {
      evo.unshift({
        hash: "h2",
        handle: async (): Promise<Result<EventoResultType>> => {
          return Promise.resolve(Result.Ok(EventoResult.Continue));
        },
      });
      evo.unshift({
        hash: "h1",
        handle: async (): Promise<Result<EventoResultType>> => {
          return Promise.resolve(Result.Ok(EventoResult.Continue));
        },
      });
    }
    expect(evo.handlers().actions.map((h) => h.hash)).toEqual(["h1", "h2"]);
    expect(evo.handlers().wildcards.length).toBe(0);
  });

  it("register ops position", () => {
    const evo = new Evento(new ReqResEventoEnDecoder());
    for (let i = 0; i < 5; i++) {
      evo.register({
        op: EventoOp.Position,
        type: EventoType.Regular,
        idx: 1,
        handler: {
          hash: "h2",
          handle: async (): Promise<Result<EventoResultType>> => {
            return Promise.resolve(Result.Ok(EventoResult.Continue));
          },
        },
      });
      evo.register({
        op: EventoOp.Position,
        type: EventoType.Regular,
        idx: 0,
        handler: {
          hash: "h1",
          handle: async (): Promise<Result<EventoResultType>> => {
            return Promise.resolve(Result.Ok(EventoResult.Continue));
          },
        },
      });
    }
    expect(evo.handlers().actions.map((h) => h.hash)).toEqual(["h1", "h2"]);
    expect(evo.handlers().wildcards.length).toBe(0);
  });

  it("wildcard ops push", () => {
    const evo = new Evento(new ReqResEventoEnDecoder());
    let r1: (() => void)[] = [],
      r2: (() => void)[] = [];
    for (let i = 0; i < 5; i++) {
      r1 = evo.push({
        hash: "h1",
        type: EventoType.WildCard,
        handle: async (): Promise<Result<EventoResultType>> => {
          return Promise.resolve(Result.Ok(EventoResult.Continue));
        },
      });
      r2 = evo.push({
        hash: "h2",
        type: EventoType.WildCard,
        handle: async (): Promise<Result<EventoResultType>> => {
          return Promise.resolve(Result.Ok(EventoResult.Continue));
        },
      });
    }
    expect(evo.handlers().wildcards.map((h) => h.hash)).toEqual(["h1", "h2"]);
    expect(evo.handlers().actions.length).toBe(0);
    r1[0]();
    expect(evo.handlers().wildcards.map((h) => h.hash)).toEqual(["h2"]);
    expect(evo.handlers().actions.length).toBe(0);
    r1[0]();
    r2[0]();
    expect(evo.handlers().actions.length).toBe(0);
    expect(evo.handlers().wildcards.length).toBe(0);
  });

  //   export interface EventoHandler {
  //   readonly type?: EventoType; // default to regular
  //   readonly hash: string;
  //   handle<INREQ, REQ, RES>(trigger: ActiveTriggerCtx<INREQ, REQ, RES>): Promise<Result<EventoResultType>>;
  //   validate?<INREQ, REQ, RES>(trigger: ActiveTriggerCtx<INREQ, REQ, RES>): Result<Option<RES>>;
  // }

  const reqRes = new ReqResEventoEnDecoder();
  const evo = new Evento(reqRes);
  const send = new TestSend();
  evo.push(
    {
      type: EventoType.WildCard,
      hash: "wildcard-handler-first",
      validate: (ctx: ValidateTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<Option<ReqTestType>>> => {
        const ret = ((): Result<Option<ReqTestType>> => {
          const test = ctx.enRequest as ReqTestType;
          if (test.x === 1) {
            return Result.Ok(Option.Some<ReqTestType>({ ...test, validated: true, step: "wildcard-first" }));
          }
          return Result.Ok(Option.None<ReqTestType>());
        })();
        send.fn("wildcard-first-validate", ctx, ret);
        return Promise.resolve(ret);
      },
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        // expect(ctx.validated).toEqual({ x: 1 });
        const ret = ctx.send
          .send(ctx, {
            response: "ok",
            req: ctx.validated,
          } satisfies ResType)
          .then((rv) => {
            const v = rv.Ok() as ResType;
            let ret: Result<EventoResultType> = Result.Ok(EventoResult.Continue);
            if (v.req.stop) {
              ret = Result.Ok(EventoResult.Stop);
            }
            send.fn("wildcard-first-handle", ctx, v, ret);
            return ret;
          });
        return ret;
      },
    },
    {
      type: EventoType.WildCard,
      hash: "wildcard-second-handler",
      validate: (ctx: ValidateTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<Option<ReqTestType>>> => {
        const ret = ((): Result<Option<ReqTestType>> => {
          const test = ctx.enRequest as ReqTestType;
          if (test.x === 1) {
            return Result.Ok(Option.Some<ReqTestType>({ ...test, validated: true, step: "wildcard-second" }));
          }
          return Result.Ok(Option.None<ReqTestType>());
        })();
        send.fn("wildcard-second-validate", ctx, ret);
        return Promise.resolve(ret);
      },
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        // expect(ctx.validated).toEqual({ x: 1 });
        const ret = ctx.send
          .send(ctx, {
            response: "ok",
            req: ctx.validated,
          } satisfies ResType)
          .then((rv) => {
            const v = rv.Ok() as ResType;
            const ret = Result.Ok(EventoResult.Continue);
            send.fn("wildcard-second-handle", ctx, v, ret);
            return ret;
          });
        return ret;
      },
    },

    {
      hash: "regular-first-handler",
      validate: (ctx: ValidateTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<Option<ReqTestType>>> => {
        const ret = ((): Result<Option<ReqTestType>> => {
          const test = ctx.enRequest as ReqTestType;
          if (test.x === 2) {
            return Result.Ok(Option.Some<ReqTestType>({ ...test, validated: true, step: "regular-first" }));
          }
          return Result.Ok(Option.None<ReqTestType>());
        })();
        send.fn("regular-first-validate", ctx, ret);
        return Promise.resolve(ret);
      },
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        // expect(ctx.validated).toEqual({ x: 1 });
        const ret = ctx.send
          .send(ctx, {
            response: "ok",
            req: ctx.validated,
          } satisfies ResType)
          .then((rv) => {
            const v = rv.Ok() as ResType;
            let ret: Result<EventoResultType> = Result.Ok(EventoResult.Continue);
            if (v.req.stop) {
              ret = Result.Ok(EventoResult.Stop);
            }
            send.fn("regular-first-handle", ctx, v, ret);
            return ret;
          });
        return ret;
      },
    },

    {
      hash: "regular-second-handler",
      validate: (ctx: ValidateTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<Option<ReqTestType>>> => {
        const ret = ((): Result<Option<ReqTestType>> => {
          const test = ctx.enRequest as ReqTestType;
          if (test.x === 2) {
            return Result.Ok(Option.Some<ReqTestType>({ ...test, validated: true, step: "regular-second" }));
          }
          return Result.Ok(Option.None<ReqTestType>());
        })();
        send.fn("regular-second-validate", ctx, ret);
        return Promise.resolve(ret);
      },
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        // expect(ctx.validated).toEqual({ x: 1 });
        const ret = ctx.send
          .send(ctx, {
            response: "ok",
            req: ctx.validated,
          } satisfies ResType)
          .then((rv) => {
            const v = rv.Ok() as ResType;
            const ret = Result.Ok(EventoResult.Continue);
            send.fn("regular-second-handle", ctx, v, ret);
            return ret;
          });
        return ret;
      },
    },
  );

  beforeEach(() => {
    send.fn.mockClear();
  });

  it("continue:wildcard trigger", async () => {
    const request = new Request("http://example.com", { method: "POST", body: JSON.stringify({ x: 1 }) });
    await evo.trigger({
      send,
      request,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual([
      "regular-first-validate",
      "regular-second-validate",
      "wildcard-first-validate",
      "start",
      "send",
      "wildcard-first-handle",
      "wildcard-second-validate",
      "send",
      "wildcard-second-handle",
      "done",
    ]);

    expect(send.fn.mock.calls[2]).toEqual([
      "wildcard-first-validate",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 1 },
        encoder: reqRes,
        request,
        send,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 1, step: "wildcard-first" })),
    ]);
    expect(send.fn.mock.calls[5]).toEqual([
      "wildcard-first-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 1 },
        encoder: reqRes,
        request,
        send,
        validated: { validated: true, x: 1, step: "wildcard-first" },
      }),
      {
        encoderInfo: "test-encoder",
        req: {
          step: "wildcard-first",
          validated: true,
          x: 1,
        },
        response: "ok",
      },
      Result.Ok(EventoResult.Continue),
    ]);

    expect(send.fn.mock.calls[6]).toEqual([
      "wildcard-second-validate",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 1 },
        encoder: reqRes,
        request,
        send,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 1, step: "wildcard-second" })),
    ]);

    expect(send.fn.mock.calls[8]).toEqual([
      "wildcard-second-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 1 },
        encoder: reqRes,
        request,
        send,
        validated: { validated: true, x: 1, step: "wildcard-second" },
      }),
      {
        encoderInfo: "test-encoder",
        req: {
          step: "wildcard-second",
          validated: true,
          x: 1,
        },
        response: "ok",
      },
      Result.Ok(EventoResult.Continue),
    ]);
  });

  it("stop:wildcard trigger", async () => {
    const request = new Request("http://example.com", { method: "POST", body: JSON.stringify({ x: 1, stop: true }) });
    await evo.trigger({
      send,
      request,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual([
      "regular-first-validate",
      "regular-second-validate",
      "wildcard-first-validate",
      "start",
      "send",
      "wildcard-first-handle",
      "done",
    ]);

    expect(send.fn.mock.calls[2]).toEqual([
      "wildcard-first-validate",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 1, stop: true },
        encoder: reqRes,
        request,
        send,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 1, stop: true, step: "wildcard-first" })),
    ]);
    expect(send.fn.mock.calls[5]).toEqual([
      "wildcard-first-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 1, stop: true },
        encoder: reqRes,
        request,
        send,
        validated: { validated: true, x: 1, stop: true, step: "wildcard-first" },
      }),
      {
        encoderInfo: "test-encoder",
        req: {
          step: "wildcard-first",
          validated: true,
          stop: true,
          x: 1,
        },
        response: "ok",
      },
      Result.Ok(EventoResult.Stop),
    ]);
  });

  it("continue:regular trigger", async () => {
    const request = new Request("http://example.com", { method: "POST", body: JSON.stringify({ x: 2 }) });
    await evo.trigger({
      send,
      request,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual([
      "regular-first-validate",
      "start",
      "send",
      "regular-first-handle",
      "regular-second-validate",
      "send",
      "regular-second-handle",
      "done",
    ]);

    expect(send.fn.mock.calls[0]).toEqual([
      "regular-first-validate",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 2 },
        encoder: reqRes,
        request,
        send,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 2, step: "regular-first" })),
    ]);
    expect(send.fn.mock.calls[3]).toEqual([
      "regular-first-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 2 },
        encoder: reqRes,
        request,
        send,
        validated: { validated: true, x: 2, step: "regular-first" },
      }),
      {
        encoderInfo: "test-encoder",
        req: {
          step: "regular-first",
          validated: true,
          x: 2,
        },
        response: "ok",
      },
      Result.Ok(EventoResult.Continue),
    ]);

    expect(send.fn.mock.calls[4]).toEqual([
      "regular-second-validate",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 2 },
        encoder: reqRes,
        request,
        send,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 2, step: "regular-second" })),
    ]);

    expect(send.fn.mock.calls[6]).toEqual([
      "regular-second-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 2 },
        encoder: reqRes,
        request,
        send,
        validated: { validated: true, x: 2, step: "regular-second" },
      }),
      {
        encoderInfo: "test-encoder",
        req: {
          step: "regular-second",
          validated: true,
          x: 2,
        },
        response: "ok",
      },
      Result.Ok(EventoResult.Continue),
    ]);
  });

  it("stop:regular trigger", async () => {
    const request = new Request("http://example.com", { method: "POST", body: JSON.stringify({ x: 2, stop: true }) });
    await evo.trigger({
      send,
      request,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual([
      "regular-first-validate",
      "start",
      "send",
      "regular-first-handle",
      "done",
    ]);

    expect(send.fn.mock.calls[0]).toEqual([
      "regular-first-validate",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 2, stop: true },
        encoder: reqRes,
        request,
        send,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 2, stop: true, step: "regular-first" })),
    ]);
    expect(send.fn.mock.calls[3]).toEqual([
      "regular-first-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        enRequest: { x: 2, stop: true },
        encoder: reqRes,
        request,
        send,
        validated: { validated: true, x: 2, stop: true, step: "regular-first" },
      }),
      {
        encoderInfo: "test-encoder",
        req: {
          step: "regular-first",
          validated: true,
          stop: true,
          x: 2,
        },
        response: "ok",
      },
      Result.Ok(EventoResult.Stop),
    ]);
  });
});
