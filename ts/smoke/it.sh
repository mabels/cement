set -e

cd smoke
rm -f package.json pnpm-lock.yaml tsconfig.json
pnpm init
pnpm install -f ../dist/pubdir/adviser-cement-*.tgz
pnpm add tsx
pnpm exec tsc --init
npx tsx ./smoke.ts
deno run --allow-read ./smoke.ts

node ./smoke.cjs
rm -f package.json pnpm-lock.yaml tsconfig.json
