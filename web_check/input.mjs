// C1: every action, by touch alone, by mouse, and by keys alone, on the real page, read from the game's own state.
// Touch: a phone upright and turned. In Chromium real fingers through the devtools (two at once: the stick held, a look on the right). WebKit has no fingers here: touch-typed PointerEvents on what's under the point, as the platform's own kit drives it.
// Every .btn on the page has to be driven: a button this file doesn't know is a FAIL by its own line, so a new power can't go unchecked.
//   node input.mjs <base> <chromium|webkit> [--only=C1t,C1m,C1k] [--out=dir]
import { gate, PHONE, DESK } from './lib/h.mjs';
const W = await gate('input', { budget: 170 });
const { line, note, open, section, finish, engine, out, want } = W;
const state = (page) => page.evaluate(() => { const G = window.__game, h = G.hero; return { x: h.pos.x, y: h.pos.y, z: h.pos.z, sp: h.speed, st: h.state, yaw: G.camYaw, pitch: G.camPitch, surge: h.surge, hp: h.hp, cool: { ...h.cool }, land: h.land, air: h.air, ride: !!h.ride, paused: G.paused, tide: h.tide, stance: G.stance || h.stance || null, thrown: !!document.querySelector('#bCast.call') }; });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const diveReady = (page) => page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none' && window.__game && window.__game.booted; }, null, { timeout: 45000 });
const openPowers = (page) => page.evaluate(() => { const G = window.__game, h = G.hero; for (const k in h.powers) h.powers[k] = true; h.powers.ice = true; if (G.combat && G.combat.unlockStance) G.combat.unlockStance('ice'); ['dash', 'spin', 'wave', 'call', 'cast'].forEach((k) => G.ui.unlock(k)); h.tide = h.maxTide = 400; if (G.enemies.clearAll) G.enemies.clearAll(); });
const openWater = (page) => page.evaluate(() => { const Q = window.__qa, w = Q.openWater(40), G = window.__game; Q.calm(); G.hero.inv = 0; Q.swimAt(w.x, w.y, w.z); Q.aim(w.ax, w.ay, 0); return w; });

// fingers: real in Chromium, typed in WebKit
function hands(page, ctx) {
  const P = new Map(); let cdp = null;
  const send = async (type, pts) => { cdp = cdp || await ctx.newCDPSession(page); await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([id, p]) => ({ id, x: p.x, y: p.y })) }); };
  const typed = (type, id, x, y) => page.evaluate(([type, id, x, y]) => { window.__tt = window.__tt || {}; const el = type === 'pointerdown' ? (window.__tt[id] = document.elementFromPoint(x, y) || document.body) : window.__tt[id] || document.body; el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 1, buttons: type === 'pointerup' ? 0 : 1, button: 0 })); }, [type, id, x, y]);
  return {
    async down(id, x, y) { if (engine === 'chromium') { P.set(id, { x, y }); await send(P.size === 1 ? 'touchStart' : 'touchStart', [...P]); } else await typed('pointerdown', id, x, y); },
    async move(id, x, y) { if (engine === 'chromium') { P.set(id, { x, y }); await send('touchMove', [...P]); } else await typed('pointermove', id, x, y); },
    async up(id) { if (engine === 'chromium') { const p = P.get(id); P.delete(id); await send('touchEnd', []); if (P.size) { await send('touchStart', [...P]); await send('touchMove', [...P]); } void p; } else { await typed('pointerup', id, 0, 0); } },
    async tap(x, y, ms = 150) { await this.down(7, x, y); await page.waitForTimeout(ms); await this.up(7); },
  };
}
const centre = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; }, sel);
const shown = (page) => page.evaluate(() => [...document.querySelectorAll('.btn')].map((b) => b.id));

await section(['C1t.dive', 'C1t.stick', 'C1t.look', 'C1t.boost', 'C1t.strike', 'C1t.parry', 'C1t.dash', 'C1t.spin', 'C1t.wave', 'C1t.call', 'C1t.cast', 'C1t.p4', 'C1t.stance', 'C1t.jump', 'C1t.ride', 'C1t.all', 'C1t.pause', 'C1t.size', 'C1t.upright', 'C1t.turned', 'C1t.errors'], async () => {
  const { page, ctx, errors, close } = await open('?fresh&tier=phone', { ctx: PHONE }); const T = hands(page, ctx);
  await diveReady(page);
  // a click-handled button: Playwright's own tap in WebKit, whose typed pointers make no click; a real finger in Chromium
  const tapEl = async (sel) => { if (engine === 'webkit') await page.tap(sel); else { const [x, y] = await centre(page, sel); await T.tap(x, y); } };
  await tapEl('#dive'); await page.waitForTimeout(700);
  const started = await page.evaluate(() => window.__game.started); line('C1t.dive', started, `the Dive button by touch starts the game: ${started}`);
  await openWater(page); await page.waitForTimeout(100);
  const [sx, sy] = await centre(page, '#stick');
  const a = await state(page); await T.down(1, sx, sy); await T.move(1, sx, sy - 50); await page.waitForTimeout(1500); const b = await state(page);
  line('C1t.stick', dist(a, b) > 4, `the stick swims: ${dist(a, b).toFixed(1)} m in 1.5 s (over 4)`);
  const a2 = await state(page); await T.down(2, 300, 300); await T.move(2, 240, 280); await page.waitForTimeout(120); await T.up(2); const b2 = await state(page);
  line('C1t.look', Math.abs(b2.yaw - a2.yaw) > 0.1, `a second finger looks while the first still swims: yaw ${(b2.yaw - a2.yaw).toFixed(2)} rad`);
  const [bx, by] = await centre(page, '#bBoost'); await T.down(3, bx, by); await page.waitForTimeout(2600); const c = await state(page); await T.up(3); await T.up(1);
  line('C1t.boost', c.sp > 30, `Boost held reaches super speed: ${c.sp.toFixed(1)} m/s (over 30)`); await page.waitForTimeout(700);
  await openPowers(page);
  const press = async (sel, wait = 170) => { const [x, y] = await centre(page, sel); await T.tap(x, y, 90); await page.waitForTimeout(wait); return state(page); };
  const known = { bBoost: 1 };
  const one = async (id, sel, read, what, settle = 1300) => { known[sel.slice(1)] = 1; const on = await page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }, sel); if (!on) { line(id, false, `${sel} isn't on the screen when it should be`); return; } let s = await press(sel); for (let k = 0; k < 14 && !read(s); k++) { await page.waitForTimeout(60); s = await state(page); }   /* a power's cooldown starts at its release frame, after its startup */ line(id, read(s), `${what}: ${JSON.stringify(read.show ? read.show(s) : { state: s.st, cool: s.cool })}`); await page.waitForTimeout(settle); };
  await one('C1t.strike', '#bAtk', (s) => s.st === 'attack', 'Strike goes into a blow');
  await one('C1t.parry', '#bParry', (s) => s.st === 'parry', 'Parry goes into a parry', 800);
  await one('C1t.dash', '#bDash', (s) => s.cool.dash > 0, 'Riptide fires');
  await one('C1t.spin', '#bSpin', (s) => s.cool.spin > 0, 'Maelstrom fires');
  await one('C1t.wave', '#bWave', (s) => s.cool.wave > 0, 'Wave fires');
  await one('C1t.call', '#bCall', (s) => s.cool.call > 0, 'Call fires');
  // Homeward Cast (combat's P14): the trident leaves his hand, and the button turns to Recall
  { const has = await page.evaluate(() => !!document.querySelector('#bCast')); if (has) { const a = (s) => s.thrown; a.show = (s) => ({ state: s.st, thrown: s.thrown }); await one('C1t.cast', '#bCast', a, 'Cast throws the trident, and the button says Recall', 2200); } }
  // the fourth power and the stance (EPIC P12a, CR-7): shown when the powers are open; a press has to do something
  await page.waitForTimeout(600); await page.evaluate(() => { const G = window.__game; G.hero.tide = 900; for (const c in G.hero.cool) G.hero.cool[c] = 0; });
  await one('C1t.p4', '#bP4', (s) => s.cool.p4 > 0 || s.st === 'attack', 'the fourth power fires');
  const st0 = await page.evaluate(() => document.body.dataset.stance || (window.__game.hero.stance ?? null));
  await one('C1t.stance', '#bStance', () => true, 'the Stance button is on the screen', 200);
  const st1 = await page.evaluate(() => document.body.dataset.stance || (window.__game.hero.stance ?? null));
  if (st1 === st0) line('C1t.stance', false, `the Stance button changes the stance: still ${st0}`);
  // Ride: beside a whale; Jump: on land
  const near = await page.evaluate(() => { const Q = window.__qa, G = window.__game, w = G.life.whales && G.life.whales[0]; if (!w) return false; const p = w.position || w.pos; G.hero.pos.set(p.x, p.y + 6, p.z); G.hero.prev.copy(G.hero.pos); G.hero.vel.set(0, 0, 0); return true; });
  if (near) { await page.waitForTimeout(450); known.bRide = 1; const on = await page.evaluate(() => getComputedStyle(document.querySelector('#bRide')).display !== 'none'); if (on) { const [x, y] = await centre(page, '#bRide'); await T.tap(x, y, 120); await page.waitForTimeout(300); } const s = await state(page); line('C1t.ride', s.ride, `beside a whale the Ride button shows (${on}) and takes the fin: riding ${s.ride}`); await page.evaluate(() => { window.__game.hero.ride = null; }); } else line('C1t.ride', false, 'no whale in the world to ride');
  const landed = await page.evaluate(() => { const Q = window.__qa, G = window.__game, b = (G.world.data.land || [])[0]; if (!b) return false; Q.walkAt(b.x, b.y); G.hero.inv = 1e6; return true; });
  await page.waitForTimeout(500); known.bJump = 1; const jumpOn = await page.evaluate(() => getComputedStyle(document.querySelector('#bJump')).display !== 'none');
  if (landed && jumpOn) { const before = await state(page); const [x, y] = await centre(page, '#bJump'); await T.tap(x, y, 90); await page.waitForTimeout(220); const s = await state(page); line('C1t.jump', s.air === true || s.y > before.y + 0.5, `on land the Jump button shows and jumps: in the air ${s.air}, up ${(s.y - before.y).toFixed(2)} m`); } else line('C1t.jump', false, `Jump isn't on the screen on land (${landed}, ${jumpOn})`);
  const all = await shown(page), un = all.filter((b) => !known[b]);
  line('C1t.all', un.length === 0, `every button on the page is driven: ${all.length - un.length} of ${all.length}${un.length ? '; no check for ' + un.join(' ') : ''}`);
  await tapEl('#pauseB'); await page.waitForTimeout(300); const p1 = await state(page); await tapEl('#resume'); await page.waitForTimeout(300); const p2 = await state(page);
  line('C1t.pause', p1.paused && !p2.paused, `pause and resume by touch: paused ${p1.paused}, then ${p2.paused}`);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.btn.show,#stick,#pauseB')].map((b) => { const r = b.getBoundingClientRect(); return [b.id, Math.round(Math.min(r.width, r.height))]; }));
  line('C1t.size', sizes.every((s) => s[1] >= 44), `touch targets 44 px or more (QS-C3, Apple; EPIC CR-36): the smallest ${Math.min(...sizes.map((s) => s[1]))} px`); note(`C1t.size, for Android (Google Play's 48 dp, QS-C3; information, not a pass line): ${sizes.filter((s) => s[1] < 48).map((s) => s.join(' ')).join(', ') || 'all at 48 or more'}`);
  const overlap = () => page.evaluate(() => { const list = [...document.querySelectorAll('.btn.show,#stick')].map((b) => [b.id, b.getBoundingClientRect()]), hits = []; for (let i = 0; i < list.length; i++) { const r = list[i][1]; if (r.top < 0 || r.left < 0 || r.right > innerWidth || r.bottom > innerHeight) hits.push(list[i][0] + ' off screen'); for (let j = i + 1; j < list.length; j++) { const a = list[i][1], b = list[j][1]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) hits.push(list[i][0] + '/' + list[j][0]); } } return hits; });
  const o1 = await overlap(); line('C1t.upright', o1.length === 0, `no buttons overlap upright${o1.length ? ': ' + o1.join(' ') : ''}`); await page.screenshot({ path: out + `/upright_${engine}.png` }); await page.waitForTimeout(350);
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(800); const o2 = await overlap(); line('C1t.turned', o2.length === 0, `no buttons overlap turned, none off the screen${o2.length ? ': ' + o2.join(' ') : ''}`); await page.screenshot({ path: out + `/turned_${engine}.png` });
  await openWater(page);     // the jump left him on a beach, facing whatever's there: this reads the stick, not the shore
  const b0 = await state(page); await page.waitForTimeout(350); const tx = await centre(page, '#stick'); await T.down(1, tx[0], tx[1]); await T.move(1, tx[0], tx[1] - 50); await page.waitForTimeout(700); const b1 = await state(page); await T.up(1);
  line('C1t.errors', errors.length === 0 && dist(b0, b1) > 1, `the stick still works turned (${dist(b0, b1).toFixed(1)} m), ${errors.length} errors${errors[0] ? ': ' + errors[0] : ''}`);
  await close();
});

// a mouse, on a computer
await section(['C1m.dive', 'C1m.look', 'C1m.strike', 'C1m.parry', 'C1m.pause', 'C1m.swim', 'C1m.powers'], async () => {
  const { page, errors, close } = await open('?fresh&tier=desktop', { ctx: DESK });
  await diveReady(page); await page.click('#dive'); await page.waitForTimeout(600);
  line('C1m.dive', await page.evaluate(() => window.__game.started), 'a click on Dive starts the game');
  await openWater(page); await openPowers(page);
  const a = await state(page); await page.mouse.move(640, 360); await page.mouse.down(); await page.mouse.move(520, 340, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(150); const b = await state(page);
  line('C1m.look', Math.abs(b.yaw - a.yaw) > 0.1, `a mouse drag looks: yaw ${(b.yaw - a.yaw).toFixed(2)} rad`);
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); }); await page.waitForTimeout(1000);
  await page.mouse.click(640, 360); await page.waitForTimeout(130); const s1 = await state(page); line('C1m.strike', s1.st === 'attack', `a click strikes: ${s1.st}`); await page.waitForTimeout(1200);
  await page.mouse.click(640, 360, { button: 'right' }); await page.waitForTimeout(100); const s2 = await state(page); line('C1m.parry', s2.st === 'parry', `a right click parries: ${s2.st}`); await page.waitForTimeout(800);
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.mouse.click(...(await centre(page, '#pauseB')).slice(0, 2)); await page.waitForTimeout(250); const p1 = await state(page); await page.click('#resume'); await page.waitForTimeout(250); const p2 = await state(page);
  line('C1m.pause', p1.paused && !p2.paused, `pause and resume by mouse: paused ${p1.paused}, then ${p2.paused}`);
  await openWater(page); await page.waitForTimeout(80); const c = await state(page); await page.mouse.move(640, 300); await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up(); const d = await state(page);
  line('C1m.swim', dist(c, d) > 3, `the mouse alone can swim (GameSnacks: "entirely playable using mouse input"): holding the button moved him ${dist(c, d).toFixed(1)} m (over 3)`);
  const pw = await page.evaluate(() => { const Q = window.__qa, list = ['bDash', 'bSpin', 'bWave', 'bCall', 'bCast'].filter((x) => document.getElementById(x)); return list.map((id) => { const e = document.getElementById(id); return [id, !!e && Q.vis(e) && parseFloat(getComputedStyle(e).pointerEvents === 'none' ? 0 : 1) > 0]; }); }), off = pw.filter((p) => !p[1]);
  line('C1m.powers', off.length === 0, `the powers can be reached with the mouse alone (GameSnacks: "entirely playable using mouse input"): ${pw.length - off.length} of ${pw.length} on the screen${off.length ? '; keys only: ' + off.map((p) => p[0]).join(' ') : ''}`);
  if (errors.length) line('C1m.errors', false, errors[0]);
  await close();
});

// keys alone
await section(['C1k.start', 'C1k.swim', 'C1k.boost', 'C1k.strike', 'C1k.parry', 'C1k.powers', 'C1k.jump', 'C1k.look', 'C1k.pause'], async () => {
  const { page, close } = await open('?fresh&tier=desktop', { ctx: DESK });
  await diveReady(page); await page.keyboard.press('Enter'); await page.waitForTimeout(300); let st = await page.evaluate(() => window.__game.started);
  if (!st) { await page.keyboard.press('Space'); await page.waitForTimeout(300); st = await page.evaluate(() => window.__game.started); }
  line('C1k.start', st, `keys alone start the game from the title (Enter or Space): ${st}`);
  if (!st) await page.click('#dive');
  await page.waitForTimeout(400); await openWater(page); await openPowers(page);
  const a = await state(page); await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); const b = await state(page); line('C1k.swim', dist(a, b) > 3, `W swims: ${dist(a, b).toFixed(1)} m`);
  await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(2400); const c = await state(page); line('C1k.boost', c.sp > 30, `Shift held reaches super speed: ${c.sp.toFixed(1)} m/s`); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW'); await page.waitForTimeout(700);
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(120); const d = await state(page); line('C1k.strike', d.st === 'attack', `J strikes: ${d.st}`); await page.waitForTimeout(1200);
  await page.keyboard.press('KeyL'); await page.waitForTimeout(100); const e = await state(page); line('C1k.parry', e.st === 'parry', `L parries: ${e.st}`); await page.waitForTimeout(800);
  const got = {}; for (const [k, n] of [['KeyK', 'dash'], ['KeyQ', 'spin'], ['KeyE', 'wave'], ['KeyR', 'call']]) { await page.keyboard.press(k); let c = 0; for (let q = 0; q < 16 && !(c > 0); q++) { await page.waitForTimeout(60); c = (await state(page)).cool[n]; } got[n] = +c.toFixed(1); await page.waitForTimeout(1200); }
  if (await page.evaluate(() => !!document.querySelector('#bCast'))) { await page.keyboard.press('KeyV'); let t = false; for (let q = 0; q < 16 && !t; q++) { await page.waitForTimeout(60); t = (await state(page)).thrown; } got.cast = t ? 1 : 0; await page.waitForTimeout(600); }
  line('C1k.powers', Object.values(got).every((v) => v > 0), `K, Q, E, R${got.cast === undefined ? '' : ', V'} fire: ${JSON.stringify(got)}`);
  await page.evaluate(() => { const Q = window.__qa, G = window.__game, b = (G.world.data.land || [])[0]; if (b) Q.walkAt(b.x, b.y); }); await page.waitForTimeout(300); const j0 = await state(page); await page.keyboard.press('Space'); await page.waitForTimeout(200); const j1 = await state(page); line('C1k.jump', j1.air === true || j1.y > j0.y + 0.5, `Space jumps on land: in the air ${j1.air}`); await page.waitForTimeout(900);
  await openWater(page); const l0 = await state(page); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(600); await page.keyboard.up('ArrowLeft'); const l1 = await state(page); line('C1k.look', Math.abs(l1.yaw - l0.yaw) > 0.1, `keys alone can look around (GameSnacks: "should"): an arrow key turned the view ${(l1.yaw - l0.yaw).toFixed(2)} rad`);
  await page.keyboard.press('KeyP'); await page.waitForTimeout(200); const p = await state(page); await page.keyboard.press('KeyP'); await page.waitForTimeout(200); const p2 = await state(page); line('C1k.pause', p.paused && !p2.paused, `P pauses and resumes: ${p.paused}, ${p2.paused}`);
  await close();
});
await finish();
