const fs = require('fs');
const path = require('path');

function getVersion() {
  const ghref = process.env.GITHUB_REF || "refs/tags/v0.0.0-dev";
  let version = ghref.split("/").slice(-1)[0];
  if (version.startsWith('v')) {
    version = version.replace(/^v/, "");
  } else {
    version = "0.0.0-dev";
  }
  return version;
}

function replaceInFile(filePath, version) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace the placeholder with actual version
    content = content.replace(/__packageVersion__/g, version);
    fs.writeFileSync(filePath, content);
    console.log(`Updated version to ${version} in ${filePath}`);
  }
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (stat.isFile()) {
      callback(filePath);
    }
  });
}

const version = getVersion();
const distDir = './dist/ts';

if (fs.existsSync(distDir)) {
  walkDir(distDir, (filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.d.ts')) {
      replaceInFile(filePath, version);
    }
  });
} else {
  console.error(`Directory ${distDir} does not exist`);
}
