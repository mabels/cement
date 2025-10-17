import { command, option, restPositionals, string } from "cmd-ts";
import * as fs from "node:fs";
import * as process from "node:process";
import { getVersion } from "./utils.js";

export function patchVersionCmd(): ReturnType<typeof command> {
  return command({
    name: "patch-version",
    description: "patch version in package.json and deno.json",
    version: "1.0.0",
    args: {
      version: option({
        long: "version",
        short: "v",
        defaultValue: () => getVersion(),
        defaultValueIsSerializable: true,
        type: string,
        description: "Path to the file containing the version, defaults to './package.json'.",
      }),
      files: restPositionals({
        type: string,
        displayName: "packageJsonFiles",
        description: "package.json files to process",
      }),
    },
    handler: (args) => {
      const version = getVersion(args.version);
      for (const fileToPatch of args.files) {
        // eslint-disable-next-line no-console
        console.log(`Patch ${fileToPatch} version to ${version}(${process.env.GITHUB_REF})`);
        const packageJson = JSON.parse(fs.readFileSync(fileToPatch).toString()) as { version: string };
        packageJson.version = version;
        fs.writeFileSync(fileToPatch, JSON.stringify(packageJson, undefined, 2) + "\n");
      }
    },
  }) as ReturnType<typeof command>;
}
