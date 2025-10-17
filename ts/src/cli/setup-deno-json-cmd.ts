import { command, option, string } from "cmd-ts";
import * as path from "node:path";
import * as fs from "node:fs";

// node ./setup-jsr-json.cjs ./pubdir/deno.json
function setupDenoJson(packageJsonFile: string, jsrJsonFile: string): void {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonFile).toString()) as { dependencies: Record<string, string> };
  const jsrJson = JSON.parse(fs.readFileSync(jsrJsonFile).toString()) as {
    name: string;
    exports: Record<string, string>;
    imports: Record<string, string>;
  };
  // self imports
  const jsrJsonImports = Object.fromEntries(Object.entries(jsrJson.exports ?? {}).map(([k, v]) => [path.join(jsrJson.name, k), v]));
  const nodeJsonImports = Object.fromEntries(
    Array.from(Object.entries(packageJson.dependencies ?? {})).map(([k, v]) => [k, `npm:${k}@${v.replace(/^npm:/, "")}`]),
  );
  jsrJson.imports = { ...jsrJson.imports, ...jsrJsonImports, ...nodeJsonImports };
  fs.writeFileSync(jsrJsonFile, JSON.stringify(jsrJson, undefined, 2) + "\n");
}

export function setUpDenoJsonCmd(): ReturnType<typeof command> {
  return command({
    name: "setup-deno-json",
    description: "setup deno.json",
    version: "1.0.0",
    args: {
      packageJson: option({
        long: "packageJson",
        short: "p",
        defaultValue: () => "package.json",
        defaultValueIsSerializable: true,
        type: string,
        description: "Path to the package.json file, defaults to './package.json'.",
      }),
      jsrJson: option({
        long: "jsrJson",
        short: "j",
        defaultValue: () => "deno.json",
        defaultValueIsSerializable: true,
        type: string,
        description: "Path to the deno.json file, defaults to './deno.json'.",
      }),
    },
    handler: (args) => {
      // eslint-disable-next-line no-console
      console.log(`Setup deno.json ${args.jsrJson} from ${args.packageJson}`);
      setupDenoJson(args.packageJson, args.jsrJson);
    },
  }) as ReturnType<typeof command>;
}
