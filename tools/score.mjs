// A round's score: reads runs/<n>/gate/*.json (every wall in each engine), says what holds per checkpoint, and writes the Status column of web_check/CHECKPOINT_MAP.md.
//   node tools/score.mjs <n>
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), n = process.argv[2], G = path.join(ROOT, 'runs', n, 'gate');
const rows = [];
// the 34 checkpoints live in these files; EPIC's own IDs (C1 the cinematics, G1 the story, M, P, W, T, L) come from the other owners' files and are counted apart
const OURS = new Set(['load', 'collide', 'drawn', 'play', 'rates', 'perf', 'pace', 'turned', 'lowpower', 'input', 'ui', 'focus', 'contrast', 'motion', 'state', 'weigh', 'first', 'soak', 'cold', 'lag', 'static', 'judged']); const others = [];
// a wall that writes no json (the g_*.mjs walls): its PASS and FAIL lines are read from its text
for (const f of fs.readdirSync(G).filter((x) => /_(chromium|webkit)\.txt$/.test(x))) { const stem = f.replace(/\.txt$/, ''); if (fs.existsSync(path.join(G, stem + '.json')) || /^(move_walls)_/.test(f)) continue; const [, name, engine] = /^(.*)_(chromium|webkit)$/.exec(stem); for (const l of fs.readFileSync(path.join(G, f), 'utf8').split('\n')) { const q = /^(PASS|FAIL) (\S+) (.*)$/.exec(l); if (q) others.push({ wall: name, engine, id: q[2], pass: q[1] === 'PASS', what: q[3] }); } }
for (const f of fs.readdirSync(G).filter((x) => /_(chromium|webkit)\.json$/.test(x))) { try { const j = JSON.parse(fs.readFileSync(path.join(G, f))); if (!j.results || !j.engine) continue; for (const r of j.results) (OURS.has(j.name) ? rows : others).push({ wall: j.name, engine: j.engine, ...r }); } catch (e) { /* a wall's other json */ } }
const cp = (id) => { if (/^J[345]/.test(id)) return 'A5'; const m = /^([A-G]\d)/.exec(id); return m ? m[1] : 'other'; };     // J3, J3c, J4, J5: the camera, born from the judge's clips
const by = new Map(); for (const r of rows) { const k = cp(r.id); if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
const P = rows.filter((r) => r.pass).length, F = rows.length - P; console.log(`SCORE round ${n}: ${P} of ${rows.length} lines pass across both engines; ${F} fail`);
const walls = [...new Set(rows.filter((r) => !r.pass).map((r) => `${r.id}/${r.engine}`))];
for (const k of [...by.keys()].sort()) { const l = by.get(k), bad = l.filter((r) => !r.pass); if (bad.length) { const ids = [...new Set(bad.map((r) => r.id))]; console.log(`  QS-${k}: ${l.length - bad.length} of ${l.length}; failing ${ids.map((i) => `${i} (${[...new Set(bad.filter((r) => r.id === i).map((r) => r.engine))].join('+')})`).join(' ')}`); } }
if (others.length) { const bad = others.filter((r) => !r.pass); console.log(`OTHERS: ${others.length - bad.length} of ${others.length} lines pass in the other owners' walls${bad.length ? '; failing: ' + [...new Set(bad.map((r) => `${r.wall}/${r.id}`))].join(' ') : ''}`); }
// CR-22: the room under Q5's line, against the round before: flag it when it narrows
{ const roomOf = (r) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'runs', String(r), 'gate', 'weigh_room_chromium.json'))).room; } catch (e) { return null; } }, now = roomOf(n); let was = null, at = null; for (let r = +n - 1; r > 0 && was === null; r--) { was = roomOf(r); at = r; } if (now !== null) console.log(`Q5 ROOM ${now.toFixed(1)} MB under 96 (the tally plus the collected heap, CR-22; a definition chosen, a real iPhone owed)${was !== null ? `; round ${at} had ${was.toFixed(1)}${now < was - 0.5 ? ': **NARROWED**' : ''}` : ''}`); }
// the map's Status column
const mapF = path.join(ROOT, 'web_check', 'CHECKPOINT_MAP.md');
if (fs.existsSync(mapF)) {
  const out = fs.readFileSync(mapF, 'utf8').split('\n').map((line) => { const m = /^\| (?:QS-)?([A-G]\d) \|/.exec(line); if (!m) return line; const cells = line.split('|'); const l = by.get(m[1]); if (!l) return line; const bad = l.filter((r) => !r.pass), both = new Set(l.map((r) => r.engine)).size === 2, st = bad.length ? `**FAIL** r${n}: ${[...new Set(bad.map((r) => r.id))].join(' ')}` : `pass r${n}${both ? '' : ' (one engine)'}`; cells[cells.length - 2] = ` ${st} `; return cells.join('|'); });
  fs.writeFileSync(mapF, out.join('\n'));
}
