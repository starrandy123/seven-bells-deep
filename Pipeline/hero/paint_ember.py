# The Emberkin's skin: a regular man in red. His own face and hands from the Rocketbox art, his uniform's camouflage gone: the cloth is re-dyed from the folds in the normal map, so no print, badge or name is left in it.
# Phone size, the only size there is: 256 x 512 colour, 128 x 256 normal. Boots and trousers are darkened by vertex colour in build_ember.py.
import os
import numpy as np
import tex

def paint(d, OUT, TD, log):
    S = 256; STRIP, ROWS = 32, 240; tex.configure(S, STRIP, 0, 0, row=True)
    bc = tex.load(os.path.join(TD, 'sm024_body_color_acu.tga'), S); bn = tex.load(os.path.join(TD, 'sm024_body_normal.tga'), S)
    hc = tex.load(os.path.join(TD, 'sm024_head_color_acu.tga'), S); hn = tex.load(os.path.join(TD, 'sm024_head_normal.tga'), S)
    LIT = tex.srgb2lin(tex.hexc('#d4232a')); MID = tex.srgb2lin(tex.hexc('#a50f18')); DARK = tex.srgb2lin(tex.hexc('#3c0507'))
    L = np.array((0.34, 0.42, 0.84)); L /= np.linalg.norm(L)
    def dye(rgb, nrm):
        """Red cloth lit from its own folds: the normal map keeps them, the colour map's camouflage is dropped."""
        N = nrm * 2.0 - 1.0; sh = np.clip((N * L).sum(-1), 0, 1); sh = tex.blur(sh, 1); m = np.median(sh)
        k = np.clip((sh - m) * 2.6, -1, 1)[..., None]
        out = MID + (LIT - MID) * np.clip(k, 0, 1) + (DARK - MID) * np.clip(-k, 0, 1)
        return tex.lin2srgb(out * (0.94 + 0.12 * tex.noise2((S, S), 7, 40)[..., None]))
    def cloth_mask(rgb):
        """Camouflage is grey-green: low in colour, where skin, hair and boots aren't."""
        sat = rgb.max(-1) - rgb.min(-1); return np.clip((0.13 - sat) * 14, 0, 1) * (rgb.mean(-1) > 0.08)
    yy, xx = np.mgrid[0:S, 0:S]; u = (xx + 0.5) / S; v = (yy + 0.5) / S
    bm = cloth_mask(bc)
    # the patches and the flag have colour of their own: they're cloth all the same (rectangles from paint_reaver, y up)
    for (x0, y0, x1, y1) in ((0.12, 0.51, 0.23, 0.64), (0.77, 0.51, 0.88, 0.65), (0.46, 0.59, 0.56, 0.66), (0.25, 0.60, 0.40, 0.70), (0.60, 0.60, 0.75, 0.70)): bm[(u >= x0) & (u <= x1) & (1 - v >= y0) & (1 - v <= y1)] = 1
    bm = tex.blur(bm, 1)[..., None]; colr = bc * (1 - bm) + dye(bc, bn) * bm
    hm = cloth_mask(hc)
    hm[(u < 0.30) & (1 - v > 0.66)] = 0              # the eye and the mouth stay as they are (y from the art's top, rows from the bottom)
    hm[(1 - v < 0.40)] = 0                           # and the face and the hair
    hm[(u >= 0.78) & (1 - v >= 0.54) & (1 - v <= 0.62)] = 1      # the name tape
    hm = tex.blur(hm, 1)[..., None]; head = hc * (1 - hm) + dye(hc, hn) * hm
    atlas = np.zeros((2 * S, S, 3), dtype=np.float32); normal = np.zeros_like(atlas); normal[...] = (0.5, 0.5, 1.0); mr = np.zeros_like(atlas); mr[..., 1] = 0.7; em = np.zeros_like(atlas)
    def squeeze(a):
        idx = np.linspace(0, S - 1, ROWS); i0 = idx.astype(int); i1 = np.minimum(i0 + 1, S - 1); f = (idx - i0)[:, None, None].astype(np.float32)
        return a[i0] * (1 - f) + a[i1] * f
    atlas[STRIP:STRIP + ROWS] = squeeze(head); atlas[STRIP + ROWS:] = squeeze(colr); normal[STRIP:STRIP + ROWS] = squeeze(hn); normal[STRIP + ROWS:] = squeeze(bn)
    tex.swatches(atlas, normal, mr, em)
    small = lambda a, k: a.reshape(a.shape[0] // k, k, a.shape[1] // k, k, 3).mean(axis=(1, 3))
    files = {'albedo': os.path.join(OUT, 'ember_albedo.jpg'), 'normal': os.path.join(OUT, 'ember_normal.jpg')}
    log('atlas', dict(albedo=tex.save_jpg(atlas, files['albedo'], q=3), normal=tex.save_jpg(small(normal, 2), files['normal'], q=3, chroma444=True)))
    return files, ((STRIP / (2 * S), ROWS / (2 * S)), ((STRIP + ROWS) / (2 * S), ROWS / (2 * S)))
