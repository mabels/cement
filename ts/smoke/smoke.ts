import { NodeSysAbstraction, LoggerImpl } from "@adviser/cement";

(async () => {
  const sys = new NodeSysAbstraction();
  const log = new LoggerImpl();
  log.Info().Str("id", sys.NextId()).Msg("Alright");
})();
