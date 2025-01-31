#!/bin/bashi

if [ "$IN_CI" != "in_ci" ]
then
  pnpm run build
fi
rm -rf pubdir 
mkdir -p pubdir

cp -pr ../.gitignore ../README.md ../LICENSE dist/ts pubdir/

(cd dist/pkg && cp -pr . ../../pubdir/)
(cd src/ && cp -pr . ../pubdir/src/)
cp package.json pubdir/
cp ../README.md ../LICENSE pubdir/src/
cp ./jsr.json ./pubdir/src/
(cd pubdir/src && rm -f test/test-exit-handler.* ./utils/stream-test-helper.ts)
find pubdir/src -name __screenshots__ -print | xargs rm -rf thisIsnotFound 
find pubdir/src -name "*.test.ts" -print | xargs rm -f thisIsnotFound

node ./patch-version.cjs ./pubdir/package.json 
node ./patch-version.cjs ./pubdir/src/jsr.json 

node ./setup-jsr-json.cjs ./pubdir/src/jsr.json

(cd pubdir && pnpm pack)

(cd pubdir/src && deno publish --dry-run --unstable-sloppy-imports --allow-dirty)
