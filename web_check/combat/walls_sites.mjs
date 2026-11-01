// Every fight at its own place on the real map: each encounter woken where it stands, fought at three skills, and each boss at the place its mission wakes it. A site a map change walled in, or a foe
// that can't be reached, shows here and nowhere else: walls_fights.mjs fights on a clear stage by the spawn.     node walls_sites.mjs [port=8812] [only=regex] [engine]
import { rig } from './rig.mjs'; import { STAGE } from './scenarios.mjs';
const [port = '8791', only = '', engine = 'chromium', difficulty = 'normal'] = process.argv.slice(2);
const r = await rig({ port: +port, tier: 'phone', limit: 178, engine }); await r.page.evaluate(STAGE);
await r.page.evaluate((d) => { window.__game.settings.difficulty = d; }, difficulty);
await r.page.evaluate(async () => {
  const G = window.__game, S = window.__stage, h = G.hero, m = await import('/js/combat_bot.js'), H = (x, z) => G.world.heightAt(x, -z); let seed = 5; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  G.quest.isRung = () => false; G.enemies.opened = 9; G.quest.onDeath = () => {}; G.quest.spareFirstFight = () => false; S.encs = G.enemies.encounters.map((e) => e.id);
  const stand = (x, y, z, yaw) => { const g = H(x, z), p = { x, y: -z, z: Math.max(y, g + 1.4) }; G.world.collide(p, 0.6); S.place(p.x, p.z, -p.y, yaw); };
  const fresh = () => { G.enemies.clearAll(); G.combat.reset(); for (const q of G.enemies.encounters) { q.cleared = true; q.state = 'idle'; q.list.length = 0; } h.maxHp = 100; h.hp = 100; h.maxTide = 100; h.tide = 60; h.state = 'swim'; h.dead = false; h.inv = 0; G.hitstop = 0; G.combat.setStance('water', true); h.boostFuel = 1; };
  S.site = (id, level, maxS) => {
    fresh(); if (G.boss.active) G.boss.stop(); const enc = G.enemies.encounters.find((e) => e.id === id), c = enc.c; enc.cleared = false; enc.cool = 0; stand(c.x, c.y, c.z, 0.6); if (enc.land) { h.pos.y = H(c.x, c.z) + 0.92; h.land = true; h.air = false; h.grounded = true; } const from = h.pos.clone(); G.bot = m.createFighter(G, level);
    let t = 0, deaths = 0, dmg = 0, last = h.hp, woke = 0, onLand = 0, n = 0, cast = '';
    while (t < maxS) {
      G.frame(1 / 60); t += 1 / 60; if (enc.list.length > woke) { woke = enc.list.length; cast = enc.list.map((e) => e.kind).join(' '); } if (h.hp < last) dmg += last - h.hp; last = h.hp; for (const e of enc.list) { n++; if (e.onLand) onLand++; }
      if (h.dead) { deaths++; h.respawn(from.clone(), 0.6); h.place && h.place(); if (enc.land) { h.pos.copy(from); h.land = true; h.air = false; h.grounded = true; } h.hp = last = 100; h.tide = 60; }
      if (woke && enc.state !== 'awake') return { won: true, t, deaths, dmg, woke, cast, land: onLand / Math.max(n, 1) };
    }
    return { won: false, t, deaths, dmg, woke, left: enc.list.map((e) => `${e.kind}:${e.state}:${e.hp.toFixed(0)}:${e.pos.distanceTo(h.pos).toFixed(0)}m${e.hidden ? ':hidden' : ''}`).join(' ') };
  };
  S.bossAt = (id, at, level, maxS) => {
    fresh(); for (const k in G.bosses) G.bosses[k].stop && G.bosses[k].stop(); const b = G.bosses[id], W = G.world.data; let x, y, z;
    if (at === 'arena') { const a = W.arena; x = a.x; z = -a.y - 6; y = a.z + 14; } else { const p = at.split('|').map((n) => W.poi.find((q) => q.id === n)).find(Boolean); if (!p) return { won: false, why: 'no place ' + at }; x = p.x; z = -p.y; y = p.z; }
    stand(x, y, z, Math.PI); b.dead = false; b.hp = b.maxHp; if (b.arms) for (const q of b.arms) { q.gone = false; if (q.hp !== undefined) q.hp = G.combat.data.bosses[id].arm_hp; } const from = h.pos.clone(); b.wake(); G.bot = m.createFighter(G, level); let t = 0, deaths = 0, last = h.hp, hurt = 0;
    while (t < maxS && !b.dead) { G.frame(1 / 60); t += 1 / 60; if (h.hp < last) hurt += last - h.hp; last = h.hp; if (h.dead) { deaths++; h.respawn(from.clone(), 0.6); h.place && h.place(); h.hp = last = 100; h.tide = 60; } }
    const won = b.dead; for (let i = 0; i < 30; i++) G.frame(1 / 60); b.stop(); return { won, t, deaths, hurt, hp: b.hp, where: `${from.x.toFixed(0)},${from.y.toFixed(0)},${from.z.toFixed(0)}` };
  };
});
let bad = 0; const re = only ? new RegExp(only) : null; const ids = await r.page.evaluate(() => window.__stage.encs); let best = 1e9, worst = 0; const times = [];
for (const id of ids) {
  if (re && !re.test(id)) continue; const row = []; let ok = true, note = '';
  for (const level of ['novice', 'casual', 'expert']) { const a = await r.page.evaluate(([i, l]) => window.__stage.site(i, l, 90), [id, level]); row.push(`${level[0]} ${a.won ? a.t.toFixed(0) + ' s' : 'LOST'}${a.deaths ? ' ' + a.deaths + 'd' : ''}`); if (!a.won) { ok = false; note = ` [${a.woke} woke; ${a.left}]`; } if (a.won) { best = Math.min(best, a.t); worst = Math.max(worst, a.t); } if (level === 'expert' && a.deaths) ok = false; if (a.deaths > 3) ok = false; if (level === 'expert' && a.won) { row.push(`${a.cast}${a.land ? ' ' + (a.land * 100).toFixed(0) + '% on land' : ''}`); times.push(a.t); } }
  console.log((ok ? '✔ ' : '✖ ') + `[wall_fights] ${id}: ` + row.join(' · ') + note); if (!ok) bad++;
}
for (const [id, at] of [['wyrm', 'rime_shrine|rimehold|open_blue'], ['colossus', 'cinder_shrine|cindermere|wreck'], ['kraken', 'kraken_lair|wrackreach|wreck'], ['leviathan', 'arena']]) {
  if (re && !re.test(id)) continue; const row = []; let ok = true;
  for (const level of ['novice', 'casual', 'expert']) { const a = await r.page.evaluate(([i, p, l]) => window.__stage.bossAt(i, p, l, 140), [id, at, level]); row.push(`${level[0]} ${a.won ? a.t.toFixed(0) + ' s' : 'LOST at ' + (a.hp === undefined ? a.why : a.hp.toFixed(0))}${a.deaths ? ' ' + a.deaths + 'd' : ''}`); if (!a.won) ok = false; if (a.where) row[row.length - 1] += ` (${a.where})`; }
  console.log((ok ? '✔ ' : '✖ ') + `[wall_fights] boss ${id} at its place: ` + row.join(' · ')); if (!ok) bad++;
}
const errs = [...new Set(r.errors)]; if (errs.length) { console.log('✖ page errors: ' + errs.slice(0, 5).join(' | ').slice(0, 700)); bad++; }
times.sort((a, b) => a - b); console.log(`fights took ${best.toFixed(0)}-${worst.toFixed(0)} s; an expert's ${times[0] ? times[0].toFixed(0) : '?'}-${times.length ? times[times.length - 1].toFixed(0) : '?'} s, median ${times.length ? times[times.length >> 1].toFixed(0) : '?'}`); console.log(`${difficulty}: ` + (bad ? `RED: ${bad} failed` : 'all green')); await r.close(); process.exit(bad ? 1 : 0);
