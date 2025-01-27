
cd smoke
rm -f package.json; 
pnpm init
pnpm install -f ../pubdir/adviser-cement-*.tgz
npx tsx ./smoke.ts
deno run --allow-read ./smoke.ts
rm package.json pnpm-lock.yaml
