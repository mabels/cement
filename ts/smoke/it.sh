
cd smoke
rm -f package.json pnpm-lock.yaml tsconfig.json
pnpm init
pnpm install -f ../pubdir/adviser-cement-*.tgz
pnpm add typescript tsx
pnpm exec tsc --init
npx tsx ./smoke.ts
deno run --allow-read ./smoke.ts

node ./smoke.cjs
rm -f package.json pnpm-lock.yaml tsconfig.json
