// A fight filmed from the game's own camera: scripted presses go in through the player's own input, every Nth frame is kept, tiled into sheets to read.
//   node film.mjs <scenario> [out=/tmp/film] [nth=2] [w=844] [h=390] [tier=phone] [port=8812]
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
import { rig } from './rig.mjs';
import { STAGE, scenarios } from './scenarios.mjs';
const [name = 'chain', outRoot = '/tmp/film', nth = '2', W = '844', H = '390', tier = 'phone', port = '8791'] = process.argv.slice(2);
const sc = scenarios[name]; if (!sc) { console.log('no scenario', name, Object.keys(scenarios)); process.exit(2); }
const out = path.join(outRoot, name); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const r = await rig({ port: +port, tier, w: +W, h: +H, draw: true, limit: 160 });
await r.page.evaluate(STAGE); await r.page.evaluate(sc.setup);
await r.page.addStyleTag({ content: sc.hud ? '' : '#hud{opacity:0!important}' });
let kept = 0; const T = sc.frames, log = [];
for (let f = 0; f < T; f++) {
  await r.page.evaluate(([f, press]) => { window.__stage.frame(f, press); }, [f, sc.press[f] || null]);
  if (f >= (sc.from || 0) && f % +nth === 0) { await r.page.screenshot({ path: path.join(out, `f${String(kept).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 82 }); kept++; }
}
const stats = await r.page.evaluate(() => { const G = window.__game; return { fx: G.fx.stats, look: G.look.stats(), log: G.combat.log.slice(-40).map((l) => l.type + ':' + (l.id || l.foe || '')).join(' ') }; });
console.log(JSON.stringify(stats).slice(0, 900)); console.log('errors', r.errors.slice(0, 6)); await r.close();
const tile = sc.tile || '6x5', w = 320;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '60', '-i', path.join(out, 'f%04d.jpg'), '-vf', `scale=${w}:-1,tile=${tile}`, '-q:v', '3', path.join(out, 'sheet_%02d.jpg')]);
console.log(fs.readdirSync(out).filter((f) => f.startsWith('sheet')).map((f) => path.join(out, f)).join('\n'));
