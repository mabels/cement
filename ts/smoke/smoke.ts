import { Lazy, VERSION, LoggerImpl, Result, Option, Level, runtimeFn, BasicSysAbstractionFactory } from "@adviser/cement";

async function main(): Promise<void> {
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
    const { NodeSysAbstraction } = await import("@adviser/cement/node");
    const sys = NodeSysAbstraction();
    log.Info().Str("id", sys.NextId()).Msg("Node-Alright");
  }
  if (rt.isDeno) {
    const { DenoSysAbstraction } = await import("@adviser/cement/deno");
    const sys = DenoSysAbstraction();
    log.Info().Str("id", sys.NextId()).Msg("Deno-Alright");
  }
  {
    const sys = BasicSysAbstractionFactory();
    log.Info().Str("id", sys.NextId()).Msg("Web-Alright");
  }
  await Lazy(() => log.Flush())();
}
// eslint-disable-next-line no-console
main().catch(console.error);
