import { runtimeFn } from "../runtime.js";
import { RuntimeSysAbstraction } from "../sys-abstraction.js";

const gts = globalThis as unknown /*Deno*/ as {
  Deno: {
    args: string[];
    pid: number;
    kill(pid: number, signal: string): void;
  };
  process: {
    argv: string[];
    pid: number;
    kill(pid: number, signal: string): void;
  };
};

async function main(): Promise<void> {
  const modPath = runtimeFn().isDeno
    ? new URL("../deno/deno-sys-abstraction.ts", import.meta.url).pathname
    : new URL("../node/node-sys-abstraction.ts", import.meta.url).pathname;
  // console.log("modPath", modPath);
  const sa = (await import(modPath)) as {
    DenoSysAbstraction: () => RuntimeSysAbstraction;
    NodeSysAbstraction: () => RuntimeSysAbstraction;
  };

  const my = runtimeFn().isDeno ? sa.DenoSysAbstraction() : sa.NodeSysAbstraction();

  const process = runtimeFn().isDeno ? gts.Deno : gts.process;

  const rargs = (runtimeFn().isDeno ? gts.Deno?.args : gts.process?.argv) || [];

  const larg = rargs[rargs.length - 1];
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      larg,
      pid: process.pid,
    }),
  );

  my.System().OnExit(async () => {
    await my.Time().Sleep(100);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        larg,
        pid: process.pid,
        msg: "Called OnExit 1",
      }),
    );
  });
  my.System().OnExit(async () => {
    await my.Time().Sleep(200);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        larg,
        pid: process.pid,
        msg: "Called OnExit 2",
      }),
    );
  });

  switch (larg) {
    case "sigint":
      await my.Time().Sleep(100);
      process.kill(process.pid, "SIGINT");
      await my.Time().Sleep(1000000);
      break;
    case "sigquit":
      await my.Time().Sleep(100);
      process.kill(process.pid, "SIGQUIT");
      await my.Time().Sleep(1000000);
      break;
    case "sigterm":
      await my.Time().Sleep(100);
      process.kill(process.pid, "SIGTERM");
      await my.Time().Sleep(1000000);
      break;
    case "throw":
      await my.Time().Sleep(100);
      throw new Error("throwing");
    case "sleep":
      await my.Time().Sleep(3000);
      break;
    case "exit24":
    default:
      my.System().Exit(24);
  }
  return;
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
