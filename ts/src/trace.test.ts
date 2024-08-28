import { Time } from "./time";
import { WebSysAbstraction } from "./web";
import { TimeMode } from "./sys-abstraction";
import { TraceNode } from "./tracer";
import { MockLogger } from "./test/mock-logger";

describe("trace", () => {
  let time: Time;
  let trace: TraceNode;
  const logger = MockLogger().logger.With().Module("trace").Str("value", "important").Logger();
  beforeEach(() => {
    time = WebSysAbstraction({ TimeMode: TimeMode.STEP }).Time();
    trace = TraceNode.root(time, logger);
  });
  it("a simple trace", () => {
    expect(
      trace.span("test", (trace) => {
        const r1 = trace.span("test.1", () => {
          return 1;
        }) as number;
        const r2 = trace.span("test.2", () => {
          return 1;
        }) as number;
        return r1 + r2;
      }),
    ).toBe(2);
    const childs = Array.from(trace.childs.values());
    expect(childs.map((v) => v.invokes())).toEqual([
      {
        ctx: {
          module: "trace",
          spanId: "test",
          value: "important",
        },
        invokations: [
          {
            end: 1612134006000,
            result: "success",
            start: 1612134001000,
          },
        ],
      },
    ]);
    const layered = Array.from(trace.childs.get("test")?.childs.values() || []);
    expect(layered.map((v) => v.invokes())).toEqual([
      {
        ctx: {
          module: "trace",
          spanId: "test.1",
          value: "important",
        },
        invokations: [
          {
            end: 1612134003000,
            result: "success",
            start: 1612134002000,
          },
        ],
      },
      {
        ctx: {
          module: "trace",
          spanId: "test.2",
          value: "important",
        },
        invokations: [
          {
            end: 1612134005000,
            result: "success",
            start: 1612134004000,
          },
        ],
      },
    ]);
  });

  it("a async simple trace", async () => {
    const log = trace.ctx.logger?.With().Str("value", "test").Logger();
    const ret = await trace.span(trace.ctxWith("test", log), async (trace) => {
      const r1 = trace.span(trace.ctxWith("test.1"), () => 1) as number;
      const log2 = trace.ctx.logger?.With().Module("xxx").Str("r2", "test.2").Logger();
      const r2 = (await trace.span(trace.ctxWith("test.2", log2), async () => {
        time.Now();
        await new Promise<void>((resolve) =>
          setTimeout(() => {
            time.Now();
            time.Now();
            resolve();
          }, 100),
        );
        return 1;
      })) as number;
      return r1 + r2;
    });
    expect(ret).toBe(2);
    const childs = Array.from(trace.childs.values());
    const exp = childs.map((v) => v.invokes());
    expect(exp).toEqual([
      {
        ctx: {
          module: "trace",
          spanId: "test",
          value: "test",
        },
        invokations: [
          {
            end: 1612134009000,
            result: "success",
            start: 1612134001000,
          },
        ],
      },
    ]);
    const layered = Array.from(trace.childs.get("test")?.childs.values() || []);
    expect(layered.map((v) => v.invokes())).toEqual([
      {
        ctx: {
          module: "trace",
          spanId: "test.1",
          value: "test",
        },
        invokations: [
          {
            end: 1612134003000,
            result: "success",
            start: 1612134002000,
          },
        ],
      },
      {
        ctx: {
          module: "xxx",
          r2: "test.2",
          spanId: "test.2",
          value: "test",
        },
        invokations: [
          {
            end: 1612134008000,
            result: "success",
            start: 1612134004000,
          },
        ],
      },
    ]);
  });

  it("a async exception trace", async () => {
    const ret = await trace.span("test", async (trace) => {
      let r1 = 0;
      let r2 = 0;
      for (let i = 0; i < 3; i++) {
        try {
          r1 += trace.span("test.1", (trace) => {
            if (i % 2) {
              throw new Error("test.1");
            }
            trace.metrics.get("i.1").add([i]);
            return 1;
          }) as number;
        } catch (e) {
          if (i % 2) {
            expect((e as Error).message).toEqual("test.1");
          } else {
            assert(false, "should not happen");
          }
        }
        try {
          r2 += await trace.span("test.2", async (trace) => {
            time.Now();
            await new Promise<void>((resolve, reject) =>
              setTimeout(() => {
                time.Now();
                time.Now();
                if (i % 2) {
                  trace.metrics.get("i.2").add(i);
                  resolve();
                } else {
                  reject("test.2");
                }
              }, 10),
            );
            return 1;
          });
        } catch (e) {
          if (i % 2) {
            assert(false, "should not happen");
          } else {
            expect(e).toEqual("test.2");
          }
        }
      }
      return r1 + r2;
    });
    expect(ret).toBe(3);
    expect(trace.metrics.toJSON()).toEqual({
      "/test/test.1/i.1": [0, 2],
      "/test/test.2/i.2": 1,
    });
    const childs = Array.from(trace.childs.values());
    const exp = childs.map((v) => v.invokes());
    expect(exp).toEqual([
      {
        ctx: {
          module: "trace",
          spanId: "test",
          value: "important",
        },
        invokations: [
          {
            end: 1612134023000,
            result: "success",
            start: 1612134001000,
          },
        ],
      },
    ]);
    const layered = Array.from(trace.childs.get("test")?.childs.values() || []);
    expect(layered.map((v) => v.invokes())).toEqual([
      {
        ctx: {
          module: "trace",
          spanId: "test.1",
          value: "important",
        },
        invokations: [
          {
            end: 1612134003000,
            result: "success",
            start: 1612134002000,
          },
          {
            end: 1612134010000,
            result: "error",
            start: 1612134009000,
          },
          {
            end: 1612134017000,
            result: "success",
            start: 1612134016000,
          },
        ],
        metricRefs: {
          "/test/test.1/i.1": [0, 2],
        },
      },
      {
        ctx: {
          module: "trace",
          spanId: "test.2",
          value: "important",
        },
        invokations: [
          {
            end: 1612134008000,
            result: "error",
            start: 1612134004000,
          },
          {
            end: 1612134015000,
            result: "success",
            start: 1612134011000,
          },
          {
            end: 1612134022000,
            result: "error",
            start: 1612134018000,
          },
        ],
        metricRefs: {
          "/test/test.2/i.2": 1,
        },
      },
    ]);
  });
});

describe("metrics", () => {
  let time: Time;
  let trace: TraceNode;
  // const logger = MockLogger().logger.With().Module("trace").Str("value", "important").Logger()
  beforeEach(() => {
    time = WebSysAbstraction({ TimeMode: TimeMode.STEP }).Time();
    trace = TraceNode.root(time);
  });

  it("a simple metrics", () => {
    ["/test", "test", "/test/wurst", "bla"].forEach((path) => {
      const abs = path.startsWith("/") ? path : "/" + path;
      expect(trace.metrics.get(path).path).toBe(abs);
      expect(trace.metrics.get(path).value).toBeFalsy();
      trace.metrics.get(path).add(4711);
      expect(trace.metrics.get(path).value).toBe(4711);
      trace.metrics.get(path).set(undefined);
    });
  });
  it("create metrics path", () => {
    trace.span("test", (trace) => {
      trace.span("test.1", (trace) => {
        trace.metrics.get("m1.1").add(1);
        trace.metrics.get("/test/test.1/m1.1").add(1);
        expect(trace.metrics.get("m1.1").path).toBe("/test/test.1/m1.1");
        expect(trace.metrics.get("m1.1").value).toBe(2);
      });
    });
  });
});
