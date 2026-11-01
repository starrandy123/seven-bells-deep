// The story as data, read against EPIC.md §5: chapters in order, each with objectives, a place, a fight and a reward; people; side missions;
// challenges; events; collectibles; the four beats of every power; every source with a sink; no forbidden name anywhere; every place a mission
// names read from world.json. No browser: it reads what the frozen copy serves.
//   node web_check/g_data.mjs <base> <engine>
import fs from 'fs';
import { args, ok, done } from './lib_g.mjs';
const { base } = args(), root = base.replace(/index\.html.*$/, '');
const get = async (p) => { const r = await fetch(root + p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
try {
  const [ms, dl, pe, rl, cx, gr, up, ev, ch, ci, wd] = await Promise.all(['missions', 'dialogue', 'people', 'relics', 'codex', 'gear', 'upgrades', 'events', 'challenges', 'cinematics'].map((n) => get(`data/${n}.json`)).concat(get('assets/world.json')));
  const story = ms.story, ORDER = ['Waking', 'The Green Nave', 'The Gilded City', 'Cold Water', 'Fire Below', 'The Long Dark', 'The Sunken Arena', 'Thalor Wakes'];
  ok('G1a', story.map((c) => c.title).join('|') === ORDER.join('|'), story.map((c) => c.title).join(', '));
  const FIGHT = new Set(['defeat', 'boss', 'survive', 'drill', 'waves']);
  const weak = story.slice(0, 7).filter((c) => c.objectives.length < 3 || !c.place || !c.objectives.some((o) => FIGHT.has(o.type)) || !Object.keys(c.reward || {}).length).map((c) => c.id);
  ok('G1b', !weak.length, weak.length ? `short of 3 objectives, a place, a fight or a reward: ${weak}` : `all 7 chapters hold at least 3 objectives (fewest ${Math.min(...story.slice(0, 7).map((c) => c.objectives.length))}), a place, a fight, a reward`);

  const people = pe.people, speakers = new Set(Object.values(dl).flat().map((l) => l[0])), known = new Set([...people.map((p) => p.id), ...Object.keys(pe.extra || {})]);
  const lost = [...speakers].filter((s) => !known.has(s));
  const noPic = people.filter((p) => !p.portrait || !p.name || !p.role).map((p) => p.id);
  ok('G2a', people.length >= 8 && !lost.length && !noPic.length, `${people.length} named people (at least 8), each with a portrait and a role${lost.length ? `; speakers with no person: ${lost}` : ''}${noPic.length ? `; no portrait: ${noPic}` : ''}`);
  const long = Object.entries(dl).flatMap(([k, v]) => v.filter((l) => l[1].length > 170).map(() => k));
  ok('G2c', !long.length, long.length ? `dialogue lines over 170 characters: ${[...new Set(long)]}` : 'every dialogue line fits the phone box (170 characters, ours)');

  const side = ms.side, need = { nets: /Net/, divers: /Diver/, whale: /Whale/, bell: /Bell/, lighthouse: /Lighthouse/, treasure: /Chart|Treasure/ }, missSide = Object.keys(need).filter((k) => !side.some((m) => need[k].test(m.title)));
  ok('G3a', side.length >= 12 && !missSide.length, `${side.length} side missions (at least 12); named kinds ${missSide.length ? 'missing: ' + missSide : 'all there'}`);
  const rings = ch.list.filter((c) => c.objectives.some((o) => o.type === 'rings' && !o.surface)).length, surf = ch.list.filter((c) => c.objectives.some((o) => o.type === 'rings' && o.surface)).length, arena = ch.list.filter((c) => c.objectives.some((o) => o.type === 'waves')).length;
  ok('G4a', rings > 0 && surf > 0 && arena > 0, `${rings} ring runs, ${surf} surf runs, ${arena} arena waves`);
  const evNeed = { raid: /Raid/, frenzy: /Frenzy/, migration: /Migration/, bloom: /Bloom/, surge: /Surge/, star: /Star/ }, missEv = Object.keys(evNeed).filter((k) => !ev.list.some((e) => evNeed[k].test(e.title)));
  const unpaid = ev.list.filter((e) => !e.reward || !e.text || !e.dur).map((e) => e.id);
  ok('G5b', ev.list.length >= 6 && !missEv.length && !unpaid.length, `${ev.list.length} events (at least 6), each announced, timed and rewarded${missEv.length ? '; missing ' + missEv : ''}${unpaid.length ? '; unpaid ' + unpaid : ''}`);
  ok('G6b', rl.list.length === 20 && new Set(rl.list.map((r) => r.id)).size === 20, `${rl.list.length} relic tablets, every id its own`);
  ok('G6d', gr.forms.length === 5 && gr.outfits.length >= 3, `${gr.forms.length} trident forms, ${gr.outfits.length} outfits`);

  // G8c: every power taught in four beats, in order through the story
  const beats = {}; let at = 0;
  for (const c of story) for (const o of c.objectives) { at++; for (const b of o.beat ? [o.beat] : o.beats || []) (beats[b[0]] = beats[b[0]] || []).push([b[1], at]); }
  const bad = Object.keys(ms.teach || {}).filter((p) => { const l = beats[p] || []; return l.map((x) => x[0]).join() !== '1,2,3,4' && p !== 'call' || l.some((x, i) => i && x[1] < l[i - 1][1]); });
  ok('G8c', !bad.length && Object.keys(ms.teach || {}).length >= 8, bad.length ? `powers out of order or short of four beats: ${bad.map((p) => `${p} [${(beats[p] || []).map((x) => x[0])}]`)}` : `${Object.keys(beats).length} powers, each taught in order: ${Object.entries(beats).map(([p, l]) => `${p} ${l.length}`).join(', ')} (the Call of the Deep has three; a judge reads the rest)`);
  const words = (ms.onboard || []).flatMap((s) => [s.touch, s.keys]).filter(Boolean), wordy = words.filter((t) => t.split(/\s+/).length > 12);
  ok('G8w', !wordy.length && (ms.onboard || []).length >= 3, `${(ms.onboard || []).length} onboarding steps, longest ${Math.max(...words.map((t) => t.split(/\s+/).length))} words (at most 12)`);

  // every source has a sink
  let earned = (wd.pearls || []).length + (wd.chests || []).length * 3;
  for (const m of [...story, ...side]) earned += (m.reward && m.reward.pearls) || 0;
  const tracks = up.list.length, sink = tracks * up.cost.reduce((a, c) => a + c.pearls, 0), tabletSink = tracks * up.cost.reduce((a, c) => a + (c.relics || 0), 0);
  ok('G6s', sink >= earned && tabletSink > 0 && tabletSink <= rl.list.length, `pearls: ${earned} to find once, ${sink} to spend, and events and runs pay on top; tablets: ${rl.list.length} to find, ${tabletSink} to lay at shrines`);

  // C1: a shot list for the opening, each bell, each boss and the ending
  const needCine = ['opening', 'ending', ...Object.keys(ms.bells).map((b) => `bell_${b}`), 'boss_leviathan', 'boss_wyrm', 'boss_colossus', 'boss_kraken'], noCine = needCine.filter((k) => !ci[k] || !ci[k].length);
  ok('C1e', !noCine.length, noCine.length ? `no shot list: ${noCine}` : `${needCine.length} shot lists: the opening, ${Object.keys(ms.bells).length} bells, 4 bosses, the ending`);

  // names: nothing of DC's, nothing famous, no studio
  const FORBID = /\b(aquaman|atlantis|atlantean|arthur curry|black manta|mera|orm|nereus|vulko|xebel|justice league|dc comics|the trench|ghibli|shinkai|miyazaki|nintendo|disney)\b/i;
  const texts = await Promise.all(['index.html', 'js/stack.js', 'js/ui.js', 'js/screens.js', 'js/quest.js', 'js/missions.js', 'data/missions.json', 'data/dialogue.json', 'data/people.json', 'data/relics.json', 'data/codex.json', 'data/gear.json', 'data/events.json', 'data/challenges.json', 'data/upgrades.json', 'data/cinematics.json'].map(async (p) => [p, await (await fetch(root + p)).text()]));
  const hits = texts.map(([p, t]) => { const m = FORBID.exec(t); return m ? `${p}: "${m[0]}"` : null; }).filter(Boolean);
  ok('G2b', !hits.length, hits.length ? hits.join(' · ') : `no forbidden name in ${texts.length} files`);
  // S2: every person's name and the title carry a dated search, and the register stays named as owed until a person has read it
  const rec = JSON.parse(fs.readFileSync(new URL('./names_searched.json', import.meta.url), 'utf8')), cfg = await (await fetch(root + 'js/config.js')).text(), title = (cfg.match(/TITLE\s*=\s*['"]([^'"]+)/) || [])[1];
  const noRow = pe.people.map((p) => p.name.replace(/^(Captain|Bosun) /, '')).filter((n) => !rec.people.includes(n)), row = rec.titles.find((t) => t.name === title), STORES = ['steam', 'appstore', 'googleplay', 'itch', 'poki', 'crazygames', 'roblox'];
  ok('S2b', !noRow.length, noRow.length ? `no search written down for: ${noRow.join(', ')}` : `all ${pe.people.length} people's names have a search dated ${rec.searched_on}`);
  ok('S2a', !!rec.searched_on && !!row && STORES.every((k) => row[k]) && !!row.web, `the title "${title}": seven stores and the web searched ${rec.searched_on}; the trademark register: ${rec.register.status}`);

  // places: every first choice a mission names is in world.json. A fallback plays, and this names what the world still owes
  const have = new Set([...(wd.poi || []).map((p) => p.id), ...(wd.land || []).map((p) => p.id)]), asked = new Set();
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const k in v) { const x = v[k]; if (['at', 'to', 'from', 'around', 'poi', 'start'].includes(k) && typeof x === 'string') asked.add(x.split('|')[0]); else walk(x); } };
  walk([story, side, rl, pe, ev, ch, ms.bells]);
  const owed = [...asked].filter((x) => !have.has(x)).sort();
  ok('G1p', !owed.length, owed.length ? `the world still owes ${owed.length} of ${asked.size} places (each plays on a fallback): ${owed.join(' ')}` : `all ${asked.size} places a mission names are in world.json`);
} catch (e) { ok('G1a', false, 'the run did not finish: ' + e.message); }
done();
