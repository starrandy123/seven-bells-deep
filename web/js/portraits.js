// A person's portrait: a framed painted card, drawn by code once and kept as a picture. The face is laid in flat shapes, then every
// shape is broken into brush strokes sampled from what's under them (the way a gouache study builds up), and the eyes and mouth go back on top.
const W = 240, H = 300;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function ellipse(x, cx, cy, rx, ry, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, 6.2832); x.fill(); }

// hair in two passes: the mass behind the head, then a fringe that leaves the forehead and eyes clear
function hairBack(x, p, c) {
  const d = shade(c, -0.3), s = p.hair || 'short'; x.fillStyle = c;
  if (s === 'bun') { ellipse(x, 120, 96, 54, 46); ellipse(x, 120, 46, 26, 22); }
  else if (s === 'short') ellipse(x, 120, 100, 56, 52);
  else if (s === 'crop') ellipse(x, 120, 96, 51, 42);
  else if (s === 'long') { ellipse(x, 120, 104, 60, 58); x.fillRect(60, 104, 28, 118); x.fillRect(152, 104, 28, 118); }
  else if (s === 'braids') { ellipse(x, 120, 100, 56, 50); x.fillStyle = d; for (const sx of [62, 178]) for (let i = 0; i < 6; i++) ellipse(x, sx + Math.sin(i) * 2, 128 + i * 20, 11, 12); }
  else if (s === 'wild') for (let i = 0; i < 16; i++) { const a = -3.2 + i * 0.25; ellipse(x, 120 + Math.cos(a) * 58, 104 + Math.sin(a) * 52, 20, 16, a); }
  else if (s === 'hood') { ellipse(x, 120, 116, 76, 82); x.fillRect(44, 116, 152, 120); }
}
function hairFront(x, p, c) {
  const s = p.hair || 'short', l = shade(c, 0.22);
  if (s === 'bald') return;
  if (s === 'cap') { x.fillStyle = c; x.beginPath(); x.moveTo(62, 100); x.quadraticCurveTo(120, 36, 178, 100); x.lineTo(192, 106); x.lineTo(48, 106); x.closePath(); x.fill(); x.fillStyle = shade(c, -0.3); x.fillRect(50, 100, 140, 7); return; }
  x.fillStyle = c; x.beginPath(); x.moveTo(68, 122); x.quadraticCurveTo(66, 56, 120, 54); x.quadraticCurveTo(174, 56, 172, 122);
  if (s === 'wild') { x.quadraticCurveTo(158, 92, 136, 96); x.quadraticCurveTo(116, 84, 96, 98); x.quadraticCurveTo(80, 92, 68, 122); } else { x.quadraticCurveTo(160, 86, 120, 84); x.quadraticCurveTo(80, 86, 68, 122); }
  x.fill();
  x.fillStyle = l; ellipse(x, 100, 70, 22, 8, -0.3);
}

function features(x, p, skin) {
  const dark = shade(skin, -0.62), ey = 128, age = p.age || 0;
  // eyes, a brow each: the look of a person is here
  for (const sx of [-1, 1]) {
    const ex = 120 + sx * 21;
    x.fillStyle = 'rgba(255,250,240,0.92)'; ellipse(x, ex, ey, 9, 5.2);
    x.fillStyle = p.eyes || '#2f2a24'; ellipse(x, ex + 0.6, ey + 0.4, 4.8, 4.8);
    x.fillStyle = '#fff'; ellipse(x, ex + 2, ey - 1.6, 1.3, 1.3);
    x.strokeStyle = dark; x.lineWidth = 2.2; x.beginPath(); x.moveTo(ex - 10, ey - 2.6); x.quadraticCurveTo(ex, ey - 8, ex + 10, ey - 2.2); x.stroke();
    x.strokeStyle = shade(p.brow || p.hairCol || '#3a2a20', -0.1); x.lineWidth = age > 0.5 ? 3.4 : 4; x.beginPath(); x.moveTo(ex - 13, ey - 13 + (p.frown ? sx * 2.4 : 0)); x.quadraticCurveTo(ex, ey - 19, ex + 13, ey - 13 - (p.frown ? sx * 2.4 : 0)); x.stroke();
    if (age > 0.4) { x.strokeStyle = shade(skin, -0.3); x.lineWidth = 1.2; x.beginPath(); x.moveTo(ex + sx * 12, ey + 2); x.lineTo(ex + sx * 18, ey + 6); x.moveTo(ex - 8, ey + 9); x.quadraticCurveTo(ex, ey + 12, ex + 8, ey + 9); x.stroke(); }
  }
  // the nose, the mouth
  x.strokeStyle = shade(skin, -0.34); x.lineWidth = 2.2; x.beginPath(); x.moveTo(121, 134); x.quadraticCurveTo(128, 152, 119, 156); x.stroke();
  x.strokeStyle = shade(p.lips || skin, -0.44); x.lineWidth = 3; x.beginPath(); const smile = p.smile === undefined ? 0.5 : p.smile;
  x.moveTo(101, 175 - smile * 2); x.quadraticCurveTo(120, 175 + smile * 9, 139, 175 - smile * 2); x.stroke();
  if (p.glasses) { x.strokeStyle = '#2a2015'; x.lineWidth = 2.4; x.beginPath(); x.arc(99, ey, 15, 0, 6.3); x.moveTo(156, ey); x.arc(141, ey, 15, 0, 6.3); x.moveTo(114, ey); x.lineTo(126, ey); x.stroke(); }
}

export function paintPortrait(id, p = {}) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }), R = rng(hash(id));
  const skin = p.skin || '#b98a66', cloth = p.cloth || '#2d6a78', hairCol = p.hairCol || '#3a2a20', bg = p.bg || ['#2a6f88', '#0d2f47'];
  p = { ...p, hairCol };
  // the ground: a sky or a sea, in wide wet strokes
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    x.fillStyle = shade(i % 2 ? bg[0] : bg[1], (R() - 0.5) * 0.5); x.globalAlpha = 0.16 + R() * 0.2;
    const px = R() * W, py = R() * H; x.save(); x.translate(px, py); x.rotate(-0.5 + R() * 0.5); x.fillRect(-40 - R() * 40, -6 - R() * 8, 80 + R() * 80, 12 + R() * 16); x.restore();
  }
  x.globalAlpha = 1;
  // hair behind, shoulders, neck, head
  hairBack(x, p, hairCol);
  x.fillStyle = cloth; x.beginPath(); x.moveTo(20, H); x.quadraticCurveTo(26, 226, 86, 212); x.lineTo(154, 212); x.quadraticCurveTo(214, 226, 220, H); x.closePath(); x.fill();
  x.fillStyle = shade(cloth, -0.26); x.beginPath(); x.moveTo(150, 214); x.quadraticCurveTo(214, 226, 220, H); x.lineTo(150, H); x.closePath(); x.fill();
  x.fillStyle = shade(skin, -0.2); x.fillRect(98, 180, 44, 44); ellipse(x, 120, 218, 26, 10);
  if (p.scarf) { x.fillStyle = p.scarf; ellipse(x, 120, 214, 50, 16); x.fillStyle = shade(p.scarf, -0.2); ellipse(x, 140, 218, 18, 10, 0.3); }
  if (p.apron) { x.strokeStyle = p.apron; x.lineWidth = 14; x.beginPath(); x.moveTo(82, 218); x.lineTo(92, H); x.moveTo(158, 218); x.lineTo(148, H); x.stroke(); }
  x.fillStyle = skin; x.beginPath(); x.moveTo(72, 118); x.quadraticCurveTo(72, 62, 120, 62); x.quadraticCurveTo(168, 62, 168, 118); x.quadraticCurveTo(168, 170, 140, 192); x.quadraticCurveTo(120, 204, 100, 192); x.quadraticCurveTo(72, 170, 72, 118); x.fill();
  x.fillStyle = shade(skin, -0.2); x.beginPath(); x.moveTo(168, 118); x.quadraticCurveTo(168, 170, 140, 192); x.quadraticCurveTo(160, 150, 150, 84); x.quadraticCurveTo(168, 96, 168, 118); x.fill();
  x.fillStyle = shade(skin, 0.18); ellipse(x, 100, 104, 18, 22, 0.2);
  x.fillStyle = 'rgba(214,92,70,0.18)'; ellipse(x, 92, 154, 16, 11); ellipse(x, 148, 154, 16, 11);
  if (p.beard) { x.fillStyle = p.beard; x.beginPath(); x.moveTo(76, 142); x.quadraticCurveTo(84, 204, 120, 210); x.quadraticCurveTo(156, 204, 164, 142); x.quadraticCurveTo(142, 168, 120, 166); x.quadraticCurveTo(98, 168, 76, 142); x.fill(); }
  hairFront(x, p, hairCol);
  if (p.helm) { x.fillStyle = p.helm; x.beginPath(); x.moveTo(70, 112); x.quadraticCurveTo(120, 36, 170, 112); x.lineTo(160, 96); x.quadraticCurveTo(120, 74, 80, 96); x.closePath(); x.fill(); x.fillStyle = shade(p.helm, 0.3); ellipse(x, 120, 72, 8, 16); }

  // break it all into brush strokes: each samples what's under it
  const src = x.getImageData(0, 0, W, H).data;
  for (let i = 0; i < 2600; i++) {
    const px = (R() * W) | 0, py = (R() * H) | 0, k = (py * W + px) * 4, big = py < 56 || py > 226 ? 1.6 : 1;
    x.strokeStyle = `rgb(${src[k]},${src[k + 1]},${src[k + 2]})`; x.globalAlpha = 0.62; x.lineWidth = (2 + R() * 3.4) * big; x.lineCap = 'round';
    const a = -0.9 + R() * 0.7, L = (5 + R() * 11) * big; x.beginPath(); x.moveTo(px - Math.cos(a) * L, py - Math.sin(a) * L); x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke();
  }
  x.globalAlpha = 1;
  features(x, p, skin);

  if (p.ghost) {
    x.globalCompositeOperation = 'color'; x.fillStyle = 'rgba(92,220,235,0.82)'; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'lighter'; const gl = x.createRadialGradient(120, 130, 12, 120, 130, 150); gl.addColorStop(0, 'rgba(120,240,255,0.12)'); gl.addColorStop(1, 'rgba(120,240,255,0)'); x.fillStyle = gl; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
  }

  // the frame: old gilt, a dark inner edge
  x.lineWidth = 12; x.strokeStyle = '#7a5a22'; x.strokeRect(6, 6, W - 12, H - 12);
  x.lineWidth = 3; x.strokeStyle = '#e6bd6a'; x.strokeRect(11, 11, W - 22, H - 22);
  x.lineWidth = 2; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.strokeRect(14, 14, W - 28, H - 28);
  return c.toDataURL('image/jpeg', 0.86);
}
