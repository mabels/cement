import { WebSysAbstraction } from "@adviser/cement/web";
import { NodeSysAbstraction } from "@adviser/cement/node";
import { DenoSysAbstraction } from "@adviser/cement/deno";
import { VERSION, LoggerImpl, Result, Option, Level, runtimeFn } from "@adviser/cement";

(async (): Promise<void> => {
  const none = Option.None();
  const result = Result.Ok(none);
  if (!result.isOk()) {
    throw new Error("Result is Err");
  }
  const log = new LoggerImpl()
    .EnableLevel(Level.DEBUG)
    .With()
    .Str("runtime", globalThis.Deno ? "Deno" : "Node")
    .Str("version", VERSION)
    .Str("runtime-version", !globalThis.Deno ? process?.version : globalThis.Deno.version.deno)
    .Logger();
  const rt = runtimeFn();
  if (rt.isNodeIsh) {
    const sys = NodeSysAbstraction();
    log.Info().Str("id", sys.NextId()).Msg("Node-Alright");
  }
  if (rt.isDeno) {
    const sys = DenoSysAbstraction();
    log.Info().Str("id", sys.NextId()).Msg("Node-Alright");
  }
  {
    const sys = WebSysAbstraction();
    log.Info().Str("id", sys.NextId()).Msg("Web-Alright");
  }
})();
