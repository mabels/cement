#!/bin/bash
set -ex

if [ "$IN_CI" != "in_ci" ]
then
  pnpm run build
fi
rm -rf pubdir 
mkdir -p pubdir

cp -pr ../.gitignore ../README.md ../LICENSE ./dist/ts/ pubdir/

(cd dist/pkg && cp -pr . ../../pubdir/)
(cd src/ && cp -pr . ../pubdir/src/)
for i in $(find pubdir/cjs -name "*.js" -print)
do
  mv $i ${i%.js}.cjs
done
for i in $(find pubdir/cjs -name "*.js.map" -print)
do
  mv $i ${i%.js.map}.cjs.map
done
pnpm exec jscodeshift --parser=babel -t=./to-cjs.js $(find pubdir/cjs -name "*.cjs")

cp package.json pubdir/
cp ./jsr.json ./pubdir/src/

(cd pubdir/src && rm -f test/test-exit-handler.* ./utils/stream-test-helper.ts)
find pubdir/src -name __screenshots__ -print | xargs rm -rf thisIsnotFound 
find pubdir/src -name "*.test.ts" -print | xargs rm -f thisIsnotFound

node ./patch-version.cjs ./pubdir/package.json 
node ./patch-version.cjs ./pubdir/src/jsr.json 

node ./setup-jsr-json.cjs ./pubdir/src/jsr.json

(cd pubdir && pnpm pack)

(cd pubdir/src && deno publish --dry-run --unstable-sloppy-imports --allow-dirty)
