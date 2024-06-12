import { Level } from "../logger";
import { LoggerImpl } from "../logger_impl";
import { MockLogger } from "./mock_logger";

describe("logger", () => {
  it("with logcollector", async () => {
    const l = MockLogger();
    l.logger.Debug().Str("bla1", "blub1").Msg("hello1");
    l.logger.Info().Str("bla2", "blub2").Msg("hello2");
    await l.logger.Flush();
    expect(l.logCollector.Logs()).toEqual([
      { level: "debug", bla1: "blub1", msg: "hello1", module: "MockLogger" },
      { level: "info", bla2: "blub2", msg: "hello2", module: "MockLogger" },
    ]);
  });

  it("with logcollector disableDebug", async () => {
    const l = MockLogger({
      disableDebug: true,
    });
    l.logger.Debug().Str("bla1", "blub1").Msg("hello1");
    l.logger.Info().Str("bla2", "blub2").Msg("hello2");
    await l.logger.Flush();
    expect(l.logCollector.Logs()).toEqual([{ level: "info", bla2: "blub2", msg: "hello2", module: "MockLogger" }]);
  });

  it("with logcollector moduleName", async () => {
    const l = MockLogger({
      moduleName: "test",
    });
    l.logger.Debug().Str("bla1", "blub1").Msg("hello1");
    l.logger.Info().Str("bla2", "blub2").Msg("hello2");
    await l.logger.Flush();
    expect(l.logCollector.Logs()).toEqual([
      { level: "debug", bla1: "blub1", msg: "hello1", module: "test" },
      { level: "info", bla2: "blub2", msg: "hello2", module: "test" },
    ]);
  });

  it("with logcollector [moduleName]", async () => {
    const l = MockLogger({
      moduleName: ["test", "wurst"],
    });
    l.logger.Debug().Str("bla1", "blub1").Msg("hello1");
    l.logger.With().Module("wurst").Logger().Debug().Str("bla2", "blub2").Msg("hello2");
    await l.logger.Flush();
    expect(l.logCollector.Logs()).toEqual([
      { level: "debug", bla1: "blub1", msg: "hello1", module: "test" },
      { level: "debug", bla2: "blub2", msg: "hello2", module: "wurst" },
    ]);
  });

  it("global Check", async () => {
    const g1 = new LoggerImpl().EnableLevel(Level.DEBUG) as LoggerImpl;
    const g2 = new LoggerImpl();
    const g3 = g1.With().Module("X").Logger() as LoggerImpl;
    expect(g1._levelHandler).toBe(g2._levelHandler);
    expect(g1._levelHandler).toBe(g3._levelHandler);
    expect((g1._levelHandler as any)._globalLevels.has(Level.DEBUG)).toBeTruthy();
  });
});
