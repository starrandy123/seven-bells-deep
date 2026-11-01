// In-game cinematics. A cinematic is a shot list in web/data/cinematics.json, each shot an orbit round a focus with a line of text:
//   { "dur": 3, "a": [0, 0.5], "r": [18, 12], "h": [4, 7], "fov": 48, "look": 1, "text": "..." }
//     a: orbit angle from the focus's own bearing, start and end · r: distance · h: height above the focus · look: how high on the focus to look
// Bars, a Skip that takes one tap, and it pauses with the game (the fixed step simply stops). The opening runs behind the title, so tapping
// Dive both skips it and starts the game: one tap (X9).
import * as THREE from 'three';
import { FLAG } from './config.js';
import { DATA } from './data.js';

const $ = (id) => document.getElementById(id);
const ease = (t) => t * t * (3 - 2 * t);

// a cinematic camera never sits in a solid or under the ground, and nothing stands between it and who it's looking at
const sa = { x: 0, y: 0, z: 0 }, sb = { x: 0, y: 0, z: 0 };
export function keepClear(G, cam, from, r = 0.55) {
  sa.x = from.x; sa.y = -from.z; sa.z = from.y; sb.x = cam.x; sb.y = -cam.z; sb.z = cam.y;
  const hit = G.world.sweep ? G.world.sweep(sa, sb, r) : null;
  if (hit) cam.set(hit.x, hit.z, -hit.y);
  sb.x = cam.x; sb.y = -cam.z; sb.z = cam.y;
  if (G.world.collide(sb, r)) cam.set(sb.x, sb.z, -sb.y);
}

export function createCine(G) {
  const clips = DATA.cinematics || {};
  let now = null, played = 0;
  const focus = new THREE.Vector3(), cam = new THREE.Vector3(), look = new THREE.Vector3();

  function shotAt(c) {
    let t = c.t, i = 0;
    while (i < c.shots.length - 1 && t > c.shots[i].dur) { t -= c.shots[i].dur; i++; }
    return { s: c.shots[i], f: Math.min(1, t / c.shots[i].dur), i };
  }
  function show(on) {
    document.body.classList.toggle('cine', on);
    $('bars').classList.toggle('on', on);
    if (!on) $('cineText').textContent = '';
  }
  function play(id, opts = {}) {
    const shots = opts.shots || clips[id] || (opts.alt && clips[opts.alt]);
    if (!shots || !shots.length) { if (opts.done) opts.done(); return false; }
    if (now) stop(true);
    if (FLAG.demo && !opts.film) { if (opts.done) opts.done(); return false; }   // the bot and the checks don't sit through them
    now = { id, shots, t: 0, dur: shots.reduce((a, s) => a + s.dur, 0), at: opts.focus, base: opts.bearing || 0, done: opts.done, line: -1, title: !!opts.title };
    played++; if (!opts.title) show(true);
    return true;
  }
  function stop(skipped) {
    const c = now; now = null; show(false);
    if (c && c.done) c.done(skipped);
  }
  function step(dt) {
    if (!now) return;
    now.t += dt;
    if (now.t >= now.dur) { if (now.title) now.t = 0; else { stop(false); return; } }
    const { s, i } = shotAt(now);
    if (i !== now.line) { now.line = i; if (!now.title) $('cineText').textContent = s.text || ''; }
  }
  function draw() {
    if (!now) return false;
    const { s, f } = shotAt(now), e = ease(f), lerp = (v, d) => (Array.isArray(v) ? v[0] + (v[1] - v[0]) * e : v === undefined ? d : v);
    const at = typeof now.at === 'function' ? now.at() : now.at; if (at) focus.copy(at);
    if (s.at) { const pl = G.quest.places.resolve(s.at); focus.copy(pl.p); }
    const a = now.base + lerp(s.a, 0), r = lerp(s.r, 14), hh = lerp(s.h, 4);
    cam.set(focus.x + Math.sin(a) * r, focus.y + hh, focus.z + Math.cos(a) * r);
    keepClear(G, cam, G.hero.pos.distanceTo(focus) < 80 ? G.hero.pos : focus);
    const c = G.camera; c.position.copy(cam); look.copy(focus); look.y += s.look || 0; c.up.set(0, 1, 0); c.lookAt(look);
    const fov = lerp(s.fov, 50); if (Math.abs(c.fov - fov) > 0.05) { c.fov = fov; c.updateProjectionMatrix(); }
    return true;
  }
  // on the click: the bars are gone by then, and a skip on the press would let the same tap's click land on the pause button under it
  $('cineSkip').addEventListener('pointerdown', (e) => e.stopPropagation());
  $('cineSkip').addEventListener('click', (e) => { e.stopPropagation(); if (now) stop(true); });
  $('cinePause').addEventListener('pointerdown', (e) => e.stopPropagation());
  $('cinePause').addEventListener('click', (e) => { e.stopPropagation(); if (G.ui) G.ui.setPause(true); });
  return { play, stop, step, draw, get active() { return !!now; }, get id() { return now ? now.id : null; }, get title() { return !!(now && now.title); }, played: () => played, list: () => Object.keys(clips) };
}
