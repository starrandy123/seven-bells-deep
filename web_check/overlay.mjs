// A look at the colliders over what's drawn (the standard's A8: "render a debug overlay for a human to look at"): red boxes and cylinders, from the game's own renderer.
// Not a wall: a picture for the judge, and for whoever fixes a collider.
//   node overlay.mjs <base> <chromium|webkit> --out=dir --at=x,y,z[,x2,y2,z2...] [--back=30]
import { gate, DESK } from './lib/h.mjs';
const W = await gate('overlay', { budget: 120 });
const { page } = await W.open('?film&fresh&tier=desktop', { ctx: DESK });
const list = String(W.flags.at || '').split(',').map(Number), back = +(W.flags.back || 30);
await page.evaluate(() => {
  const Q = window.__qa, G = window.__game, C = G.world.data.colliders, T = window.__three_for_overlay; Q.start(); G.bot = null; G.hero.root.visible = true;
  const pts = [], seg = (a, b) => pts.push(a[0], a[2], -a[1], b[0], b[2], -b[1]);
  for (const c of C) {
    if (c.t === 'cyl') { for (let i = 0; i < 16; i++) { const a0 = (i / 16) * 6.283, a1 = ((i + 1) / 16) * 6.283, p = (a, z) => [c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r, z]; seg(p(a0, c.z0), p(a1, c.z0)); seg(p(a0, c.z1), p(a1, c.z1)); if (i % 4 === 0) seg(p(a0, c.z0), p(a0, c.z1)); } }
    else { const cs = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0), p = (u, v, z) => [c.x + u * c.hx * cs - v * c.hy * sn, c.y + u * c.hx * sn + v * c.hy * cs, z], R = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; for (let i = 0; i < 4; i++) { const a = R[i], b = R[(i + 1) % 4]; seg(p(a[0], a[1], c.z0), p(b[0], b[1], c.z0)); seg(p(a[0], a[1], c.z1), p(b[0], b[1], c.z1)); seg(p(a[0], a[1], c.z0), p(a[0], a[1], c.z1)); } }
  }
  // no three.js import here: the page's own classes, found through the scene
  const Line = window.__qaLine; const g = new G.scene.constructor(); void g;
  Q.overlayPts = new Float32Array(pts);
});
// the page has an import map: three is reachable from a module script
await page.addScriptTag({ type: 'module', content: `import * as THREE from 'three'; const G = window.__game, Q = window.__qa; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(Q.overlayPts, 3)); const m = new THREE.LineBasicMaterial({ color: 0xff2a2a, depthTest: false, transparent: true, opacity: 0.85 }); const l = new THREE.LineSegments(geo, m); l.frustumCulled = false; l.renderOrder = 9999; G.scene.add(l); Q.overlay = l; window.__overlayReady = true;` });
await page.waitForFunction(() => window.__overlayReady, null, { timeout: 8000 });
for (let i = 0; i + 2 < list.length; i += 3) {
  const [x, y, z] = list.slice(i, i + 3);
  await page.evaluate(([x, y, z, back]) => { const G = window.__game, Q = window.__qa; G.filmCam = () => { const c = G.camera; c.position.set(x + back * 0.7, z + back * 0.45, -y + back * 0.7); c.up.set(0, 1, 0); c.lookAt(x, z, -y); }; Q.swimAt(x + back, y, -6); for (let k = 0; k < 24; k++) G.frame(1 / 30); }, [x, y, z, back]);
  await page.screenshot({ path: `${W.out}/collider_${Math.round(x)}_${Math.round(y)}.jpg`, type: 'jpeg', quality: 86 });
  W.note(`${W.out}/collider_${Math.round(x)}_${Math.round(y)}.jpg`);
}
await W.finish(0);
