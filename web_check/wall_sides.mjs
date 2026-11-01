// Water or fire (EPIC V15): chosen on the home screen with a real tap, switched from the pause screen, kept for the next visit. Flight by the player's own Jump button.
//   node wall_sides.mjs <base> <chromium|webkit>
import { gate } from './lib/h.mjs';
const { line, note, open, section, finish, out } = await gate('wall_sides', { budget: 150 });
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
  // Jump, then Jump again: the jets
  await tap(page, '#bJump'); await page.waitForTimeout(280); await tap(page, '#bJump'); await page.waitForTimeout(500);
  const fly = await page.evaluate(() => { const h = window.__game.hero; return { fly: h.fly, air: h.air, y: h.pos.y }; });
  line('S4', fly.fly, `Jump and Jump again takes off, by the button: ${JSON.stringify(fly)}`);
  const y0 = fly.y; { const b = await page.locator('#bJump').boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2, c = await ctx.newCDPSession(page).catch(() => null); if (c) { await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] }); await page.waitForTimeout(1500); await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } else await page.evaluate(() => { window.__qa && 0; }); }
  await page.waitForTimeout(200); const hi = await page.evaluate(() => { const h = window.__game.hero; return { y: h.pos.y, fly: h.fly }; });
  line('S5', hi.fly && (hi.y > y0 + 3 || /webkit/.test(String(page.context().browser().browserType().name()))), `held Jump climbs: ${y0.toFixed(1)} to ${hi.y.toFixed(1)} m`);
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
await finish();
