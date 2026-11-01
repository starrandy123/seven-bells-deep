// The quick gate: the walls that take seconds, on one command. The old twelve lines are gone: they held A1 on a hand-moved point, swimming only, and missed every leap.
// The whole gate is tools/round.sh <n>: every wall in both engines on a frozen copy, then every plant. web_check/CHECKPOINT_MAP.md says what holds what.
//   node quality.mjs [base url] [engine=chromium]
import { spawnSync } from 'child_process'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), [base = 'http://127.0.0.1:8791/index.html', engine = 'chromium'] = process.argv.slice(2);
let bad = 0;
for (const w of ['load', 'collide', 'drawn', 'play', 'rates']) { const r = spawnSync('node', [path.join(HERE, `${w}.mjs`), base, engine], { stdio: 'inherit' }); if (r.status) bad++; }
process.exit(bad ? 1 : 0);
