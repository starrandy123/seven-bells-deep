// Q13: the visible response to a press starts within 50 ms of the input event (ours). For every action, at phases spread across the frame: from the press to the first frame drawn with the changed state, the game's own loop at 60 Hz, phone size.
// The press is a real pointer event on the real button (WebKit and Chromium alike: this reads the game, not the fingers). The clock starts at the event's handler; a phone's touch and display add their own on top, which is why the bound is 50 ms inside the 100 ms class.
//   node lag.mjs <base> <chromium|webkit> [--only=Q13]
import { gate, PHONE } from './lib/h.mjs';
const W = await gate('lag', { budget: 120 });
const { line, note, open, section, finish } = W;
await section(['Q13'], async () => {
  const { page, close } = await open('?fresh&tier=phone', { ctx: PHONE });
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 30000 }); await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const Q = window.__qa, G = window.__game, h = G.hero, w = Q.openWater(40); Q.calm(); h.inv = 1e6; Q.swimAt(w.x, w.y, w.z); Q.aim(w.ax, w.ay, 0); for (const k in h.powers) h.powers[k] = true; ['dash', 'spin', 'wave', 'call', 'cast'].forEach((k) => G.ui.unlock(k)); h.tide = h.maxTide = 900;
    const sig = () => `${h.state}|${h.atk ? h.atk.name : ''}|${Object.values(h.cool).map((c) => (c > 0 ? 1 : 0)).join('')}`;
    let waiting = null; const render = G.look.render; G.look.render = (...a) => { if (waiting && sig() !== waiting.s) { waiting.done(performance.now() - waiting.t0); waiting = null; } return render.apply(G.look, a); };
    const press = (id) => new Promise((done) => { const b = document.getElementById(id), c = b.getBoundingClientRect(), o = { pointerId: 81, pointerType: 'touch', clientX: c.left + c.width / 2, clientY: c.top + c.height / 2, bubbles: true, cancelable: true }; waiting = { s: sig(), t0: performance.now(), done }; b.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1 })); b.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 })); setTimeout(() => { if (waiting) { waiting = null; done(-1); } }, 400); });
    const out = {};
    for (const id of ['bAtk', 'bParry', 'bDash', 'bSpin', 'bWave', 'bCall', 'bCast'].filter((x) => document.getElementById(x))) {
      const list = [], tries = id === 'bAtk' || id === 'bParry' ? 5 : 1;   // a power has a cooldown the wall can't clear: it's read once, fresh, at its first press
      for (let i = 0; i < tries; i++) { await new Promise((d) => setTimeout(d, 900 + ((i * 3.7) % 16.7))); for (const c in h.cool) h.cool[c] = 0; h.tide = 900; Q.calm(); h.inv = 1e6; await new Promise((d) => setTimeout(d, (i * 3.7) % 16.7)); list.push(await press(id)); }
      out[id] = list;
    }
    return out;
  });
  const rows = Object.entries(r).map(([k, v]) => [k, Math.max(...v), v.filter((x) => x < 0).length]), worst = Math.max(...rows.map((x) => x[1])), none = rows.filter((x) => x[2] > 0);
  line('Q13', worst <= 50 && none.length === 0, `press to the first changed drawn state, 5 presses of Strike and Parry at spread phases, one of each power: worst ${worst.toFixed(1)} ms (≤ 50): ${rows.map((x) => `${x[0]} ${x[1].toFixed(0)}`).join(', ')}${none.length ? `; no change in 400 ms: ${none.map((x) => x[0]).join(' ')}` : ''}`);
  await close();
});
await finish();
