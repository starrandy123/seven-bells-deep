// The input and everything drawn in the page over the canvas: stick, buttons, keys, HUD, toasts, compass, the feed, talk, title, the menu.
import { TITLE, TOUCH, FLAG } from './config.js';
import { DATA } from './data.js';
import { STACK_HTML } from './stack.js';
import { readSave } from './save.js';
import { createScreens } from './screens.js';

const $ = (id) => document.getElementById(id);
export const SETTINGS = { music: 1, sound: 1, shake: true, flash: true, camera: 1, difficulty: 'normal', toggleBoost: false };
export const KEY_DEFAULTS = { atk: 'KeyJ', dash: 'KeyK', spin: 'KeyQ', wave: 'KeyE', p4: 'KeyG', stance: 'KeyX', parry: 'KeyL', call: 'KeyR', cast: 'KeyV', ride: 'KeyF', map: 'KeyM' };

export function createUI(G) {
  const input = { mx: 0, my: 0, ud: 0, yaw: 0, pitch: 0, boost: false, atk: false, dash: false, spin: false, wave: false, parry: false, call: false, ride: false, jump: false, p4: false, stance: false, dodge: false };
  const held = {};
  const press = (k) => { input[k] = true; if (k === 'parry' && document.body.dataset.stance === 'ice' && G.quest) G.quest.note('power:guard'); };
  let locked = false, usedKeys = false;

  // the settings live here: the rest of the game reads G.settings live (shake and flash in combat, the camera below)
  G.settings = { ...SETTINGS, keys: { ...KEY_DEFAULTS } };
  // a device that asks for less motion starts with shake and big flashes off; the Settings screen can turn them back on
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { G.settings.shake = false; G.settings.flash = false; }
  // settings are the player's, not the run's: ?fresh starts the game over and keeps them, as New game does
  if (!FLAG.demo && !FLAG.film) { const s = readSave(); if (s && s.settings) { Object.assign(G.settings, s.settings); G.settings.keys = { ...KEY_DEFAULTS, ...(s.settings.keys || {}) }; } }
  const sens = () => G.settings.camera || 1;
  function applySettings(s) { Object.assign(G.settings, s || {}); if (G.audio.setVolumes) G.audio.setVolumes(G.settings.music, G.settings.sound); }
  applySettings();

  if (TOUCH) document.body.classList.add('touch');
  document.title = TITLE; $('titleName').textContent = TITLE.toUpperCase();

  // ------------------------------------------------------------------ keys and mouse
  const actionOf = (code) => { const k = G.settings.keys; for (const a in k) if (k[a] === code) return a; return null; };
  let capture = null, boostLatch = false;
  // a key for an action: the action that had it takes the old key, so nothing is left without one
  function remap(action, code) {
    const k = G.settings.keys, old = k[action], had = actionOf(code); if (had && had !== action) k[had] = old; k[action] = code;
    if (G.quest) G.quest.save();
  }
  const SCROLLERS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);
  addEventListener('keydown', (e) => {
    if (SCROLLERS.has(e.code) && !(e.target && e.target.matches && e.target.matches('input,select,textarea'))) e.preventDefault();      // a host page never scrolls under the game
    if (e.repeat) return;
    if (capture) { const a = capture; capture = null; remap(a, e.code); screens.refresh(); e.preventDefault(); return; }
    held[e.code] = true;
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && G.settings.toggleBoost) boostLatch = !boostLatch;
    if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') usedKeys = true;
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !G.started && $('dive').style.display !== 'none') { $('dive').click(); return; }
    G.audio.start();
    if (G.quest && G.quest.st.talk) { if (e.code === 'Space' || e.code === 'Enter' || e.code === G.settings.keys.ride) G.quest.talkTap(); if (e.code === 'Escape') G.quest.talkSkip(); return; }
    const act = actionOf(e.code);
    if (act === 'ride') doContext(); else if (act === 'map') { if (G.started) { if (G.paused && screens.tab === 'map') setPause(false); else openScreen('map'); } } else if (act) press(act);
    if (e.code === 'Space') press('jump');
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'KeyH') { if (G.started && !G.paused) setPause(true); showPanel(true); }
  });
  addEventListener('keyup', (e) => { held[e.code] = false; });
  addEventListener('blur', () => { for (const k in held) held[k] = false; });

  const canvas = $('c');
  let drag = false, lastX = 0, lastY = 0, moved = 0, leftAt = 0; const HOLD = 240;     // the left button held past this swims; shorter is a click
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    drag = true; lastX = e.clientX; lastY = e.clientY; moved = 0;
    if (e.button === 0) leftAt = performance.now();
    if (e.button === 2) { if (leftAt && performance.now() - leftAt > HOLD) held.mouseBoost = true; else press('parry'); }
    G.audio.start();
    if (usedKeys && G.playing && !TOUCH && !document.pointerLockElement && canvas.requestPointerLock && !G.film) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
  });
  addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return;
    if (e.button === 2) held.mouseBoost = false;
    if (e.button === 0) {
      const short = !leftAt || performance.now() - leftAt <= HOLD; leftAt = 0;
      if (short && G.playing && (document.pointerLockElement || (drag && moved < 8))) { if (ctx) doContext(); else press('atk'); }
    }
    drag = false;
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (document.pointerLockElement) { input.yaw -= e.movementX * 0.0023 * sens(); input.pitch -= e.movementY * 0.0023 * sens(); return; }
    if (!drag) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    input.yaw -= dx * 0.0042 * sens(); input.pitch -= dy * 0.0042 * sens();
  });
  addEventListener('contextmenu', (e) => e.preventDefault());
  // iOS honours resume() only inside these gestures: after a call or the lock screen the next tap brings the sound back
  for (const ev of ['pointerup', 'touchend', 'click']) addEventListener(ev, () => { if (G.started && !G.paused) G.audio.start(); }, { passive: true });
  addEventListener('pagehide', () => { if (G.started) setPause(true); });

  // ------------------------------------------------------------------ touch: a stick where the left thumb lands, looking on the right, the buttons
  const stick = $('stick'), nub = $('nub');
  let stickId = null, lookId = null, lookX = 0, lookY = 0, sx = 0, sy = 0, sox = 0, soy = 0, floatStick = false;
  const setStick = (x, y) => {
    const R = 54, d = Math.hypot(x, y), k = d > R ? R / d : 1; x *= k; y *= k;
    nub.style.transform = `translate(${x}px,${y}px)`; sx = x / R; sy = -y / R;
  };
  const stickFrom = (e) => { setStick(e.clientX - sox, e.clientY - soy); };
  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (_) {} const r = stick.getBoundingClientRect();
    sox = r.left + r.width / 2; soy = r.top + r.height / 2; stickFrom(e); G.audio.start(); e.stopPropagation();
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickFrom(e); });
  const stickUp = (e) => {
    if (e.pointerId !== stickId) return; stickId = null; setStick(0, 0);
    if (floatStick) { floatStick = false; stick.style.left = ''; stick.style.top = ''; stick.style.bottom = ''; }
  };
  stick.addEventListener('pointerup', stickUp); stick.addEventListener('pointercancel', stickUp);

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    G.audio.start();
    // the left of the screen is the stick, wherever the thumb lands (Apple's touch control rule)
    if (G.playing && stickId === null && e.clientX < innerWidth * 0.42 && e.clientY > innerHeight * 0.3) {
      stickId = e.pointerId; floatStick = true; sox = e.clientX; soy = e.clientY;
      stick.style.left = `${e.clientX - 66}px`; stick.style.top = `${e.clientY - 66}px`; stick.style.bottom = 'auto'; setStick(0, 0);
      return;
    }
    if (lookId !== null) return; lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY;
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId && floatStick) { stickFrom(e); return; }
    if (e.pointerId !== lookId) return;
    input.yaw -= (e.clientX - lookX) * 0.0052 * sens(); input.pitch -= (e.clientY - lookY) * 0.0052 * sens(); lookX = e.clientX; lookY = e.clientY;
  });
  const lookUp = (e) => { if (e.pointerId === lookId) lookId = null; if (e.pointerId === stickId && floatStick) stickUp(e); };
  addEventListener('pointerup', lookUp); addEventListener('pointercancel', lookUp);

  const hold = (id, name, isHold) => {
    const b = $(id); b.classList.add('show');
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); b.classList.add('down'); b.classList.remove('pulse'); G.audio.start();
      if (isHold) { held[name] = true; if (name === 'boostB' && G.settings.toggleBoost) boostLatch = !boostLatch; } else if (name === 'ride') doContext(); else press(name);
      if (name === 'call') held.callB = true;
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
    });
    const up = () => { b.classList.remove('down'); if (isHold) held[name] = false; if (name === 'call') held.callB = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    return b;
  };
  const bAtk = hold('bAtk', 'atk'), bBoost = hold('bBoost', 'boostB', true), bParry = hold('bParry', 'parry');
  const bRide = hold('bRide', 'ride'), bJump = hold('bJump', 'jump'), bStance = hold('bStance', 'stance');
  // the hotbar (Randy, 1 Nov: "best practice standard MMO type HUD"): each slot uses its power, as an MMO action bar does; holding Call is
  // Shoalsong (P13a). The keys still use each power straight away (K Q E G V R).
  const slot = (id, name) => {
    const b = $(id); b.classList.add('show');
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); b.classList.add('down'); b.classList.remove('pulse'); G.audio.start();
      press(name); if (name === 'call') held.callB = true;
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
    });
    const up = () => { b.classList.remove('down'); if (name === 'call') held.callB = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    return b;
  };
  const bDash = slot('bDash', 'dash'), bSpin = slot('bSpin', 'spin'), bWave = slot('bWave', 'wave'), bP4 = slot('bP4', 'p4'), bCast = slot('bCast', 'cast'), bCall = slot('bCall', 'call');
  for (const x of [bDash, bSpin, bWave, bP4, bStance, bCall, bCast, bRide, bJump]) x.classList.remove('show');
  bJump.addEventListener('pointerdown', () => { held.jumpB = true; });          // how long it's held sets the jump's height
  for (const ev of ['pointerup', 'pointercancel']) bJump.addEventListener(ev, () => { held.jumpB = false; });
  const buttonOf = { dash: bDash, spin: bSpin, wave: bWave, p4: bP4, call: bCall, cast: bCast, atk: bAtk, parry: bParry, boost: bBoost, jump: bJump, stance: bStance, ice: bStance };
  // what the phone passes read (PUBLISHING.md §3): only what is on the screen right now, each with its key
  const KEYNAME = { Space: ' ', Shift: 'Shift' };
  function declareControls() {
    const on = (b) => b && b.classList.contains('show') && getComputedStyle(b).display !== 'none';
    const act = (id, label, el, kind) => ({ id, label, keys: el.dataset.key ? [KEYNAME[el.dataset.key] || el.dataset.key.toLowerCase()] : [], touch: '#' + el.id, kind: kind || 'button' });
    const a = [];
    if (TOUCH) a.push({ id: 'move', label: 'Move', kind: 'move', keys: ['w', 'a', 's', 'd'], touch: '#stick' }, { id: 'look', label: 'Look', kind: 'look', keys: [], touch: true, target: 'canvas' });
    for (const [id, label, b] of [['strike', 'Strike', bAtk], ['parry', 'Parry', bParry], ['boost', 'Boost', bBoost], ['jump', 'Jump', bJump], ['stance', 'Stance', bStance],
      ['slot-dash', 'Slot 1', bDash], ['slot-spin', 'Slot 2', bSpin], ['slot-wave', 'Slot 3', bWave], ['slot-p4', 'Slot 4', bP4], ['slot-cast', 'Cast', bCast], ['slot-call', 'Call', bCall], ['context', 'Ride / Talk', bRide]]) {
      if (on(b)) a.push(act(id, label, b));
    }
    a.push({ id: 'pause', label: 'Pause', keys: ['Escape'], touch: '#pauseB', kind: 'button' });
    window.__MOSA_CONTROLS = { schema: 'mosa.controls.v1', actions: a };
  }

  // read once per fixed step; one-shot presses are cleared by whoever consumes them
  function sample() {
    if (locked) { input.mx = input.my = input.ud = 0; input.boost = input.jumpHeld = false; input.atk = input.dash = input.spin = input.wave = input.p4 = input.stance = input.parry = input.call = input.ride = input.jump = false; input.cast = input.callHeld = false; input.yaw = input.pitch = 0; return input; }
    const f = (held.KeyW ? 1 : 0) - (held.KeyS ? 1 : 0), r = (held.KeyD ? 1 : 0) - (held.KeyA ? 1 : 0);
    input.mx = r || sx; input.my = f || sy || (leftAt && performance.now() - leftAt > HOLD ? 1 : 0);
    // the arrow keys look, so the whole game plays from the keyboard alone
    input.yaw += ((held.ArrowLeft ? 1 : 0) - (held.ArrowRight ? 1 : 0)) * 0.04 * sens(); input.pitch += ((held.ArrowUp ? 1 : 0) - (held.ArrowDown ? 1 : 0)) * 0.03 * sens();
    input.ud = (held.Space ? 1 : 0) - (held.KeyC || held.ControlLeft ? 1 : 0);
    input.boost = G.settings.toggleBoost ? boostLatch : !!(held.ShiftLeft || held.ShiftRight || held.boostB || held.mouseBoost);
    input.jumpHeld = !!(held.Space || held.jumpB);
    input.callHeld = !!(held.callB || held[G.settings.keys.call]);
    return input;
  }

  // ------------------------------------------------------------------ screens
  const screens = createScreens(G, { setPause: (on) => setPause(on), showPanel: (on) => showPanel(on) });
  function togglePause() { if (!G.started) return; setPause(!G.paused); }
  function setPause(on) {
    G.paused = on; $('menu').classList.toggle('on', on); document.body.classList.toggle('menu', on); G.audio.suspend(on);
    if (on) { screens.open(); if (document.pointerLockElement) document.exitPointerLock(); } else if (G.quest) G.quest.save();
  }
  function openScreen(tab) { if (!G.started) return; if (!G.paused) setPause(true); screens.show(tab); }
  // on the click, never the press: the menu's Resume sits under this same spot, and a menu opened on the press would take the finger's own click and close again
  $('pauseB').addEventListener('pointerdown', (e) => e.stopPropagation());
  $('pauseB').addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
  $('resume').addEventListener('click', () => setPause(false));
  function showPanel(on) { $('panel').classList.toggle('on', on); }
  $('panelIn').innerHTML = STACK_HTML;
  $('stackB').addEventListener('click', () => showPanel(true));
  $('panelX').addEventListener('click', () => showPanel(false));

  function refreshTitle() { if (G.quest && G.quest.hasSave()) { $('dive').textContent = 'Continue'; $('newGame').style.display = ''; } }
  function setLoad(f, msg) {
    $('load').querySelector('i').style.transform = `scaleX(${Math.min(1, f)})`;
    if (msg) $('load').querySelector('small').textContent = msg;
  }
  function ready(onDive) {
    // A page's first AudioContext takes about 190 ms to open (measured here in Chromium; the next one takes 1), and the game's own can only open on a press.
    // So one is opened and shut now, while no tap is waiting: the player's first tap answers at once (B4i).
    try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { const c = new AC(); if (c.close) { const p = c.close(); if (p && p.catch) p.catch(() => {}); } } } catch (_) { /* no sound is no failure */ }
    $('load').style.display = 'none'; $('dive').style.display = ''; $('stackB').style.display = '';
    if (DATA.broken.length) { $('load').style.display = ''; setLoad(1, `Part of the game did not load: ${DATA.broken.join(', ')}`); }
    refreshTitle();
    if (G.quest) G.quest.titleShot();
    setTimeout(() => screens.map.warm(), 1200);
    const go = () => { G.audio.start(); if (G.quest) G.quest.endTitle(); cut(); $('title').classList.remove('on'); $('hud').classList.add('on'); onDive(); };
    $('dive').addEventListener('click', go);
    let sure = false;
    $('newGame').addEventListener('click', () => {
      if (!sure) { sure = true; $('newGame').textContent = 'Tap again to start over'; return; }
      G.quest.newGame(); go();
    });
  }
  function fade(on) { $('fade').classList.toggle('on', on); }
  // a hard cut, covered: black for a frame, then the fade lifts
  function cut() { const f = $('fade'); f.style.transition = 'none'; f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = ''; f.classList.remove('on'); })); }

  // ------------------------------------------------------------------ the feed: each line shows, holds and leaves by itself
  const timers = {};
  function show(id, sec) {
    const el = $(id); el.classList.remove('bye'); el.classList.add('on');
    if (sec) timers[id] = sec; else delete timers[id];
    return el;
  }
  function hide(id) { const el = $(id); delete timers[id]; el.classList.add('bye'); setTimeout(() => { if (el.classList.contains('bye')) { el.classList.remove('on', 'bye'); } }, 360); }
  function toast(big, small, sec = 4) { const t = $('toast'); t.querySelector('b').textContent = big; t.querySelector('span').textContent = small || ''; show('toast', sec); }
  function place(name) { $('place').textContent = name; show('place', 3.5); }
  function tip(msg, sec = 5) { $('tip').textContent = msg; show('tip', sec); }
  function bark(who, text, sec = 5) { const b = $('bark'); b.querySelector('b').textContent = who || ''; b.querySelector('span').textContent = text; show('bark', sec); }
  function card(title, text, sec = 8, style = '') { const c = $('card'); c.className = `${style} on`; c.querySelector('b').textContent = title; c.querySelector('span').textContent = text; show('card', sec); }
  function done(small, big, lines = []) { const d = $('done'); d.querySelector('small').textContent = small; d.querySelector('b').textContent = big; d.querySelector('span').textContent = lines.join(' · '); show('done', 6); }
  function event(big, small, sec = 7) { const e = $('event'); e.querySelector('b').textContent = big; e.querySelector('span').textContent = small || ''; show('event', sec); }
  let timerOn = false;
  function timer(sec, label, up) {
    if (sec === null || sec === undefined) { if (timerOn) { timerOn = false; hide('timer'); } return; }
    if (!timerOn) { timerOn = true; show('timer'); }
    const el = $('timer'); el.querySelector('small').textContent = label || ''; el.querySelector('span').textContent = up ? sec.toFixed(1) : String(Math.ceil(sec));
  }
  function objective(msg) { $('obj').textContent = msg; $('obj').style.display = msg ? '' : 'none'; }
  function unlock(power) { const b = buttonOf[power]; if (b) b.classList.add('show'); declareControls(); }
  function lockPowers() { for (const x of [bDash, bSpin, bWave, bP4, bStance, bCall, bCast]) x.classList.remove('show'); declareControls(); }
  // combat calls this on every swap and whenever a power opens: four slots of { id, name, open }, and slots.ice once Ice is open
  function setStance(stance, slots) {
    document.body.dataset.stance = stance;
    const short = (n) => (n === 'Ice Path' ? n : n.split(' ').pop().replace('Maelstrom', 'Mael\u00adstrom'));      // the button says the last word: Lance, Breath, Wave
    [bDash, bSpin, bWave, bP4].forEach((b, i) => { b.textContent = short(slots[i].name); b.setAttribute('aria-label', slots[i].name); b.classList.toggle('show', !!slots[i].open); });
    bStance.textContent = stance === 'ice' ? 'Ice' : 'Water'; bStance.classList.toggle('show', !!slots.ice);
    declareControls();
  }
  function hurt(a) { $('hurt').style.opacity = a; }
  // the moment to press: the button itself calls for it, and a word for keys
  let cueT = 0;
  function cue(name) {
    if (name === 'parry') { bParry.classList.add('call'); cueT = 0.9; if (!TOUCH) tip('PARRY: right click or L', 0.9); }
  }
  function pulse(power, sec) {
    const b = buttonOf[power]; if (b) { b.classList.add('pulse'); setTimeout(() => b.classList.remove('pulse'), sec * 1000); }
  }

  // one contextual button: talk, a shrine, a run, or a whale's fin
  let rideShown = false, ctx = null;
  function paintContext() {
    const label = ctx || (rideShown ? 'Ride' : null);
    if (label) bRide.textContent = label;
    bRide.classList.toggle('show', !!label); declareControls();
  }
  function context(label) { if (label === ctx) return; ctx = label; paintContext(); }
  function rideHint(on) { if (on === rideShown) return; rideShown = on; paintContext(); }
  function doContext() { if (ctx && G.quest && G.quest.act()) return; press('ride'); }

  // ------------------------------------------------------------------ onboarding hint: a picture on the control, a word, a Skip
  const hintEl = $('hint'), thumb = $('thumb'); let pulsed = null;
  const placeThumb = (h) => { if (h.on === '#stick') { thumb.style.left = `calc(var(--left) + 76px)`; thumb.style.top = `calc(100vh - var(--bottom) - var(--lift, 0px) - 76px)`; thumb.className = 'push'; } if (h.zone === 'right') { thumb.style.left = '72vw'; thumb.style.top = '50vh'; thumb.className = 'drag'; } };
  function hint(h) {
    if (pulsed) { pulsed.classList.remove('pulse'); pulsed = null; }
    thumb.className = '';
    if (!h) { hintEl.classList.remove('on'); return; }
    hintEl.querySelector('.txt').textContent = h.text;
    hintEl.querySelector('.caps').innerHTML = (h.caps || []).map((k) => `<kbd>${k}</kbd>`).join('');
    hintEl.classList.remove('bye'); hintEl.classList.add('on');
    if (h.on) {
      const el = document.querySelector(h.on); if (el) { el.classList.add('pulse'); pulsed = el; }
    }
    placeThumb(h);
  }
  $('hintSkip').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (G.onboard) G.onboard.skip(); });

  // ------------------------------------------------------------------ talk
  const talkEl = $('talk'), talkText = $('talkText'); let typing = null;
  function talkLine(who, text, pic, more) {
    if (who === null) { talkEl.classList.remove('on'); typing = null; return; }
    talkEl.classList.add('on'); $('talkWho').textContent = who; $('talkPic').style.backgroundImage = pic ? `url(${pic})` : 'none';
    $('talkNext').textContent = more ? 'Tap to go on' : 'Tap to close';
    const instant = FLAG.demo || FLAG.film || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (instant) { talkText.textContent = text; typing = null; } else { typing = { text, n: 0 }; talkText.textContent = ''; }
  }
  function talkTyping() { return !!typing; }
  function talkFinish() { if (typing) { talkText.textContent = typing.text; typing = null; } }
  function lock(on) {
    locked = on; document.body.classList.toggle('talking', on);
    if (on) { held.boostB = false; for (const k in held) held[k] = false; setStick(0, 0); stickId = null; lookId = null; }
  }
  talkEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === $('talkSkip')) return; if (G.quest) G.quest.talkTap(); });
  $('talkSkip').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (G.quest) G.quest.talkSkip(); });

  // ------------------------------------------------------------------ the frame's HUD
  const wp = $('wp'), proj = { x: 0, y: 0, z: 0 };
  function marker(tgt) {
    const cam = G.camera; if (!tgt || !cam || G.paused) { wp.classList.remove('on'); return; }
    const e = cam.matrixWorldInverse.elements, p = cam.projectionMatrix.elements;
    const x = tgt.x, y = tgt.y, z = tgt.z;
    const vx = e[0] * x + e[4] * y + e[8] * z + e[12], vy = e[1] * x + e[5] * y + e[9] * z + e[13], vz = e[2] * x + e[6] * y + e[10] * z + e[14];
    if (vz > -1) { wp.classList.remove('on'); return; }                       // behind the camera: the compass has it
    const w = -vz; proj.x = ((p[0] * vx) / w + 1) * 0.5 * innerWidth; proj.y = (1 - (p[5] * vy) / w) * 0.5 * innerHeight;
    if (proj.x < 20 || proj.x > innerWidth - 20 || proj.y < 20 || proj.y > innerHeight - 20) { wp.classList.remove('on'); return; }
    wp.classList.add('on'); wp.style.transform = `translate(${proj.x.toFixed(1)}px,${proj.y.toFixed(1)}px)`;
  }

  function update(dt) {
    if (cueT > 0 && (cueT -= dt) <= 0) bParry.classList.remove('call');
    for (const id in timers) { if ((timers[id] -= dt) <= 0) hide(id); }
    if (typing) {
      typing.n += dt * 62; const n = Math.floor(typing.n);
      talkText.textContent = typing.text.slice(0, n); if (n >= typing.text.length) typing = null;
    }
    const h = G.hero; if (!h) return;
    $('hp').firstElementChild.style.transform = `scaleX(${Math.max(0, h.hp / h.maxHp)})`;
    $('tide').firstElementChild.style.transform = `scaleX(${Math.max(0, h.tide / h.maxTide)})`;
    const pc = G.quest ? G.quest.pearlCount() : 0; if (pc !== update.pc) { update.pc = pc; $('pearls').textContent = `${pc} pearls`; }
    const c = h.cool; bDash.classList.toggle('cool', c.dash > 0); bSpin.classList.toggle('cool', c.spin > 0); bWave.classList.toggle('cool', c.wave > 0); bP4.classList.toggle('cool', c.p4 > 0); bCall.classList.toggle('cool', c.call > 0);
    // the compass: where the objective lies, across a strip as wide as a half turn
    const tgt = G.quest && G.quest.target();
    if (tgt && h.pos) {
      const dx = tgt.x - h.pos.x, dz = tgt.z - h.pos.z, a = Math.atan2(dx, dz), rel = Math.atan2(Math.sin(a - G.camYaw), Math.cos(a - G.camYaw));
      $('mark').style.left = `${50 - (Math.max(-1.57, Math.min(1.57, rel)) / 1.57) * 42}%`;
      const d = Math.hypot(dx, tgt.y - h.pos.y, dz); $('dist').textContent = `${Math.round(d)} m`; $('compass').style.display = ''; $('dist').style.display = '';
    } else { $('compass').style.display = 'none'; $('dist').style.display = 'none'; }
    marker(tgt);
    const om = G.quest && G.quest.events.omen, m2 = $('mark2');
    if (om) { const a2 = Math.atan2(om.x - h.pos.x, om.z - h.pos.z), r2 = Math.atan2(Math.sin(a2 - G.camYaw), Math.cos(a2 - G.camYaw)); m2.style.left = `${50 - (Math.max(-1.57, Math.min(1.57, r2)) / 1.57) * 42}%`; m2.style.display = 'block'; $('compass').style.display = ''; } else m2.style.display = 'none';
    const jumpOn = !!h.land || h.state === 'surf' || h.state === 'swim';
    if (jumpOn !== bJump.classList.contains('show')) { bJump.classList.toggle('show', jumpOn); declareControls(); }
    const sp = $('speedv'); if (sp) sp.style.opacity = (h.surge * 0.85).toFixed(2);
    const bar = $('bossbar'), b = G.boss;
    const on = !!(b && b.active); bar.classList.toggle('on', on); if (on) bar.querySelector('i').style.transform = `scaleX(${Math.max(0, b.hp / b.maxHp)})`;
  }

  return {
    input, sample, setLoad, ready, fade, toast, tip, place, bark, card, done, event, timer, objective, unlock, lockPowers, hurt, rideHint, context, cue, pulse, hint, update, setPause, showPanel, openScreen,
    setCast(out) { bCast.textContent = out ? 'Recall' : 'Cast'; bCast.classList.toggle('call', out); },
    lock, talkLine, talkTyping, talkFinish, applySettings, setStance, refreshTitle, remap, captureKey(a) { capture = a; }, screen: () => (G.paused ? screens.tab : 'play'), screens,
    objectiveChanged() { G.audio.bubble(); },
  };
}
