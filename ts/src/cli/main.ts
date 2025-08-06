import { run, subcommands } from "cmd-ts";
import { patchVersionCmd, generateVersionTsCmd, setUpDenoJsonCmd, preparePubdirCmd } from "./patch-version-cmd.js";

(async (): Promise<void> => {
  const cmd = subcommands({
    name: "cement",
    description: "cement cli",
    version: "1.0.0",
    cmds: {
      patchVersion: patchVersionCmd(),
      generateVersionTs: generateVersionTsCmd(),
      setUpDenoJson: setUpDenoJsonCmd(),
      preparePubdir: preparePubdirCmd(),
    },
  });

  await run(cmd, process.argv.slice(2));
  // eslint-disable-next-line no-console
})().catch(console.error);
