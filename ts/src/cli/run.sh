#!/bin/bash
TSX="npx tsx"
if [ -x ./node_modules/.bin/tsx ]
then
  TSX=./node_modules/.bin/tsx
fi
if [ -x ../node_modules/.bin/tsx ]
then
  TSX=../node_modules/.bin/tsx
fi
exec $TSX $(dirname $0)/main.ts $@
