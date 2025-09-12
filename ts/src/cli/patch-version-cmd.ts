import * as ts from "typescript";
import { command, option, restPositionals, string } from "cmd-ts";
import * as path from "node:path";
import * as fs from "node:fs";
import * as process from "node:process";
import { $, cd, glob } from "zx";

// Custom compiler host
function createCompilerHost(options: ts.CompilerOptions, version: string): ts.CompilerHost {
  const host = ts.createCompilerHost(options);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const myGetSourceFile = host.getSourceFile;

  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile): ts.SourceFile => {
    const sourceFile = myGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    if (!sourceFile) {
      throw new Error("getSourceFile is not defined");
    }

    // Patch version.ts during compilation
    if (fileName.endsWith("version.ts") && sourceFile) {
      const newText = `export const VERSION: string = "${version}";`;
      return ts.createSourceFile(fileName, newText, languageVersion);
    }

    return sourceFile;
  };
  return host;
}

function readTSConfig(configPath = "./tsconfig.json"): ts.CompilerOptions {
  // Read the config file
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFile.error) {
    throw new Error(`Error reading tsconfig: ${configFile.error.messageText as string}`);
  }

  // Parse and resolve the config
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath), undefined, configPath);

  if (parsedConfig.errors.length > 0) {
    const errors = parsedConfig.errors.map((err) => err.messageText as string).join("\n");
    throw new Error(`Error parsing tsconfig: ${errors}`);
  }

  return parsedConfig.options; // This is CompilerOptions
}

function versionFromPackageJson(): string {
  const packageJson = JSON.parse(fs.readFileSync("package.json").toString()) as { version: string };
  return packageJson.version;
}

const versionArgs = {
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
};

export function generateVersionTsCmd(): ReturnType<typeof command> {
  return command({
    name: "fireproof build cli",
    description: "helps to build fp",
    version: "1.0.0",
    args: versionArgs,
    handler: (args) => {
      const options = readTSConfig(args.tsconfig);
      const host = createCompilerHost(options, args.version);
      const program = ts.createProgram([args.versionFile], options, host);
      program.emit();
    },
  }) as ReturnType<typeof command>;
}

function getVersion(iversion?: string): string {
  const ghref = iversion || process.env.GITHUB_REF || versionFromPackageJson() || "a/v0.0.0-smoke";
  let lastPart = ghref.split("/").slice(-1)[0];
  if (iversion) {
    return iversion.replace(/^[vdsp]/, "");
  }
  const short = $.sync`git rev-parse --short HEAD`.stdout.trim();
  if (process.env.GITHUB_REF) {
    lastPart = lastPart.replace(/^[vdsp]/, "");
    if (lastPart.match(/^\d+\.\d+\.\d+/)) {
      return lastPart;
    }
    return `0.0.0-dev-ci-${short}`;
  }
  return `0.0.0-dev-local-${Date.now()}`;
}

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

// node ./setup-jsr-json.cjs ./pubdir/deno.json
function setupDenoJson(packageJsonFile: string, jsrJsonFile: string): void {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonFile).toString()) as { dependencies: Record<string, string> };
  const jsrJson = JSON.parse(fs.readFileSync(jsrJsonFile).toString()) as { imports: Record<string, string> };
  jsrJson.imports = Object.fromEntries(
    Array.from(Object.entries(packageJson.dependencies ?? {})).map(([k, v]) => [k, `npm:${k}@${v.replace(/^npm:/, "")}`]),
  );
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

export async function preparePubdir(pubdir: string, version: string, baseDir: string, srcDir: string): Promise<void> {
  // Set shell options equivalent to 'set -ex'
  $.verbose = true;

  // Build if not in CI
  if (process.env.IN_CI !== "in_ci") {
    await $`pnpm run build`;
  }

  // Clean and create pubdir
  await $`rm -rf ${pubdir}`;
  await $`mkdir -p ${pubdir}`;

  // Copy files to pubdir
  await $`cp -pr ${path.join(baseDir, ".gitignore")} ${path.join(baseDir, "README.md")} ${path.join(baseDir, "LICENSE")} ./dist/ts/ ${pubdir}/`;

  // Copy from dist/pkg
  cd("dist/pkg");
  await $`cp -pr . ../../${pubdir}/`;
  cd("../..");

  // Copy from src
  cd(srcDir);
  await $`cp -pr . ../${pubdir}/${srcDir}/`;
  cd("..");

  // Rename .js files to .cjs in pubdir/cjs
  const jsFiles = await glob(`${pubdir}/cjs/**/*.js`);
  for (const file of jsFiles) {
    const newFile = file.replace(/\.js$/, ".cjs");
    await $`mv ${file} ${newFile}`;
  }

  // Rename .js.map files to .cjs.map in pubdir/cjs
  const mapFiles = await glob(`${pubdir}/cjs/**/*.js.map`);
  for (const file of mapFiles) {
    const newFile = file.replace(/\.js\.map$/, ".cjs.map");
    await $`mv ${file} ${newFile}`;
  }

  // Run jscodeshift on .cjs files
  const cjsFiles = await glob(`${pubdir}/cjs/**/*.cjs`);
  if (cjsFiles.length > 0) {
    await $`pnpm exec jscodeshift --parser=babel -t=./to-cjs.js ${cjsFiles}`;
  }

  // Copy package.json
  await $`cp package.json ${pubdir}/`;

  // Clean up test files in pubdir/src
  cd(`${pubdir}/${srcDir}`);
  await $`rm -f test/test-exit-handler.* ./utils/stream-test-helper.ts`.catch(() => {
    // Ignore errors if files don't exist
  });
  cd("../..");

  // Remove __screenshots__ directories
  const screenshotDirs = await glob(`${pubdir}/${srcDir}/**/__screenshots__`);
  for (const dir of screenshotDirs) {
    await $`rm -rf ${dir}`;
  }

  // Remove test files
  const testFiles = await glob(`${pubdir}/${srcDir}/**/*.test.ts`);
  for (const file of testFiles) {
    await $`rm -f ${file}`;
  }

  // Copy deno.json
  await $`cp ./deno.json ./${pubdir}/`;

  // Patch version in package.json and deno.json
  await patchVersionCmd().handler({ version, files: [`${pubdir}/package.json`, `${pubdir}/deno.json`] });
  // await $`sh src/cli/run.sh patchVersion ./pubdir/package.json ./pubdir/deno.json`;

  // Setup JSR JSON
  await setUpDenoJsonCmd().handler({ packageJson: `${pubdir}/package.json`, jsrJson: `${pubdir}/deno.json` });
  // await $`node ./setup-jsr-json.cjs ./pubdir/deno.json`;

  // Pack and publish
  cd("pubdir");
  await $`pnpm pack`;
  await $`deno publish --dry-run --unstable-sloppy-imports --allow-dirty`;
}

export function preparePubdirCmd(): ReturnType<typeof command> {
  return command({
    name: "prepare-pubdir",
    description: "prepare pubdir",
    version: "1.0.0",
    args: {
      pubdir: option({
        long: "pubdir",
        short: "p",
        defaultValue: () => "pubdir",
        defaultValueIsSerializable: true,
        type: string,
        description: "Path to the pubdir, defaults to './pubdir'.",
      }),
      srcDir: option({
        long: "srcDir",
        short: "s",
        defaultValue: () => "src",
        defaultValueIsSerializable: true,
        type: string,
        description: "Path to the src directory, defaults to './src'.",
      }),
      baseDir: option({
        long: "baseDir",
        short: "b",
        defaultValue: () => "../",
        defaultValueIsSerializable: true,
        type: string,
        description: "Path to the base directory of the project, defaults to '../'.",
      }),
      version: option({
        long: "version",
        short: "v",
        defaultValue: () => getVersion(),
        defaultValueIsSerializable: true,
        type: string,
        description: "Version to patch in, defaults to reading from package.json.",
      }),
    },
    handler: async (args) => {
      await preparePubdir(args.pubdir, args.version, args.baseDir, args.srcDir);
    },
  }) as ReturnType<typeof command>;
}
