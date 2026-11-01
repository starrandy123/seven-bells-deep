// C2-C6, E1: the phone's screen. Every number is read off the page at a phone's size.
//   C2  turned mid-game ten times and resized: the picture fills it, the rules see it, the HUD stays on it, the state is untouched, something is drawn.
//   C3  touch targets: gameplay controls 44 x 44 or more, 12 px apart (Apple); menu controls 28 x 28 or more, at 375 x 667 and 430 x 932, upright and turned. Every control shown at once: the worst case.
//   C4  the notch, the island and the home bar: an iPhone's insets (59/34 upright, 59/59/21 turned), no control or HUD inside them. Chromium applies them for real where its devtools can (env() then answers); else, and in WebKit, the page's own --top/--left/--right/--bottom are set.
//   C5  browser gestures: a double tap and a long press change nothing; Space and the arrows don't scroll a tall host page; nothing selects.
//   C6  thumbs (a SHOULD): the stick lands where the left thumb lands; a right-side drag looks; every button shows a press.
//   E1  text: 11 px or more everywhere; 17 px or more for HUD and body text (the standard's automatic test, Apple's default size); a shot at 800 x 450 at 1x for a person to read.
//   node ui.mjs <base> <chromium|webkit> [--only=C2,C2s,C3,C3m,C4,C4s,C5,C5k,C6,C6s,C6p,E1,E1h]
import { gate, PHONE } from './lib/h.mjs';
const W = await gate('ui', { budget: 170 });
const { line, note, open, section, finish, engine, base, out } = W;
const dive = async (page) => { await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 30000 }); await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(700); };
const HUD = '.btn.show,#stick,#pauseB,#vitals,#obj,#compass,#dist,#bossbar.on,#tip.on,#toast.on';

await section(['C2', 'C2s'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone', { ctx: PHONE });
  await dive(page);
  const snap = () => page.evaluate(() => { const G = window.__game, h = G.hero; return { p: [h.pos.x, h.pos.y, h.pos.z], hp: Math.round(h.hp), tide: Math.round(h.tide / 10), pearls: G.quest.pearlCount(), rung: G.quest.rungCount(), obj: document.getElementById('obj').textContent, paused: G.paused, powers: JSON.stringify(h.powers) }; });
  const fits = (sel) => page.evaluate((sel) => { const Q = window.__qa, G = window.__game, c = document.getElementById('c'), r = c.getBoundingClientRect(), W = innerWidth, H = innerHeight, bad = [];
    if (Math.abs(r.width - W) > 2 || Math.abs(r.height - H) > 2 || Math.abs(r.left) > 2 || Math.abs(r.top) > 2) bad.push(`canvas ${r.width}x${r.height} of ${W}x${H}`);
    if (Math.abs(G.camera.aspect - W / H) > 0.01) bad.push(`camera aspect ${G.camera.aspect.toFixed(3)} of ${(W / H).toFixed(3)}`);
    if (Math.abs(c.width / c.height - W / H) > 0.02) bad.push(`drawn ${c.width}x${c.height} of ${W}x${H}`);
    for (const e of document.querySelectorAll(sel)) { if (!Q.vis(e)) continue; const b = e.getBoundingClientRect(); if (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1) bad.push(`${e.id} off the screen ${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}`); }
    return bad; }, sel);
  const a = await snap(), bad = []; let turns = 0;
  for (let i = 0; i < 10; i++) { const s = i % 2 ? { width: 390, height: 844 } : { width: 844, height: 390 }; await page.setViewportSize(s); await page.waitForTimeout(220); const b = await fits(HUD); turns++; if (b.length) bad.push(`${s.width}x${s.height}: ${b.join(', ')}`); }
  const b = await snap(); const moved = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]);
  const same = ['pearls', 'rung', 'obj', 'paused', 'powers'].every((k) => a[k] === b[k]) && Math.abs(a.hp - b.hp) <= 1 && moved < 6;
  line('C2', bad.length === 0 && same && errors.length === 0, `turned ${turns} times mid-game: ${bad.length} wrong fits${bad[0] ? ': ' + bad.slice(0, 3).join(' · ') : ''}; state ${same ? 'kept' : 'CHANGED ' + JSON.stringify([a, b])} (drifted ${moved.toFixed(2)} m); ${errors.length} errors${errors[0] ? ': ' + errors[0] : ''}`);
  const bad2 = []; for (const s of [[320, 568], [430, 932], [932, 430], [768, 1024], [1024, 768], [360, 640], [640, 360]]) { await page.setViewportSize({ width: s[0], height: s[1] }); await page.waitForTimeout(220); const r = await fits(HUD); if (r.length) bad2.push(`${s.join('x')}: ${r.join(', ')}`); }
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250);
  const px = await page.evaluate(() => window.__qa.pixels());
  line('C2s', bad2.length === 0 && px.lit >= 30 && px.distinct >= 4, `free resizes, 320 to 1024 wide: ${bad2.length} wrong fits${bad2[0] ? ': ' + bad2.slice(0, 4).join(' · ') : ''}; then ${px.lit} of ${px.of} sampled pixels lit, ${px.distinct} colours (a blank frame has 1)`);
  await close();
});

await section(['C3', 'C3m'], async () => {
  const { page, close } = await open('?fresh&tier=phone', { ctx: { ...PHONE, viewport: { width: 375, height: 667 } } });
  const bad = [], menu = []; let least = 1e9, gapLeast = 1e9, count = 0;
  await dive(page);
  for (const [w, h] of [[375, 667], [667, 375], [430, 932], [932, 430]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(220);
    const r = await page.evaluate(() => { const Q = window.__qa; Q.showAll(); const list = [...document.querySelectorAll('.btn.show,#stick')].filter(Q.vis).map((e) => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e), round = cs.borderRadius.includes('50%') || parseFloat(cs.borderRadius) >= Math.min(b.width, b.height) / 2; return { id: e.id, x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height, round, r: b }; }); const size = list.map((l) => [l.id, Math.round(Math.min(l.w, l.h))]), gaps = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j]; let g; if (a.round && b.round) g = Math.hypot(a.x - b.x, a.y - b.y) - Math.min(a.w, a.h) / 2 - Math.min(b.w, b.h) / 2; else { const dx = Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2), dy = Math.max(0, Math.abs(a.y - b.y) - (a.h + b.h) / 2); g = Math.hypot(dx, dy); } gaps.push([a.id + '/' + b.id, Math.round(g)]); } return { size, gaps }; });
    count = r.size.length;
    for (const [id, s] of r.size) { least = Math.min(least, s); if (s < 44) bad.push(`${w}x${h} ${id} ${s} px`); }
    for (const [id, g] of r.gaps) { gapLeast = Math.min(gapLeast, g); if (g < 12) bad.push(`${w}x${h} ${id} ${g} px apart`); }
    const m = await page.evaluate(() => { const Q = window.__qa, out = [], was = [...document.querySelectorAll('.screen')].map((s) => s.classList.contains('on')); const list = [...document.querySelectorAll('.screen')]; list.forEach((s) => s.classList.add('on')); for (const s of list) for (const b of s.querySelectorAll('button,[role=button],a')) { if (!Q.vis(b)) continue; const r = b.getBoundingClientRect(); out.push([b.id || b.textContent.trim().slice(0, 16), Math.round(Math.min(r.width, r.height))]); } const p = document.getElementById('pauseB'); if (p) { const r = p.getBoundingClientRect(); out.push(['pauseB', Math.round(Math.min(r.width, r.height))]); } list.forEach((s, i) => s.classList.toggle('on', was[i])); return out; });
    for (const [id, s] of m) if (s < 28) menu.push(`${w}x${h} ${id} ${s} px`);
    // the menu's tabs, as the game opens them
    for (const tab of ['quests', 'map', 'codex', 'powers', 'settings']) { const small = await page.evaluate((tab) => { const G = window.__game, Q = window.__qa; if (!G.ui.openScreen) return []; G.ui.openScreen(tab); const out = []; for (const b of document.querySelectorAll('#menu button, #menu [role=button], #menu input, #menu select, #menu a')) { if (!Q.vis(b)) continue; const r = b.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue; const n = Math.round(Math.min(r.width, r.height)); if (n < 28) out.push([b.id || b.textContent.trim().slice(0, 16) || b.tagName, n]); } return out; }, tab); for (const [id, s] of small) menu.push(`${w}x${h} ${tab} ${id} ${s} px`); }
    await page.evaluate(() => { const G = window.__game; if (G.ui.setPause) G.ui.setPause(false); });
  }
  line('C3', bad.length === 0, `gameplay controls: ${count} shown at once at 4 sizes; the smallest ${least} px (≥ 44), the closest ${gapLeast} px apart (≥ 12)${bad.length ? `; ${bad.length} wrong: ` + bad.slice(0, 8).join(' · ') : ''}`);
  line('C3m', menu.length === 0, `menu controls 28 px or more: ${menu.length} under${menu[0] ? ': ' + menu.slice(0, 6).join(' · ') : ''}`);
  await close();
});

await section(['C4', 'C4s'], async () => {
  const INSETS = { upright: { top: 59, left: 0, right: 0, bottom: 34, w: 393, h: 852 }, turned: { top: 0, left: 59, right: 59, bottom: 21, w: 852, h: 393 } };
  const { page, ctx, close } = await open('?fresh&tier=phone', { ctx: { ...PHONE, viewport: { width: 393, height: 852 } } });
  const st = await page.evaluate(() => { const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join(' '); return { env: /env\(safe-area-inset-/.test(css), cover: /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]').content) }; });
  line('C4s', st.env && st.cover, `the page asks for the whole screen and reads the insets: viewport-fit=cover ${st.cover}, env(safe-area-inset-*) in its CSS ${st.env}`);
  let cdp = null; if (engine === 'chromium') { try { cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, left: 0, bottom: 34, right: 0 } }); } catch (e) { cdp = null; } }
  const probe = await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;padding-top:env(safe-area-inset-top)'; document.body.appendChild(d); const v = parseFloat(getComputedStyle(d).paddingTop); d.remove(); return v; });
  const real = cdp && probe === 59; note(real ? 'C4: Chromium applied the insets for real: env() answers 59' : `C4: env() can't be set in ${engine} (it answers ${probe}): the page's own --top, --left, --right, --bottom are set instead`);
  await dive(page);
  const bad = [];
  for (const [name, I] of Object.entries(INSETS)) {
    await page.setViewportSize({ width: I.w, height: I.h });
    if (real) await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: I.top, left: I.left, bottom: I.bottom, right: I.right } });
    else await page.evaluate((I) => { let s = document.getElementById('qaSafe'); if (!s) { s = document.createElement('style'); s.id = 'qaSafe'; document.head.appendChild(s); } s.textContent = `:root { --top: max(12px, ${I.top}px); --left: max(14px, ${I.left}px); --right: max(14px, ${I.right}px); --bottom: max(16px, ${I.bottom}px); }`; }, I);
    await page.waitForTimeout(300);
    const r = await page.evaluate(([sel, I]) => { const Q = window.__qa, W = innerWidth, H = innerHeight, out = []; Q.showAll(); document.getElementById('tip').classList.add('on'); document.getElementById('bossbar') && document.getElementById('bossbar').classList.add('on');
      for (const e of document.querySelectorAll(sel)) { if (!Q.vis(e) || Q.opaque(e) < 0.02 && e.id !== 'tip') continue; const b = e.getBoundingClientRect(); const over = Math.max(I.top - b.top, I.left - b.left, b.right - (W - I.right), b.bottom - (H - I.bottom)); if (over > 0.5) out.push(`${e.id || e.className} ${Math.round(over)} px`); }
      return out; }, [HUD, I]);
    if (r.length) bad.push(`${name}: ${r.join(', ')}`);
    // the menu's controls too, tab by tab
    for (const tab of ['quests', 'map', 'codex', 'powers', 'settings']) { const m = await page.evaluate(([tab, I]) => { const G = window.__game, Q = window.__qa, W = innerWidth, H = innerHeight, out = []; if (!G.ui.openScreen) return out; G.ui.openScreen(tab); for (const b of document.querySelectorAll('#menu button, #menu [role=button]')) { if (!Q.vis(b)) continue; b.scrollIntoView({ block: 'center' }); /* a list scrolls past the home bar on its way: what counts is whether each control can be brought clear of it */ const c = b.getBoundingClientRect(); if (c.top >= H || c.bottom <= 0) continue; const over = Math.max(I.top - c.top, I.left - c.left, c.right - (W - I.right), c.bottom - (H - I.bottom)); if (over > 0.5) out.push(`${b.id || b.textContent.trim().slice(0, 14)} ${Math.round(over)} px`); } return out; }, [tab, I]); if (m.length) bad.push(`${name} ${tab}: ${[...new Set(m)].slice(0, 5).join(', ')}`); }
    await page.evaluate(() => { const G = window.__game; if (G.ui.setPause) G.ui.setPause(false); });
  }
  line('C4', bad.length === 0, `nothing in the notch, the island or the home bar: ${bad.length ? bad.join(' · ') : 'every control and HUD piece inside an iPhone\'s insets, upright and turned'}`);
  await close();
});

await section(['C5', 'C5k'], async () => {
  const { page, ctx, close } = await open('?fresh&tier=phone', { ctx: PHONE, init: `window.__menus = 0; addEventListener('contextmenu', (e) => { setTimeout(() => { if (!e.defaultPrevented) window.__menus++; }, 0); }, true);` });
  await dive(page);
  const mid = [260, 420];
  await page.touchscreen.tap(...mid); await page.waitForTimeout(90); await page.touchscreen.tap(...mid); await page.waitForTimeout(350);
  if (engine === 'chromium') { const c = await ctx.newCDPSession(page); await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mid[0], y: mid[1] }] }); await page.waitForTimeout(900); await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200); }
  const r = await page.evaluate(() => { const c = document.getElementById('c'), cs = getComputedStyle(c), b = getComputedStyle(document.body), h = getComputedStyle(document.documentElement); return { scale: visualViewport.scale, sel: getSelection().toString(), menus: window.__menus, ta: cs.touchAction, bta: b.touchAction, hta: h.touchAction, us: b.userSelect || b.webkitUserSelect, meta: document.querySelector('meta[name=viewport]').content, y: scrollY }; });
  const taOk = r.ta === 'none' || r.bta === 'none';
  line('C5', r.scale === 1 && r.sel === '' && r.menus === 0 && taOk && /none/.test(r.us) && r.y === 0, `a double tap${engine === 'chromium' ? ' and a long press' : ' (WebKit has no held finger here: the long press is Chromium\'s)'} change nothing: zoom ${r.scale} (1), selected "${r.sel}", context menus ${r.menus}, page scrolled ${r.y}; touch-action canvas ${r.ta}, body ${r.bta} (none); user-select ${r.us}`);
  await close();
  // inside a tall host page: Space and the arrows must not scroll the host. A desktop window, the game in a frame.
  const src = base + '?fresh&tier=desktop', hostUrl = base.replace(/index\.html.*$/, '__host.html');
  const host = await W.open('', { ctx: { viewport: { width: 900, height: 600 } }, wait: false, url: hostUrl, route: (p) => p.route('**/__host.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><body style="margin:0;height:4000px;background:#123"><iframe id=f src="${src}" style="width:800px;height:450px;border:0;display:block" allow="autoplay; gamepad"></iframe></body>` })) });
  const fr = await (await host.page.waitForSelector('#f')).contentFrame();
  await fr.waitForFunction(() => window.__game && window.__game.booted, null, { timeout: 45000 });
  await fr.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }, null, { timeout: 15000 });
  await fr.click('#dive'); await host.page.waitForTimeout(500); await host.page.mouse.click(400, 220); await host.page.waitForTimeout(100);
  const seen = {}; for (const k of ['Space', 'ArrowDown', 'ArrowUp', 'PageDown', 'End']) { await host.page.keyboard.press(k); await host.page.waitForTimeout(150); seen[k] = await host.page.evaluate(() => scrollY); }
  const worstY = Math.max(...Object.values(seen));
  line('C5k', worstY === 0, `the game in a frame on a tall page: Space and the arrow keys scroll the host ${worstY} px (0): ${JSON.stringify(seen)}`);
  await host.close();
});

await section(['C6', 'C6s', 'C6p'], async () => {
  const { page, ctx, close } = await open('?fresh&tier=phone', { ctx: PHONE });
  await dive(page);
  const ev = (type, x, y, id = 41) => page.evaluate(([type, x, y, id]) => { window.__t = window.__t || {}; const el = type === 'pointerdown' ? (window.__t[id] = document.elementFromPoint(x, y) || document.body) : window.__t[id] || document.body; el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true })); }, [type, x, y, id]);
  let good = 0, tried = 0; const spots = [[40, 300], [120, 420], [60, 560], [150, 500], [90, 640], [30, 470]];
  for (const [x, y] of spots) { tried++; const a = await page.evaluate(() => { const p = window.__game.hero.pos; return [p.x, p.y, p.z]; }); await ev('pointerdown', x, y); await ev('pointermove', x, y - 44); await page.waitForTimeout(350); const b = await page.evaluate(() => { const p = window.__game.hero.pos, n = document.getElementById('stick').getBoundingClientRect(); return { p: [p.x, p.y, p.z], cx: n.left + n.width / 2, cy: n.top + n.height / 2 }; }); await ev('pointerup', x, y - 44); await page.waitForTimeout(250); if (Math.hypot(b.p[0] - a[0], b.p[1] - a[1], b.p[2] - a[2]) > 0.6 && Math.hypot(b.cx - x, b.cy - y) < 30) good++; }
  line('C6', good === tried, `the stick lands where the left thumb lands (Apple): ${good} of ${tried} touches in the left half moved him with the stick under the thumb; the stick stands at a fixed place ${good === 0 ? '(a SHOULD not met)' : ''}`);
  const y0 = await page.evaluate(() => window.__game.camYaw); await ev('pointerdown', 300, 300, 42); await ev('pointermove', 240, 300, 42); await page.waitForTimeout(140); await ev('pointerup', 240, 300, 42); await page.waitForTimeout(100); const y1 = await page.evaluate(() => window.__game.camYaw);
  line('C6s', Math.abs(y1 - y0) > 0.1, `a drag on the right looks: yaw moved ${(y1 - y0).toFixed(2)} rad`);
  const pr = await page.evaluate(async () => { const Q = window.__qa; Q.showAll(); const out = []; for (const b of document.querySelectorAll('.btn.show')) { const a = getComputedStyle(b).backgroundColor; b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 43, pointerType: 'touch', bubbles: true, cancelable: true, buttons: 1 })); await new Promise((d) => requestAnimationFrame(d)); const c = getComputedStyle(b), down = c.backgroundColor; b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 43, pointerType: 'touch', bubbles: true, cancelable: true })); out.push([b.id, a !== down || b.classList.contains('down')]); } return out; });
  const none = pr.filter((p) => !p[1]);
  line('C6p', none.length === 0, `every button shows a press: ${pr.length - none.length} of ${pr.length}${none[0] ? '; no press state: ' + none.map((n) => n[0]).join(' ') : ''}`);
  await close();
});

await section(['E1', 'E1h'], async () => {
  const { page, close } = await open('?fresh&tier=phone', { ctx: PHONE });
  const rows = []; const take = async (state) => { const t = await page.evaluate(() => window.__qa.texts()); for (const r of t) rows.push({ state, ...r }); };
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }); await take('title');
  await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(900);
  await page.evaluate(() => { const G = window.__game; G.ui.toast('The Reef Bell', 'A torpedo strike through your enemies', 9); G.ui.tip('Hold Boost to torpedo', 9); }); await page.waitForTimeout(1000); await take('play');
  await page.evaluate(() => { const s = [...document.querySelectorAll('.screen')]; window.__s = s; }); 
  const screens = await page.evaluate(() => [...document.querySelectorAll('.screen')].map((s) => s.id));
  for (const id of screens) { await page.evaluate((id) => { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }, id); await page.waitForTimeout(120); await take(id); }
  await page.evaluate(() => { for (const s of document.querySelectorAll('.screen')) s.classList.remove('on'); });
  // every tab of the menu, opened as the game opens it
  const tabs = ['quests', 'map', 'codex', 'powers', 'settings']; for (const tab of tabs) { const had = await page.evaluate((tab) => { const G = window.__game; if (!G.ui.openScreen) return false; G.ui.openScreen(tab); return true; }, tab); if (!had) break; await page.waitForTimeout(160); await take('menu ' + tab); }
  await page.evaluate(() => { const G = window.__game; if (G.ui.setPause) G.ui.setPause(false); });
  const seen = new Map(); for (const r of rows) { const k = r.state + r.el + r.size; if (!seen.has(k)) seen.set(k, r); }
  const all = [...seen.values()], small = all.filter((r) => r.size < 11), low = all.slice().sort((a, b) => a.size - b.size)[0], hud = all.filter((r) => r.size < 17 && !/^(kbd)/.test(r.el));
  line('E1', all.length > 5 && small.length === 0, `${all.length} texts on ${1 + 1 + screens.length + tabs.length} screens and tabs: the smallest ${low.size} px, ${low.el} "${low.text}" in ${low.state} (≥ 11, Apple's minimum)`);
  const names = new Map(); for (const r of hud) if (!names.has(r.el) || names.get(r.el) > r.size) names.set(r.el, r.size);
  line('E1h', hud.length === 0, `HUD and body text 17 px or more (the standard's test, Apple's default): ${names.size} kinds of text under${names.size ? ': ' + [...names].sort((a, b) => a[1] - b[1]).slice(0, 12).map(([e, s]) => `${e} ${s} px`).join(', ') : ''}`);
  await close();
  // a person reads this one: 800 x 450 at 1x, CrazyGames' mobile size
  const one = await open('?fresh&tier=phone', { ctx: { viewport: { width: 800, height: 450 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } });
  await one.page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }); await one.page.tap('#dive').catch(() => one.page.click('#dive')); await one.page.waitForTimeout(1200);
  await one.page.screenshot({ path: `${out}/e1_800x450_${engine}.png` }); await one.close();
});
await finish();
