// Node, no page: the frame table itself. Reads the game's own combat.json and combat_core.js.   node walls_data.mjs <web dir>
import fs from 'fs'; import path from 'path';
const dir = path.resolve(process.argv[2] || '../../web');
const core = await import(path.join(dir, 'js/combat_core.js')); const D = JSON.parse(fs.readFileSync(path.join(dir, 'data/combat.json')));
let bad = 0; const line = (ok, s) => { console.log((ok ? '✔ ' : '✖ ') + s); if (!ok) bad++; };
const audit = core.audit(D); line(audit.length === 0, `the frame table is sound: ${audit.length} bad rows (0)${audit.length ? ': ' + audit.join('; ') : ''}`);
// M14: the longest stretch with no input taken, over every move. The finisher is the stated exception: he can't be hurt in it
let worst = 0, where = ''; for (const id in D.moves) { const a = core.deadFrames(D.moves[id]).any; if (a > worst) { worst = a; where = id; } }
line(worst <= 20, `no dead stretch: at most ${worst} frames (${(worst / 60).toFixed(2)} s) before any input is taken, over every move (M14a ≤ 20 f, 0.33 s; ${where})`);
// the reference's numbers
const R = { windup: [10, 14], gapLo: 20, gapHi: 40 };
const seq = ['strike1', 'strike2', 'strike3', 'strike1']; let lo = 1e9, hi = 0, at = '';
for (let i = 0; i < 3; i++) { const a = D.moves[seq[i]], b = D.moves[seq[i + 1]], gap = a.cancel.strike - a.startup + b.startup; if (gap < lo) { lo = gap; at = seq[i]; } hi = Math.max(hi, gap); }
line(lo >= R.gapLo && hi <= R.gapHi, `blow to blow in the chain: ${lo}-${hi} frames (${(lo / 60).toFixed(2)}-${(hi / 60).toFixed(2)} s; reference 0.33-0.67, ${R.gapLo}-${R.gapHi} f)`);
let w2 = 0, w2at = ''; for (const id of ['strike1', 'strike2', 'strike3']) { const m = D.moves[id]; if (m.startup > w2) { w2 = m.startup; w2at = id; } }
line(w2 <= R.windup[1], `wind-up of a strike: at most ${w2} frames (${(w2 / 60).toFixed(2)} s; reference 0.17-0.23; ${w2at})`);
const dg = D.moves.dodge; line(dg.total >= 16 && dg.total <= 20, `a dodge lasts ${(dg.total / 60).toFixed(2)} s (P4e 0.27-0.33)`); line(D.input.buffer_f >= 9, `a press lives ${(D.input.buffer_f / 60).toFixed(2)} s (M14c ≥ 0.15)`); line(D.interactions && Object.keys(D.interactions).length >= 4, `${Object.keys(D.interactions).length} named interactions (P3e ≥ 4)`); { const K = Object.keys(D.foes).filter((k) => k !== '_doc'), no = K.filter((k) => !D.foes[k].counter); line(K.length >= 9 && no.length === 0, `${K.length} enemy kinds, each with a stated counter (P6a ≥ 9, P6b; ${no.length} without)`); }
line(dg.cancel.strike <= 20, `a dodge takes a blow from frame ${dg.cancel.strike} (${(dg.cancel.strike / 60).toFixed(2)} s; reference 0.33)`);
line(dg.iframes[1] - dg.iframes[0] >= 12, `dodge invulnerable for ${dg.iframes[1] - dg.iframes[0] + 1} frames (≥ 13)`);
line((D.moves.parry.guard[1] - D.moves.parry.guard[0]) / 60 >= 0.4, `parry guards ${((D.moves.parry.guard[1] - D.moves.parry.guard[0]) / 60).toFixed(2)} s (≥ 0.40, P8)`);
let tell = 9, tellAt = ''; for (const k in D.foes) { if (k === '_doc') continue; for (const b of D.foes[k].blows) if (b.tell_s < tell) { tell = b.tell_s; tellAt = k + ' ' + b.id; } }
line(tell >= 0.5, `every enemy blow is told at least ${tell.toFixed(2)} s ahead in the data (≥ 0.50, P8; ${tellAt})`);
let cost = 0; for (const st in D.stances) for (const id of D.stances[st].slots) { const m = D.moves[id]; if (!(m.cost > 0) || !(m.cooldown > 0)) cost++; }
line(cost === 0, `every power has a cost and a cooldown: ${cost} without`);
const hs = (k) => D.impacts[k].hitstop_f; line(hs('light') <= 1.8 && hs('heavy') >= 4.2 && hs('heavy') <= 6 && hs('finisher') <= 6, `hit-stop: light ${(hs('light') / 60).toFixed(3)} s, heavy ${(hs('heavy') / 60).toFixed(3)} s, finisher ${(hs('finisher') / 60).toFixed(3)} s (P4h ≤ 0.03; 0.07-0.10)`);
console.log(bad ? `RED: ${bad} failed` : 'all green'); process.exit(bad ? 1 : 0);
