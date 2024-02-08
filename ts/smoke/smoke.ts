import { NodeSysAbstraction, LoggerImpl, Result, Option } from "@adviser/cement";

(async () => {
  const none = Option.None();
  const result = Result.Ok(none);
  if (!result.isOk()) {
    throw new Error("Result is Err");
  }
  const sys = new NodeSysAbstraction();
  const log = new LoggerImpl();
  log.Info().Str("id", sys.NextId()).Msg("Alright");
})();
