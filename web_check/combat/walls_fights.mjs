// P10: every fight, at three skills, pressing only what a player can press. The novice never parries: a fight must be winnable without it.
//   node walls_fights.mjs [port=8812] [only=regex]
import { rig } from './rig.mjs'; import { STAGE } from './scenarios.mjs';
const [port = '8791', only = '', engine = 'chromium'] = process.argv.slice(2);
const r = await rig({ port: +port, tier: 'phone', limit: 175, engine }); await r.page.evaluate(STAGE);
await r.page.evaluate(async () => {
  const G = window.__game, S = window.__stage, h = G.hero, m = await import('/js/combat_bot.js'); S.spot = S.open(); let seed = 5; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  S.fight = (list, level, maxS) => {
    G.enemies.clearAll(); G.combat.reset(); S.place(S.spot.x, S.spot.y, S.spot.z, 0.6); h.maxHp = 100; h.hp = 100; h.maxTide = 100; h.tide = 60; h.state = 'swim'; h.dead = false; h.inv = 0; G.hitstop = 0; G.combat.setStance('water', true); h.boostFuel = 1;
    G.quest.onDeath = () => {}; G.quest.spareFirstFight = () => false;
    list.forEach((k, i) => S.foe(k, 9 + i * 1.5, (i % 2 ? 1 : -1) * (1 + i), 0.3));
    const bot = m.createFighter(G, level); G.bot = bot; S.frame = (f, p) => { G.frame(1 / 60); };
    let t = 0, deaths = 0, low = 100, dmg = 0, last = h.hp;
    while (t < maxS) {
      G.frame(1 / 60); t += 1 / 60; low = Math.min(low, h.hp); if (h.hp < last) dmg += last - h.hp; last = h.hp;
      if (h.dead) { deaths++; h.respawn(new h.pos.constructor(S.spot.x, S.spot.y, S.spot.z), 0.6); h.place && h.place(); h.hp = last = 100; h.tide = 60; }
      if (G.enemies.count() === 0) return { won: true, t, deaths, low, dmg };
    }
    return { won: false, t, deaths, low, dmg, left: G.enemies.count(), states: G.enemies.all().filter((e) => e.hp > 0).map((e) => e.kind + ':' + e.state + ':' + e.hp.toFixed(0) + ':' + e.pos.distanceTo(h.pos).toFixed(0) + (e.hidden ? ':hidden' : '') + ':t' + e.t.toFixed(1) + ':hold' + e.hold).join(' ') };
  };
});
const FIGHTS = [['a Duelist', ['duelist']], ['two Thornbacks', ['thornback', 'thornback']], ['a Duelist and an Archer', ['duelist', 'archer']], ['three Reavers', ['reaver', 'reaver', 'reaver']], ['two sharks', ['shark', 'shark']], ['a Captain and his guard', ['captain', 'reaver']], ['Archers', ['archer', 'archer', 'reaver']], ['a Hammerhead pair', ['hammerhead', 'hammerhead']], ['a mixed crew', ['captain', 'archer', 'reaver', 'shark']], ['morays', ['moray', 'moray']], ['an Anglerfish', ['anglerfish', 'reaver']], ['a Giant Crab', ['giant_crab']], ['a Siren and guard', ['siren', 'reaver']], ['Frost Wights', ['frost_wight', 'frost_wight']], ['Magma Husks', ['magma_husk', 'magma_husk']]];
let bad = 0; const re = only ? new RegExp(only) : null;
// each boss, by the same three: its three phases reached, every blow of it told
for (const [bossId, label] of [['leviathan', 'the Leviathan'], ['wyrm', 'the Frost Wyrm'], ['kraken', 'the Kraken'], ['colossus', 'the Cinder Colossus']]) { if (re && !re.test(label)) continue;
  await r.page.evaluate(() => { const S = window.__stage, G = window.__game, h = G.hero, m = S; S.leviathan = async (level, id) => {
    const mod = await import('/js/combat_bot.js'), b = G.bosses[id], arena = id === 'leviathan', a = arena ? G.world.data.arena : { x: S.spot.x, z: S.spot.y, y: -S.spot.z }; G.enemies.clearAll(); G.combat.reset(); if (G.boss.active) G.boss.stop(); b.stop(); b.dead = false; b.hp = b.maxHp; G.quest.onDeath = () => {}; G.quest.spareFirstFight = () => false; G.quest.onBossDead = () => {}; h.maxHp = h.hp = 140; h.maxTide = 100; h.tide = 100; h.dead = false; h.state = 'swim'; G.combat.setStance('water', true); S.place(a.x, a.z + 6, -a.y + 14, Math.PI); G.bot = mod.createFighter(G, level); b.wake(); let t = 0, deaths = 0, hurt = 0, last = h.hp; const phases = new Set(); let tells = 0, least = 9; const open = {};
    while (t < 150 && !b.dead) { G.frame(1 / 60); t += 1 / 60; phases.add(b.phase); if (h.hp < last) hurt += last - h.hp; last = h.hp; if (h.dead) { deaths++; h.respawn(new h.pos.constructor(a.x, a.z + 6, -a.y + 14), Math.PI); h.place && h.place(); h.hp = last = 140; h.tide = 100; } for (const l of G.combat.log) { if (l.foe !== id || l._s) continue; l._s = 1; if (l.type === 'tell') { open.t = l.t; tells++; } if (l.type === 'contact' && open.t !== undefined) { least = Math.min(least, l.t - open.t); } } }
    const won = b.dead; for (let i = 0; i < 30; i++) G.frame(1 / 60); return { won, t, deaths, hurt, phases: [...phases].length, tells, least, hp: b.hp }; }; });
  const row = []; let ok = true;
  for (const level of ['novice', 'casual', 'expert']) { const a = await r.page.evaluate(([lv, id]) => window.__stage.leviathan(lv, id), [level, bossId]); row.push(`${level} ${a.won ? a.t.toFixed(0) + ' s' : 'LOST at ' + a.hp.toFixed(0)}, ${a.deaths} deaths, phases ${a.phases}, ${a.tells} tells${a.least < 9 ? ', least ' + a.least.toFixed(2) + ' s' : ''}`); if (!a.won || a.phases < 3 || a.deaths > 3 || a.least < 0.5) ok = false; }
  console.log((ok ? '✔ ' : '✖ ') + label + ': ' + row.join(' · ') + ' (won by all three, 3 phases, every blow told ≥ 0.5 s)'); if (!ok) bad++;
}
for (const [name, list] of FIGHTS) {
  if (re && !re.test(name)) continue;
  const row = []; let ok = true, note = '';
  for (const level of ['novice', 'casual', 'expert']) {
    const a = await r.page.evaluate(([l, lv]) => window.__stage.fight(l, lv, 75), [list, level]);
    row.push(`${level} ${a.won ? a.t.toFixed(0) + ' s' : 'LOST'}, ${a.deaths} deaths, ${a.dmg.toFixed(0)} hurt`); if (!a.won) { ok = false; note = ' [' + (a.states || '') + ']'; } if (level === 'expert' && a.deaths > 0) ok = false; if (a.deaths > 2) ok = false;
  }
  console.log((ok ? '✔ ' : '✖ ') + name + ': ' + row.join(' · ') + note + ' (won by all three; a novice dies at most twice; an expert never)'); if (!ok) bad++;
}
// what a read is worth: holding Strike against the foes that punish it, against an expert in the same fight
if (!re || re.test('reads')) for (const [name, list] of [['a Duelist', ['duelist']], ['a Thornback', ['thornback']]]) {
  const a = await r.page.evaluate(([l]) => window.__stage.fight(l, 'expert', 75), [list]), b = await r.page.evaluate(([l]) => window.__stage.fight(l, 'masher', 75), [list]), ok = b.dmg >= Math.max(a.dmg * 2, 12);
  console.log((ok ? '✔ ' : '✖ ') + `reads: ${name} punishes a masher: ${b.dmg.toFixed(0)} hurt in ${b.t.toFixed(0)} s, an expert ${a.dmg.toFixed(0)} in ${a.t.toFixed(0)} s (twice as much, 12 at least)`); if (!ok) bad++;
}
const errs = [...new Set(r.errors)]; if (errs.length) { console.log('✖ page errors: ' + errs.slice(0, 5).join(' | ').slice(0, 700)); bad++; }
console.log(bad ? `RED: ${bad} failed` : 'all green'); await r.close(); process.exit(bad ? 1 : 0);
