# The textures, painted in code: the real skin stays, its colour graded; what must change is painted through a map of each texel's 3D place, so a
# wrap or a tattoo runs across UV seams as if the islands weren't there. One atlas, 1024 x 2048: body on top, head below, swatches for the added
# pieces in the head block's empty corner. Blender's numpy; images are arrays of sRGB-encoded floats, row 0 at the bottom, like Blender's.
import bpy, math, os, subprocess
import numpy as np

W, H = 1024, 2048
BLOCK = 1024
SW = 128                      # one swatch; four of them in the head block's empty lower right corner
SW_X, SW_Y = 760, 8
SWATCH = {'bronze': (0, 0), 'cloth': (1, 0), 'scale': (0, 1), 'glow': (1, 1)}
def configure(block, sw, x, y, row=False):
    """An atlas of block x 2 block; the swatches sit at (x, y), each sw texels square, in a 2 x 2 block or, with row, in one line."""
    global W, H, BLOCK, SW, SW_X, SW_Y, SWATCH
    W, H, BLOCK, SW, SW_X, SW_Y = block, block * 2, block, sw, x, y
    if row: SWATCH = {'bronze': (0, 0), 'cloth': (1, 0), 'scale': (2, 0), 'glow': (3, 0)}
def free_square(covered, size, step=8):
    """The first empty size x size square in a coverage mask (row 0 at the bottom), or None."""
    c = np.zeros((covered.shape[0] + 1, covered.shape[1] + 1), dtype=np.int64); c[1:, 1:] = covered.astype(np.int64).cumsum(0).cumsum(1)
    h, w = covered.shape
    for y in range(4, h - size - 4, step):
        for x in range(4, w - size - 4, step):
            if c[y + size, x + size] - c[y, x + size] - c[y + size, x] + c[y, x] == 0: return x, y
    return None
def swatch_uv(name):
    """(u0, v0, du, dv) of a swatch in atlas UV, 4 texels in from its edges."""
    i, j = SWATCH[name]
    m = max(2, SW // 32)
    x0 = SW_X + i * SW + m; y0 = SW_Y + j * SW + m
    return (x0 / W, y0 / H, (SW - 2 * m) / W, (SW - 2 * m) / H)

def srgb2lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lin2srgb(c):
    c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)

def load(path, size):
    img = bpy.data.images.load(path)
    if img.size[0] != size: img.scale(size, size)
    a = np.zeros(size * size * 4, dtype=np.float32); img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(size, size, 4)[..., :3].copy()

def save_jpg(a, path, q=3, chroma444=False):
    """An array (row 0 at the bottom) to a JPEG on disk, through ffmpeg."""
    b = (np.clip(a[::-1], 0, 1) * 255 + 0.5).astype(np.uint8)
    raw = path + '.rgb'; b.tofile(raw)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (a.shape[1], a.shape[0]), '-i', raw,
                    '-frames:v', '1', '-q:v', str(q), '-pix_fmt', 'yuvj444p' if chroma444 else 'yuvj420p', path], check=True)
    os.remove(raw)
    return os.path.getsize(path)

def bake_positions(tris_uv, tris_co, size, extra=None):
    """Rasterises triangles in UV space. tris_uv (n,3,2) in 0..1, tris_co (n,3,3). Returns pos (size,size,3) and a filled mask; `extra` (n,3,k) too."""
    pos = np.zeros((size, size, 3), dtype=np.float32); mask = np.zeros((size, size), dtype=bool)
    ex = np.zeros((size, size, extra.shape[2]), dtype=np.float32) if extra is not None else None
    uv = tris_uv * size - 0.5
    for t in range(len(uv)):
        a, b, c = uv[t]
        x0 = max(int(math.floor(min(a[0], b[0], c[0]))) - 1, 0); x1 = min(int(math.ceil(max(a[0], b[0], c[0]))) + 1, size - 1)
        y0 = max(int(math.floor(min(a[1], b[1], c[1]))) - 1, 0); y1 = min(int(math.ceil(max(a[1], b[1], c[1]))) + 1, size - 1)
        if x1 < x0 or y1 < y0: continue
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-9: continue
        X, Y = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        l0 = ((b[1] - c[1]) * (X - c[0]) + (c[0] - b[0]) * (Y - c[1])) / d
        l1 = ((c[1] - a[1]) * (X - c[0]) + (a[0] - c[0]) * (Y - c[1])) / d
        l2 = 1 - l0 - l1
        e = -1.2 / max(abs(d) ** 0.5, 1.0)        # a little over the edge, so the seams have no gaps
        ins = (l0 >= e) & (l1 >= e) & (l2 >= e)
        if not ins.any(): continue
        py, px = Y[ins], X[ins]; L = np.stack((l0[ins], l1[ins], l2[ins]), axis=1)
        pos[py, px] = L @ tris_co[t]; mask[py, px] = True
        if ex is not None: ex[py, px] = L @ extra[t]
    return pos, mask, ex

def noise2(shape, seed, cells):
    """Smooth value noise, a few octaves."""
    rng = np.random.default_rng(seed); h, w = shape; out = np.zeros(shape, dtype=np.float32); amp = 1.0; tot = 0
    for o in range(4):
        n = cells * 2 ** o; g = rng.random((n + 2, n + 2), dtype=np.float32)
        ys = np.linspace(0, n, h, endpoint=False); xs = np.linspace(0, n, w, endpoint=False)
        yi = ys.astype(int); xi = xs.astype(int); fy = (ys - yi)[:, None]; fx = (xs - xi)[None, :]
        fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
        a = g[yi][:, xi]; b = g[yi][:, xi + 1]; c = g[yi + 1][:, xi]; d = g[yi + 1][:, xi + 1]
        out += amp * ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy); tot += amp; amp *= 0.5
    return out / tot

def resize(a, w, h):
    """Down to (w, h): softened first, then read bilinearly."""
    H0, W0 = a.shape[:2]; r = max(1, int(round(W0 / w / 2)))
    b = blur(a, r)
    ys = (np.arange(h) + 0.5) * H0 / h - 0.5; xs = (np.arange(w) + 0.5) * W0 / w - 0.5
    y0 = np.clip(ys.astype(int), 0, H0 - 2); x0 = np.clip(xs.astype(int), 0, W0 - 2)
    fy = (ys - y0)[:, None, None].astype(np.float32); fx = (xs - x0)[None, :, None].astype(np.float32)
    r0 = b[y0]; r1 = b[y0 + 1]
    t = r0[:, x0] * (1 - fx) + r0[:, x0 + 1] * fx; u = r1[:, x0] * (1 - fx) + r1[:, x0 + 1] * fx
    return t * (1 - fy) + u * fy

def height_to_normal(hf, strength):
    dy, dx = np.gradient(hf)
    n = np.stack((-dx * strength, -dy * strength, np.ones_like(hf)), axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5

def blur(a, r):
    """A cheap separable box blur, three passes."""
    a = a.astype(np.float32)
    for _ in range(3):
        for ax in (0, 1):
            c = np.cumsum(a, axis=ax)
            p = np.take(c, np.clip(np.arange(a.shape[ax]) + r, 0, a.shape[ax] - 1), axis=ax)
            q = np.take(c, np.clip(np.arange(a.shape[ax]) - r - 1, 0, a.shape[ax] - 1), axis=ax)
            a = (p - q) / (2 * r + 1)
    return a

def scales(a, b, size=1.0):
    """Fish scales from two surface coordinates in metres: returns (height 0..1, edge 0..1). Overlapping rows, each scale a round-bottomed shield."""
    pw = 0.024 * size; ph = 0.016 * size
    v = b / ph; row = np.floor(v); u = a / pw + 0.5 * (row % 2)
    fu = u - np.floor(u) - 0.5; fv = v - row
    r = np.sqrt(fu * fu * 1.25 + (fv * 0.62) ** 2)
    hgt = np.clip(1.0 - r, 0, 1) ** 0.6
    edge = np.clip((r - 0.40) / 0.25, 0, 1)
    return hgt * (0.55 + 0.45 * fv), edge

def swatches(atlas, normal, mr, em):
    """The added pieces' materials. All in 256 x 256 texels of the head block's empty corner."""
    rng = 1931
    for name in SWATCH:
        i, j = SWATCH[name]; x0 = SW_X + i * SW; y0 = SW_Y + j * SW
        sh = (SW, SW)
        if name == 'bronze':
            # worn bronze: nothing fine at all, only broad soft undulation under a satin surface. The crevices' patina comes from the baked shade
            dents = blur(noise2(sh, rng, 3), max(2, SW // 24))
            alb = (0.90 + 0.09 * (blur(noise2(sh, rng + 3, 4), max(2, SW // 24)) - 0.5))[..., None] * np.array((1, 1, 1), dtype=np.float32)
            atlas[y0:y0 + SW, x0:x0 + SW] = np.clip(alb, 0, 1)
            normal[y0:y0 + SW, x0:x0 + SW] = height_to_normal(dents * 3.2, 0.5)
            mr[y0:y0 + SW, x0:x0 + SW] = np.stack((np.zeros(sh), 0.46 + 0.12 * blur(noise2(sh, rng + 4, 5), 3), np.full(sh, 0.72)), -1)
        elif name == 'cloth':
            # sea cloth: no weave (a weave turns to moire at phone size), only soft mottling
            n = blur(noise2(sh, rng + 5, 5), max(1, SW // 40))
            atlas[y0:y0 + SW, x0:x0 + SW] = np.clip((0.84 + 0.28 * (n - 0.5))[..., None], 0, 1)
            normal[y0:y0 + SW, x0:x0 + SW] = height_to_normal(n * 3.0, 0.45)
            mr[y0:y0 + SW, x0:x0 + SW] = np.stack((np.zeros(sh), np.full(sh, 0.74), np.zeros(sh)), -1)
        elif name == 'scale':
            yy, xx = np.mgrid[0:SW, 0:SW] * (0.002)
            hg, ed = scales(xx.astype(np.float32), yy.astype(np.float32))
            atlas[y0:y0 + SW, x0:x0 + SW] = np.clip((0.82 + 0.3 * (hg - 0.5) - 0.3 * ed)[..., None], 0, 1)
            normal[y0:y0 + SW, x0:x0 + SW] = height_to_normal(blur(hg, 1), 2.4)
            mr[y0:y0 + SW, x0:x0 + SW] = np.stack((np.zeros(sh), np.full(sh, 0.4), np.full(sh, 0.3)), -1)
        else:   # glow: flat white in the map (the vertex colour is the line's colour), pure light in the emissive
            atlas[y0:y0 + SW, x0:x0 + SW] = 1.0
            normal[y0:y0 + SW, x0:x0 + SW] = (0.5, 0.5, 1.0)
            mr[y0:y0 + SW, x0:x0 + SW] = np.stack((np.zeros(sh), np.full(sh, 0.5), np.zeros(sh)), -1)
            em[y0:y0 + SW, x0:x0 + SW] = 1.0

def grade_skin(rgb, tone='#9a6443', ref=(0.88, 0.66, 0.56), keep=None):
    """Graded in linear light: the skin's own detail stays, its base goes from pale to warm brown."""
    lin = srgb2lin(rgb); ref_l = srgb2lin(np.array(ref, dtype=np.float32)); tgt = srgb2lin(hexc(tone))
    out = lin * (tgt / ref_l)
    lum = out.mean(axis=-1, keepdims=True)
    return lin2srgb(lum + (out - lum) * 0.92)
