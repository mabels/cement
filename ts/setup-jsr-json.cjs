const fs = require("node:fs");
const process = require("node:process");

const filePackageJson = "package.json";
const fileToPatch = process.argv[process.argv.length - 1];

const packageJson = JSON.parse(fs.readFileSync(filePackageJson).toString());

const jsrJson = JSON.parse(fs.readFileSync(fileToPatch).toString());

jsrJson.imports = Object.fromEntries(
  Array.from(Object.entries(packageJson.dependencies)).map(([k, v]) => [k, `npm:${k}@${v.replace(/^npm:/, "")}`]),
);

//for (const key of Object.keys(jsrJson.exports)) {
//  jsrJson.exports[key] = jsrJson.exports[key].replace(/src\//, "");
//}
// jsrJson.publish.include = jsrJson.publish.include.map((i) => i.replace(/src\//, ""));

fs.writeFileSync(fileToPatch, JSON.stringify(jsrJson, undefined, 2) + "\n");
