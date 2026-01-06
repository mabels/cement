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
  EventoSendProvider,
  SendStatItem,
  EventoSend,
  TriggerStats,
} from "./evento.js";
import { Result } from "./result.js";
import { Option } from "./option.js";
import { sleep } from "./promise-sleep.js";

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
  cnt?: number;
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

class TestSend implements EventoSendProvider<Request, ReqTestType, ResType> {
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
  const sendEvent = new EventoSend<Request, ReqTestType, ResType>(send);
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
            const { item } = rv.Ok() as SendStatItem<ResType>;
            const v = item.Ok();
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
            const { item: v } = rv.Ok() as SendStatItem<ResType>;
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
            const { item } = rv.Ok() as SendStatItem<ResType>;
            const v = item.Ok();
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
            const { item } = rv.Ok() as SendStatItem<ResType>;
            const v = item.Ok();
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 1 },
        encoder: reqRes,
        request,
        send: sendEvent,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 1, step: "wildcard-first" })),
    ]);
    expect(send.fn.mock.calls[5]).toEqual([
      "wildcard-first-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 1 },
        encoder: reqRes,
        request,
        send: sendEvent,
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 1 },
        encoder: reqRes,
        request,
        send: sendEvent,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 1, step: "wildcard-second" })),
    ]);

    expect(send.fn.mock.calls[8]).toEqual([
      "wildcard-second-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 1 },
        encoder: reqRes,
        request,
        send: sendEvent,
        validated: { validated: true, x: 1, step: "wildcard-second" },
      }),
      Result.Ok({
        encoderInfo: "test-encoder",
        req: {
          step: "wildcard-second",
          validated: true,
          x: 1,
        },
        response: "ok",
      }),
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 1, stop: true },
        encoder: reqRes,
        request,
        send: sendEvent,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 1, stop: true, step: "wildcard-first" })),
    ]);
    expect(send.fn.mock.calls[5]).toEqual([
      "wildcard-first-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 1, stop: true },
        encoder: reqRes,
        request,
        send: sendEvent,
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 2 },
        encoder: reqRes,
        request,
        send: sendEvent,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 2, step: "regular-first" })),
    ]);
    expect(send.fn.mock.calls[3]).toEqual([
      "regular-first-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 2 },
        encoder: reqRes,
        request,
        send: sendEvent,
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 2 },
        encoder: reqRes,
        request,
        send: sendEvent,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 2, step: "regular-second" })),
    ]);

    expect(send.fn.mock.calls[6]).toEqual([
      "regular-second-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 2 },
        encoder: reqRes,
        request,
        send: sendEvent,
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 2, stop: true },
        encoder: reqRes,
        request,
        send: sendEvent,
      }),
      Result.Ok(Option.Some<ReqTestType>({ validated: true, x: 2, stop: true, step: "regular-first" })),
    ]);
    expect(send.fn.mock.calls[3]).toEqual([
      "regular-first-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        enRequest: { x: 2, stop: true },
        encoder: reqRes,
        request,
        send: sendEvent,
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

  it("validate throw encode error trigger", async () => {
    class ErrorEncoder implements EventoEnDecoder<Request, string> {
      encode(_args: Request): Promise<Result<unknown>> {
        throw new Error("test encode error");
      }
      decode(data: unknown): Promise<Result<string>> {
        return Promise.resolve(Result.Ok(JSON.stringify(data)));
      }
    }
    const evo = new Evento(new ErrorEncoder());
    const send = new TestSend();
    const sendEvent = new EventoSend<Request, ReqTestType, ResType>(send);
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-0-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-1",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-1-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    evo.push({
      hash: "regular-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-0-handle", ctx);
        return Promise.reject(new Error("test error"));
      },
    });
    const request = new Request("http://example.com", { method: "GET" });
    await evo.trigger({
      send,
      request,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual(["error-handler-0-handle", "error-handler-1-handle"]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(send.fn.mock.calls[0][1].error.message).toContain("test encode error");

    expect(send.fn.mock.calls[0]).toEqual([
      "error-handler-0-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        encoder: reqRes,
        request,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        error: send.fn.mock.calls[0][1].error,
        send: sendEvent,
      }),
    ]);
  });

  it("validate result encode error trigger", async () => {
    class ErrorEncoder implements EventoEnDecoder<Request, string> {
      encode(_args: Request): Promise<Result<unknown>> {
        return Promise.resolve(Result.Err(new Error("test encode error")));
      }
      decode(data: unknown): Promise<Result<string>> {
        return Promise.resolve(Result.Ok(JSON.stringify(data)));
      }
    }
    const evo = new Evento(new ErrorEncoder());
    const send = new TestSend();
    const sendEvent = new EventoSend<Request, ReqTestType, ResType>(send);
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-0-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-1",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-1-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    evo.push({
      hash: "regular-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-0-handle", ctx);
        return Promise.reject(new Error("test error"));
      },
    });
    const request = new Request("http://example.com", { method: "GET" });
    await evo.trigger({
      send,
      request,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual(["error-handler-0-handle", "error-handler-1-handle"]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(send.fn.mock.calls[0][1].error.message).toContain("test encode error");

    expect(send.fn.mock.calls[0]).toEqual([
      "error-handler-0-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        encoder: reqRes,
        request,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        error: send.fn.mock.calls[0][1].error,
        send: sendEvent,
      }),
    ]);
  });

  it("validate throw error trigger", async () => {
    const evo = new Evento(reqRes);
    const send = new TestSend();
    const sendEvent = new EventoSend<Request, ReqTestType, ResType>(send);
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-0-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-1",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-1-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    const error = new Error("test validate error");
    evo.push({
      hash: "regular-handler-0",
      validate: async (ctx: ValidateTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<Option<ReqTestType>>> => {
        send.fn("regular-handler-0-validate", ctx);
        return Promise.reject(error);
      },
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-0-handle", ctx);
        return Promise.reject(new Error("test error"));
      },
    });
    const request = new Request("http://example.com", { method: "POST", body: JSON.stringify({ x: 2, stop: true }) });
    await evo.trigger({
      send,
      request,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual([
      "regular-handler-0-validate",
      "error-handler-0-handle",
      "error-handler-1-handle",
    ]);

    expect(send.fn.mock.calls[1]).toEqual([
      "error-handler-0-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        encoder: reqRes,
        enRequest: { x: 2, stop: true },
        request,
        error,
        send: sendEvent,
      }),
    ]);
  });

  it("validate result error trigger", async () => {
    const evo = new Evento(reqRes);
    const send = new TestSend();
    const sendEvent = new EventoSend<Request, ReqTestType, ResType>(send);
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-0-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-1",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-1-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    const error = new Error("test validate error");
    evo.push({
      hash: "regular-handler-0",
      validate: async (ctx: ValidateTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<Option<ReqTestType>>> => {
        send.fn("regular-handler-0-validate", ctx);
        return Promise.resolve(Result.Err(error));
      },
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-0-handle", ctx);
        return Promise.reject(new Error("test error"));
      },
    });
    const request = new Request("http://example.com", { method: "POST", body: JSON.stringify({ x: 2, stop: true }) });
    await evo.trigger({
      send,
      request,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual([
      "regular-handler-0-validate",
      "error-handler-0-handle",
      "error-handler-1-handle",
    ]);

    expect(send.fn.mock.calls[1]).toEqual([
      "error-handler-0-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        encoder: reqRes,
        enRequest: { x: 2, stop: true },
        request,
        error,
        send: sendEvent,
      }),
    ]);
  });

  it("handle throw error trigger", async () => {
    const evo = new Evento(reqRes);
    const send = new TestSend();
    const sendEvent = new EventoSend<Request, ReqTestType, ResType>(send);
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-0-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-1",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-1-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    const error = new Error("test handle error");
    evo.push({
      hash: "regular-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-0-handle", ctx);
        return Promise.reject(error);
      },
    });
    const request = new Request("http://example.com", { method: "POST", body: JSON.stringify({ x: 2, stop: true }) });
    await evo.trigger({
      send,
      request,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual([
      "start",
      "regular-handler-0-handle",
      "error-handler-0-handle",
      "error-handler-1-handle",
      "done",
    ]);

    expect(send.fn.mock.calls[2]).toEqual([
      "error-handler-0-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        encoder: reqRes,
        enRequest: { x: 2, stop: true },
        request,
        error,
        send: sendEvent,
        validated: {
          stop: true,
          x: 2,
        },
      }),
    ]);
  });

  it("handle result error trigger", async () => {
    const evo = new Evento(reqRes);
    const send = new TestSend();
    const sendEvent = new EventoSend<Request, ReqTestType, ResType>(send);
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-0-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    evo.push({
      type: EventoType.Error,
      hash: "error-handler-1",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("error-handler-1-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    const error = new Error("test handle error");
    evo.push({
      hash: "regular-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-0-handle", ctx);
        return Promise.resolve(Result.Err(error));
      },
      post: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<void> => {
        send.fn("regular-handler-0-post", ctx);
        return Promise.resolve();
      },
    });
    const request = new Request("http://example.com", { method: "POST", body: JSON.stringify({ x: 2, stop: true }) });
    await evo.trigger({
      send,
      request,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual([
      "start",
      "regular-handler-0-handle",
      "regular-handler-0-post",
      "error-handler-0-handle",
      "error-handler-1-handle",
      "done",
    ]);

    expect(send.fn.mock.calls[3]).toEqual([
      "error-handler-0-handle",
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ctx: expect.anything(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stats: expect.anything(),
        encoder: reqRes,
        enRequest: { x: 2, stop: true },
        request,
        error,
        send: sendEvent,
        validated: {
          stop: true,
          x: 2,
        },
      }),
    ]);
  });

  it("call post", async () => {
    const evo = new Evento(reqRes);
    const send = new TestSend();
    evo.push({
      hash: "regular-handler-0",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-0-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
      post: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<void> => {
        send.fn("regular-handler-0-post", ctx);
        return Promise.reject(new Error("test post-0 error"));
      },
    });
    evo.push({
      hash: "regular-handler-1",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-1-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    evo.push({
      hash: "regular-handler-2",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-2-handle", ctx);
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
      post: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<void> => {
        send.fn("regular-handler-2-post", ctx);
        return Promise.resolve();
      },
    });

    const request = new Request("http://example.com", { method: "POST", body: JSON.stringify({ x: 2, stop: true }) });
    await evo.trigger({
      send,
      request,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual([
      "start",
      "regular-handler-0-handle",
      "regular-handler-1-handle",
      "regular-handler-2-handle",
      "regular-handler-0-post",
      "regular-handler-2-post",
      "done",
    ]);
  });

  it("check stat", async () => {
    const evo = new Evento(reqRes);
    const send = new TestSend();
    evo.push({
      hash: "regular-handler-0",
      validate: async (ctx: ValidateTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<Option<ReqTestType>>> => {
        send.fn("regular-handler-0-validate", ctx);
        return sleep(10).then(() => Result.Ok(Option.Some<ReqTestType>({ x: 2, stop: true } as ReqTestType)));
      },
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-0-handle", ctx);
        for (let i = 0; i < 3; i++) {
          await ctx.send.send(ctx, {
            response: "ok0",
            req: ctx.validated,
            cnt: i,
          } satisfies ResType);
        }
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
      post: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<void> => {
        send.fn("regular-handler-0-post", ctx);
        return sleep(10).then(() => {
          return;
        });
      },
    });
    evo.push({
      hash: "regular-handler-1",
      handle: async (ctx: HandleTriggerCtx<Request, ReqTestType, ResType>): Promise<Result<EventoResultType>> => {
        send.fn("regular-handler-1-handle", ctx);
        for (let i = 0; i < 3; i++) {
          await ctx.send.send(ctx, {
            response: "ok1",
            req: ctx.validated,
            cnt: i,
          } satisfies ResType);
        }
        return Promise.resolve(Result.Ok(EventoResult.Continue));
      },
    });
    const request = new Request("http://example.com", { method: "POST", body: JSON.stringify({ x: 2, stop: true }) });
    await evo.trigger({
      send,
      request,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(send.fn.mock.calls.map((i) => i[0])).toEqual([
      "regular-handler-0-validate",
      "start",
      "regular-handler-0-handle",
      "send",
      "send",
      "send",
      "regular-handler-1-handle",
      "send",
      "send",
      "send",
      "regular-handler-0-post",
      "done",
    ]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const stats = send.fn.mock.calls[3][1].stats as TriggerStats;
    expect(stats.request.doneTime.getTime()).toBeGreaterThanOrEqual(stats.request.startTime.getTime());
    expect(stats.encode.doneTime.getTime()).toBeGreaterThanOrEqual(stats.encode.startTime.getTime());
    expect(stats.handlers.length).toBe(2);
    for (const hdl of stats.handlers) {
      expect(hdl.handled.doneTime.getTime()).toBeGreaterThanOrEqual(hdl.handled.startTime.getTime());
      expect(hdl.handler.hash).toMatch(/regular-handler/);
      expect(hdl.validated.doneTime.getTime()).toBeGreaterThanOrEqual(hdl.validated.startTime.getTime());
      expect(hdl.total.doneTime.getTime()).toBeGreaterThanOrEqual(hdl.total.startTime.getTime());
    }
    expect(stats.send.doneTime.getTime()).toBeGreaterThanOrEqual(stats.send.startTime.getTime());
    expect(stats.send.items.length).toBe(6);
    let sendCount = 0;
    for (const item of stats.send.items) {
      expect(item.doneTime.getTime()).toBeGreaterThanOrEqual(item.startTime.getTime());
      expect(item.item).toEqual(
        Result.Ok({
          cnt: sendCount++ % 3,
          encoderInfo: "test-encoder",
          req: {
            stop: true,
            x: 2,
          },
          response: `ok${sendCount > 3 ? 1 : 0}`,
        }),
      );
    }
  });
});
