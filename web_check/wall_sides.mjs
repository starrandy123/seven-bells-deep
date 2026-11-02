// Water or fire (EPIC V15): chosen on the home screen with a real tap, switched from the pause screen, kept for the next visit. Flight by the player's own Jump button.
//   node wall_sides.mjs <base> <chromium|webkit>
import { gate } from './lib/h.mjs';
const { line, note, open, section, finish, out } = await gate('wall_sides', { budget: 150 });
const QA = '/Users/randy/Documents/UnrealProjects/DrownedCity_fire/web_check/lib/qa_page.js'; void QA;
const TURNED = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const tap = async (page, sel) => { const b = await page.locator(sel).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
await section(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'], async () => {
  const { page, ctx, errors, close } = await open('?fresh&tier=phone', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 40000 }); await page.waitForTimeout(400);
  const seen = await page.evaluate(() => ({ w: !!document.querySelector('#pickWater'), f: !!document.querySelector('#pickFire'), on: document.querySelector('#pickWater').classList.contains('on'), side: window.__game.sideNow, vis: getComputedStyle(document.querySelector('#sidePick')).display }));
  line('S1', seen.w && seen.f && seen.on && seen.side === 'water' && seen.vis !== 'none', `the home screen offers Water and Fire, Water first for a new player: ${JSON.stringify(seen)}`);
  await page.screenshot({ path: `${out}/title_water.jpg`, type: 'jpeg', quality: 80 });
  await tap(page, '#pickFire'); await page.waitForTimeout(700);
  const man = await page.evaluate(() => { const G = window.__game, H = G.ember.heroForm, h = G.hero; return { side: G.sideNow, man: H.man.visible, fire: H.fire.visible, own: H.own.some((o) => o.visible), y: h.pos.y, land: h.land, z: -h.pos.z, x: h.pos.x, line: document.querySelector('#titleLine').textContent }; });
  await page.screenshot({ path: `${out}/title_fire.jpg`, type: 'jpeg', quality: 80 });
  line('S2', man.side === 'fire' && man.man && !man.own && man.land && man.y > 5, `a tap on Fire: the man in red, not the Warden, on the Burnt Isle: ${JSON.stringify(man)}`);
  await tap(page, '#dive'); await page.waitForTimeout(1200);
  const labels = await page.evaluate(() => ['bStance', 'bDash', 'bSpin', 'bWave', 'bP4', 'bCast', 'bCall'].map((i) => document.getElementById(i).textContent + (document.getElementById(i).classList.contains('locked') ? ' (locked)' : '')));
  line('S3', labels[0] === 'Fire' && labels[6] === 'Super' && !labels.some((l) => /locked/.test(l)), `his hotbar is the fire kit, nothing locked: ${labels.join(', ')}`);
  await page.screenshot({ path: `${out}/play_fire.jpg`, type: 'jpeg', quality: 80 });
  // his flight: Boost and Jump together, then Boost reads Fly. Driven through the input the buttons feed, since two thumbs held at once can't be tapped from here in WebKit
  await page.evaluate(() => { const Q = window.__qa, G = window.__game; window.__ys = []; Q.drive({ boost: true, jump: true, my: 0, mx: 0 }); }); await page.waitForTimeout(120); await page.evaluate(() => { window.__qa.drive({ boost: false, my: 0, mx: 0 }); });
  const ups = []; for (let i = 0; i < 6; i++) { await page.waitForTimeout(90); ups.push(await page.evaluate(() => +window.__game.hero.vel.y.toFixed(1))); }
  const air = await page.evaluate(() => { const h = window.__game.hero; return { air: h.air, fireAir: h.fireAir, y: +h.pos.y.toFixed(1), label: document.getElementById('bBoost').textContent }; });
  const eased = ups.every((v, i) => !i || v >= ups[i - 1] - 3);
  line('S4', air.fireAir && air.label === 'Fly' && eased, `Boost and Jump take off, the lift eased in: speed up ${ups.join(' ')}, and Boost reads "${air.label}"`);
  await page.evaluate(() => window.__qa.drive({ boost: true, my: 0, mx: 0 })); await page.waitForTimeout(2600); await page.evaluate(() => window.__qa.drive({ boost: false, my: 0, mx: 0 })); await page.waitForTimeout(3600);
  const fly = await page.evaluate(() => { const h = window.__game.hero; return { fly: h.fly, y: +h.pos.y.toFixed(1), vy: +h.vel.y.toFixed(1) }; }); await page.waitForTimeout(700); const still = await page.evaluate(() => +window.__game.hero.pos.y.toFixed(1));
  await page.evaluate(() => window.__qa.drive({ boost: false, jumpHeld: true, my: 0, mx: 0 })); await page.waitForTimeout(900); const gl = await page.evaluate(() => { const h = window.__game.hero; return { vy: +h.vel.y.toFixed(1), y: +h.pos.y.toFixed(1), fly: h.fly }; }); await page.evaluate(() => window.__qa.drive({ jumpHeld: false, my: 0, mx: 0 }));
  line('S5', fly.fly && Math.abs(still - fly.y) < 2.5 && gl.fly && gl.vy < -1.5 && gl.vy > -17, `let go of Fly and he hovers (${fly.y} then ${still} m), and Jump held takes him down at ${gl.vy} m/s`);
  await page.evaluate(() => { const b = window.__game.ember; b.heroSuper(); }); await page.waitForTimeout(300);
  const sup = await page.evaluate(() => { const H = window.__game.ember.heroForm; return { man: H.man.visible, fire: H.fire.visible, t: H.sup }; }); line('S6', sup.fire && !sup.man, `Super: the all-fire form: ${JSON.stringify(sup)}`);
  await page.screenshot({ path: `${out}/super_fire.jpg`, type: 'jpeg', quality: 80 });
  await tap(page, '#bPause').catch(() => page.evaluate(() => window.__game.ui.setPause(true))); await page.waitForTimeout(500);
  const shown = await page.evaluate(() => { const m = document.querySelector('#menu'); return { on: m.classList.contains('on'), t: document.querySelector('#swapSide').textContent }; });
  await tap(page, '#swapSide'); await page.waitForTimeout(400);
  const back = await page.evaluate(() => { const G = window.__game, H = G.ember.heroForm; return { side: G.sideNow, own: H.own.some((o) => o.visible), man: H.man.visible, fire: H.fire.visible, stance: document.getElementById('bStance').textContent, t: document.querySelector('#swapSide').textContent }; });
  line('S7', back.side === 'water' && back.own && !back.man && !back.fire && back.stance === 'Water', `from the pause screen, "${shown.t}": the Warden is back: ${JSON.stringify(back)}`);
  await tap(page, '#swapSide'); await page.waitForTimeout(300); await page.reload(); await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 40000 }); await page.waitForTimeout(500);
  const kept = await page.evaluate(() => { const G = window.__game; return { side: G.sideNow, man: G.ember.heroForm.man.visible }; }); const bad = errors.filter((x) => !/qa\.js|Failed to load resource/.test(x));
  line('S8', kept.side === 'fire' && kept.man && bad.length === 0, `the next visit starts on the side he left: ${JSON.stringify(kept)}; ${bad.length} page errors${bad[0] ? ': ' + bad[0].slice(0, 200) : ''}`);
  await close();
});
// Real fingers, two at once: the devtools can press them in Chromium, WebKit can't. Boost held by one and Jump by another, then one thumb sliding off Boost and onto Jump, which is how a phone is really held
if (process.argv[3] === 'chromium') await section(['S9', 'S10'], async () => {
  const { page, close } = await open('?fresh&tier=phone', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 60000 }); await page.waitForTimeout(400);
  await tap(page, '#pickFire'); await page.waitForTimeout(700); await tap(page, '#dive'); await page.waitForTimeout(1600);
  const cdp = await page.context().newCDPSession(page), box = (id) => page.evaluate((i) => { const r = document.getElementById(i).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id), touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const hero = () => page.evaluate(() => { const h = window.__game.hero; return { skim: !!h.skim, fly: !!h.fly, air: !!h.air, fireAir: !!h.fireAir, y: +h.pos.y.toFixed(1), label: document.getElementById('bBoost').textContent, side: window.__game.sideNow }; });
  const B = await box('bBoost'), J = await box('bJump');
  const f1 = { x: B.x, y: B.y, id: 1 }, f2 = { x: J.x, y: J.y, id: 2 };
  await touch('touchStart', [f1]); await page.waitForTimeout(500); const a = await hero();
  await touch('touchStart', [f1, f2]); await page.waitForTimeout(100); await touch('touchMove', [f1]); await page.waitForTimeout(1200); const b = await hero(); await page.waitForTimeout(1200); const c = await hero();
  await touch('touchEnd', []); await page.waitForTimeout(1000); const d = await hero();
  line('S9', a.skim && b.fireAir && c.fly && b.y > a.y + 4 && d.fly && Math.abs(d.y - c.y) < 12, `two real fingers: Boost held runs on the jets (${a.skim}, label ${a.label}), a second finger on Jump launches him to ${b.y} m from ${a.y}, Boost still held flies (${c.fly}, label ${c.label}), let go and he hovers (${d.fly}, at ${d.y} m)`);
  // Jump held takes him down, and back in the sea the same two thumbs work again
  await touch('touchStart', [f2]); await page.waitForFunction(() => { const h = window.__game.hero; return !h.fly; }, null, { timeout: 12000 }).catch(() => {}); await touch('touchEnd', []); await page.waitForTimeout(600); const e = await hero();
  await touch('touchStart', [f1]); await page.waitForTimeout(450); const g = await hero(); await touch('touchEnd', []); await page.waitForTimeout(130); await touch('touchStart', [{ ...f2, id: 3 }]); await page.waitForTimeout(90); await touch('touchEnd', []); await page.waitForTimeout(900); const k = await hero();
  line('S10', g.skim && k.fireAir && k.y > e.y + 4, `one thumb slides from Boost to Jump in 130 ms and the jump still comes: ${e.y} to ${k.y} m`);
  await close();
});
// A phone drops the graphics context when the player leaves the app. The ground comes back from the files, and the Burnt Isle is painted over them, so it has to be painted again or the isle comes back green
await section(['S11'], async () => {
  const { page, close } = await open('?fresh&tier=phone', { ctx: TURNED, wait: false });
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 60000 }); await page.waitForTimeout(400);
  await tap(page, '#pickFire'); await page.waitForTimeout(700); await tap(page, '#dive'); await page.waitForTimeout(1600);
  await page.evaluate(() => { window.__qa.walkAt(246, -760); window.__game.camPitch = 0.45; }); await page.waitForTimeout(3500);
  const pic = async () => { const b = await page.screenshot({ type: 'jpeg', quality: 80 }); return page.evaluate(async (u) => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = 32; c.height = 16; const x = c.getContext('2d'); x.drawImage(i, 0, 0, 32, 16); return [...x.getImageData(0, 9, 32, 7).data]; }, 'data:image/jpeg;base64,' + b.toString('base64')); };
  const a = await pic(); await page.screenshot({ path: `${out}/isle_before.jpg`, type: 'jpeg', quality: 80 });
  const ok = await page.evaluate(() => new Promise((res) => { const g = window.__game.renderer.getContext(), e = g.getExtension('WEBGL_lose_context'); if (!e) return res(false); e.loseContext(); setTimeout(() => { e.restoreContext(); res(true); }, 700); }));
  await page.waitForTimeout(6000); const b = await pic(); await page.screenshot({ path: `${out}/isle_after.jpg`, type: 'jpeg', quality: 80 });
  let d = 0, green = 0; for (let i = 0; i < a.length; i += 4) { d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); if (b[i + 1] > b[i] + 12 && b[i + 1] > b[i + 2] + 12) green++; } d /= (a.length / 4) * 3;
  line('S11', !ok || (d < 26 && green < 12), ok ? `a lost and restored context leaves the isle as it was: ${d.toFixed(1)} of 255 apart, ${green} of ${a.length / 4} blocks green` : 'this engine offers no way to lose a context here');
  await close();
});
await finish();
