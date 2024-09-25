const fs = require("fs");
const ghref = process.env.GITHUB_REF || "a/v0.0.0-smoke";
// refs/tags/v0.2.30
const lastPart = ghref.split("/").slice(-1)[0];
let version = "0.0.0-smoke-ci";
if (lastPart.match(/^v/)) {
  version = lastPart.replace(/^v/, "");
}
const fileToPatch = process.argv[process.argv.length - 1];
console.error(`Patch ${fileToPatch} version to ${version}(${process.env.GITHUB_REF})`);
const packageJson = JSON.parse(fs.readFileSync(fileToPatch).toString());
packageJson.version = version;
fs.writeFileSync(fileToPatch, JSON.stringify(packageJson, undefined, 2) + "\n");
