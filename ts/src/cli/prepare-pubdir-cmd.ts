import { command, option, string } from "cmd-ts";
import * as path from "node:path";
import * as process from "node:process";
import { $, cd, glob } from "zx";
import { getVersion } from "./utils.js";
import { setUpDenoJsonCmd } from "./setup-deno-json-cmd.js";
import { patchVersionCmd } from "./patch-version-cmd.js";

function disableVerbose(fn: () => Promise<void>): Promise<void> {
  const verbose = $.verbose;
  $.verbose = false;
  return fn().finally(() => {
    $.verbose = verbose;
  });
}

export async function preparePubdir(pubdir: string, version: string, baseDir: string, srcDir: string): Promise<void> {
  // Set shell options equivalent to 'set -ex'
  $.verbose = true;

  const rootDir = process.cwd();

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
  cd(rootDir);

  // Copy from src
  cd(srcDir);
  await $`cp -pr . ../${pubdir}/${srcDir}/`;
  cd(rootDir);

  // Rename .js files to .cjs in pubdir/cjs
  const jsFiles = await glob(`${pubdir}/cjs/**/*.js`);

  await disableVerbose(async () => {
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
  });

  // Run jscodeshift on .cjs files
  const cjsFiles = await glob(`${pubdir}/cjs/**/*.cjs`);
  if (cjsFiles.length > 0) {
    await $`pnpm exec jscodeshift -s --parser=babel -t=./to-cjs.js ${cjsFiles}`;
  }

  // Copy package.json
  await $`cp package.json ${pubdir}/`;

  // Clean up test files in pubdir/src
  cd(`${pubdir}/${srcDir}`);
  await $`rm -f test/test-exit-handler.* ./utils/stream-test-helper.ts`.catch(() => {
    // Ignore errors if files don't exist
  });
  cd(rootDir);

  // Remove __screenshots__ directories
  const screenshotDirs = await glob(`${pubdir}/${srcDir}/**/__screenshots__`);
  for (const dir of screenshotDirs) {
    await $`rm -rf ${dir}`;
  }

  // Remove test files
  await disableVerbose(async () => {
    const testFiles = await glob(`${pubdir}/${srcDir}/**/*.test.ts`);
    for (const file of testFiles) {
      await $`rm -f ${file}`;
    }
  });

  // Copy tsconfig.json
  await $`cp ./tsconfig.json ./${pubdir}/`;

  // Copy deno.json
  await $`cp ./deno.json ./${pubdir}/`;

  // Patch version in package.json and deno.json
  await patchVersionCmd().handler({ version, files: [`${pubdir}/package.json`, `${pubdir}/deno.json`] });
  // await $`sh src/cli/run.sh patchVersion ./pubdir/package.json ./pubdir/deno.json`;

  // Setup JSR JSON
  await setUpDenoJsonCmd().handler({ packageJson: `${pubdir}/package.json`, jsrJson: `${pubdir}/deno.json` });
  // await $`node ./setup-jsr-json.cjs ./pubdir/deno.json`;

  // Pack and publish
  cd(pubdir);
  await $`pnpm pack 2>&1 | head -10 && echo "..."`;
  await $`deno publish --dry-run --unstable-sloppy-imports --allow-dirty --quiet`;
  cd(rootDir);

  // eslint-disable-next-line no-console
  console.log(`Prepared ${pubdir} for version ${version}`);
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
        defaultValue: () => "dist/pubdir",
        defaultValueIsSerializable: true,
        type: string,
        description: "Path to the pubdir, defaults to './dist/pubdir'.",
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
