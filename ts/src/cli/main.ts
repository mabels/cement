import { run, subcommands } from "cmd-ts";
import { patchVersionCmd } from "./patch-version-cmd.js";
import { generateVersionTsCmd } from "./generate-version-ts-cmd.js";
import { setUpDenoJsonCmd } from "./setup-deno-json-cmd.js";
import { preparePubdirCmd } from "./prepare-pubdir-cmd.js";
import { publishTagsCmd } from "./publish-tags-cmd.js";

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
      publishTags: publishTagsCmd(),
    },
  });

  await run(cmd, process.argv.slice(2));
  // eslint-disable-next-line no-console
})().catch(console.error);
