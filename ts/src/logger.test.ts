import {
  TimeFactory,
  IsLogger,
  Level,
  LevelHandlerImpl,
  LogCollector,
  Logger,
  LoggerImpl,
  logValue,
  Result,
  runtimeFn,
  TimeMode,
  BuildURI,
  URI,
  MutableURL,
  JSONFormatter,
  YAMLFormatter,
} from "@adviser/cement";
import { WebSysAbstraction } from "@adviser/cement/web";
import { stripper } from "./utils/stripper.js";

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
      expect(logCollector.Logs()).toEqual([{ error: false }]);
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
    expect(g1.levelHandler).toBe(g2.levelHandler);
    expect(g1.levelHandler).toBe(g3.levelHandler);
    expect((g1.levelHandler as LevelHandlerImpl)._globalLevels.has(Level.DEBUG)).toBeTruthy();
    expect((g2.levelHandler as LevelHandlerImpl)._globalLevels.has(Level.DEBUG)).toBeTruthy();
    expect((g3.levelHandler as LevelHandlerImpl)._globalLevels.has(Level.DEBUG)).toBeTruthy();
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
    const fn = (): string => "" + value++;
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
    const url = new MutableURL("http://localhost:8080");
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
  it("array setDebug could receive anything", () => {
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
    expect(Array.from(((logger as LoggerImpl).levelHandler as LevelHandlerImpl)._modules.keys())).toEqual([
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
  it("object setDebug could receive anything", async () => {
    logger
      .Error()
      .Any("sock", {
        m: 1,
        nested: {
          m: 2,
          mfn: logValue(() => 23, logger.levelHandler),
        },
        mfn: logValue(() => 19, logger.levelHandler),
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
    const logs = logCollector.Logs() as ({ stack?: string[] } & Record<string, unknown>)[];
    logs[1].stack = logs[1].stack?.map((s: string) => s.toLowerCase());
    expect(logs).toEqual([
      {
        error: "test",
        level: "error",
        msg: "1",
      },
      {
        error: "test",
        level: "error",
        msg: "2",
        stack: e.stack?.split("\n").map((s) => s.trim().toLowerCase()),
      },
      {
        error: "test",
        level: "error",
        msg: "3",
      },
    ]);
  });

  it("which writer for which runtime", () => {
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
      mfn: logValue(() => 23, logger.levelHandler),
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
        mfn: logValue(() => 19, logger.levelHandler),
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

  it("serialize json as string", () => {
    const suri = "file://./doof?test=1";
    const auri = JSON.stringify({ uri: suri });
    const buri = BuildURI.from(suri);
    const uri = URI.from(suri);
    expect(JSON.stringify({ uri: buri })).toEqual(auri);
    expect(JSON.stringify({ uri })).toEqual(auri);
  });

  it("emits attributes", () => {
    const log = logger
      .With()
      .Str("str", "a str")
      .Ref("bla", () => "blub")
      .Any("what", { a: 1 })
      .Logger();
    expect(log.Attributes()).toEqual({ str: "a str", what: { a: 1 }, bla: "blub" });

    const tlog = log.With().Timestamp().Logger();
    const refTime = WebSysAbstraction({ TimeMode: TimeMode.STEP }).Time();
    expect(tlog.Attributes()).toEqual({
      str: "a str",
      what: { a: 1 },
      bla: "blub",
      ts: refTime.Now().toISOString(),
    });
  });
  it("Url could receive URL", async () => {
    logger.Info().Url(new URL("http://localhost:8080")).Msg("1");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "info",
        msg: "1",
        url: "http://localhost:8080/",
      },
    ]);
  });

  it("Url could receive String", async () => {
    logger.Info().Url("http://localhost:8080").Msg("1");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "info",
        msg: "1",
        url: "http://localhost:8080/",
      },
    ]);
  });

  it("error could receive Result", async () => {
    logger.Info().Error().Err(Result.Err("xxxxx")).Msg("1");
    logger.Info().Error().Err(Result.Ok("yyyyy")).Msg("2");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        error: "xxxxx",
        level: "error",
        msg: "1",
      },
      {
        noerror: "yyyyy",
        level: "error",
        msg: "2",
      },
    ]);
  });

  it("introspect json", async () => {
    logger
      .Info()
      .Str("bla", JSON.stringify({ a: 4711 }))
      .Any("y", {
        a: JSON.stringify({ b: 4711, c: '{"d":4711}', e: ['{"f":4712}'] }),
      })
      .Msg(JSON.stringify(["x", 4712, { a: 4711 }, '{"d":4711}', '{"a":4711}']));
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        bla: { a: 4711 },
        level: "info",
        msg: [
          "x",
          4712,
          {
            a: 4711,
          },
          {
            d: 4711,
          },
          {
            a: 4711,
          },
        ],
        y: {
          a: {
            b: 4711,
            c: {
              d: 4711,
            },
            e: [
              {
                f: 4712,
              },
            ],
          },
        },
      },
    ]);
  });

  it("introspect uint8array", async () => {
    logger
      .Info()
      .Any("fhex", new Uint8Array(new Array(36).fill(1).map((_, i) => i)))
      .Any("hex", { a: new Uint8Array(new Array(36).fill(1).map((_, i) => i)) })
      .Msg("1");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        fhex: [
          "0000  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f ................",
          "0010  10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f ................",
          '0020  20 21 22 23                                      !"#',
        ],
        hex: {
          a: [
            "0000  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f ................",
            "0010  10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f ................",
            '0020  20 21 22 23                                      !"#',
          ],
        },
        level: "info",
        msg: "1",
      },
    ]);
  });

  it("my own json formatter", async () => {
    logger.SetExposeStack(true).SetFormatter(new JSONFormatter(logger.TxtEnDe(), 2));
    logger
      .Error()
      .Str("bla", "blub")
      // .Err(new Error("test"))
      .Str("xxx", '{"b": 4711}')
      .Str("lines", "a\nb\nc")
      .Any("flat", new Uint8Array(new Array(36).fill(1).map((_, i) => i)))
      .Any("hi", {
        ho: 1,
        su: "bla",
        js: '{"a":1}',
        bi: new Uint8Array(new Array(36).fill(1).map((_, i) => i)),
        ls: "a\nb\nc",
      })
      .Msg("hello");
    await logger.Flush();
    expect(logCollector.Logs(true)).toEqual([
      "{",
      '  "level": "error",',
      '  "bla": "blub",',
      //  "  \"error\": \"test\",",
      //  "  \"stack\": [",
      //  "    \"Error: test\",",
      // "   ],",
      '  "xxx": {',
      '    "b": 4711',
      "  },",
      '  "lines": [',
      '    "a",',
      '    "b",',
      '    "c"',
      "  ],",
      '  "flat": [',
      '    "0000  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f ................",',
      '    "0010  10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f ................",',
      '    "0020  20 21 22 23                                      !\\"#"',
      "  ],",
      '  "hi": {',
      '    "ho": 1,',
      '    "su": "bla",',
      '    "js": {',
      '      "a": 1',
      "    },",
      '    "bi": [',
      '      "0000  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f ................",',
      '      "0010  10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f ................",',
      '      "0020  20 21 22 23                                      !\\"#"',
      "    ],",

      '    "ls": [',
      '      "a",',
      '      "b",',
      '      "c"',
      "    ]",
      "  },",
      '  "msg": "hello"',
      "}",
    ]);
  });

  it("AsError", () => {
    const error = logger.Error().Msg("AsError").AsError();
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('{"level":"error","msg":"AsError"}\n');
  });

  it("ResultError", () => {
    const fn = (): Result<{ a: number }> => {
      return logger.Error().Msg("AsError").ResultError();
    };
    const res = fn();
    expect(Result.Is(res)).toBeTruthy();
    expect(res.isErr()).toBeTruthy();
    expect(res.Err().message).toBe('{"level":"error","msg":"AsError"}\n');
  });

  it("receive object", async () => {
    logger
      .Error()
      .Str({ blaStr: "blub", blaStr2: "blub2" })
      .Uint64({ blaUint64: 65, blaUint642: 66 })
      .Int({ blaInt: 65 })
      .Bool({ blaBool: true, blaBool2: false })
      .Any({ blaAny: { a: 1 }, blaAny2: { b: 2 } })
      .Msg("hello");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        blaAny: {
          a: 1,
        },
        blaAny2: {
          b: 2,
        },
        blaBool: true,
        blaBool2: false,
        blaInt: 65,
        blaStr: "blub",
        blaStr2: "blub2",
        blaUint64: 65,
        blaUint642: 66,
        level: "error",
        msg: "hello",
      },
    ]);
  });

  it("my own yaml formatter", async () => {
    const log = logger.SetExposeStack(true).SetFormatter(new YAMLFormatter(logger.TxtEnDe(), 2)).With().Logger();
    log
      .Error()
      .Str("bla", "blub")
      // .Err(new Error("test"))
      .Str("xxx", '{"b": 4711}')
      .Str("lines", "a\nb\nc")
      .Any("flat", new Uint8Array(new Array(36).fill(1).map((_, i) => i)))
      .Any("hi", {
        ho: 1,
        su: "bla",
        js: '{"a":1}',
        bi: new Uint8Array(new Array(36).fill(1).map((_, i) => i)),
        ls: "a\nb\nc",
      })
      .Msg("hello");
    await log.Flush();
    expect(logCollector.Logs(true)).toEqual([
      "---",
      "level: error",
      "bla: blub",
      "xxx:",
      "  b: 4711",
      "lines:",
      "  - a",
      "  - b",
      "  - c",
      "flat:",
      "  - 0000  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f ................",
      "  - 0010  10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f ................",
      '  - 0020  20 21 22 23                                      !"#',
      "hi:",
      "  ho: 1",
      "  su: bla",
      "  js:",
      "    a: 1",
      "  bi:",
      "    - 0000  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f ................",
      "    - 0010  10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f ................",
      '    - 0020  20 21 22 23                                      !"#',
      "  ls:",
      "    - a",
      "    - b",
      "    - c",
      "msg: hello",
    ]);
  });

  it("Pairing", async () => {
    logger
      .Error()
      .Pair({
        str: "blub",
        int: 4711,
        bool: true,
        resultOk: Result.Ok({ a: 1 }),
        resultErr: Result.Err("Error"),
        uint8: new Uint8Array([1, 2, 3]),
        obj: { a: 1 },
        arr: [1, 2, 3],
      })
      .Msg("1");
    await logger.Flush();
    expect(logCollector.Logs(true)).toEqual([
      JSON.stringify({
        level: "error",
        str: "blub",
        int: 4711,
        bool: true,
        resultOk: { a: 1 },
        error: "Error",
        uint8: "0000  01 02 03                                        ...",
        obj: { a: 1 },
        arr: [1, 2, 3],
        msg: "1",
      }),
    ]);
  });

  class TestResponse extends Response {
    readonly #url: string;
    constructor(body?: BodyInit, init?: ResponseInit & { url: string }) {
      super(body, init);
      this.#url = init?.url || "";
    }
    get url(): string {
      return this.#url;
    }
    // get body(): ReadableStream<Uint8Array> {

    // toJSON(): unknown {
    // return super.toJSON();
    // }
  }

  describe("fetch-formatter", () => {
    // const result = await fetch("https://www.google.com")
    const resp = new TestResponse("body", {
      status: 200,
      statusText: "OK",
      headers: new Headers({
        "Content-Type": "text/html",
        "X-Test": "test",
      }),
      url: "https://www.google.com",
    });
    const req = new Request("https://www.google.com", {
      method: "PUT",
      headers: new Headers({
        "Content-Type": "text/html",
        "X-Test": "xtest",
      }),
      // duplex: true,
      body: "String",
    });

    async function fixupLogs(): Promise<unknown> {
      await logger.Flush();
      // return logCollector.Logs()
      return stripper(
        [
          "isReloadNavigation",
          "reason",
          "targetAddressSpace",
          "attribute",
          "duplex",
          "cache",
          "type",
          "fetcher",
          "cf",
          "webSocket",
          "credentials",
          "destination",
          "integrity",
          "isHistoryNavigation",
          "keepalive",
          "mode",
          "redirect",
          "referrer",
          "referrerPolicy",
        ],
        logCollector.Logs() /*.map((i) => JSON.parse(i))*/,
      );
    }
    it("ok-the-res", async () => {
      logger.Error().Any("res", { the: resp }).Msg("ok-the-res");
      expect(await fixupLogs()).toEqual([
        {
          level: "error",
          res: {
            the: {
              redirected: false,
              status: 200,
              ok: true,
              statusText: "OK",
              headers: {
                "content-type": "text/html",
                "x-test": "test",
              },
              body: ">Stream<",
              bodyUsed: false,
            },
          },
          msg: "ok-the-res",
        },
      ]);
    });

    it("ok-the-req", async () => {
      logger.Error().Any("req", { the: req }).Msg("ok-the-req");
      expect(await fixupLogs()).toEqual([
        {
          level: "error",
          msg: "ok-the-req",
          req: {
            the: {
              body: ">Stream<",
              bodyUsed: false,
              headers: {
                "content-type": "text/html",
                "x-test": "xtest",
              },
              method: "PUT",
              signal: {
                aborted: false,
                onabort: "null",
              },
              url: "https://www.google.com/",
            },
          },
        },
      ]);
    });

    it("the-req-res", async () => {
      logger
        .Error()
        .Any("req-res", { the: { req, res: resp } })
        .Msg("ok-the-req-res");
      expect(await fixupLogs()).toEqual([
        {
          level: "error",
          msg: "ok-the-req-res",
          "req-res": {
            the: {
              req: {
                body: ">Stream<",
                bodyUsed: false,
                headers: {
                  "content-type": "text/html",
                  "x-test": "xtest",
                },
                method: "PUT",
                signal: {
                  aborted: false,
                  onabort: "null",
                },
                url: "https://www.google.com/",
              },
              res: {
                body: ">Stream<",
                bodyUsed: false,
                headers: {
                  "content-type": "text/html",
                  "x-test": "test",
                },
                ok: true,
                redirected: false,
                status: 200,
                statusText: "OK",
              },
            },
          },
        },
      ]);
    });

    it("result-req-res", async () => {
      logger.Error().Http(Result.Ok(resp)).Msg("-1");
      expect(await fixupLogs()).toEqual([
        {
          Http: {
            body: ">Stream<",
            bodyUsed: false,
            headers: {
              "content-type": "text/html",
              "x-test": "test",
            },
            ok: true,
            redirected: false,
            status: 200,
            statusText: "OK",
          },
          level: "error",
          msg: "-1",
        },
      ]);
    });
    it("0", async () => {
      logger.Error().Http().Msg("0");
      expect(await fixupLogs()).toEqual([
        {
          level: "error",
          msg: "0",
        },
      ]);
    });
    it("1", async () => {
      logger.Error().Http(resp, req, "Https").Msg("1");
      expect(await fixupLogs()).toEqual([
        {
          Https: {
            req: {
              body: ">Stream<",
              bodyUsed: false,
              headers: {
                "content-type": "text/html",
                "x-test": "xtest",
              },
              method: "PUT",
              signal: {
                aborted: false,
                onabort: "null",
              },
              url: "https://www.google.com/",
            },
            res: {
              body: ">Stream<",
              bodyUsed: false,
              headers: {
                "content-type": "text/html",
                "x-test": "test",
              },
              ok: true,
              redirected: false,
              status: 200,
              statusText: "OK",
            },
          },
          level: "error",
          msg: "1",
        },
      ]);
    });
    it("1.1", async () => {
      logger.Error().Http("Yolo", Result.Ok(req), Result.Ok(resp)).Msg("1.1");
      expect(await fixupLogs()).toEqual([
        {
          Yolo: {
            req: {
              body: ">Stream<",
              bodyUsed: false,
              headers: {
                "content-type": "text/html",
                "x-test": "xtest",
              },
              method: "PUT",
              signal: {
                aborted: false,
                onabort: "null",
              },
              url: "https://www.google.com/",
            },
            res: {
              body: ">Stream<",
              bodyUsed: false,
              headers: {
                "content-type": "text/html",
                "x-test": "test",
              },
              ok: true,
              redirected: false,
              status: 200,
              statusText: "OK",
            },
          },
          level: "error",
          msg: "1.1",
        },
      ]);
    });
    it("1.2", async () => {
      logger.Error().Http("Yerr", Result.Err<Response>("e1"), Result.Err<Request>("e2")).Msg("1.2");
      expect(await fixupLogs()).toEqual([
        {
          error: ["e1", "e2"],
          level: "error",
          msg: "1.2",
        },
      ]);
    });
    it("2", async () => {
      logger.Error().Http(req, "Https").Msg("2");
      expect(await fixupLogs()).toEqual([
        {
          Https: {
            body: ">Stream<",
            bodyUsed: false,
            headers: {
              "content-type": "text/html",
              "x-test": "xtest",
            },
            method: "PUT",
            signal: {
              aborted: false,
              onabort: "null",
            },
            url: "https://www.google.com/",
          },
          level: "error",
          msg: "2",
        },
      ]);
    });
    it("3", async () => {
      logger.Error().Any("HttpReq", req).Msg("3");
      expect(await fixupLogs()).toEqual([
        {
          HttpReq: {
            body: ">Stream<",
            bodyUsed: false,
            headers: {
              "content-type": "text/html",
              "x-test": "xtest",
            },
            method: "PUT",
            signal: {
              aborted: false,
              onabort: "null",
            },
            url: "https://www.google.com/",
          },
          level: "error",
          msg: "3",
        },
      ]);
    });
    it("4", async () => {
      logger.Error().Any("HttpRes", resp).Msg("4");
      expect(await fixupLogs()).toEqual([
        {
          HttpRes: {
            body: ">Stream<",
            bodyUsed: false,
            headers: {
              "content-type": "text/html",
              "x-test": "test",
            },
            ok: true,
            redirected: false,
            status: 200,
            statusText: "OK",
          },
          level: "error",
          msg: "4",
        },
      ]);
    });
    // tricky problem
    // it("if resp is !200 collect streams", async () => {
    //   const resp = new TestResponse(string2stream("the body"), {
    //     status: 407,
    //     statusText: "Not OK",
    //     headers: new Headers({
    //       "Content-Type": "text/html",
    //       "X-Test": "test",
    //     }),
    //     url: "https://www.google.com",
    //   });
    //   logger.Error().Any("HttpRes", resp).Msg("!200");
    //   expect(await fixupLogs()).toEqual([
    //     {
    //       HttpRes: {
    //         body: "the body",
    //         bodyUsed: false,
    //         headers: {
    //           "content-type": "text/html",
    //           "x-test": "test",
    //         },
    //         ok: false,
    //         redirected: false,
    //         status: 407,
    //         statusText: "Not OK",
    //         type: "default",
    //       },
    //       level: "error",
    //       msg: "!200",
    //     },
    //   ]);
    // });
  });

  it("use toJSON", async () => {
    logger
      .Error()
      .Any("res", { uri: URI.from("https://doof.de?x=4&a=b") })
      .Msg("ok");
    await logger.Flush();
    expect(logCollector.Logs(true)).toEqual(
      [
        {
          level: "error",
          res: {
            uri: "https://doof.de/?a=b&x=4",
          },
          msg: "ok",
        },
      ].map((i) => JSON.stringify(i)),
    );
  });

  class Test {
    constructor(
      public a: number,
      public b: URI,
    ) {}
    toJSON(): unknown {
      throw new Error("test");
    }
  }
  it("throw in toString", async () => {
    logger
      .Error()
      .Any("res", new Test(1, URI.from("https://doof.de")))
      .Msg("ok");
    await logger.Flush();
    expect(logCollector.Logs(true)).toEqual(
      [
        {
          level: "error",
          res: "LogValue:test",
          msg: "ok",
        },
      ].map((i) => JSON.stringify(i)),
    );
  });

  it("if uint8array is json do not hexdump", async () => {
    logger
      .Error()
      .Any("res", new TextEncoder().encode(JSON.stringify({ a: 1, b: { c: "x" } })))
      .Msg("ok");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "error",
        msg: "ok",
        res: {
          a: 1,
          b: {
            c: "x",
          },
        },
      },
    ]);
  });
  it("Result received ResolveError with Error is Object", async () => {
    const x = Result.Err({
      type: "error",
      tid: "z3AHk4H2a8",
      message: "Method not implemented.",
      version: "FP-MSG-1.0",
    } as unknown as Error);
    logger.Error().Result("res", x).Msg("1");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        error: {
          message: "Method not implemented.",
          tid: "z3AHk4H2a8",
          type: "error",
          version: "FP-MSG-1.0",
        },
        level: "error",
        msg: "1",
      },
    ]);
  });

  it("default ignore _attributes in any", async () => {
    logger
      .Error()
      .Any("res", {
        empty: {
          _bla: 5,
        },
        realEmpty: {},
        test: {
          empty: {
            _bla: 5,
          },
          realEmpty: {},
          _attributes: 1,
          jo: 42,
        },
        _bla: 5,
      })
      .Msg("1");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "error",
        msg: "1",
        res: {
          empty: {},
          realEmpty: {},
          test: {
            empty: {},
            realEmpty: {},
            jo: 42,
          },
        },
      },
    ]);
  });

  it("switch of ignore _attributes in any", async () => {
    logger.SetIgnoreAttribute();
    logger
      .Error()
      .Any("res", { test: { _attributes: 1, jo: 42 }, _bla: 5 })
      .Msg("1");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        level: "error",
        msg: "1",
        res: {
          _bla: 5,
          test: {
            jo: 42,
            _attributes: 1,
          },
        },
      },
    ]);
  });
  it("error with cause", async () => {
    const e = new Error("test");
    e.cause = "yes -- cause";
    logger.Error().Err(e).Msg("1");
    await logger.Flush();
    expect(logCollector.Logs()).toEqual([
      {
        error: {
          cause: "yes -- cause",
          message: "test",
        },
        level: "error",
        msg: "1",
      },
    ]);
  });
});
