import { MockLogger } from "./mock_logger";
import { LogWriterCollector } from "./log_collector";

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

  it("tee in logcolletor", async () => {
    const lc2Buffer: Uint8Array[] = [];
    const lc2 = new LogWriterCollector(lc2Buffer);
    const l = MockLogger({
      pass: lc2,
    });
    l.logger.Error().Msg("should been shown in console");
    await l.logger.Flush();
    expect(l.logCollector.Logs()).toEqual([{ level: "error", msg: "should been shown in console", module: "MockLogger" }]);
    expect(lc2Buffer.length).toBe(1);
    expect(JSON.parse(new TextDecoder().decode(lc2Buffer[0]))).toEqual({
      level: "error",
      msg: "should been shown in console",
      module: "MockLogger",
    });
  });
});
