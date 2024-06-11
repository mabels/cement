import { LevelHandlerImpl, LoggerImpl } from "./logger_impl";
import { LogCollector } from "./test/log_collector";

import { Logger, Level } from "./logger";
import { TimeMode } from "./sys_abstraction";
import { WebSysAbstraction } from "./web/web_sys_abstraction";
import { TimeFactory } from "./base_sys_abstraction";

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
});
