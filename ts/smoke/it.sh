
cd smoke
rm -f package.json pnpm-lock.yaml 
pnpm init
pnpm install -f ../pubdir/adviser-cement-*.tgz
npx tsx ./smoke.ts
deno run --allow-read ./smoke.ts

node ./smoke.cjs
rm -f package.json pnpm-lock.yaml
