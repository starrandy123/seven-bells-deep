// The Warden's blows and powers: what a press does, the frame rules of every move, hits, damage taken and given. hero.js moves him; this decides
// what he does. Every number is in data/combat.json; the rules that need no page are in combat_core.js, so the walls can step them in Node.
import * as THREE from 'three';
import { CLASS, accepts, audit, clamp, createBuffer, inFrames, resolve, wrap } from './combat_core.js';
import { createPowers } from './powers.js';
import { first } from './formulas/follow.js';

const damp = (cur, tgt, k, dt) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));
const FPS = 60, UP = new THREE.Vector3(0, 1, 0);
const SLOT_COOL = ['dash', 'spin', 'wave', 'p4'];    // the HUD's cooldown keys, slot by slot

export function createCombat(G, h, api) {
  let D = null, buf = null, now = 0, cur = null, last = null, lastEnd = -999, stance = 'water', swapT = 0, hurtF = 0, seenT = -1, wasBoost = false, lastDodge = -999, P = null, sigT = 0, sigWas = '', charge = null, jumpIsHeld = false, spoutHold = 0, splashTied = false;
  const win = { dodge: 0, parry: 0, perfect: 0 }, cool = {}, taught = {}, upgrades = {}, bonus = { hp: 0, td: 0 };
  const to = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), fwd = new THREE.Vector3();
  const LOG = []; const log = (type, o) => { LOG.push({ t: +G.time.toFixed(4), f: G.stats ? G.stats.frames : 0, type, ...o }); if (LOG.length > 2000) LOG.splice(0, 500); };

  h.stance = stance;
  const heroFacing = (out) => out.set(Math.sin(h.heading), 0, Math.cos(h.heading));
  const camDir = (out = new THREE.Vector3()) => out.set(Math.sin(G.camYaw) * Math.cos(G.camPitch), Math.sin(G.camPitch), Math.cos(G.camYaw) * Math.cos(G.camPitch));

  // ------------------------------------------------------------------ the stick, where a press means it
  let stickX = 0, stickY = 0, stickUD = 0;
  function stickDir(out) {
    if (Math.hypot(stickX, stickY) + Math.abs(stickUD) < 0.15) return null;
    const cy = Math.cos(G.camYaw), sy = Math.sin(G.camYaw), onLand = h.land && !h.air, cp = onLand ? 1 : Math.cos(G.camPitch), sp = onLand ? 0 : Math.sin(G.camPitch);
    out.set(sy * cp * stickY - cy * stickX, sp * stickY + (onLand ? 0 : stickUD), cy * cp * stickY + sy * stickX);
    return out.lengthSq() > 1e-4 ? out.normalize() : null;
  }

  // ------------------------------------------------------------------ who a blow is aimed at: the stick's way if pushed, or where the camera looks
  function findTarget(range) {
    const list = G.enemies ? G.enemies.alive() : []; let best = null, score = 1e9;
    const pushed = Math.hypot(stickX, stickY) > 0.3, cy = G.camYaw + (pushed ? Math.atan2(-stickX, stickY) : 0);
    for (const e of list) {
      const dx = e.pos.x - h.pos.x, dy = e.pos.y - h.pos.y, dz = e.pos.z - h.pos.z, d = Math.hypot(dx, dy, dz);
      if (d > range || e.hidden) continue;
      const a = Math.abs(wrap(Math.atan2(dx, dz) - cy)), s = d + a * 6;
      if (s < score) { score = s; best = e; }
    }
    if (G.boss && G.boss.active) { const t = G.boss.lockPoint(h.pos); if (t && t.pos.distanceTo(h.pos) < range && (!best || t.pos.distanceTo(h.pos) < best.pos.distanceTo(h.pos))) best = t; }
    return best;
  }

  const open = (id) => { if (G.sideNow === 'fire') return true; const k = D.unlock[id]; return k === true || k === undefined ? true : !!h.powers[k]; };
  const afford = (id) => !!D.moves[id] && h.tide >= costOf(id);
  const coolOf = (id) => cool[id] || 0;

  // what the fight looks like to a press
  function view() {
    const melee = 4.2, list = G.enemies ? G.enemies.alive() : []; let near = false, far = false, finish = false;
    for (const e of list) {
      const d = e.pos.distanceTo(h.pos), gap = d - (e.r || 0.8);
      if (gap < 7) near = true;
      if (gap < 4.6 && (e.stagger > 0 || e.frozen > 0)) finish = true;
      if (gap > melee + 1 && d < whipRange()) far = true;
    }
    if (near) far = false;
    if (G.boss && G.boss.active) { const t = G.boss.lockPoint(h.pos); if (t) { const d = t.pos.distanceTo(h.pos); if (d < 9) near = true; if (G.boss.stunned > 0 && d < 8) finish = true; } }
    const prev = cur ? cur.def : last && now - lastEnd < D.input.chain_gap_f ? D.moves[last] : null;
    return { stance, air: !!h.air, cur: cur && cur.id, chainNext: prev && prev.chain, win, finish, near, far, open, afford, cool: coolOf };
  }

  // the clip runs at whatever speed puts its contact on the move's first active frame, and its end on the last frame
  const fireMove = (id) => (G.sideNow === 'fire' && D.fire.moves[id]) || null;
  const nameOf = (id) => (G.sideNow === 'fire' && D.fire.names[id]) || D.moves[id].name;
  const rateFor = (d, f) => { const [t0, t1, t2] = d.clip_t, s = f < d.startup && d.startup > 0 ? (t1 - t0) / (d.startup / FPS) : (t2 - t1) / Math.max(1e-3, (d.total - d.startup) / FPS); return Math.max(0.05, s); };

  // ------------------------------------------------------------------ a move starts
  function begin(id) {
    const d = D.moves[id];
    if (cur) { log('cancel', { id: cur.id, at: +cur.f.toFixed(1), into: id }); leave(); }
    const range = id === 'whip' ? whipRange() : d.range_m || (d.lunge_m || 0) + (d.reach || 3) + 2.4;
    const target = d.kind === 'dodge' || d.kind === 'parry' ? null : findTarget(id === 'riptide' ? 24 : Math.max(range, 4));
    cur = { id, def: d, f: 0, hits: new Set(), landed: false, released: false, target, entry: h.vel.clone(), dir: new THREE.Vector3(), action: null, close: 1, swung: false, rehit: 0, wentAir: !!h.air, rising: false, spent: false };
    h.atk = cur; h.next = null; h.state = d.kind === 'parry' ? 'parry' : 'attack'; h.combatT = 0; h.target = target; h.plunge = false;
    log('start', { id, stance });
    if (d.clip) {
      const fm = fireMove(id); cur.timing = fm ? { ...d, clip_t: fm.clip_t } : d;     // the man in red fights with his fists: the same move, its own clip
      api.play(fm ? fm.clip : d.clip_ice && stance === 'ice' ? d.clip_ice : d.clip_land && h.land && !h.air ? d.clip_land : d.clip, d.kind === 'strike' ? 0.05 : 0.07);
      const sh = h.body && h.body.shot;
      if (sh && d.clip_t) { cur.shot = sh; sh.t = cur.timing.clip_t[0]; sh.rate = rateFor(cur.timing, 0) * cur.close; }
    }
    if (d.kind === 'strike' || d.motion === 'dash') startReach(cur);
    if (d.kind === 'dodge') startDodge(cur);
    if (id === 'riptide' && lv('riptide') >= 3) cur.rehitAt = d.startup + d.active / 2;
    if (d.kind === 'parry') { cur.guardEnd = d.guard[1] + (d.freezes && lv('guard') >= 1 ? D.upgrades.guard.window_f : 0); h.parryT = (cur.guardEnd - d.guard[0]) / FPS; G.audio.swing(); G.fx.guard && G.fx.guard(h.pos, stance); }
    if (d.kind === 'power') { P.begin(id, cur); }
    if (id === 'counter' || id === 'riposte') { win.perfect = 0; win.parry = 0; }
    if (id === 'launcher') win.dodge = 0;
  }

  // a blow reaches for its target: far off, he crosses the gap first, and the wind-up lasts as long as the crossing
  function startReach(a) {
    const d = a.def, t = a.target;
    if (!t) { heroFacing(a.dir); return; }
    to.subVectors(t.pos, h.pos); const dist = to.length() || 1, gap = Math.max(0, dist - (t.r || 0.8) - 1.3);
    a.dir.copy(to).multiplyScalar(1 / dist);
    // the fire side doesn't cross the gap: from here on the same blow is thrown at him as a blast. He stands and turns to it
    if (fireMove(a.id) && d.kind === 'strike' && gap > D.fire.melee_m) { a.shotAt = t; a.target = null; h.heading = Math.atan2(a.dir.x, a.dir.z); return; }
    if (d.startup > 0) { const need = (gap / 26) * FPS; a.close = need > d.startup ? d.startup / Math.min(need, d.startup + 18) : 1; if (a.shot) a.shot.rate = rateFor(d, 0) * a.close; }
  }

  function startDodge(a) {
    const d = a.def, onLand = h.land && !h.air;
    const s = stickDir(v1); if (s) a.dir.copy(s);
    else { const t = findTarget(14); if (t) a.dir.subVectors(h.pos, t.pos); else heroFacing(a.dir).negate(); if (onLand) a.dir.y = 0; a.dir.normalize(); }
    win.dodge = d.total + D.input.after_dodge_f; lastDodge = now; h.inv = Math.max(h.inv, 0);
    G.audio.swing(); G.fx.dodge && G.fx.dodge(h.pos, a.dir, stance);
  }

  function leave() {
    const a = cur; last = a.id; lastEnd = now; cur = null; h.atk = null; h.roll = 0; h.tiltGoal = undefined;
    if (a.def.kind === 'power' && P) P.end(a);
  }
  function finish(fade = 0.16) {
    leave();
    if (h.state === 'attack' || h.state === 'parry') h.state = 'swim';
    api.clear(fade);
  }

  // ------------------------------------------------------------------ can this press start now?
  function tryStart(kind) {
    const cls = CLASS[kind];
    // the trident's away: Strike or Cast calls it home, from anywhere, whatever he's doing. A Strike pressed while it's on its way waits for the catch in the buffer
    if (P.spout.riding) { if (kind === 'strike') P.spout.leap(true); return true; }       // on the spout there's one thing to do: Strike goes off the top into a slam
    if (P.home.out && (kind === 'strike' || kind === 'cast')) { if (P.home.flying) return kind === 'cast'; P.home.recall(); return true; }
    if (h.state === 'hurt') { if (!(cls === 'dodge' || cls === 'parry') || hurtF < D.input.hurt_cancel_f) return false; h.stun = 0; }
    else if (cur && !accepts(cur.def, cur.f, cls, cur.landed)) return false;
    if (kind === 'dodge' && now - lastDodge < D.input.dodge_gap_f) return false;
    const id = resolve(D, kind, view()); if (!id) return true;
    const d = D.moves[id];
    if (d.kind === 'power') {
      if (!open(id)) { G.ui.lockedTip(D.locked_tip[id] || 'Not yet'); return true; }
      if (!afford(id) || coolOf(id) > 0) { log('denied', { id, tide: h.tide, cool: coolOf(id) }); G.fx.denied && G.fx.denied(); return true; }
    }
    if (id === 'icepath' && G.world.heightAt(h.pos.x, -h.pos.z) > -1) { log('denied', { id, tide: h.tide, cool: 0 }); G.fx.denied && G.fx.denied(); G.ui.tip(G.sideNow === 'fire' ? 'Lava Path needs the sea under you' : 'Ice Path needs the sea under you', 2); return true; }
    if (d.motion === 'free') { P.instant(id); return true; }
    begin(id); return true;
  }

  function showSlots() {
    if (!G.ui.setStance) return;
    if (G.sideNow === 'fire') { G.ui.unlock('call'); G.ui.unlock('cast'); }
    else if (open('shoalsong')) { G.ui.unlock('call'); teach('song_open', 'Shoalsong', 'Hold Call: what the ring touches follows you'); }
    if (G.sideNow !== 'fire' && open('cast')) { G.ui.unlock('cast'); teach('cast_open', 'Homeward Cast', 'Cast throws the trident. Cast or Strike calls it home'); } const slots = D.stances[stance].slots.map((id) => ({ id, name: nameOf(id), open: open(id) })); slots.ice = open('ice'); slots.cast = open('cast'); G.ui.setStance(stance, slots); }
  function swapStance() {
    if (stance === 'water' && !open('ice')) { G.ui.lockedTip(D.locked_tip.ice); return; }
    setStance(stance === 'water' ? 'ice' : 'water');
  }
  function setStance(s, quiet) {
    stance = s; h.stance = s; swapT = D.status.swap_s; log('stance', { stance: s });
    const c = D.stances[s].glow; if (G.heroGlowCol) G.heroGlowCol.value.setRGB(c[0], c[1], c[2]);
    if (G.heroGlow) G.heroGlow.value = 5;
    showSlots();
    if (!quiet) { G.fx.stance && G.fx.stance(h.pos, s); G.audio.swing(); G.look.flash(h.pos, s === 'ice' ? 0xcfeeff : 0x4ff0ff, 7, 0.3); }
  }

  // ------------------------------------------------------------------ the fixed step: called every step, in the air too, so every move runs here
  function presses(u, dt) {
    if (!D) { u.atk = u.dash = u.spin = u.wave = u.parry = u.call = u.stance = u.p4 = u.dodge = u.cast = false; return; }
    const df = dt * FPS; now += df;
    if (G.time - seenT > 0.25) { u.stance = u.p4 = u.dodge = u.cast = false; charge = null; wasBoost = !!u.boost; }   // a cine or a ride kept us away: what was pressed then isn't pressed now
    seenT = G.time; stickX = u.mx || 0; stickY = u.my || 0; stickUD = u.ud || 0;
    if (u.atk) { u.atk = false; buf.push('strike', now); }
    if (u.parry) { u.parry = false; buf.push('parry', now); }
    if (u.dash) { u.dash = false; buf.push('slot1', now); }
    if (u.spin) { u.spin = false; buf.push('slot2', now); }
    if (u.wave) { u.wave = false; buf.push('slot3', now); }
    if (u.p4) { u.p4 = false; buf.push('slot4', now); }
    // Call: the press sings; held, the song goes on down its tiers, and letting go is what fires the tier it reached
    if (u.call && G.sideNow === 'fire') { u.call = false; G.ember.heroSuper(); }      // the man in red's Call: all fire
    if (u.call) { u.call = false; charge = { t: 0, tier: 0 }; buf.push('song', now); }
    if (charge) {
      charge.t += dt; // the pack and the whale come through the sea: on land the song is all there is
      const top = !open('call') || G.world.heightAt(h.pos.x, -h.pos.z) > -2 ? 0 : P.shoal.knows('whale') ? 2 : 1; let tier = 0; for (let i = 1; i <= top; i++) if (charge.t >= D.shoal.tier_s[i]) tier = i;
      if (tier !== charge.tier) { charge.tier = tier; G.fx.chargeRing(h.pos, tier); G.audio.bubble(); }
      if (!u.callHeld || h.dead) { if (tier) buf.push(tier === 2 ? 'breach' : 'pack', now); charge = null; }
    }
    if (u.cast) { u.cast = false; buf.push('cast', now); }
    // Jump held on the water raises the spout. A tap stays a leap: nothing here happens until it's been held a moment
    jumpIsHeld = !!u.jumpHeld; const onSea = !h.land && !h.dead && h.pos.y < 6 && G.world.heightAt(h.pos.x, -h.pos.z) < -1.5;
    if (onSea && !spoutTold && (seaT += dt) > 12) { spoutTold = true; teach('spout_open', 'Tornado', 'Hold Jump on the water: it lifts you up'); }      // it has no button of its own, so it's said once
    if (!jumpIsHeld) spoutHold = 0; else if (onSea && spoutHold >= 0) { spoutHold += dt; if (spoutHold >= D.spout.hold_s) { spoutHold = -1; if (P && !P.spout.on) buf.push('spout', now); } }
    if (P) P.spout.stick = [stickX, stickY];
    // the leap's splash, going out and coming in, is the sheet: wake.js keeps its foam on the sea, with less of its cloud. Tied here because wake.js sets the hook after this file loads
    if (!splashTied && h.onSplash) { splashTied = true; const wake = h.onSplash; h.onSplash = (p, size) => { wake(p, size * 0.3); G.fx.sheet(p, size * 1.3); }; }
    if (u.dodge) { u.dodge = false; buf.push('dodge', now); }
    if (u.stance) { u.stance = false; swapStance(); }
    // Boost's press is the dodge when there's a fight on: the burst of a dodge runs on into the boost if it's held
    if (u.boost && !wasBoost && inFight() && !h.fireAir) buf.push('dodge', now);      // in the air the man in red's Boost is Fly
    wasBoost = !!u.boost;

    for (const k in win) win[k] = Math.max(0, win[k] - df);
    swapT = Math.max(0, swapT - dt);
    for (const k in cool) cool[k] = Math.max(0, cool[k] - dt);
    const slots = D.stances[stance].slots; for (let i = 0; i < 4; i++) h.cool[SLOT_COOL[i]] = coolOf(slots[i]);
    h.cool.call = Math.max(coolOf('call'), coolOf('shoalsong'));
    if ((sigT -= dt) <= 0) { sigT = 0.5; const sig = D.stances.water.slots.concat(D.stances.ice.slots, ['ice', 'shoalsong', 'cast']).map((id) => (open(id) ? 1 : 0)).join(''); if (sig !== sigWas) { sigWas = sig; showSlots(); } }
    hurtF = h.state === 'hurt' ? hurtF + df : 0;
    if (lv('tide') >= 3 && h.combatT < 4) h.tide = Math.min(h.maxTide, h.tide + D.upgrades.tide_refill_s * dt);
    if (P) P.step(dt);

    if (cur) {
      const d = cur.def, before = cur.f;
      cur.f += df * (cur.f < d.startup ? cur.close : 1);
      if (before < d.startup && cur.f >= d.startup && cur.shot && d.clip_t) cur.shot.rate = rateFor(cur.timing || d, d.startup);
      if (cur.f >= d.total) { log('end', { id: cur.id }); finish(); }
    }
    buf.expire(now);
    if (!h.dead && h.state !== 'cine' && buf.list.length) buf.take(tryStart);
    if (cur && accepts(cur.def, cur.f, 'free', cur.landed) && Math.hypot(stickX, stickY) > 0.25) { log('walkout', { id: cur.id, at: +cur.f.toFixed(1) }); finish(0.2); }
    if (cur) stepMove(dt);
  }
  const inFight = () => cur !== null || h.combatT < D.input.dodge_fight_s || (G.enemies && G.enemies.alive().some((e) => e.pos.distanceTo(h.pos) < 16));

  function turnTo(goal, dt) {
    // a blow turns him fast but never in a frame: an exact first-order ease toward the goal, capped at the turn rate
    const d = wrap(goal - h.heading), max = (D.turn.rate_deg_s * Math.PI / 180) * dt;
    h.heading = wrap(h.heading + clamp(first(1 / D.turn.ease, 0, d, dt), -max, max));
  }

  function stepMove(dt) {
    const a = cur, d = a.def, f = a.f;
    const t = a.target; if (t && t.hp !== undefined && t.hp <= 0) a.target = null;
    if (a.target) {
      to.subVectors(a.target.pos, h.pos); turnTo(Math.atan2(to.x, to.z), dt);
      h.pitchT = damp(h.pitchT, Math.atan2(to.y, Math.hypot(to.x, to.z)), 14, dt);
    } else if (d.kind === 'strike' || d.kind === 'power') { const s = stickDir(v2); if (s) turnTo(Math.atan2(s.x, s.z), dt); else if (d.kind === 'power') turnTo(G.camYaw, dt); }

    if (!a.swung && d.reach && f >= d.startup - 3) { a.swung = true; G.audio.swing(); }
    switch (d.motion || 'lunge') {
      case 'lunge': lunge(a, dt); break;
      case 'rise': lunge(a, dt); if (f >= d.startup) rise(a, dt); break;
      case 'air': hover(a, dt); break;
      case 'plunge': plunge(a, dt); break;
      case 'dodge': dodge(a, dt); break;
      case 'dash': dash(a, dt); break;
      default: brake(a, dt);
    }
    if (cur !== a) return;
    const hitEnd = d.startup + d.active;
    if (d.kind === 'power' && !a.released && f >= d.startup) { a.released = true; pay(a.id); P.release(a.id, a); }
    if (a.rehitAt && f >= a.rehitAt) { a.rehitAt = 0; a.hits.clear(); }
    if (d.reach && d.active > 0 && f >= d.startup && f < hitEnd) {
      const fm = !a.fired && d.kind === 'strike' ? fireMove(a.id) : null; if (fm && G.fireKit) { a.fired = true; G.fireKit.strike(a, fm.limb, !!a.shotAt); }
      if (a.shotAt || (fireMove(a.id) && d.kind === 'strike' && !a.target)) { /* it left his hand: the blast does the hitting */ }
      else if (d.rehit_f) { a.rehit -= dt * FPS; if (a.rehit <= 0) { a.rehit = d.rehit_f; a.hits.clear(); checkHits(a); } } else checkHits(a);
    }
    if (d.kind === 'power' && P) P.during(a, dt);
  }

  const lv = (id) => upgrades[id] || 0;
  const whipRange = () => D.moves.whip.range_m * (lv('whip') >= 1 ? D.upgrades.whip.range : 1);
  const costOf = (id) => (D.moves[id].cost || 0) * (id === 'geyser' && lv('geyser') >= 2 ? D.upgrades.geyser.cost : 1);
  function pay(id) { const d = D.moves[id]; h.tide = Math.max(0, h.tide - costOf(id)); if (d.cooldown) cool[id] = d.cooldown; G.quest && G.quest.note && G.quest.note('power:' + id); }

  function lunge(a, dt) {
    const d = a.def, f = a.f, hitEnd = d.startup + d.active;
    if (f < hitEnd && a.target) {
      to.subVectors(a.target.pos, h.pos); const dist = to.length() || 1, gap = Math.max(0, dist - (a.target.r || 0.8) - 1.3);
      const left = Math.max(1, (d.startup - f) / a.close + 1) / FPS, along = a.entry.dot(to) / dist, sp = Math.max(Math.min(gap / left, 34), gap > 0.2 ? along * (d.carry || 0.7) : 0);
      v1.copy(to).multiplyScalar(sp / dist); const k = 22;
      h.vel.x = damp(h.vel.x, v1.x, k, dt); h.vel.y = damp(h.vel.y, v1.y, k, dt); h.vel.z = damp(h.vel.z, v1.z, k, dt);
    } else if (f < hitEnd) {
      // nothing to reach for: he carries what he came in with
      const share = (d.carry || 0.7) * (1 - f / d.total); v1.copy(a.entry).multiplyScalar(share);
      heroFacing(v2); v1.addScaledVector(v2, 2.2);
      h.vel.x = damp(h.vel.x, v1.x, 10, dt); h.vel.y = damp(h.vel.y, v1.y, 10, dt); h.vel.z = damp(h.vel.z, v1.z, 10, dt);
    } else brake(a, dt);
  }
  // a blow never roots him: as it dies away the stick has him again, so he comes out of it moving
  function brake(a, dt) { h.vel.multiplyScalar(Math.exp(-(a.def.brake || 5) * dt)); const s = stickDir(v2); if (s) { const k = 1 - Math.exp(-7 * dt), S = D.input.drift_mps; h.vel.x += (s.x * S - h.vel.x) * k; h.vel.z += (s.z * S - h.vel.z) * k; } }

  function rise(a, dt) {
    const d = a.def;
    if (h.land && !h.air) { h.air = true; h.grounded = false; a.wentAir = true; }
    h.vel.y = damp(h.vel.y, d.rise_mps, 18, dt); a.rising = true;
  }
  function hover(a, dt) {
    const d = a.def;
    if (a.target) {
      to.subVectors(h.pos, a.target.pos); const l = to.length() || 1; v1.copy(a.target.pos).addScaledVector(to, (d.hover || 2.4) / l).sub(h.pos).multiplyScalar(9);
      h.vel.x = damp(h.vel.x, v1.x, 14, dt); h.vel.y = damp(h.vel.y, v1.y, 14, dt); h.vel.z = damp(h.vel.z, v1.z, 14, dt);
    } else { h.vel.x *= Math.exp(-3 * dt); h.vel.z *= Math.exp(-3 * dt); h.vel.y = damp(h.vel.y, h.air ? -3 : 0, 10, dt); }
  }
  function plunge(a, dt) {
    const d = a.def, f = a.f;
    if (f < d.startup) { h.vel.multiplyScalar(Math.exp(-9 * dt)); return; }
    if (a.wentAir) {
      if (!h.air) { landPlunge(a); return; }
      h.plunge = true; if (h.vel.y > -6) h.vel.y = -6;
      if (a.target) { to.subVectors(a.target.pos, h.pos); h.vel.x = damp(h.vel.x, clamp(to.x * 4, -10, 10), 8, dt); h.vel.z = damp(h.vel.z, clamp(to.z * 4, -10, 10), 8, dt); }
      return;
    }
    // under water it's a driven dive: down hard, until the bed or the thing under him
    const groundY = G.world.heightAt(h.pos.x, -h.pos.z), under = a.target ? a.target.pos : null;
    v1.set(under ? clamp((under.x - h.pos.x) * 5, -9, 9) : 0, -d.drop_mps, under ? clamp((under.z - h.pos.z) * 5, -9, 9) : 0);
    h.vel.x = damp(h.vel.x, v1.x, 20, dt); h.vel.y = damp(h.vel.y, v1.y, 20, dt); h.vel.z = damp(h.vel.z, v1.z, 20, dt);
    const d2 = under ? under.distanceTo(h.pos) : 99;
    if (h.pos.y - groundY < 2.2 || d2 < 2.6 || f > d.startup + 26) landPlunge(a);
  }
  function landPlunge(a) {
    const d = a.def, p = h.pos, r = d.aoe_m, im = D.impacts[d.impact];
    log('plunge', { x: p.x, y: p.y, z: p.z }); if (Math.abs(p.y) < 5 && G.world.heightAt(p.x, -p.z) < -0.5) G.fx.sheet(v1.set(p.x, 0.08, p.z), 4.2, 1);
    if (G.enemies) for (const e of G.enemies.alive()) { if (e.pos.distanceTo(p) < r + (e.r || 0.8)) land(e, a); }
    if (G.boss && G.boss.active) G.boss.strike(p, r, (t, mul) => land(t, a, mul));
    G.fx.shock && G.fx.shock(p, r, stance);
    punch(im, UP);
    h.plunge = false; h.stun = 0; h.state = 'attack';
    begin('plunge_land');
  }
  function dodge(a, dt) {
    const d = a.def, f = a.f, T = d.cancel.free, q = clamp(f / T, 0, 1), s = d.speed_mps * (1 - q * q);
    const along = Math.max(0, a.entry.dot(a.dir));
    v1.copy(a.dir).multiplyScalar(Math.max(s, along * (1 - 0.5 * q)));
    const k = 32; h.vel.x = damp(h.vel.x, v1.x, k, dt); h.vel.z = damp(h.vel.z, v1.z, k, dt); if (!h.land || h.air) h.vel.y = damp(h.vel.y, v1.y, k, dt);
    // the body rolls round its own length: read by hero.animate as h.roll
    const inWater = !(h.land && !h.air); h.tiltGoal = inWater ? 1.3 : undefined;
    h.roll = inWater ? Math.PI * 2 * clamp(f / (d.total - 4), 0, 1) : 0;
    turnTo(Math.atan2(a.dir.x, a.dir.z), dt);
  }
  function dash(a, dt) {
    const d = a.def, f = a.f, hitEnd = d.startup + d.active;
    if (f < d.startup) { brake(a, dt); return; }
    if (f < hitEnd) {
      if (a.target) { to.subVectors(a.target.pos, h.pos); const l = to.length() || 1; if (l > 2.5) a.dir.lerp(to.multiplyScalar(1 / l), 1 - Math.exp(-8 * dt)).normalize(); }
      v1.copy(a.dir).multiplyScalar(d.dash_mps * (a.dashMul || 1)); h.vel.x = damp(h.vel.x, v1.x, 26, dt); h.vel.y = damp(h.vel.y, v1.y, 26, dt); h.vel.z = damp(h.vel.z, v1.z, 26, dt);
    } else { h.vel.multiplyScalar(Math.exp(-5 * dt)); }
  }

  // ------------------------------------------------------------------ a blow lands
  function checkHits(a) {
    const d = a.def, st = D.stances[stance], reach = d.reach + (d.element ? 0 : st.reach_add), arc = (d.arc_deg * Math.PI) / 360;
    const targets = G.enemies ? G.enemies.alive() : [];
    for (const e of targets) {
      if (e.hidden) continue;
      const dx = e.pos.x - h.pos.x, dy = e.pos.y - h.pos.y, dz = e.pos.z - h.pos.z, l = Math.hypot(dx, dy, dz);
      if (l > reach + (e.r || 0.8)) continue;
      const ang = Math.abs(wrap(Math.atan2(dx, dz) - h.heading));
      // a sweep can catch a crowd, but it's aimed at one: the rest take half, or a group would die as fast as a single foe
      if (ang <= arc || l < 1.2 + (e.r || 0.8) * 0.5) land(e, a, a.target && e !== a.target && d.kind === 'strike' ? D.cleave : 1);
    }
    if (G.boss && G.boss.active) G.boss.strike(h.pos, reach, (t, mul) => land(t, a, mul));
    if (G.quest) G.quest.strike(h.pos, reach + 0.6, d.clip || a.id);
  }

  function land(e, a, mul = 1) {
    if (a.hits.has(e)) return; a.hits.add(e); a.landed = true;
    const d = a.def, el = d.element || stance, st = D.stances[el], dmg = d.damage * st.damage_mul * mul * (G.ember ? G.ember.heroMul() : 1) * (a.id === 'riptide' && lv('riptide') >= 1 ? D.upgrades.riptide.damage : 1);
    const info = { move: a.id, melee: d.kind === 'strike' && a.id !== 'whip', element: el, status: a.status || d.status || st.status, shatters: !!d.shatters, knock: d.knock || 0, stun: (d.stun_s || 0) * (a.stunMul || 1), poise: d.poise || 0, launch: (d.launch || 0) * (a.launchMul || 1), heavy: d.impact === 'heavy' || d.impact === 'finisher' };
    const res = e.onHit(dmg, a.from || h.pos, d.clip || a.id, info);
    if (res === 'blocked') {
      // a shield: the blow rings off and throws him back a step; a parry or the cold is what opens it
      log('blocked', { id: a.id, foe: e.kind });
      a.landed = false; v1.copy(e.pos).lerp(h.pos, 0.4); v1.y += 1; G.fx.block ? G.fx.block(v1) : G.fx.sparks(v1, 10, 0xffe7a8, 7); G.audio.hit(false); G.hitstop = Math.max(G.hitstop, 0.05);
      if (e.pos.distanceTo(h.pos) < 6) { h.vel.addScaledVector(fwd.subVectors(h.pos, e.pos).normalize(), 5); if (!(G.settings && G.settings.shake === false)) G.shake(0.2); }
      G.ui.tip && teach('shield', 'A shield', 'Parry the bash, or freeze him');
      return res;
    }
    log('hit', { id: a.id, dmg: +dmg.toFixed(1), foe: e.kind || 'boss', hp: e.hp }); if (e.hp !== undefined && e.kind) P.shoal.setMark(e);
    impactAt(e, a, el);
    h.tide = Math.min(h.maxTide, h.tide + D.tide.strike_gain); h.combatT = 0;
    if (d.kind === 'strike' || d.motion === 'dash') h.vel.addScaledVector(fwd.subVectors(h.pos, e.pos).normalize(), 0.6);
    return res;
  }

  function impactAt(e, a, el) {
    const d = a.def, im = D.impacts[d.impact];
    // on him at any range: a third of the way back from a foe at arm's length, and no further than that from one at twenty metres
    const from = a.from || h.pos; v1.copy(e.pos).lerp(from, Math.min(0.35, 1.2 / Math.max(e.pos.distanceTo(from), 0.1))); v1.y += 0.9;
    v2.subVectors(e.pos, from).normalize();
    G.fx.impact ? G.fx.impact(v1, v2, d.impact, el) : G.fx.sparks(v1, 16, 0x9ff4ff, 8);
    G.audio.hit(!!im.heavy_sound);
    G.look.flash(v1, G.sideNow === 'fire' ? 0xffa050 : el === 'ice' ? 0xcfeeff : 0x8feeff, im.light_m, 0.1 + im.hitstop_f * 0.02);
    G.life && G.life.scatter(v1, 14);
    G.hitstop = Math.max(G.hitstop, im.hitstop_f / FPS);
    punch(im, v2);
  }
  // the screen takes the blow: a kick along it, a shove in, and the shake; gone in a few frames, and none of it if the setting is off
  function punch(im, dir) {
    if (G.settings && G.settings.shake === false) return;
    G.shake(im.shake); G.fx.punch(dir, im.punch);
  }

  // ------------------------------------------------------------------ a blow lands on him
  h.damage = (amount, from, opts = {}) => {
    if (h.dead || h.state === 'cine') return 'miss';
    if (!D) return 'miss';
    const a = cur, d = a && a.def;
    if (d && inFrames(d.iframes, a.f)) {
      if (d.kind === 'dodge' && a.f <= d.perfect_f && !a.spent) {
        a.spent = true; win.perfect = D.input.after_perfect_f; h.tide = Math.min(h.maxTide, h.tide + D.tide.perfect_gain); log('perfect', {});
        G.fx.perfect && G.fx.perfect(h.pos, stance); G.audio.hit(false); G.ui.tip && teach('perfect', 'Perfect dodge', 'Strike now: Undertow');
      }
      return 'dodged';
    }
    if (h.inv > 0) return 'miss';
    h.combatT = 0;
    if (P && !(d && d.guard && a.f >= d.guard[0] && a.f <= (a.guardEnd || d.guard[1])) && P.shoal.absorb(opts)) { h.inv = Math.max(h.inv, 0.3); return 'shielded'; }
    if (d && d.guard && a.f >= d.guard[0] && a.f <= (a.guardEnd || d.guard[1]) && !opts.unblockable) {
      log('parried', { at: +a.f.toFixed(1), id: a.id });
      v1.copy(h.pos); v1.y += 1.2; if (from) v1.lerp(from, 0.35);
      G.fx.parry ? G.fx.parry(v1, stance) : G.fx.sparks(v1, 22, 0xffe7a8, 9);
      G.audio.hit(true); G.hitstop = Math.max(G.hitstop, 0.1); G.shake && !(G.settings && G.settings.shake === false) && G.shake(0.3); G.look.flash(v1, stance === 'ice' ? 0xcfeeff : 0xffe7a8, 7, 0.3);
      h.tide = Math.min(h.maxTide, h.tide + D.tide.parry_gain - (lv('guard') >= 3 && a.f <= 10 ? 0 : d.cost_on_success || 0)); h.parryT = 0;
      win.parry = D.input.after_parry_f; a.f = Math.max(a.f, a.def.cancel.strike); a.landed = true;
      if (d.freezes && G.quest && G.quest.note) G.quest.note('power:guard');
      G.ui.tip('Parried', 1.2);
      h.guardFroze = !!d.freezes; h.guardHold = d.freezes && lv('guard') >= 2 ? D.upgrades.guard.frozen : 1; return 'parried';
    }
    let dmg = amount; if (h.state === 'parry') dmg *= 0.4;
    h.hp -= dmg; h.inv = 0.45; log('hurt', { dmg, hp: h.hp });
    if (!(G.settings && G.settings.shake === false)) G.shake(0.5);
    G.audio.hit(false); G.ui.hurt(0.8);
    v1.copy(h.pos); v1.y += 1.1; G.fx.sparks(v1, 12, 0xffb098, 6);
    if (from) { const k = 6; v2.subVectors(h.pos, from).normalize(); h.vel.addScaledVector(v2, k); }
    if (h.hp <= 0) {
      if (G.quest && G.quest.spareFirstFight()) { h.hp = 18; return 'spared'; }
      if (cur) leave();
      h.hp = 0; h.dead = true; h.state = 'dead'; api.play('death', 0.15); G.quest && G.quest.onDeath(); return 'dead';
    }
    const armoured = d && d.armour;
    if (!armoured || opts.heavy) {
      if (cur) leave();
      const fromAhead = from ? Math.abs(wrap(Math.atan2(from.x - h.pos.x, from.z - h.pos.z) - h.heading)) < 1.57 : true;
      h.state = 'hurt'; h.stun = 0.42; hurtF = 0; api.play(fromAhead ? 'hit_front' : 'hit_back', 0.05); if (P) P.shoal.lift();
    }
    return 'hit';
  };

  // each interaction is taught once per save: the list rides in G.settings, which the save already carries
  let seaT = 0, spoutTold = false;
  function teach(id, name, how) {
    const T = G.settings ? (G.settings.taught = G.settings.taught || {}) : taught; if (T[id]) return; T[id] = 1; log('taught', { id }); G.ui.toast(name, how, 3.2);
  }

  // hero.js's own branch for a blow: every move already ran in presses(), so here there's nothing left to do
  function stepAttack() {}

  // a plain blow by name, for anyone who wants one without a press
  function startAttack(name) { const id = { atk1: 'strike1', atk2: 'strike2', atk3: 'strike3', atk_dash: 'riptide', atk_spin: 'maelstrom' }[name] || name; if (D && D.moves[id]) begin(id); }

  const ready = fetch('data/combat.json').then((r) => { if (!r.ok) throw new Error('combat.json ' + r.status); return r.json(); }).then((data) => {
    const bad = audit(data); if (bad.length) console.error('combat.json:\n' + bad.join('\n'));
    D = data; buf = createBuffer(D.input.buffer_f);
    if (G.fireKit) G.fireKit.bind({ land });
    P = createPowers(G, h, D, { land, findTarget, cool, log, teach, camDir, lv, jumpHeld: () => jumpIsHeld, interact: (id) => teach(id, D.interactions[id].name, D.interactions[id].tip) });
    setStance('water', true);
    return data;
  });

  return {
    presses, stepAttack, findTarget, startAttack, ready, log: LOG, teach, relabel: showSlots,
    get data() { return D; }, get charging() { return !!charge; },
    get cur() { return cur; },
    get stance() { return stance; },
    get powers() { return P; },
    get windows() { return win; },
    get cool() { return cool; },
    setStance,
    has: (id) => !!(D && D.moves[id]),
    opened: (id) => !!D && open(id),
    difficulty: () => (D && D.difficulty[G.settings && G.settings.difficulty]) || (D && D.difficulty.normal),
    unlockStance(id) { if (id === 'ice' || id === undefined) { h.powers.ice = true; showSlots(); } },
    // a clean slate for a check: nothing running, nothing cooling, nothing buffered
    reset() { if (cur) finish(0.01); buf && buf.clear(); for (const k in win) win[k] = 0; for (const k in cool) cool[k] = 0; last = null; lastEnd = -999; lastDodge = -999; wasBoost = false; charge = null; sigWas = ''; if (P) P.clear(); LOG.length = 0; },
    power: (id) => ({ open: open(id), cool: coolOf(id), afford: afford(id) }),
    trail: () => { if (!cur) return 0; const d = cur.def; return cur.f >= d.startup - 3 && cur.f < d.startup + d.active + 12 && d.kind !== 'dodge' && d.kind !== 'parry' ? 1 : 0; },
    applyUpgrades(levels) {
      for (const k in upgrades) delete upgrades[k]; Object.assign(upgrades, levels || {}); if (!D) { ready.then(() => this.applyUpgrades(levels)); return; }
      // health and tide stack on whatever else raised them: only the difference of this call is applied, so a reload can repeat it safely
      const hp = lv('health') ? D.upgrades.health[lv('health') - 1] : 0, td = lv('tide') ? D.upgrades.tide[lv('tide') - 1] : 0;
      h.maxHp += hp - bonus.hp; h.hp = Math.min(h.maxHp, h.hp + Math.max(0, hp - bonus.hp)); bonus.hp = hp; h.maxTide += td - bonus.td; bonus.td = td;
      if (P) P.upgrades(upgrades);
    },
    interact: (id) => teach(id, D.interactions[id].name, D.interactions[id].tip),
  };
}
