import * as ts from "typescript";
import { command, option, string } from "cmd-ts";
import { createCompilerHost, readTSConfig, getVersion } from "./utils.js";

export function generateVersionTsCmd(): ReturnType<typeof command> {
  return command({
    name: "fireproof build cli",
    description: "helps to build fp",
    version: "1.0.0",
    args: {
      version: option({
        long: "version",
        short: "v",
        defaultValue: () => getVersion(),
        defaultValueIsSerializable: true,
        type: string,
        description: "Version to patch in, defaults to reading from package.json.",
      }),
      versionFile: option({
        long: "versionFile",
        short: "f",
        defaultValue: () => "src/version.ts",
        defaultValueIsSerializable: true,
        type: string,
        description: "Path to the file containing the version, defaults to './src/version.ts'.",
      }),
      tsconfig: option({
        long: "tsconfig",
        short: "t",
        defaultValue: () => "tsconfig.json",
        defaultValueIsSerializable: true,
        type: string,
        description: "Path to the tsconfig.json file, defaults to './tsconfig.json'.",
      }),
    },
    handler: (args) => {
      const options = readTSConfig(args.tsconfig);
      const host = createCompilerHost(options, args.version);
      const program = ts.createProgram([args.versionFile], options, host);
      program.emit();
    },
  }) as ReturnType<typeof command>;
}
