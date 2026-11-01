# The Reaver's skin: a soldier a century under water. The Rocketbox uniform goes to rot: every print, name and badge is gone under blur and black-green growth, rust runs
# through it, the skin is drowned grey-green, and the eyes burn amber. Half the Warden's resolution.
import math, os
import numpy as np
import tex
from paint_hero import tris_of

def paint(d, co, W, BI, J, OUT, SRC, log):
    S = 512; TD = os.path.join(SRC, 'Textures')
    body_i = next(i for i, n in enumerate(d['mat_names']) if 'body' in n.lower()); head_i = next(i for i, n in enumerate(d['mat_names']) if 'head' in n.lower())
    bc = tex.load(os.path.join(TD, 'sm024_body_color_acu.tga'), S); bn = tex.load(os.path.join(TD, 'sm024_body_normal.tga'), S)
    hc = tex.load(os.path.join(TD, 'sm024_head_color_acu.tga'), S); hn = tex.load(os.path.join(TD, 'sm024_head_normal.tga'), S)
    # Military's UVs leave no free corner, so the atlas keeps a 64 texel strip along its foot for the swatches; head and body stand on it at 480 rows each
    STRIP, ROWS = 64, 480
    tex.configure(S, STRIP, 0, 0, row=True)
    def rot(rgb, seed):
        """Cloth to rot: fine print softened away, only the big shapes of folds kept, recoloured from below."""
        lum = rgb.mean(-1); soft = tex.blur(lum, 2)
        n1 = tex.noise2((S, S), seed, 6); n2 = tex.noise2((S, S), seed + 1, 18); n3 = tex.noise2((S, S), seed + 2, 11)
        base = tex.srgb2lin(tex.hexc('#1c2a26')); up = tex.srgb2lin(tex.hexc('#46574a')); black = tex.srgb2lin(tex.hexc('#070c0b')); rust = tex.srgb2lin(tex.hexc('#6e3220')); algae = tex.srgb2lin(tex.hexc('#2a4a3a'))
        k = np.clip((soft - 0.28) * 1.7, 0, 1)[..., None]
        out = base + (up - base) * k * (0.3 + 0.7 * n2[..., None])
        a = np.clip((n3 - 0.60) * 6, 0, 1)[..., None]; out = out * (1 - a) + algae * (0.5 + 0.6 * n2[..., None]) * a
        r = np.clip((n1 * 0.5 + n2 * 0.5 - 0.615) * 11, 0, 1)[..., None]; out = out * (1 - r) + rust * (0.35 + 0.75 * n2[..., None]) * r
        b = np.clip((0.47 - n1 * 0.6 - n2 * 0.4) * 8, 0, 1)[..., None]; out = out * (1 - b) + black * b
        return tex.lin2srgb(out)
    def skin_mask(rgb):
        return np.clip(((rgb[..., 0] - rgb[..., 2]) - 0.12) * 8, 0, 1) * (rgb[..., 0] > 0.3)
    def drowned(rgb, seed):
        lum = tex.srgb2lin(rgb).mean(-1, keepdims=True)
        tone = tex.srgb2lin(tex.hexc('#5d7263')); dark = tex.srgb2lin(tex.hexc('#1a2622'))
        n = tex.noise2((S, S), seed, 14)[..., None]
        return tex.lin2srgb(dark + (tone - dark) * np.clip(lum * 2.6, 0, 1) * (0.55 + 0.75 * n))
    bs = tex.blur(skin_mask(bc), 1)[..., None]
    colr = rot(bc, 11) * (1 - bs) + drowned(bc, 21) * bs
    hs = tex.blur(skin_mask(hc), 1)[..., None]
    head = rot(hc, 31) * (1 - hs) + drowned(hc, 41) * hs
    # no badge survives: flag, patches, rank, the name tape, each painted out with the growth around it (y from the top of the texture in the art's own layout)
    def wipe(img, x0, y0, x1, y1, seed):
        X0, X1 = int(x0 * S), int(x1 * S); Y0, Y1 = int((1 - y1) * S), int((1 - y0) * S)
        h, w = Y1 - Y0, X1 - X0; n = tex.noise2((h, w), seed, 5)[..., None]
        # feathered, and the edge wanders, so a badge's place reads as more growth and not as a patch
        yy_, xx_ = np.mgrid[0:h, 0:w]; d_ = np.minimum.reduce([yy_, h - 1 - yy_, xx_, w - 1 - xx_]).astype(np.float32)
        m = np.clip((d_ / 6.0 + (tex.noise2((h, w), seed + 9, 7) - 0.5) * 1.6), 0, 1)[..., None]
        img[Y0:Y1, X0:X1] = img[Y0:Y1, X0:X1] * (1 - m) + tex.lin2srgb(tex.srgb2lin(tex.hexc('#101a17')) * (0.6 + n)) * m
    for i, r in enumerate(((0.12, 0.51, 0.23, 0.64), (0.77, 0.51, 0.88, 0.65), (0.46, 0.59, 0.56, 0.66), (0.25, 0.60, 0.40, 0.70), (0.60, 0.60, 0.75, 0.70))): wipe(colr, *r, 50 + i)
    wipe(head, 0.78, 0.54, 0.99, 0.62, 60)
    # sunken sockets and a dark mouth
    yy, xx = np.mgrid[0:S, 0:S]; u = (xx + 0.5) / S; v = 1 - (yy + 0.5) / S
    for (cx, cy, rx, ry, k) in ((0.425, 0.283, 0.062, 0.040, 0.85), (0.572, 0.283, 0.062, 0.040, 0.85), (0.50, 0.405, 0.075, 0.022, 0.75)):
        e = np.clip(1.2 - ((u - cx) / rx) ** 2 - ((v - cy) / ry) ** 2, 0, 1)[..., None]
        head = head * (1 - k * e)
    # the eyes: the eyeball's patch burns
    ex, ey, er = 0.265, 0.93, 0.07
    dist = np.sqrt(((u - ex) / er) ** 2 + ((v - ey) / er) ** 2)
    eye = (dist < 1.25)
    glow = np.clip(1.25 - dist, 0, 1)[..., None]
    amber = tex.hexc('#ffb238')
    head = np.where(eye[..., None], amber * (0.4 + 0.6 * glow) * (dist[..., None] > 0.16), head)
    em = np.zeros((2 * S, S, 3), dtype=np.float32)
    em[:S] = np.where(eye[..., None], amber * np.clip(glow * 1.8, 0, 1), 0.0)
    atlas = np.zeros((2 * S, S, 3), dtype=np.float32); normal = np.zeros_like(atlas); normal[...] = (0.5, 0.5, 1.0); mr = np.zeros_like(atlas); mr[..., 1] = 0.78
    # the normals keep the cloth's folds and take on pits
    nh = tex.height_to_normal(tex.noise2((S, S), 71, 30) * 2.2, 1.0)
    def squeeze(a):
        idx = np.linspace(0, S - 1, ROWS); i0 = idx.astype(int); i1 = np.minimum(i0 + 1, S - 1); f = (idx - i0)[:, None, None].astype(np.float32)
        return a[i0] * (1 - f) + a[i1] * f
    atlas[STRIP:STRIP + ROWS] = squeeze(head); atlas[STRIP + ROWS:] = squeeze(colr)
    normal[STRIP:STRIP + ROWS] = squeeze(hn * 0.7 + nh * 0.3); normal[STRIP + ROWS:] = squeeze(bn * 0.7 + nh * 0.3)
    emh = em[:S].copy(); em[:] = 0; em[STRIP:STRIP + ROWS] = squeeze(emh)
    tex.swatches(atlas, normal, mr, em)
    # the swatches rusted: the plate's tile dark and pitted, less metal
    atlas[:STRIP] *= (0.55 + 0.7 * tex.noise2((STRIP, S), 81, 12))[..., None]
    mr[:STRIP, :, 2] *= 0.45; mr[:STRIP, :, 1] = np.clip(mr[:STRIP, :, 1] + 0.25, 0, 1)
    em[0:STRIP, 3 * STRIP:4 * STRIP] = amber
    files = {k: os.path.join(OUT, 'reaver_%s.jpg' % k) for k in ('albedo', 'normal', 'mr', 'emissive')}
    small = lambda a, k: a.reshape(a.shape[0] // k, k, a.shape[1] // k, k, 3).mean(axis=(1, 3))
    sizes = dict(albedo=tex.save_jpg(atlas, files['albedo'], q=4), normal=tex.save_jpg(normal, files['normal'], q=3, chroma444=True),
                 mr=tex.save_jpg(small(mr, 4), files['mr'], q=6, chroma444=True), emissive=tex.save_jpg(small(em, 2), files['emissive'], q=4))
    log('atlas', sizes)
    return files, ((STRIP / (2 * S), ROWS / (2 * S)), ((STRIP + ROWS) / (2 * S), ROWS / (2 * S)))
