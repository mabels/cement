import { LevelHandlerImpl, LoggerImpl } from "./logger_impl";
import { LogCollector } from "./test/log_collector";

import { Logger, Level, IsLogger, logValue } from "./logger";
import { TimeMode } from "./sys_abstraction";
import { WebSysAbstraction } from "./web/web_sys_abstraction";
import { TimeFactory } from "./base_sys_abstraction";
import { Result } from "./result";
import { runtimeFn } from "./runtime";

describe("TestLogger", () => {
  let logCollector: LogCollector;
  let logger: Logger;

  beforeEach(() => {
    logCollector = new LogCollector();
    logger = new LoggerImpl({
      out: logCollector,
      sys: WebSysAbstraction({ TimeMode: TimeMode.STEP }),
      levelHandler: new LevelHandlerImpl(),
    });
  });

  describe("Error()", () => {
    it("should set the level attribute to error", async () => {
      logger.Error().Msg("");
      await logger.Flush();
      expect(logCollector.Logs()).toEqual([{ level: "error" }]);
    });

    it("should set the error message", async () => {
      logger.Err(new Error("test")).Msg("");
      await logger.Flush();
      expect(logCollector.Logs()).toEqual([{ error: "test" }]);
    });

    it("should set the error from string", async () => {
      logger.Err("test").Msg("");
      await logger.Flush();
      expect(logCollector.Logs()).toEqual([{ error: "test" }]);
    });

    it("should set the error from bool", async () => {
      logger.Err(false).Msg("");
      await logger.Flush();
      expect(logCollector.Logs()).toEqual([{ error: "false" }]);
    });
  });

  describe("Info()", () => {
    it("should set the level attribute to info", async () => {
      logger.Info().Msg("");
      await logger.Flush();
      expect(logCollector.Logs()).toEqual([{ level: "info" }]);
    });
  });

  describe("Any()", () => {
    it("should set the Any attribute", async () => {
      logger.Any("key", "value").Msg("");
      await logger.Flush();
      expect(logCollector.Logs()).toEqual([{ key: "value" }]);
    });
  });

  describe("Dur()", () => {
    it("should set the Dur attribute", async () => {
      logger.Dur("key", 123).Msg("");
      await logger.Flush();
      expect(logCollector.Logs()).toEqual([{ key: "123ms" }]);
    });
  });
  describe("Uint64()", () => {
    it("should set the Uint64 / number attribute", async () => {
      logger.Uint64("Hey", 123).Msg("");
      await logger.Flush();
      expect(logCollector.Logs()).toEqual([{ Hey: 123 }]);
    });
  });
  describe("Str()", () => {
    it("should set the String attribute", async () => {
      logger.Str("key", "value").Msg("");
      await logger.Flush();
      expect(logCollector.Logs()).toEqual([{ key: "value" }]);
    });
  });

  describe("With()", () => {
    it("should return a new logger with the same attributes", async () => {
      const log = logger.With().Str("key", "value").Logger();
      const newLogger = log.With().Str("str", "str").Logger();
      logger.Msg("logger1");
      logger.Msg("logger2");
      newLogger.Msg("newLogger1");
      newLogger.Msg("newLogger2");

      log.Info().Msg("log1");
      log.Info().Msg("log2");
      await log.Flush();

      expect(logCollector.Logs()).toEqual([
        { msg: "logger1" },
        { msg: "logger2" },
        { key: "value", msg: "newLogger1", str: "str" },
        { key: "value", msg: "newLogger2", str: "str" },
        { level: "info", key: "value", msg: "log1" },
        { level: "info", key: "value", msg: "log2" },
      ]);
    });
  });

  describe("Timestamp()", () => {
    it("should set the Timestamp attribute", async () => {
      const WithConstant = logger.With().Str("key", "withconstant").Str("key1", "anotherone").Logger();
      const timelog = WithConstant.With().Timestamp().Str("key", "withconstant2").Logger();
      timelog.Msg("1");
      timelog.Msg("2");
      timelog.Timestamp().Msg("3");

      await timelog.Flush();
      const timer = TimeFactory(TimeMode.STEP);

      expect(logCollector.Logs()).toEqual([
        {
          key: "withconstant2",
          key1: "anotherone",
          ts: timer.Now().toISOString(),
          msg: "1",
        },
        {
          key: "withconstant2",
          key1: "anotherone",
          ts: timer.Now().toISOString(),
          msg: "2",
        },
        {
          key: "withconstant2",
          key1: "anotherone",
          ts: timer.Now().toISOString(),
          msg: "3",
        },
      ]);
    });

    it("should NOT set the Timestamp attribute", async () => {
      const timelog = logger.With().Logger();
      timelog.Msg("1");
      timelog.Msg("2");
      timelog.Timestamp().Msg("3");

      await timelog.Flush();
      const timer = TimeFactory(TimeMode.STEP);

      expect(logCollector.Logs()).toEqual([
        { msg: "1" },
        { msg: "2" },
        {
          ts: timer.Now().toISOString(),
          msg: "3",
        },
      ]);
    });
  });

  it("remove empty msg", async () => {
    const log = logger;
    log.Warn().Msg();
    await log.Flush();
    expect(logCollector.Logs()).toEqual([{ level: "warn" }]);
  });

  it("check log level", async () => {
    const log = logger.With().Module("test").Logger().With().Logger();
    log.Warn().Msg("Warn");
    log.Info().Msg("Info");
    log.Error().Msg("Error");
    log.Log().Msg("Log");
    log.WithLevel(Level.ERROR).Msg("WithLevel");
    log.Debug().Str("should", "reset").Msg("Debug");
    log.Info().Str("what", "the").Msg("Simple");
    await log.Flush();
    const expected = [
      { msg: "Warn", level: "warn", module: "test" },
      { msg: "Info", level: "info", module: "test" },
      { msg: "Error", level: "error", module: "test" },
      { msg: "Log", module: "test" },
      { msg: "WithLevel", level: "error", module: "test" },
      { level: "info", module: "test", msg: "Simple", what: "the" },
    ];
    expect(logCollector.Logs()).toEqual(expected);
    logCollector.Logs().splice(0, logCollector.Logs().length);
    logger.With().Logger().SetDebug("test");
    log.Debug().Msg("Debug1");
    await log.Flush();
    expect(logCollector.Logs()).toEqual([...expected, { msg: "Debug1", level: "debug", module: "test" }]);
  });

  it("should flush all logs", async () => {
    const log = new LoggerImpl();
    log.Info().Msg("1");
    log.Info().Msg("2");
    await log.Flush();
    log.Info().Msg("DONE");
    return log.Flush();
  });

  it("carry debug", async () => {
    const log = logger;
    log.Module("xxx").SetDebug("yyy", ["i   ,   xxx"]);

    log.Debug().Msg("Debug1");
    const next1 = log.With().Str("next1", "meno").Logger();
    next1.Debug().Msg("Next1");
    const next2 = next1.With().Str("next2", "meno").Logger();
    next2.Debug().Msg("Next2");

    next2.Module("zzz");
    next2.Debug().Msg("Next3");

    log.Debug().Msg("Top");
    next1.Debug().Msg("Next1");

    await log.Flush();

    expect(logCollector.Logs()).toEqual([
      {
        level: "debug",
        module: "xxx",
        msg: "Debug1",
      },
      {
        level: "debug",
        module: "xxx",
        msg: "Next1",
        next1: "meno",
      },
      {
        level: "debug",
        module: "xxx",
        msg: "Next2",
        next1: "meno",
        next2: "meno",
      },
      {
        level: "debug",
        module: "xxx",
        msg: "Top",
      },
      {
        level: "debug",
        module: "xxx",
        msg: "Next1",
        next1: "meno",
      },
    ]);
  });

  it("should return an Error on Msg", async () => {
    const log = logger;
    log.Module("xxx").SetDebug("xxx");
    log.Debug().Msg("Debug1");
    expect(JSON.parse(log.Debug().Msg("Debug2").AsError().message)).toEqual({
      level: "debug",
      module: "xxx",
      msg: "Debug2",
    });

    expect(JSON.parse(log.Info().Msg("Info2").AsError().message)).toEqual({
      level: "info",
      module: "xxx",
      msg: "Info2",
    });

    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "debug",
        module: "xxx",
        msg: "Debug1",
      },
      {
        level: "debug",
        module: "xxx",
        msg: "Debug2",
      },
      {
        level: "info",
        module: "xxx",
        msg: "Info2",
      },
    ]);
  });

  it("top should enable modules wildcard", async () => {
    const log = logger;

    const xxxModule = log.With().Module("xxx").Logger();

    log.Debug().Msg("log-Msg0");
    xxxModule.Debug().Msg("xxx-log-Msg0");
    log.EnableLevel(Level.DEBUG);

    log.Debug().Msg("log-Msg");
    xxxModule.Debug().Msg("xxx-log-Msg");

    const yyyModule = log.With().Module("yyy").Logger();
    yyyModule.Debug().Msg("yyy-log-Msg");

    log.DisableLevel(Level.DEBUG);
    yyyModule.Debug().Msg("yyy-log-Msg1");
    log.Debug().Msg("log-Msg1");
    xxxModule.Debug().Msg("xxx-log-Msg1");

    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "debug",
        msg: "log-Msg",
      },
      {
        level: "debug",
        module: "xxx",
        msg: "xxx-log-Msg",
      },
      {
        level: "debug",
        module: "yyy",
        msg: "yyy-log-Msg",
      },
    ]);
  });

  it("down should enable modules wildcard", async () => {
    const log = logger;

    const xxxModule = log.With().Module("xxx").Logger();

    log.Debug().Msg("log-Msg");
    xxxModule.Debug().Msg("xxx-log-Msg");
    xxxModule.EnableLevel(Level.DEBUG);

    log.Debug().Msg("log-Msg1");
    xxxModule.Debug().Msg("xxx-log-Msg1");

    const yyyModule = log.With().Module("yyy").Logger();
    yyyModule.Debug().Msg("yyy-log-Msg");

    yyyModule.DisableLevel(Level.DEBUG);

    log.Debug().Msg("log-Msg2");
    xxxModule.Debug().Msg("xxx-log-Msg2");
    yyyModule.Debug().Msg("yyy-log-Msg2");

    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "debug",
        msg: "log-Msg1",
      },
      {
        level: "debug",
        module: "xxx",
        msg: "xxx-log-Msg1",
      },
      {
        level: "debug",
        module: "yyy",
        msg: "yyy-log-Msg",
      },
    ]);
  });

  it("global set debug on modules", async () => {
    const log = logger;

    const xxxModule = log.With().Module("xxx").Logger();

    log.Debug().Msg("log-Msg");
    xxxModule.Debug().Msg("xxx-log-Msg");
    await log.Flush();
    expect(logCollector.Logs()).toEqual([]);

    xxxModule.EnableLevel(Level.DEBUG, "yyy", "xxx");

    const yyyModule = log.With().Module("yyy").Logger();
    yyyModule.Debug().Msg("yyy-log-Msg");

    xxxModule.Debug().Msg("xxx-log-Msg1");

    log.Debug().Msg("log-Msg1");

    yyyModule.DisableLevel(Level.DEBUG, "yyy");
    yyyModule.Debug().Msg("yyy-log-Msg1");

    xxxModule.Debug().Msg("xxx-log-Msg2");

    log.Debug().Msg("log-Msg3");

    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "debug",
        module: "yyy",
        msg: "yyy-log-Msg",
      },
      {
        level: "debug",
        module: "xxx",
        msg: "xxx-log-Msg1",
      },
      {
        level: "debug",
        module: "xxx",
        msg: "xxx-log-Msg2",
      },
    ]);
  });

  it("global Check", () => {
    const g1 = new LoggerImpl().EnableLevel(Level.DEBUG) as LoggerImpl;
    const g2 = new LoggerImpl();
    const g3 = g2.With().Module("X").Logger() as LoggerImpl;
    expect(g1._levelHandler).toBe(g2._levelHandler);
    expect(g1._levelHandler).toBe(g3._levelHandler);
    expect((g1._levelHandler as LevelHandlerImpl)._globalLevels.has(Level.DEBUG)).toBeTruthy();
    expect((g2._levelHandler as LevelHandlerImpl)._globalLevels.has(Level.DEBUG)).toBeTruthy();
    expect((g3._levelHandler as LevelHandlerImpl)._globalLevels.has(Level.DEBUG)).toBeTruthy();
  });

  it("isLogger", () => {
    const log = new LoggerImpl();
    expect(IsLogger(log)).toBeTruthy();
    expect(
      IsLogger({
        Info: () => log.Info(),
        Flush: () => log.Flush(),
        With: () => log.With(),
      }),
    ).toBeFalsy();
  });

  it("bool", async () => {
    const log = logger;
    log.Info().Bool("true", true).Msg("1");
    log.Info().Bool("false", false).Msg("2");
    log.Info().Bool("true", "wurst").Msg("3");
    log.Info().Bool("false", null).Msg("4");
    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "info",
        msg: "1",
        true: true,
      },
      {
        false: false,
        level: "info",
        msg: "2",
      },
      {
        level: "info",
        msg: "3",
        true: true,
      },
      {
        false: false,
        level: "info",
        msg: "4",
      },
    ]);
  });

  it("int", async () => {
    const log = logger;
    log.Info().Int("1", 1).Msg("1");
    log.Info().Int("2", 2).Msg("2");
    log.Info().Int("3", 3).Msg("3");
    log.Info().Int("4", 4).Msg("4");
    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        "1": 1,
        level: "info",
        msg: "1",
      },
      {
        "2": 2,
        level: "info",
        msg: "2",
      },
      {
        "3": 3,
        level: "info",
        msg: "3",
      },
      {
        "4": 4,
        level: "info",
        msg: "4",
      },
    ]);
  });

  it("int", async () => {
    const log = logger;
    log.Info().Int("1", 1).Msg("1");
    log.Info().Int("2", 2).Msg("2");
    log.Info().Int("3", 3).Msg("3");
    log.Info().Int("4", 4).Msg("4");
    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        "1": 1,
        level: "info",
        msg: "1",
      },
      {
        "2": 2,
        level: "info",
        msg: "2",
      },
      {
        "3": 3,
        level: "info",
        msg: "3",
      },
      {
        "4": 4,
        level: "info",
        msg: "4",
      },
    ]);
  });

  it("ref", async () => {
    const log = logger;
    let value = 4711;
    const fn = () => "" + value++;
    log.Info().Ref("1", { toString: fn }).Msg("1");
    log.Info().Ref("2", { toString: fn }).Msg("2");
    log.Info().Ref("3", fn).Msg("3");
    log.Info().Ref("4", fn).Msg("4");
    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        "1": "4711",
        level: "info",
        msg: "1",
      },
      {
        "2": "4712",
        level: "info",
        msg: "2",
      },
      {
        "3": "4713",
        level: "info",
        msg: "3",
      },
      {
        "4": "4714",
        level: "info",
        msg: "4",
      },
    ]);
  });
  it("result", async () => {
    const log = logger;
    log.Info().Result("res.ok", Result.Ok(4711)).Msg("1");
    log.Info().Result("res.err", Result.Err("Error")).Msg("2");
    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "info",
        msg: "1",
        "res.ok": 4711,
      },
      {
        error: "Error",
        level: "info",
        msg: "2",
      },
    ]);
  });
  it("url", async () => {
    const log = logger;
    const url = new URL("http://localhost:8080");
    log.Info().Url(url).Msg("1");
    url.searchParams.set("test", "1");
    log.Info().Url(url).Msg("2");
    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "info",
        msg: "1",
        url: "http://localhost:8080/",
      },
      {
        level: "info",
        msg: "2",
        url: "http://localhost:8080/?test=1",
      },
    ]);
  });

  it("str", async () => {
    const log = logger;
    log.Error().Str("1", undefined).Msg("1");
    await log.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        "1": "--Falsy--",
        level: "error",
        msg: "1",
      },
    ]);
  });

  it("len", async () => {
    const log = logger;
    for (const key of [undefined, "key"]) {
      log.Info().Len(undefined, key).Msg("undefined");
      log.Info().Len(null, key).Msg("null");
      log
        .Info()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .Len(true as any, key)
        .Msg("bool");
      log
        .Info()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .Len(1 as any, key)
        .Msg("number");

      log.Info().Len("string", key).Msg("string");
      log
        .Info()
        .Len(new Uint8Array([1, 2]), key)
        .Msg("uint8array");
      log
        .Info()
        .Len(Array.from([1, 2]), key)
        .Msg("Array");
      log.Info().Len({ a: 1 }, key).Msg("object");
    }
    await log.Flush();
    expect(logCollector.Logs()).toEqual(
      Array.from(["len", "key"])
        .map((key) => [
          {
            [key]: -1,
            level: "info",
            msg: "undefined",
          },
          {
            [key]: -1,
            level: "info",
            msg: "null",
          },
          {
            [key]: -1,
            level: "info",
            msg: "bool",
          },
          {
            [key]: -1,
            level: "info",
            msg: "number",
          },
          {
            [key]: 6,
            level: "info",
            msg: "string",
          },
          {
            [key]: 2,
            level: "info",
            msg: "uint8array",
          },
          {
            [key]: 2,
            level: "info",
            msg: "Array",
          },
          {
            [key]: 1,
            level: "info",
            msg: "object",
          },
        ])
        .flat(),
    );
  });

  it("wildcard debug", async () => {
    const m1 = logger.With().Module("m1").Logger();
    const m2 = logger.With().Module("m2").Logger();

    m1.Debug().Msg("m1");
    m2.Debug().Msg("m2");

    logger.SetDebug("*");
    m1.Debug().Msg("m3");
    m2.Debug().Msg("m4");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "debug",
        module: "m1",
        msg: "m3",
      },
      {
        level: "debug",
        module: "m2",
        msg: "m4",
      },
    ]);
  });
  it("setDebug could receive anything", () => {
    function c(u: unknown): string {
      return u as string;
    }
    logger.SetDebug(c(1), c(true), c(null), c(undefined), "", "test ", "test1, ,test2,,test3,,,more", [
      c(2),
      c(true),
      c(null),
      c(undefined),
      "",
      " testx",
      "test1x , , test2x,, test3x ,,,morex",
    ]);
    expect(Array.from(((logger as LoggerImpl)._levelHandler as LevelHandlerImpl)._modules.keys())).toEqual([
      "test",
      "test1",
      "test2",
      "test3",
      "more",
      "testx",
      "test1x",
      "test2x",
      "test3x",
      "morex",
    ]);
  });
  it("setDebug could receive anything", async () => {
    logger
      .Error()
      .Any("sock", {
        m: 1,
        nested: {
          m: 2,
          mfn: logValue(() => 23),
        },
        mfn: logValue(() => 19),
      })
      .Msg("1");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "error",
        msg: "1",
        sock: {
          m: 1,
          mfn: 19,
          nested: {
            m: 2,
            mfn: 23,
          },
        },
      },
    ]);
  });

  it("don't serialize json on string", async () => {
    logger
      .Error()
      .Err(new Error(JSON.stringify({ o: { h: 1 } })))
      .Str("sock", JSON.stringify({ a: { h: 1 } }))
      .Str("bla", '{a":1}')
      .Msg("1");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "error",
        error: { o: { h: 1 } },
        msg: "1",
        sock: { a: { h: 1 } },
        bla: '{a":1}',
      },
    ]);
  });

  it("see exposed Stack", async () => {
    const e = new Error("test");
    logger.Error().Err(e).Msg("1");
    logger.SetExposeStack(true);
    logger.Error().Err(e).Msg("2");
    logger.SetExposeStack(false);
    logger.Error().Err(e).Msg("3");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        error: "test",
        level: "error",
        msg: "1",
      },
      {
        error: "test",
        level: "error",
        msg: "2",
        stack: e.stack?.split("\n").map((s) => s.trim()),
      },
      {
        error: "test",
        level: "error",
        msg: "3",
      },
    ]);
  });

  it("which writer for which runtime", async () => {
    const logger = new LoggerImpl();
    if (runtimeFn().isNodeIsh) {
      expect(logger._logWriter._out instanceof WritableStream).toBeTruthy();
      logger.Info().Msg("Running in Node");
    }
    if (runtimeFn().isBrowser) {
      expect(logger._logWriter._out.constructor.name).toBe("ConsoleWriterStream");
      logger.Info().Msg("Running in Browser");
    }
  });

  it("self-ref", async () => {
    const nested: Record<string, unknown> = {
      m: 2,
      mfn: logValue(() => 23),
    };
    nested.flat = nested;
    nested.layer = {
      jo: 4,
      boom: nested,
    };
    logger
      .Error()
      .Any("sock", {
        m: 1,
        nested: nested,
        mfn: logValue(() => 19),
      })
      .Msg("1");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "error",
        msg: "1",
        sock: {
          m: 1,
          mfn: 19,
          nested: {
            m: 2,
            mfn: 23,
            flat: "...",
            layer: {
              jo: 4,
              boom: "...",
            },
          },
        },
      },
    ]);
  });
});
