const fs = require("fs");

const fileToPatch = process.argv[process.argv.length - 1];

const jsrJson = JSON.parse(fs.readFileSync(fileToPatch).toString());

for (const key of Object.keys(jsrJson.exports)) {
  jsrJson.exports[key] = jsrJson.exports[key].replace(/src\//, "");
}
jsrJson.publish.include = jsrJson.publish.include.map((i) => i.replace(/src\//, ""));

fs.writeFileSync(fileToPatch, JSON.stringify(jsrJson, undefined, 2) + "\n");
