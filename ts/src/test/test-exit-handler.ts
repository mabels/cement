(async (): Promise<void> => {
  const sa = await import("../node/node-sys-abstraction");

  const my = sa.NodeSysAbstraction();

  const larg = process.argv[process.argv.length - 1];
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
})();
