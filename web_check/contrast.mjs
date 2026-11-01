// E2 (QUALITY_SOURCES): text and key icons have enough contrast, and nothing important is shown by colour alone. Ported from CrashLab/web_check/contrast.mjs.
// Every visible text on every screen is measured against what's behind it with WCAG 2.2's ratio: 4.5:1, or 3:1 for large text (24 px, or 18.66 px bold). Behind a text are its own and its
// ancestors' backgrounds, composited. Where none is opaque the 3D scene shows through, so the worse of a black and a white scene is taken; text straight over the scene needs a full outline
// (zero-blur shadows on all 8 sides, or a stroke), measured against its colour. Windowless, a phone (390 x 844 at 3x). It also writes colour-blind pictures of the HUD for the judge.
//   node contrast.mjs <base> <chromium|webkit> [--only=E2,E2n] [--out=dir]
import { gate, PHONE } from './lib/h.mjs';
import fs from 'fs';
const W = await gate('contrast', { budget: 120 });
const { line, note, open, section, finish, engine, out } = W;
const MEASURE = ([state, within]) => {
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (t, b) => [0, 1, 2].map((i) => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const shadows = (s) => (!s || s === 'none' ? [] : s.split(/,(?![^(]*\))/).map((one) => { const n = one.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/).map(parseFloat); return { col: parse(one), x: n[0] || 0, y: n[1] || 0, blur: n[2] || 0 }; }));
  const outline = (cs) => { if (parseFloat(cs.getPropertyValue('-webkit-text-stroke-width')) >= 1) return parse(cs.getPropertyValue('-webkit-text-stroke-color')); const sh = shadows(cs.textShadow).filter((s) => s.blur === 0 && s.col && s.col[3] >= 0.99 && Math.hypot(s.x, s.y) >= 1); const sides = new Set(sh.map((s) => Math.round((((Math.atan2(s.y, s.x) * 180) / Math.PI + 360) % 360) / 45) % 8)); return sides.size === 8 && sh.every((s) => s.col.slice(0, 3).join() === sh[0].col.slice(0, 3).join()) ? sh[0].col : null; };
  const name = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + [...el.classList].map((c) => '.' + c).join(''));
  const path = (el) => (el.parentElement && el.parentElement !== document.body ? name(el.parentElement) + ' > ' : '') + name(el);
  const rows = [], root = within ? document.querySelector(within) : document.body;
  for (const el of root ? [root, ...root.querySelectorAll('*')] : []) {
    if (!el.getClientRects().length || el.closest('svg')) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); if (!text) continue;
    const cs = getComputedStyle(el); if (cs.visibility !== 'visible') continue;
    let op = 1; for (let n = el; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity); if (op < 0.05) continue;
    const r = el.getBoundingClientRect(); if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    // a gradient is a backing too: its worst stop is what's read (CrashLab's page had none)
    const layers = []; let opaque = false, pattern = false, grad = null;
    for (let n = el; n && n !== document.body; n = n.parentElement) { const ns = getComputedStyle(n), bi = ns.backgroundImage; if (bi && bi !== 'none') { pattern = true; const stops = (bi.match(/rgba?\([^)]*\)/g) || []).map(parse); if (stops.length && /gradient/.test(bi) && stops.every((c) => c[3] >= 0.999)) { grad = stops; opaque = true; break; } } const bg = parse(ns.backgroundColor); if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 0.999) { opaque = true; break; } } }
    const comp = (scene) => layers.slice().reverse().reduce((b, l) => over(l, b), scene);
    const fg = parse(cs.color), size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400, large = size >= 24 || (size >= 18.66 && weight >= 700), need = large ? 3 : 4.5;
    let worst, against; const ol = opaque ? null : outline(cs);
    if (grad) { worst = Math.min(...grad.map((b) => { const c = comp(b); return ratio(over(fg, c), c); })); against = 'its gradient\'s worst stop'; }
    else if (opaque) { const b = comp([0, 0, 0, 1]); worst = ratio(over(fg, b), b); against = 'its backing'; }
    else if (ol) { worst = ratio(fg, ol); against = 'its outline'; }
    else { const b0 = comp([0, 0, 0, 1]), b1 = comp([255, 255, 255, 1]); worst = Math.min(ratio(over(fg, b0), b0), ratio(over(fg, b1), b1)); against = layers.length ? 'a see-through backing over the scene' : 'the scene itself'; }
    rows.push({ state, el: path(el), text: text.slice(0, 32), size, weight, need, ratio: Math.round(worst * 100) / 100, against, pattern, color: cs.color, pass: worst >= need });
  }
  return rows;
};
const CVD = { deuteranopia: '0.367 0.861 -0.228 0 0 0.280 0.673 0.047 0 0 -0.012 0.043 0.969 0 0 0 0 0 1 0', protanopia: '0.152 1.053 -0.205 0 0 0.115 0.786 0.099 0 0 -0.004 -0.048 1.052 0 0 0 0 0 1 0' };
await section(['E2'], async () => {
  const { page, errors, close } = await open('?fresh&tier=phone', { ctx: PHONE });
  const rows = [], take = async (state, within) => { rows.push(...(await page.evaluate(MEASURE, [state, within || null]))); };
  await page.waitForFunction(() => { const d = document.querySelector('#dive'); return d && d.style.display !== 'none'; }); await page.waitForTimeout(300); await take('title'); await page.screenshot({ path: `${out}/e2_title_${engine}.jpg`, type: 'jpeg', quality: 70 });
  await page.tap('#dive').catch(() => page.click('#dive')); await page.waitForTimeout(1000);
  await page.evaluate(() => { const G = window.__game, Q = window.__qa; Q.showAll(); G.ui.toast('The Reef Bell', 'A torpedo strike through your enemies', 9); G.ui.tip('Hold Boost to torpedo', 9); const b = document.getElementById('bossbar'); if (b) b.classList.add('on'); document.getElementById('bParry').classList.add('call'); }); await page.waitForTimeout(1100); await take('play');
  await page.screenshot({ path: `${out}/e2_play_${engine}.jpg`, type: 'jpeg', quality: 70 });
  await page.evaluate(() => { document.getElementById('bossbar') && document.getElementById('bossbar').classList.remove('on'); document.getElementById('bParry').classList.remove('call'); });
  const screens = await page.evaluate(() => [...document.querySelectorAll('.screen')].map((s) => s.id));
  for (const id of screens) { await page.evaluate((id) => { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }, id); await page.waitForTimeout(120); await take(id, '#' + id); await page.screenshot({ path: `${out}/e2_${id}_${engine}.jpg`, type: 'jpeg', quality: 60 }); }
  await page.evaluate(() => { for (const s of document.querySelectorAll('.screen')) s.classList.remove('on'); });
  // every tab of the menu, opened as the game opens it
  for (const tab of ['quests', 'map', 'codex', 'powers', 'settings']) { const had = await page.evaluate((tab) => { const G = window.__game; if (!G.ui.openScreen) return false; G.ui.openScreen(tab); return true; }, tab); if (!had) break; await page.waitForTimeout(180); await take('menu ' + tab, '#menu'); await page.screenshot({ path: `${out}/e2_menu_${tab}_${engine}.jpg`, type: 'jpeg', quality: 60 }); }
  await page.evaluate(() => { const G = window.__game; if (G.ui.setPause) G.ui.setPause(false); });
  // what a colour-blind player sees of the HUD, for the judge: nothing important by colour alone can't be read by a machine
  for (const [k, m] of Object.entries(CVD)) { await page.evaluate(([k, m]) => { let f = document.getElementById('qaCvd'); if (!f) { f = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); f.id = 'qaCvd'; f.style.cssText = 'position:absolute;width:0;height:0'; document.body.appendChild(f); } f.innerHTML = `<filter id="qaF"><feColorMatrix type="matrix" values="${m}"/></filter>`; document.documentElement.style.filter = 'url(#qaF)'; }, [k, m]); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/e2_cvd_${k}_${engine}.jpg`, type: 'jpeg', quality: 60 }); }
  const seen = new Map(); for (const r of rows) { const k = r.state + '|' + r.el + '|' + r.color; if (!seen.has(k) || r.ratio < seen.get(k).ratio) seen.set(k, r); }
  const all = [...seen.values()], bad = all.filter((r) => !r.pass).sort((a, b) => a.ratio - b.ratio), low = all.slice().sort((a, b) => a.ratio - b.ratio)[0];
  fs.writeFileSync(`${out}/e2_${engine}.json`, JSON.stringify({ engine, rows: all, errors }, null, 1));
  const states = [...new Set(all.map((r) => r.state))].map((s) => s + ' ' + all.filter((r) => r.state === s).length).join(', ');
  line('E2', all.length > 5 && bad.length === 0, `${all.length} texts (${states}); the lowest ${low.ratio}:1 (${low.el} "${low.text}"); ${bad.length} below their bar${bad.length ? ': ' + bad.slice(0, 12).map((r) => `${r.ratio}:1 < ${r.need} ${r.state} ${r.el} against ${r.against}`).join(' · ') : ''}`);
  await close();
});
await finish();
