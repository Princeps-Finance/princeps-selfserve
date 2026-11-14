// Go-live gate. Run on the self-service-production branch (CI does it for every pull request into it).
// It fails when the live branch still has demo settings, placeholder contact details, or an unticked
// item in GO-LIVE.md. Run it yourself with: npm run check:live
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const problems = [];

const env = read('src/environments/environment.production.ts');
if (!/useMockApi:\s*false/.test(env)) problems.push('environment.production.ts: useMockApi must be false.');
if (!/demoBanner:\s*false/.test(env)) problems.push('environment.production.ts: demoBanner must be false.');
if (!/turnstileSiteKey:\s*'[^']{10,}'/.test(env)) problems.push('environment.production.ts: turnstileSiteKey is empty (bot check off).');
if (/customerModuleUrl:\s*'[^']*(vercel\.app|workers\.dev)/.test(env)) problems.push('environment.production.ts: customerModuleUrl still points at a vercel.app address. Use the Princeps domain.');

const support = read('src/app/core/support.ts');
if (/2348001234567|support@princeps\.ng/.test(support)) problems.push('support.ts: the support phone, WhatsApp or email is still the placeholder.');

const goLive = read('GO-LIVE.md');
const open = goLive.split('\n').filter((line) => line.startsWith('- [ ]'));
for (const line of open) problems.push(`GO-LIVE.md: not done yet: ${line.slice(6)}`);

if (problems.length) {
  console.error(`\nNot ready to go live (${problems.length}):\n`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log('Live config looks right.');
