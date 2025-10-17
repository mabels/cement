import * as ts from "typescript";
import * as path from "node:path";
import * as fs from "node:fs";
import * as process from "node:process";
import { $ } from "zx";

// Custom compiler host
export function createCompilerHost(options: ts.CompilerOptions, version: string): ts.CompilerHost {
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

export function readTSConfig(configPath = "./tsconfig.json"): ts.CompilerOptions {
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

export function versionFromPackageJson(): string {
  const packageJson = JSON.parse(fs.readFileSync("package.json").toString()) as { version: string };
  return packageJson.version;
}

export function getVersion(iversion?: string): string {
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
