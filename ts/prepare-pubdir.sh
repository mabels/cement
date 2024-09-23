#!/bin/bash -e

if [ -z "$version" ] 
then
  version="v0.0.0-smoke"
fi
echo "VERSION:$version" 

pnpm run build
rm -rf pubdir 
mkdir -p pubdir

cp -pr ../.gitignore ../README.md ../LICENSE dist/ts pubdir/

(cd dist/pkg && cp -pr . ../../pubdir/)
cp package.json pubdir/
cp ../README.md ../LICENSE jsr.json pubdir/ts
rm -f pubdir/ts/src/test/test-exit-handler.*


node ../.github/workflows/patch-package.json.js ./pubdir/package.json $version
node ../.github/workflows/patch-package.json.js ./pubdir/ts/jsr.json $version
