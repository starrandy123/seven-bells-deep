// The map: a sea chart drawn once from the height field, fog of war over what hasn't been swum, shrines to travel to, the objective, the Warden.
// Drag to pan, pinch or the buttons to zoom, tap a shrine or a place. All positions come from world.json through G.quest.
const $ = (id) => document.getElementById(id);
const SIZE = 512;

export function createMap(G) {
  const view = { x: 0.5, y: 0.5, zoom: 1, built: false };
  let chart = null, fogC = null, fogDirty = true, sel = null;
  const pts = new Map(); let pinch = 0, moved = 0;

  function build() {
    const d = G.world.data, size = d.size_m || 1280, o = d.origin || [-size / 2, -size / 2];
    chart = document.createElement('canvas'); chart.width = chart.height = SIZE;
    const x = chart.getContext('2d'), img = x.createImageData(SIZE, SIZE), a = img.data, H = new Float32Array(SIZE * SIZE);
    const hAt = (i, j) => G.world.heightAt(o[0] + ((i + 0.5) / SIZE) * size, o[1] + ((SIZE - 1 - j + 0.5) / SIZE) * size);
    for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) H[j * SIZE + i] = hAt(i, j);
    for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
      const k = j * SIZE + i, h = H[k], l = H[j * SIZE + Math.max(0, i - 1)], u = H[Math.max(0, j - 1) * SIZE + i], shade = Math.max(-0.5, Math.min(0.5, ((h - l) + (h - u)) * 0.02));
      let r, g, b;
      if (h > 0.2) { const t = Math.min(1, h / 90); r = 112 + t * 90 + shade * 120; g = 128 + t * 40 + shade * 120; b = 76 + t * 40 + shade * 100; }
      else { const t = Math.min(1, -h / 180); r = 74 - t * 62 + shade * 40; g = 176 - t * 142 + shade * 70; b = 196 - t * 128 + shade * 80; }
      const line = Math.floor(h / 40) !== Math.floor(l / 40) || Math.floor(h / 40) !== Math.floor(u / 40); if (line) { r += 18; g += 18; b += 18; }
      if ((h > 0.2) !== (l > 0.2) || (h > 0.2) !== (u > 0.2)) { r = 40; g = 44; b = 34; }                                       // the coast, inked
      const grain = ((i * 73 + j * 151) % 17) - 8; r += grain * 0.5; g += grain * 0.5; b += grain * 0.5;
      const n = k * 4; a[n] = r; a[n + 1] = g; a[n + 2] = b; a[n + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    fogC = document.createElement('canvas'); fogC.width = fogC.height = G.quest.FOG_N;
    view.built = true;
  }

  function paintFog() {
    const n = G.quest.FOG_N, x = fogC.getContext('2d'), img = x.createImageData(n, n), a = img.data;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      // the edge is soft: a cell's fog is the share of its neighbours not yet seen
      let unseen = 0, all = 0; for (let y = j - 2; y <= j + 2; y++) for (let x2 = i - 2; x2 <= i + 2; x2++) { if (x2 < 0 || y < 0 || x2 >= n || y >= n) continue; all++; if (!G.quest.fogAt(x2, y)) unseen++; }
      const k = ((n - 1 - j) * n + i) * 4;
      a[k] = 10; a[k + 1] = 30; a[k + 2] = 50; a[k + 3] = (unseen / all) * 196;
    }
    x.putImageData(img, 0, 0); fogDirty = false;
  }

  // world (Blender x, y) to the canvas in css pixels
  function toScreen(bx, by, w, h) {
    const d = G.world.data, size = d.size_m || 1280, o = d.origin || [-size / 2, -size / 2], side = Math.max(w, h) * view.zoom;
    const u = (bx - o[0]) / size, v = 1 - (by - o[1]) / size;
    return [w / 2 + (u - view.x) * side, h / 2 + (v - view.y) * side];
  }

  const items = () => {
    const q = G.quest, out = [];
    for (const p of q.pois) if (p.seen) out.push({ kind: 'poi', x: p.x, y: p.y, name: p.name, id: p.id });
    for (const s of q.shrinePlaces) if (q.st.shrines.has(s.id)) out.push({ kind: 'shrine', x: s.pl.x, y: s.pl.y, name: (s.poi && s.poi.name) || 'A shrine', id: s.id });
    for (const p of q.people.list) if (p.offer && p.pl) out.push({ kind: 'offer', x: p.pl.x, y: p.pl.y, name: p.name, id: p.id, note: p.offer.title });
    for (const d of q.missions.defs.values()) if (d.kind === 'challenge' && d.start && q.missions.ready(d)) { const pl = q.places.resolve(d.start); out.push({ kind: 'run', x: pl.x, y: pl.y, name: d.title, id: d.id, note: d.blurb }); }
    const om = q.events.omen; if (om) out.push({ kind: 'event', x: om.x, y: -om.z, name: q.events.list.find((d) => d.id === q.events.running).title, id: 'event' });
    return out;
  };

  function draw() {
    const c = $('mapC'), r = c.getBoundingClientRect(); if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = r.width, h = r.height;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = '#071c2c'; x.fillRect(0, 0, w, h);
    const side = Math.max(w, h) * view.zoom, ox = w / 2 - view.x * side, oy = h / 2 - view.y * side;
    x.imageSmoothingEnabled = true; x.drawImage(chart, ox, oy, side, side); x.drawImage(fogC, ox, oy, side, side);
    const list = items();
    x.textAlign = 'center'; x.font = '600 15px Avenir Next, Segoe UI, system-ui, sans-serif';
    for (const it of list) {
      const [sx, sy] = toScreen(it.x, it.y, w, h);
      if (it.kind === 'shrine') { x.fillStyle = '#ffe9b8'; x.strokeStyle = '#3a2606'; x.lineWidth = 2; x.beginPath(); x.moveTo(sx, sy - 9); x.lineTo(sx + 8, sy); x.lineTo(sx, sy + 9); x.lineTo(sx - 8, sy); x.closePath(); x.fill(); x.stroke(); }
      else if (it.kind === 'offer') { x.fillStyle = '#f0c878'; x.strokeStyle = '#3a2606'; x.lineWidth = 2; x.beginPath(); x.arc(sx, sy, 6.5, 0, 6.3); x.fill(); x.stroke(); }
      else if (it.kind === 'run') { x.strokeStyle = '#ffe6a8'; x.lineWidth = 3; x.beginPath(); x.arc(sx, sy, 6.5, 0, 6.3); x.stroke(); }
      else if (it.kind === 'event') { x.strokeStyle = '#4ff0ff'; x.lineWidth = 3; x.beginPath(); x.arc(sx, sy, 10, 0, 6.3); x.stroke(); x.beginPath(); x.arc(sx, sy, 3, 0, 6.3); x.fillStyle = '#4ff0ff'; x.fill(); }
      else { x.fillStyle = '#eafcff'; x.beginPath(); x.arc(sx, sy, 3.2, 0, 6.3); x.fill(); }
      if (view.zoom > 1.6 || it.kind === 'shrine' || it.kind === 'event') {
        const half = x.measureText(it.name).width / 2 + 6, lx = Math.max(half, Math.min(w - half, sx));     // a name near the edge stays whole
        x.lineWidth = 3; x.strokeStyle = 'rgba(3,18,32,0.95)'; x.strokeText(it.name, lx, sy - 13); x.fillStyle = '#eafcff'; x.fillText(it.name, lx, sy - 13);
      }
    }
    const q = G.quest, t = q.target();
    if (t) {
      const [sx, sy] = toScreen(t.x, -t.z, w, h); x.fillStyle = '#f0c878'; x.strokeStyle = '#3a2606'; x.lineWidth = 2; x.save(); x.translate(sx, sy); x.rotate(0.785); x.fillRect(-6, -6, 12, 12); x.strokeRect(-6, -6, 12, 12); x.restore();
    }
    const he = G.hero, [px, py] = toScreen(he.pos.x, -he.pos.z, w, h);
    x.save(); x.translate(px, py); x.rotate(Math.PI - G.camYaw); x.fillStyle = '#4ff0ff'; x.strokeStyle = '#03212d'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -10); x.lineTo(7, 8); x.lineTo(0, 4); x.lineTo(-7, 8); x.closePath(); x.fill(); x.stroke(); x.restore();
    if (sel) { const [sx, sy] = toScreen(sel.x, sel.y, w, h); x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(sx, sy, 15, 0, 6.3); x.stroke(); }
  }

  function pick(cx, cy) {
    const c = $('mapC'), r = c.getBoundingClientRect(), w = r.width, h = r.height; let best = null, bd = 34;
    for (const it of items()) { const [sx, sy] = toScreen(it.x, it.y, w, h), d = Math.hypot(sx - (cx - r.left), sy - (cy - r.top)) - (it.kind === 'shrine' ? 8 : 0); if (d < bd) { bd = d; best = it; } }
    sel = best; const sheet = $('mapSheet');
    if (!best) sheet.classList.remove('on');
    else {
      sheet.classList.add('on'); sheet.querySelector('b').textContent = best.name;
      const shrine = best.kind === 'shrine'; sheet.querySelector('small').textContent = shrine ? 'A shrine. You can travel here.' : best.kind === 'offer' ? `Someone is asking: ${best.note}` : best.kind === 'run' ? best.note : best.kind === 'event' ? 'Happening now' : 'You have been here.';
      $('mapGo').style.display = shrine ? '' : 'none';
    }
    draw();
  }
  function zoomBy(f) { view.zoom = Math.max(1, Math.min(5, view.zoom * f)); clampView(); draw(); }
  function clampView() {
    const c = $('mapC').getBoundingClientRect(), side = Math.max(c.width, c.height, 1) * view.zoom, mx = c.width / 2 / side, my = c.height / 2 / side;
    view.x = Math.max(Math.min(1 - mx, view.x), mx); view.y = Math.max(Math.min(1 - my, view.y), my);
  }

  const box = () => $('mapC');
  box().addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (pts.size === 2) { const a = [...pts.values()]; pinch = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); } try { box().setPointerCapture(e.pointerId); } catch (_) {} });
  box().addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]); moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 2) { const a = [...pts.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch) zoomBy(d / pinch); pinch = d; return; }
    const r = box().getBoundingClientRect(), side = Math.max(r.width, r.height) * view.zoom; view.x -= dx / side; view.y -= dy / side; clampView(); draw();
  });
  const up = (e) => { const had = pts.delete(e.pointerId); if (had && moved < 10 && !pts.size) pick(e.clientX, e.clientY); };
  box().addEventListener('pointerup', up); box().addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
  box().addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.2 : 0.83); }, { passive: false });
  $('mapIn').addEventListener('click', () => zoomBy(1.5)); $('mapOut').addEventListener('click', () => zoomBy(0.67));
  $('mapGo').addEventListener('click', () => { if (sel && sel.kind === 'shrine') G.quest.travel(sel.id); });

  return {
    view,
    // drawn once ahead of time, on the title, so the first tap on Map answers at once
    warm() { if (!view.built) build(); },
    open() {
      if (!view.built) build();
      paintFog(); sel = null; $('mapSheet').classList.remove('on');
      const d = G.world.data, size = d.size_m || 1280, o = d.origin || [-size / 2, -size / 2];
      view.x = (G.hero.pos.x - o[0]) / size; view.y = 1 - (-G.hero.pos.z - o[1]) / size; clampView();
      requestAnimationFrame(draw);
    },
    draw, pick, invalidate() { fogDirty = true; },
    get fogDirty() { return fogDirty; },
  };
}
