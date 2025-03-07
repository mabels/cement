import { Time, TraceNode, MockLogger, BasicSysAbstractionFactory, TimeMode } from "@adviser/cement";

describe("trace", () => {
  let time: Time;
  let refTime: Time;
  let trace: TraceNode;
  const logger = MockLogger().logger.With().Module("trace").Str("value", "important").Logger();
  beforeEach(() => {
    time = BasicSysAbstractionFactory({ TimeMode: TimeMode.STEP }).Time();
    trace = TraceNode.root(time, logger);
    refTime = BasicSysAbstractionFactory({ TimeMode: TimeMode.STEP }).Time();
  });
  it("a simple trace", () => {
    expect(
      trace.span("test", (trace) => {
        const r1 = trace.span("test.1", () => {
          return 1;
        });
        const r2 = trace.span("test.2", () => {
          return 1;
        });
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
            start: refTime.Now().getTime(),
            result: "success",
            end: refTime.Now(5).getTime(),
          },
        ],
      },
    ]);
    const layered = Array.from(trace.childs.get("test")?.childs.values() || []);
    refTime = BasicSysAbstractionFactory({ TimeMode: TimeMode.STEP }).Time();
    expect(layered.map((v) => v.invokes())).toEqual([
      {
        ctx: {
          module: "trace",
          spanId: "test.1",
          value: "important",
        },
        invokations: [
          {
            start: refTime.Now(2).getTime(),
            result: "success",
            end: refTime.Now().getTime(),
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
            start: refTime.Now().getTime(),
            result: "success",
            end: refTime.Now(1).getTime(),
          },
        ],
      },
    ]);
  });

  it("a async simple trace", async () => {
    const log = trace.ctx.logger?.With().Str("value", "test").Logger();
    const ret = await trace.span(trace.ctxWith("test", log), async (trace) => {
      const r1 = trace.span(trace.ctxWith("test.1"), () => 1);
      const log2 = trace.ctx.logger?.With().Module("xxx").Str("r2", "test.2").Logger();
      const r2 = await trace.span(trace.ctxWith("test.2", log2), async () => {
        time.Now();
        await new Promise<void>((resolve) =>
          setTimeout(() => {
            time.Now();
            time.Now();
            resolve();
          }, 100),
        );
        return 1;
      });
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
            start: refTime.Now().getTime(),
            result: "success",
            end: refTime.Now(8).getTime(),
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
            result: "success",
            start: refTime.Now(-2).getTime(),
            end: refTime.Now().getTime(),
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
            start: refTime.Now().getTime(),
            end: refTime.Now(4).getTime(),
            result: "success",
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
          });
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
                  reject(new Error("test.2"));
                }
              }, 10),
            );
            return 1;
          });
        } catch (e) {
          if (i % 2) {
            assert(false, "should not happen");
          } else {
            expect((e as Error).message).toEqual("test.2");
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
            start: refTime.Now(1).getTime(),
            end: refTime.Now(22).getTime(),
            result: "success",
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
            start: refTime.Now(-2).getTime(),
            end: refTime.Now().getTime(),
            result: "success",
          },
          {
            start: refTime.Now(-9).getTime(),
            end: refTime.Now().getTime(),
            result: "error",
          },
          {
            start: refTime.Now(-16).getTime(),
            end: refTime.Now().getTime(),
            result: "success",
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
            start: refTime.Now(-4).getTime(),
            end: refTime.Now(4).getTime(),
            result: "error",
          },
          {
            start: refTime.Now(-11).getTime(),
            end: refTime.Now(4).getTime(),
            result: "success",
          },
          {
            start: refTime.Now(-18).getTime(),
            end: refTime.Now(4).getTime(),
            result: "error",
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
    time = BasicSysAbstractionFactory({ TimeMode: TimeMode.STEP }).Time();
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
  it("typed span promise or literal", async () => {
    expect(trace.span("test", () => "1")).toBe("1");
    expect(await trace.span("test", () => Promise.resolve(1))).toBe(1);
  });
});
