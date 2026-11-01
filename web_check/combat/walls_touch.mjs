// Combat by touch alone, on the real page in real time, on a phone upright: the Ice slots, Frost Guard, the Whip, the song held, the Homeward Cast, and Ice Path under a surf. Fingers as input.mjs
// has them: real in Chromium, touch-typed PointerEvents in WebKit, which is how the platform's own kit drives it.      node walls_touch.mjs <base> <chromium|webkit> [--out=dir]
import { gate, PHONE } from '../lib/h.mjs';
const W = await gate('combat_touch', { budget: 170 }); const { line, note, open, finish, engine } = W;
function hands(page, ctx) {
  const P = new Map(); let cdp = null;
  const send = async (type, pts) => { cdp = cdp || await ctx.newCDPSession(page); await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([id, p]) => ({ id, x: p.x, y: p.y })) }); };
  const typed = (type, id, x, y) => page.evaluate(([type, id, x, y]) => { window.__tt = window.__tt || {}; const el = type === 'pointerdown' ? (window.__tt[id] = document.elementFromPoint(x, y) || document.body) : window.__tt[id] || document.body; el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: id + 10, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1 })); }, [type, id, x, y]);
  return {
    async down(id, x, y) { if (engine === 'chromium') { P.set(id, { x, y }); await send('touchStart', [...P]); } else await typed('pointerdown', id, x, y); },
    async up(id) { if (engine === 'chromium') { P.delete(id); await send('touchEnd', []); if (P.size) await send('touchStart', [...P]); } else await typed('pointerup', id, 0, 0); },
    async tap(x, y, ms = 90) { await this.down(7, x, y); await page.waitForTimeout(ms); await this.up(7); },
  };
}
const centre = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
const { page, ctx, errors } = await open('?fresh&tier=phone', { ctx: PHONE }); const T = hands(page, ctx);
await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none' && window.__game && window.__game.booted; }, null, { timeout: 45000 });
if (engine === 'webkit') await page.tap('#dive'); else { const [x, y] = await centre(page, '#dive'); await T.tap(x, y, 150); } await page.waitForTimeout(700);
const fresh = () => page.evaluate(() => { const Q = window.__qa, G = window.__game, h = G.hero, w = Q.openWater(40); Q.calm(); h.inv = 1e6; h.hp = h.maxHp = 900; h.tide = h.maxTide = 900; for (const k in h.powers) h.powers[k] = true; h.powers.ice = true; G.combat.unlockStance && G.combat.unlockStance('ice'); ['dash', 'spin', 'wave', 'call', 'cast'].forEach((p) => G.ui.unlock(p)); Q.swimAt(w.x, w.y, w.z); Q.aim(w.ax, w.ay, 0); G.combat.reset(); G.enemies.clearAll(); G.combat.log.length = 0; for (const c in G.hero.cool) G.hero.cool[c] = 0; for (const c in G.combat.cool) G.combat.cool[c] = 0; return w; });
const seen = (type, id) => page.evaluate(([type, id]) => window.__game.combat.log.filter((l) => l.type === type && (!id || l.id === id)).length, [type, id]);
const press = async (sel, wait = 260) => { const c = await centre(page, sel); if (!c) return false; await T.tap(c[0], c[1]); await page.waitForTimeout(wait); return true; };
await fresh(); await page.waitForTimeout(600);       // showSlots runs on the half second
await page.evaluate(() => window.__game.combat.setStance('water', true));
// the Stance button, then each Ice slot by its own button
await press('#bStance', 400); const st = await page.evaluate(() => window.__game.combat.stance); line('T1.stance', st === 'ice', `the Stance button by touch: ${st}`);
for (const [sel, id] of [['#bDash', 'lance'], ['#bSpin', 'glacier'], ['#bWave', 'breath']]) { await page.evaluate(() => { const G = window.__game; G.combat.reset(); G.combat.log.length = 0; for (const c in G.combat.cool) G.combat.cool[c] = 0; G.hero.tide = 900; }); await page.waitForTimeout(80); await press(sel, 320); const n = await seen('start', id); line('T2.' + id, n === 1, `${sel} in Ice starts ${id} (${n})`); await page.waitForTimeout(900); }
{ await page.evaluate(() => { const G = window.__game; G.combat.reset(); G.combat.log.length = 0; for (const c in G.combat.cool) G.combat.cool[c] = 0; }); await press('#bP4', 300); const c = await page.evaluate(() => window.__game.combat.cool.icepath || 0); line('T2.icepath', c > 0, `#bP4 in Ice lays Ice Path (cooldown ${c.toFixed(1)} s)`); }
{ await page.evaluate(() => { const G = window.__game; G.combat.reset(); G.combat.log.length = 0; }); await press('#bParry', 200); const n = await seen('start', 'guard'); line('T2.guard', n === 1, `#bParry in Ice is Frost Guard (${n})`); await page.waitForTimeout(500); }
// the Whip: Strike at range, in Water
{ await fresh(); await page.evaluate(() => { const G = window.__game, h = G.hero; G.combat.setStance('water', true); const s = Math.sin(G.camYaw), c = Math.cos(G.camYaw), e = G.enemies.spawn('reaver', new h.pos.constructor(h.pos.x + s * 11, h.pos.y, h.pos.z + c * 11)); e.hp = e.maxHp = 1e4; e.state = 'stun'; e.t = 20; G.combat.log.length = 0; }); await page.waitForTimeout(120); await press('#bAtk', 520); const a = await seen('start', 'whip'), b = await page.evaluate(() => window.__game.combat.log.filter((l) => l.type === 'hit' && l.id === 'whip').length); line('T3.whip', a === 1 && b >= 1, `Strike at 11 m is the Whip by touch: started ${a}, landed ${b}`); }
// the song: a tap sings; held, it goes on to the pack
{ await fresh(); await page.waitForTimeout(200); const c = await centre(page, '#bCall'); await T.down(4, c[0], c[1]); await page.waitForTimeout(1050); const charging = await page.evaluate(() => window.__game.combat.charging); await T.up(4); await page.waitForTimeout(350); const song = await seen('song'), pack = await seen('start', 'call'); line('T4.song', song === 1, `#bCall sings (${song})`); line('T4.hold', charging && pack === 1, `held 1 s it stays charging (${charging}) and letting go calls the pack (${pack}), which needs ui.js's input.callHeld`); }
// the Homeward Cast
{ await fresh(); await page.waitForTimeout(200); const has = await centre(page, '#bCast'); if (!has) line('T5.cast', false, 'no #bCast on the page yet: ui.js and index.html are with missions'); else { await press('#bCast', 500); const out = await page.evaluate(() => window.__game.combat.powers.home.out), label = await page.evaluate(() => document.querySelector('#bCast').textContent); await press('#bCast', 1500); const back = await page.evaluate(() => window.__game.combat.powers.home.out); line('T5.cast', out && !back, `#bCast throws (${out}, the button says ${label}) and calls it home (back in hand: ${!back})`); } }
// Ice Path under a surf: boost along the top of the sea, up on a swell, then the slot
{
  await fresh(); const went = await page.evaluate(() => new Promise((done) => { const Q = window.__qa, G = window.__game, h = G.hero, w = Q.openWater(90); G.combat.setStance('ice', true); Q.swimAt(w.x, w.y, -0.7, 0, 0, 0, 0); Q.aim(w.ax, w.ay, 0); h.pos.y = -0.7; h.inv = 1e6; Q.drive({ my: 1, mx: 0, boost: true }); let n = 0; const id = setInterval(() => { n++; if (h.state === 'surf' || n > 240) { clearInterval(id); done(h.state === 'surf'); return; } h.pos.y = Math.max(h.pos.y, -0.7); if (Math.hypot(h.vel.x, h.vel.z) < 13) h.vel.set(Math.sin(G.camYaw) * 14, 0, Math.cos(G.camYaw) * 14); }, 8); }));
  await press('#bP4', 900); const r = await page.evaluate(() => { const G = window.__game, h = G.hero, Q = window.__qa; Q.drive(null); return { plates: G.icePath.plates.length, state: h.state, land: h.land, sp: Math.hypot(h.vel.x, h.vel.z) }; }); line('T6.surf', went && r.plates >= 3, `surfing ${went}, then the slot by touch: ${r.plates} plates under him, ${r.state}${r.land ? ' on the ice' : ''} at ${r.sp.toFixed(1)} m/s`);
}
if (errors.length) line('ERR', false, errors[0]); await finish();
