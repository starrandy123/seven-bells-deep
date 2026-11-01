// All sound is drawn here by Web Audio, no files: the water, the whale, the bells, the blows, a slow score. It starts on the first press
// and stops when the page is hidden.
export function createAudio() {
  let ctx = null, master, music, sfx, whoosh, whooshGain, noiseBuf, musicTimer = 0, mood = 'calm', step = 0, vols = [1, 1], under = null, isUnder = true;
  const pad = [];

  function noise(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.03 * w) / 1.03; d[i] = last * 3.2; }
    return b;
  }

  function start() {
    if (ctx) { if (ctx.state !== 'running') ctx.resume(); return; }   // suspended, or iOS's interrupted after a call
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    under = ctx.createBiquadFilter(); under.type = 'lowpass'; under.frequency.value = isUnder ? 1100 : 20000;
    const comp = ctx.createDynamicsCompressor(); master.connect(under); under.connect(comp); comp.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0.34; music.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    noiseBuf = noise(4);

    // the water itself: brown noise, low, breathing
    const amb = ctx.createBufferSource(); amb.buffer = noiseBuf; amb.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280;
    const ag = ctx.createGain(); ag.gain.value = 0.34;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.1;
    lfo.connect(lg); lg.connect(ag.gain); lfo.start();
    amb.connect(lp); lp.connect(ag); ag.connect(master); amb.start();

    // the rush of swimming, set by speed
    whoosh = ctx.createBufferSource(); whoosh.buffer = noiseBuf; whoosh.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7;
    whooshGain = ctx.createGain(); whooshGain.gain.value = 0;
    whoosh.connect(bp); bp.connect(whooshGain); whooshGain.connect(sfx); whoosh.start();

    // three slow voices of the score, retuned by the chords below
    for (let i = 0; i < 3; i++) {
      const a = ctx.createOscillator(), b = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      a.type = 'sine'; b.type = 'triangle'; b.detune.value = 6; f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = 0;
      a.connect(f); b.connect(f); f.connect(g); g.connect(music); a.start(); b.start(); pad.push({ a, b, g });
    }
    musicTimer = 0; music.gain.value = 0.34 * vols[0]; sfx.gain.value = 0.9 * vols[1];
  }

  const CHORDS = { calm: [[110, 164.8, 246.9], [98, 146.8, 220], [87.3, 130.8, 261.6], [82.4, 123.5, 246.9]],
    tense: [[73.4, 110, 155.6], [69.3, 103.8, 155.6], [73.4, 110, 164.8], [65.4, 98, 146.8]],
    bright: [[130.8, 196, 329.6], [146.8, 220, 293.7], [110, 164.8, 277.2], [123.5, 185, 293.7]] };

  function update(dt, speed01, fighting) {
    if (!ctx) return;
    whooshGain.gain.setTargetAtTime(0.04 + speed01 * speed01 * 0.5, ctx.currentTime, 0.2);
    musicTimer -= dt;
    if (musicTimer <= 0) {
      musicTimer = mood === 'tense' ? 5 : 9;
      const set = CHORDS[mood] || CHORDS.calm, ch = set[step++ % set.length], t = ctx.currentTime;
      pad.forEach((v, i) => {
        v.a.frequency.setTargetAtTime(ch[i], t, 1.2); v.b.frequency.setTargetAtTime(ch[i] * 2, t, 1.2);
        v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(mood === 'tense' ? 0.2 : 0.15, t, 2); v.g.gain.setTargetAtTime(0.05, t + 5.5, 2.5);
      });
      if (mood === 'tense') for (let i = 0; i < 4; i++) drum(i * 0.625);
    }
    if (Math.random() < dt * 0.5) bubble();
    if (Math.random() < dt * 0.03) whale();
  }

  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

  function drum(at) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.28); env(g, t, 0.006, 0.5, 0.42); o.connect(g); g.connect(music); o.start(t); o.stop(t + 0.6);
  }

  function bubble() {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = 340 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.1, t + 0.09); env(g, t, 0.005, 0.03, 0.09); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.14);
  }

  function whale() {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), base = 90 + Math.random() * 70;
    f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 1.4;
    o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 2.3, t + 2.2); o.frequency.linearRampToValueAtTime(base * 1.2, t + 5);
    o2.type = 'sawtooth'; o2.frequency.setValueAtTime(base * 1.5, t); o2.frequency.linearRampToValueAtTime(base * 3, t + 2.4); o2.frequency.linearRampToValueAtTime(base * 1.6, t + 5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.4);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(music); o.start(t); o2.start(t); o.stop(t + 5.6); o2.stop(t + 5.6);
  }

  function hit(heavy) {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(heavy ? 170 : 230, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.2); env(g, t, 0.004, heavy ? 0.85 : 0.55, 0.26); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.36);
    const n = ctx.createBufferSource(), ng = ctx.createGain(), hp = ctx.createBiquadFilter(); n.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 900;
    env(ng, t, 0.002, heavy ? 0.5 : 0.3, 0.1); n.connect(hp); hp.connect(ng); ng.connect(sfx); n.start(t, Math.random() * 3); n.stop(t + 0.16);
    const p = ctx.createOscillator(), pg = ctx.createGain(); p.type = 'triangle'; p.frequency.value = 1900 + Math.random() * 500; env(pg, t, 0.002, 0.08, 0.2); p.connect(pg); pg.connect(sfx); p.start(t); p.stop(t + 0.26);
  }

  function swing() {
    if (!ctx) return;
    const t = ctx.currentTime, n = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter(); n.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(1500, t + 0.14); f.frequency.exponentialRampToValueAtTime(320, t + 0.28);
    env(g, t, 0.03, 0.42, 0.24); n.connect(f); f.connect(g); g.connect(sfx); n.start(t, Math.random() * 3); n.stop(t + 0.36);
  }

  function bell() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [[196, 1.0, 9], [392.5, 0.55, 7], [468.6, 0.42, 6], [589, 0.32, 5], [787, 0.2, 4], [1046, 0.14, 3]].forEach(([f, a, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; env(g, t, 0.008, a * 0.42, d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.1);
    });
  }

  function pearl() {
    if (!ctx) return;
    [880, 1318.5, 1760].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.07, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; env(g, t, 0.006, 0.1, 0.7); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.8);
    });
  }

  function roar() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 480;
      o.frequency.setValueAtTime(52 + i * 17, t); o.frequency.linearRampToValueAtTime(95 + i * 25, t + 0.7); o.frequency.exponentialRampToValueAtTime(30 + i * 8, t + 2.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8); o.connect(f); f.connect(g); g.connect(sfx); o.start(t); o.stop(t + 3);
    }
  }

  function splash() {
    if (!ctx) return;
    const t = ctx.currentTime, n = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter(); n.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 500;
    env(g, t, 0.01, 1.3, 0.7); n.connect(f); f.connect(g); g.connect(sfx); n.start(t, Math.random()); n.stop(t + 0.9);
  }

  // an enemy's blow is coming: a bright ping you can parry, a low horn you must dodge
  function tell(unblockable) {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    if (unblockable) { o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.linearRampToValueAtTime(82, t + 0.5); env(g, t, 0.02, 0.32, 0.55); }
    else { o.type = 'triangle'; o.frequency.setValueAtTime(1320, t); o.frequency.exponentialRampToValueAtTime(1760, t + 0.1); env(g, t, 0.006, 0.22, 0.22); }
    o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.7);
  }

  // the thrown trident sings where it is
  let wh = null;
  function whirr(on) {
    if (!ctx) return;
    if (on && !wh) { const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; n.buffer = noiseBuf; n.loop = true; f.type = 'bandpass'; f.Q.value = 5; f.frequency.value = 700; g.gain.value = 0; n.connect(f); f.connect(g); if (p) { g.connect(p); p.connect(sfx); } else g.connect(sfx); n.start(); wh = { n, f, g, p }; }
    if (!on && wh) { const t = ctx.currentTime; wh.g.gain.setTargetAtTime(0, t, 0.03); wh.n.stop(t + 0.2); wh = null; }
  }
  function whirrAt(pan, near, rate) { if (!wh) return; const t = ctx.currentTime; if (wh.p) wh.p.pan.setTargetAtTime(pan, t, 0.02); wh.g.gain.setTargetAtTime(0.05 + 0.4 * near, t, 0.03); wh.f.frequency.setTargetAtTime(500 + 1400 * rate, t, 0.03); }

  // the water tornado's roar: a low rumble, rising spray and a growl under it
  let sp = null;
  function spoutRoar(on) {
    if (!ctx) return; const t = ctx.currentTime;
    if (on && !sp) { const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), hi = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g2 = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain();
      n.buffer = noiseBuf; n.loop = true; lp.type = 'lowpass'; lp.frequency.value = 220; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.35);
      hi.buffer = noiseBuf; hi.loop = true; bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(1600, t + 1.2); g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.35, t + 0.5);
      o.type = 'sawtooth'; o.frequency.setValueAtTime(42, t); o.frequency.exponentialRampToValueAtTime(70, t + 1.2); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.22, t + 0.3);
      n.connect(lp); lp.connect(g); g.connect(sfx); hi.connect(bp); bp.connect(g2); g2.connect(sfx); o.connect(og); og.connect(sfx); n.start(t, Math.random() * 3); hi.start(t, Math.random() * 3); o.start(t); sp = { n, hi, o, g, g2, og }; }
    if (!on && sp) { for (const k of [sp.g, sp.g2, sp.og]) { k.gain.cancelScheduledValues(t); k.gain.setTargetAtTime(0, t, 0.35); } sp.n.stop(t + 1.6); sp.hi.stop(t + 1.6); sp.o.stop(t + 1.6); sp = null; }
  }

  function boom() {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.7); env(g, t, 0.01, 0.45, 0.8); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 1);
    const n = ctx.createBufferSource(), ng = ctx.createGain(), f = ctx.createBiquadFilter(); n.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
    env(ng, t, 0.05, 0.35, 0.7); n.connect(f); f.connect(ng); ng.connect(sfx); n.start(t, Math.random() * 3); n.stop(t + 0.9);
  }

  // through the surface: air is open, water closes everything down
  function setUnder(on) { isUnder = on; if (ctx && under) under.frequency.setTargetAtTime(on ? 1100 : 20000, ctx.currentTime, on ? 0.05 : 0.09); }
  function setVolumes(m, s) { vols = [m, s]; if (ctx) { music.gain.value = 0.34 * m; sfx.gain.value = 0.9 * s; } }
  function setMood(m) { if (m !== mood) { mood = m; musicTimer = 0; } }
  function suspend(on) { if (!ctx) return; const p = on ? ctx.suspend() : ctx.resume(); if (p && p.catch) p.catch(() => {}); }

  // fresh water near him (rivers.js): a fall's roar, low and full, and a stream's chatter over it; each 0-1, set every frame from how near they are
  let fw = null;
  function freshwater(babble, roar) {
    if (!ctx || (!fw && babble + roar < 0.01)) return;
    if (!fw) {
      const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), n2 = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g2 = ctx.createGain();
      n.buffer = noiseBuf; n.loop = true; lp.type = 'lowpass'; lp.frequency.value = 760; g.gain.value = 0;
      n2.buffer = noiseBuf; n2.loop = true; n2.playbackRate.value = 1.9; bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 0.8; g2.gain.value = 0;
      n.connect(lp); lp.connect(g); g.connect(sfx); n2.connect(bp); bp.connect(g2); g2.connect(sfx); n.start(); n2.start(0, 1.3);
      fw = { g, g2 };
    }
    const t = ctx.currentTime; fw.g.gain.setTargetAtTime(roar * 0.62 + babble * 0.07, t, 0.35); fw.g2.gain.setTargetAtTime(babble * 0.55 + roar * 0.35, t, 0.35);
  }
  return { start, update, hit, swing, bell, pearl, roar, splash, bubble, whale, boom, tell, whirr, whirrAt, spoutRoar, freshwater, setUnder, setVolumes, setMood, suspend, get on() { return !!ctx; } };
}
