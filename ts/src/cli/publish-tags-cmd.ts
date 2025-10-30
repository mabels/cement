import { command, option, string } from "cmd-ts";
import * as process from "node:process";
import { SemVer } from "semver";
import { versionFromPackageJson } from "./utils.js";

// Regex patterns for version parsing
const reVersionAlphaStart = /^[a-z](\d+\.\d+\.\d+.*)$/;
// const reVersionOptionalAlphaStart = /^[a-z]?(\d+\.\d+\.\d+.*)$/;
const reScopedVersion = /^[^@]+@(.*)$/;
const reEndVersion = /.*\/([^/]+)$/;

function getEnvVersion(version?: string, xenv = process.env): string {
  let wversion = version || xenv.GITHUB_REF || versionFromPackageJson();
  if (reEndVersion.test(wversion)) {
    const match = wversion.match(reEndVersion);
    if (match && match[1]) {
      wversion = match[1];
    }
  }
  const calculatedVersion = wversion.replace(reScopedVersion, "$1").replace(reVersionAlphaStart, "$1");
  try {
    new SemVer(calculatedVersion);
    return calculatedVersion;
  } catch (e) {
    // Fallback to package.json version if parsing fails
    return versionFromPackageJson();
  }
}

export function publishTagsCmd(): ReturnType<typeof command> {
  return command({
    name: "publish-tags",
    description: "Calculate npm publish tags based on version",
    version: "1.0.0",
    args: {
      releaseVersion: option({
        long: "release-version",
        short: "r",
        defaultValue: () => "", // "" is falsy
        defaultValueIsSerializable: true,
        type: string,
        description: "Version string to analyze, defaults to GITHUB_REF or package.json version.",
      }),
    },
    handler: (args) => {
      const calculatedVersion = getEnvVersion(args.releaseVersion);
      const tags: string[] = [];

      try {
        const semVer = new SemVer(calculatedVersion);
        // Check if the last prerelease identifier is a string
        if (semVer.prerelease.length > 0) {
          const lastIdentifier = semVer.prerelease[semVer.prerelease.length - 1];
          if (typeof lastIdentifier === "string") {
            tags.push("dev");
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`Warn parsing version ${calculatedVersion}:`, e);
      }

      // Output the --tag options if there are tags
      if (tags.length > 0) {
        // eslint-disable-next-line no-console
        console.log(tags.map((tag) => `--tag ${tag}`).join(" "));
      }
    },
  }) as ReturnType<typeof command>;
}
