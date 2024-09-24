#!/bin/bash -e

pnpm run build
rm -rf pubdir 
mkdir -p pubdir

cp -pr ../.gitignore ../README.md ../LICENSE dist/ts pubdir/

(cd dist/pkg && cp -pr . ../../pubdir/)
(cd src/ && cp -pr . ../pubdir/src/)
cp package.json pubdir/
cp ../README.md ../LICENSE pubdir/ts
cp ./jsr.json ./pubdir/src/
(cd pubdir/src && rm -f test/test-exit-handler.* ./utils/stream-test-helper.ts **/*.test.ts)

node ./patch-version.cjs ./pubdir/package.json 
node ./patch-version.cjs ./pubdir/src/jsr.json 

node ./setup-jsr-json.cjs ./pubdir/src/jsr.json

(cd pubdir/src && deno publish --dry-run --unstable-sloppy-imports --allow-dirty)
