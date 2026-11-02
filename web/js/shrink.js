// A phone's share of a character's maps: the ones it sees small drawn again at half a side before they reach the GPU, a quarter of the memory each. The colour map of the man he plays is left alone: he's what the eye is on.
// Mips go with it, so a map that was 0.67 MB costs 0.17. Each is drawn once, through a 2D canvas, and the decoded original is let go.
export function shrinkMaps(root, keys, min = 64) {
  const done = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) for (const k of keys) {
      const t = m && m[k], im = t && t.image; if (!t || done.has(t) || !im || !im.width || im.width / 2 < min) continue; done.add(t);
      const c = document.createElement('canvas'); c.width = im.width >> 1; c.height = im.height >> 1; const x = c.getContext('2d'); if (!x) continue;
      x.drawImage(im, 0, 0, c.width, c.height); if (im.close) im.close(); t.image = c; t.needsUpdate = true;
    }
  });
}
