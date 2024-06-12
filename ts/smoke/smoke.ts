import { WebSysAbstraction } from "@adviser/cement/web";
import { NodeSysAbstraction } from "@adviser/cement/node";
import { LoggerImpl, Result, Option, Level } from "@adviser/cement";

(async () => {
  const none = Option.None();
  const result = Result.Ok(none);
  if (!result.isOk()) {
    throw new Error("Result is Err");
  }
  const log = new LoggerImpl()
    .EnableLevel(Level.DEBUG)
    .With()
    .Str("runtime", globalThis.Deno ? "Deno" : "Node")
    .Str("version", process?.version || globalThis.Deno.version.deno)
    .Logger();
  {
    const sys = NodeSysAbstraction();
    log.Info().Str("id", sys.NextId()).Msg("Node-Alright");
  }
  {
    const sys = WebSysAbstraction();
    log.Info().Str("id", sys.NextId()).Msg("Web-Alright");
  }
})();
