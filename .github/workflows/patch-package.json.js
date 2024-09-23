const fs = require("fs");
let version = process.argv[process.argv.length - 1];
version = version.split("/").slice(-1)[0].replace(/^v/, "");
const fileToPatch = process.argv[process.argv.length - 2];
console.error(`Patch ${fileToPatch} version to ${version}`);
const packageJson = JSON.parse(fs.readFileSync(fileToPatch).toString());
packageJson.version = version;
fs.writeFileSync(fileToPatch, JSON.stringify(packageJson, undefined, 2) + "\n");
