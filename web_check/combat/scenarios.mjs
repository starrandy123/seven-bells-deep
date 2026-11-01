// A stage in open water, foes placed by hand, the camera behind him looking at them.
export const STAGE = () => {
  const G = window.__game, h = G.hero;
  const S = window.__stage = {
    place(x, y, z, yaw) { h.pos.set(x, y, z); h.vel.set(0, 0, 0); h.prev.copy(h.pos); h.drawPos.copy(h.pos); h.heading = yaw; G.camYaw = yaw; G.camPitch = -0.08; h.place && h.place(); if (G.camera) G.camera.position.set(x - Math.sin(yaw) * 6, y + 1.4, z - Math.cos(yaw) * 6); },
    open() {
      // a clear place: deep water near the spawn, nothing to hit within 14 m
      const sp = G.world.data.spawn, c = { x: sp.x, z: -sp.y }; let best = null;
      for (let r = 0; r < 240 && !best; r += 12) for (let a = 0; a < 6.28; a += 0.4) {
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, g = G.world.heightAt(x, -z); if (g > -16 || g < -60) continue;
        let free = true; for (let k = 0; k < 8; k++) { const q = { x: x + Math.cos(k * 0.785) * 12, y: -(z + Math.sin(k * 0.785) * 12), z: g + 9 }; if (G.world.collide(q, 2)) { free = false; break; } }
        if (free) { best = { x, y: g + 9, z, g }; break; }
      }
      return best;
    },
    ahead(d, side = 0, up = 0) { const s = Math.sin(h.heading), c = Math.cos(h.heading); return new h.pos.constructor(h.pos.x + s * d + c * side, h.pos.y + up, h.pos.z + c * d - s * side); },
    foe(kind, d, side = 0, up = 0) { return G.enemies.spawn(kind, S.ahead(d, side, up)); },
    script: null, held: {},
    frame(f, press) { if (press) Object.assign(S.held, press); G.bot = { drive(u) { for (const k in S.held) { u[k] = S.held[k]; if (typeof S.held[k] === 'boolean' && k !== 'boost') delete S.held[k]; } } }; G.frame(1 / 60); },
  };
};
const P = (list) => { const o = {}; for (const [f, v] of list) o[f] = v; return o; };
const presses = (fr, k = 'atk') => fr.map((f) => [f, { [k]: true }]);
export const scenarios = {
  chain: {
    setup: () => { const S = window.__stage, G = window.__game, p = S.open(); S.place(p.x, p.y, p.z, 0.6); S.foe('reaver', 5, 0.6, 0.2); S.foe('reaver', 7, -2.2, 0.5); G.hero.hp = G.hero.maxHp = 400; },
    frames: 96, press: P(presses([12, 36, 60])), from: 8, tile: '6x5',
  },
};

const pressAll = (list) => { const o = {}; for (const [f, v] of list) o[f] = { ...(o[f] || {}), ...v }; return o; };
scenarios.powers = {
  setup: () => { const S = window.__stage, G = window.__game, p = S.open(); S.place(p.x, p.y, p.z, 0.6); G.hero.hp = G.hero.maxHp = 900; G.hero.tide = G.hero.maxTide = 900; S.foe('reaver', 11, 1, 0.5); S.foe('reaver', 13, -3, 0.2); S.foe('reaver', 14, 3, 0.2); for (const e of G.enemies.alive()) { e.hp = e.maxHp = 900; e.t = 9; } G.enemies.alive = ((a) => () => { const l = a(); for (const e of l) if (e.state === 'circle' || e.state === 'swimTo') { e.t = 9; } return l; })(G.enemies.alive); },
  frames: 330, tile: '8x5', from: 6,
  press: pressAll([[10, { atk: true }], [70, { dash: true }], [130, { spin: true }], [230, { wave: true }], [290, { p4: true }]]),
};
scenarios.ice = {
  setup: () => { const S = window.__stage, G = window.__game, p = S.open(); S.place(p.x, p.y, p.z, 0.6); G.hero.hp = G.hero.maxHp = 900; G.hero.tide = G.hero.maxTide = 900; G.combat.setStance('ice', true); S.foe('reaver', 9, 1, 0.5); S.foe('reaver', 12, -3, 0.2); S.foe('reaver', 13, 3, 0.2); for (const e of G.enemies.alive()) { e.hp = e.maxHp = 900; e.t = 9; } },
  frames: 300, tile: '8x5', from: 6,
  press: pressAll([[10, { dash: true }], [80, { spin: true }], [170, { wave: true }]]),
};

scenarios.boss = {
  setup: () => { const S = window.__stage, G = window.__game, h = G.hero, a = G.world.data.arena; h.hp = h.maxHp = 900; h.tide = h.maxTide = 900; S.place(a.x, a.z + 6, -a.y + 16, Math.PI); for (let i = 0; i < 4; i++) G.frame(1 / 60); G.boss.wake(); S.camHold = true; },
  frames: 420, tile: '6x5', from: 30, press: {},
};

scenarios.jaw = {
  setup: () => { const S = window.__stage, G = window.__game, h = G.hero, a = G.world.data.arena; h.hp = h.maxHp = 9000; h.tide = h.maxTide = 900; S.place(a.x, a.z + 6, -a.y + 16, Math.PI); for (let i = 0; i < 4; i++) G.frame(1 / 60); G.boss.wake(); const b = G.boss, v = new h.pos.constructor(); G.quest.cineOn = () => false; for (let i = 0; i < 200; i++) G.frame(1 / 60); G.filmCam = () => { v.crossVectors(b.facing, { x: 0, y: 1, z: 0 }).normalize(); G.camera.position.copy(b.head).addScaledVector(v, 11).addScaledVector(b.facing, 5); G.camera.position.y += 1.2; G.camera.lookAt(b.head.x + b.facing.x * -2, b.head.y + b.facing.y * -2, b.head.z + b.facing.z * -2); }; b.mode = 'circle'; b.t = 0.3; b.phase = 1; },
  frames: 130, tile: '6x4', from: 0, press: {}, nthOverride: 4,
};
scenarios.wave = {
  setup: () => { const S = window.__stage, G = window.__game, p = S.open(); S.place(p.x, p.y, p.z, 0.6); G.hero.hp = G.hero.maxHp = 900; G.hero.tide = G.hero.maxTide = 900; for (const [d, s] of [[12, 1], [15, -3], [17, 3]]) { const e = S.foe('reaver', d, s, 0.5); e.hp = e.maxHp = 9000; e.state = 'stun'; e.t = 9; } },
  frames: 90, tile: '6x4', from: 12, press: P([[10, { wave: true }]]),
};

import fs from 'fs';
export const SHOTS = JSON.parse(fs.readFileSync(new URL('./cine_bosses.json', import.meta.url), 'utf8'));
const introShot = (id) => ({
  setup: new Function(`const S = window.__stage, G = window.__game, h = G.hero, a = G.world.data.arena, sh = ${JSON.stringify(SHOTS['boss_' + id])}; h.hp = h.maxHp = 9000; const p = '${id}' === 'leviathan' ? { x: a.x, y: a.z + 14, z: -a.y - 6 } : S.open(); S.place(p.x, p.y, p.z, 0.6); for (let i = 0; i < 4; i++) G.frame(1 / 60); const b = G.bosses.${id}; b.dead = false; b.wake(); G.cine.play('intro', { shots: sh, focus: () => b.frame, bearing: b.bearing(), film: true, done: () => {} }); h.cine(true);`),
  frames: 400, tile: '6x4', from: 0, press: {},
});
for (const id of ['kraken', 'wyrm', 'colossus', 'leviathan']) scenarios['intro_' + id] = introShot(id);
const bossShot = (id) => ({
  setup: new Function(`const S = window.__stage, G = window.__game, h = G.hero, p = S.open(); h.hp = h.maxHp = 9000; h.tide = h.maxTide = 900; S.place(p.x, p.y, p.z, 0.6); for (let i = 0; i < 4; i++) G.frame(1 / 60); G.quest.cineOn = () => false; G.bosses.${id}.wake(); for (let i = 0; i < 170; i++) G.frame(1 / 60);`),
  frames: 220, tile: '6x4', from: 0, press: {},
});
scenarios.kraken = bossShot('kraken');
scenarios.colossus = bossShot('colossus');
scenarios.wyrm = bossShot('wyrm');

// the song, from close on a school, and the whale, the cast and the two read foes
scenarios.song = {
  setup: () => { const S = window.__stage, G = window.__game, h = G.hero, L = G.life; h.hp = h.maxHp = 900; h.tide = h.maxTide = 900; let best = null, bd = 1e9; const sp = S.open(); for (const s of L.schools) { const p = L.schoolPos(s), g = G.world.heightAt(p.x + 16, -p.z); if (g > -9) continue; const d = p.distanceTo(sp); if (d < bd) { bd = d; best = p.clone(); } } const g = G.world.heightAt(best.x + 16, -best.z); S.place(best.x + 16, Math.max(g + 5, Math.min(best.y, -3)), best.z, -Math.PI / 2); for (const k of ['manta', 'turtle', 'reef_shark']) G.quest.collect.logged[k] = 1; },
  frames: 330, tile: '6x4', from: 0, press: P([[8, { call: true, callHeld: 1 }], [44, { callHeld: 0 }]]),
};
scenarios.breach = {
  setup: () => { const S = window.__stage, G = window.__game, h = G.hero, p = S.open(); h.hp = h.maxHp = 900; h.tide = h.maxTide = 900; G.quest.collect.logged.whale = 1; S.place(p.x, -0.3, p.z, 0.6); G.camPitch = 0.12; for (const [d, s] of [[16, 0], [18, 3], [17, -3]]) { const e = S.foe('reaver', d, s, -1.4); e.hp = e.maxHp = 9000; e.state = 'stun'; e.t = 20; } },
  frames: 360, tile: '6x4', from: 96, press: P([[6, { call: true, callHeld: 1 }], [104, { callHeld: 0 }]]),
};
scenarios.cast = {
  setup: () => { const S = window.__stage, G = window.__game, h = G.hero, p = S.open(); h.hp = h.maxHp = 900; h.tide = h.maxTide = 900; S.place(p.x, p.y, p.z, 0.6); for (const [d, s] of [[12, 1], [20, 6], [9, -5]]) { const e = S.foe('reaver', d, s); e.hp = e.maxHp = 9000; e.state = 'stun'; e.t = 20; } },
  frames: 170, tile: '6x4', from: 4, press: P([[8, { cast: true }], [64, { cast: true }]]),
};
scenarios.duelist = {
  setup: () => { const S = window.__stage, G = window.__game, h = G.hero, p = S.open(); h.hp = h.maxHp = 900; S.place(p.x, p.y, p.z, 0.6); const e = S.foe('duelist', 3.4); e.hp = e.maxHp = 9000; },
  frames: 180, tile: '6x4', from: 6, press: P([[10, { atk: true }], [34, { atk: true }], [62, { atk: true }]]),
};
scenarios.thornback = {
  setup: () => { const S = window.__stage, G = window.__game, h = G.hero, p = S.open(); h.hp = h.maxHp = 900; S.place(p.x, p.y, p.z, 0.6); const e = S.foe('thornback', 5); e.hp = e.maxHp = 9000; e.spine = true; e.spineT = 2.4; e.state = 'circle'; e.t = 9; },
  frames: 130, tile: '6x4', from: 0, press: P([[10, { atk: true }]]),
};
scenarios.rays = {
  setup: () => { const S = window.__stage, G = window.__game, h = G.hero; h.hp = h.maxHp = 900; h.tide = h.maxTide = 900; let spot = null; for (let x = -900; x < 900 && !spot; x += 40) for (let z = -900; z < 900 && !spot; z += 40) { const g = G.world.heightAt(x, -z); if (g < -120 && g > -220) spot = { x, z, g }; } S.place(spot.x, spot.g + 12, spot.z, 0.6); G.quest.collect.logged.manta = 1; const M = G.life.herds.manta.agents[0]; M.pos.set(h.pos.x + 12, h.pos.y + 2, h.pos.z + 10); },
  frames: 260, tile: '6x4', from: 0, press: P([[20, { call: true, callHeld: 1 }], [46, { callHeld: 0 }]]),
};

scenarios.spout = {
  setup: () => { const S = window.__stage, G = window.__game, h = G.hero, p = S.open(); h.hp = h.maxHp = 900; h.tide = h.maxTide = 900; S.place(p.x, -0.5, p.z, 0.6); G.camPitch = -0.02; for (const [d, s] of [[11, 2], [13, -4], [15, 5]]) { const e = S.foe('reaver', d, s, -1); e.hp = e.maxHp = 9000; } },
  frames: 460, tile: '6x5', from: 6, press: P([[12, { jumpHeld: 1 }], [140, { jumpHeld: 0 }]]),
};

scenarios.leap = {
  setup: () => { const S = window.__stage, G = window.__game, h = G.hero, p = S.open(); h.hp = h.maxHp = 900; S.place(p.x, -0.5, p.z, 0.6); G.camPitch = -0.1; h.vel.set(Math.sin(0.6) * 16, 0, Math.cos(0.6) * 16); h.onSplash && 0; window.__sheetAt = () => { const q = new h.pos.constructor(h.pos.x + Math.sin(0.6) * 7, 0.06, h.pos.z + Math.cos(0.6) * 7); G.fx.sheet(q, 3.2); }; },
  frames: 110, tile: '6x4', from: 0, press: {},
};
