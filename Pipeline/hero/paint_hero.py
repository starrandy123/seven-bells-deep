# The Warden's skin: Rocketbox's own, graded warm brown, the trunks gone under a teal scale wrap, fine tide-lines inked into him and lit in the emissive map.
import math, os
import numpy as np
import tex

def tris_of(d, mat, co):
    ls, cv, uv, ms = d['loop_start'], d['corner_v'], d['uv'], d['mat']
    sel = np.nonzero(ms == mat)[0]
    a = ls[sel]
    idx = np.stack((a, a + 1, a + 2), 1)
    return np.clip(uv[idx], 0.0, 1.0), co[cv[idx]], cv[idx]

def seg_dist(P, A, B):
    """Distance from points P (n,2) to segments A-B (m,2)."""
    d = B - A; l = (d * d).sum(1)[:, None]
    t = np.clip(((P[:, None, :] - A[None]) * d[None]).sum(2) / np.maximum(l.T, 1e-9), 0, 1)
    c = A[None] + t[..., None] * d[None]
    return np.sqrt(((P[:, None, :] - c) ** 2).sum(2)).min(1)

def curve(pts, n=14):
    """A smooth polyline through points (Catmull-Rom), n steps each span."""
    p = [np.array(x, dtype=np.float32) for x in pts]; p = [p[0]] + p + [p[-1]]; out = []
    for i in range(1, len(p) - 2):
        for k in range(n):
            t = k / n; a, b, c, e = p[i - 1], p[i], p[i + 1], p[i + 2]
            out.append(0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - e) * t * t + (3 * b - a - 3 * c + e) * t * t * t))
    out.append(p[-2]); return np.array(out, dtype=np.float32)

def lines_to_field(P, lines):
    A = np.concatenate([l[:-1] for l in lines]); B = np.concatenate([l[1:] for l in lines])
    out = np.full(len(P), 1e9, dtype=np.float32)
    for i in range(0, len(P), 40000):
        out[i:i + 40000] = seg_dist(P[i:i + 40000], A, B)
    return out

def paint(d, co, W, BI, J, OUT, SRC, log):
    S = tex.BLOCK; TD = os.path.join(SRC, 'Textures')
    body_i = next(i for i, n in enumerate(d['mat_names']) if 'body' in n.lower()); head_i = next(i for i, n in enumerate(d['mat_names']) if 'head' in n.lower())
    bc = tex.load(os.path.join(TD, 'm021_body_color.tga'), S); bn = tex.load(os.path.join(TD, 'm021_body_normal.tga'), S)
    hc = tex.load(os.path.join(TD, 'm021_head_color.tga'), S); hn = tex.load(os.path.join(TD, 'm021_head_normal.tga'), S)
    log('textures read', 'uv range', d['uv'].min(0), d['uv'].max(0))
    # each texel's place on the body
    uvb, cob, cvb = tris_of(d, body_i, co)
    armness = (W[:, BI['arm_R']] + W[:, BI['fore_R']] + W[:, BI['arm_L']] + W[:, BI['fore_L']] + W[:, BI['clav_R']] * 0 + W[:, BI['hand_R']] + W[:, BI['hand_L']])
    legness = W[:, BI['leg_R']] + W[:, BI['leg_L']] + W[:, BI['shin_R']] + W[:, BI['shin_L']]
    extra = np.stack((armness[cvb], legness[cvb]), axis=-1).astype(np.float32)
    pos, mask, ex = tex.bake_positions(uvb, cob, S, extra)
    log('positions baked', int(mask.sum()))
    # the trunks' reach, read from the texture: dark or printed cloth
    dark = (bc.mean(-1) < 0.34) & mask & (ex[..., 1] + (pos[..., 2] < 1.15) > 0) & (pos[..., 2] > 0.6) & (pos[..., 2] < 1.2)
    zs = pos[dark][:, 2]; log('trunks z', np.percentile(zs, [0.5, 5, 50, 95, 99.5]))
    colr = tex.grade_skin(bc); log('graded')
    # ---- the wrap: scales from the top of the trunks to the thigh, its hem cut on a slant
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    hem = 0.800 + 0.035 * np.sin(np.arctan2(y, x) * 1 + 0.6)
    top = float(np.percentile(zs, 99.0)) + 0.012 + 0.012 * np.cos(np.arctan2(y, x))
    wrap = mask & (z > hem) & (z < top) & (ex[..., 0] < 0.4)
    ang = np.arctan2(x, -y); rad = 0.19
    a, b = ang * rad, z
    # thighs' own angle, so the scales don't smear down the legs
    hg, ed = tex.scales(a, b, 1.0)
    hg = tex.blur(hg, 1); nz = tex.noise2((S, S), 77, 40); log('scales')
    teal = tex.srgb2lin(tex.hexc('#0f6f7a')); deep = tex.srgb2lin(tex.hexc('#052f38')); hi = tex.srgb2lin(tex.hexc('#3ab7b0'))
    shade = np.clip(hg * (0.7 + 0.5 * nz), 0, 1)[..., None]
    wr = deep + (teal - deep) * shade ** 0.7 + (hi - teal) * np.clip(shade - 0.62, 0, 1) * 1.7
    wr = wr * (1 - 0.65 * ed[..., None])
    # pearl edges at the hem and the top, a soft line
    near = np.minimum(np.abs(z - hem), np.abs(z - top)); edge = (near < 0.009)[..., None]
    wr = np.where(edge, tex.srgb2lin(tex.hexc('#e9efe6')) * (0.75 + 0.25 * nz[..., None]), wr)
    wrr = tex.lin2srgb(wr)
    soft = tex.blur(wrap.astype(np.float32), 1)[..., None]
    colr = colr * (1 - soft) + wrr * soft
    # the wrap's normals: scale relief; cloth folds of the trunks go
    sn = tex.height_to_normal(hg, 4.0)
    bnn = bn * (1 - soft) + sn * soft
    # ---- the tide lines: thin and few. Chest and back drawn on the plane (x, z), arms and thighs round their own axes
    ink = np.zeros((S, S), dtype=np.float32)
    torso = mask & (ex[..., 0] < 0.45) & (z > 1.03) & (z < 1.56)
    fr = torso & (y < 0.0); bk = torso & (y >= 0.0)
    wid = 0.0026
    F = []
    F.append(curve([(0.0, 1.075), (0.004, 1.17), (-0.003, 1.26), (0.0, 1.335)]))                 # the centre line, navel to breastbone
    for s in (-1, 1):
        F.append(curve([(0.0, 1.335), (s * 0.05, 1.39), (s * 0.13, 1.455), (s * 0.235, 1.485)]))  # up and out to each shoulder
        F.append(curve([(0.0, 1.30), (s * 0.075, 1.262), (s * 0.15, 1.285), (s * 0.20, 1.34)]))   # under each breast, a wave's curve
        F.append(curve([(s * 0.035, 1.18), (s * 0.085, 1.155), (s * 0.13, 1.19)]))                # one low crest each side
    log('front texels', int(fr.sum()), 'back', int(bk.sum()), 'segments', sum(len(l) for l in F))
    d_f = lines_to_field(np.stack((x[fr], z[fr]), 1), F)
    ink[fr] = np.clip(1.0 - d_f / wid, 0, 1)
    B = [curve([(0.0, 1.10), (0.003, 1.22), (-0.003, 1.34), (0.0, 1.47)])]
    for s in (-1, 1):
        B.append(curve([(0.0, 1.42), (s * 0.08, 1.38), (s * 0.16, 1.40), (s * 0.235, 1.47)]))
        B.append(curve([(0.0, 1.27), (s * 0.09, 1.235), (s * 0.17, 1.27)]))
    d_b = lines_to_field(np.stack((x[bk], z[bk]), 1), B)
    ink[bk] = np.clip(1.0 - d_b / wid, 0, 1)
    # the arms: one current running shoulder to wrist round the outside, two bands above the elbow
    for side in 'RL':
        A, E, Wr = J['arm_' + side], J['fore_' + side], J['hand_' + side]
        for seg, (P, Q) in enumerate(((A, E), (E, Wr))):
            u = (Q - P) / np.linalg.norm(Q - P); e1 = np.array((0.0, -1.0, 0.0)); e1 -= u * e1.dot(u); e1 /= np.linalg.norm(e1); e2 = np.cross(u, e1)
            L = float(np.linalg.norm(Q - P))
            s_ = (pos - P) @ u; q = pos - P - s_[..., None] * u
            th = np.arctan2(q @ e2, q @ e1); r = np.linalg.norm(q, axis=-1)
            near_ = mask & (ex[..., 0] > 0.5) & (s_ > -0.02) & (s_ < L + 0.01) & (r < 0.13) & (np.sign(x) == (1 if side == 'L' else -1))
            th0 = 1.15 * np.sin(s_ * (2 * math.pi / 0.34) + seg * 0.9) + (1.6 if side == 'L' else -1.6)
            dt = (th - th0 + math.pi) % (2 * math.pi) - math.pi
            ln = np.clip(1.0 - np.abs(dt * r) / (wid * 1.1), 0, 1)
            if seg == 0:
                for sb in (0.56, 0.635): ln = np.maximum(ln, np.clip(1.0 - np.abs(s_ - sb * L) / (wid * 0.9), 0, 1))
            ink = np.where(near_, np.maximum(ink, ln), ink)
    # the thighs' outsides
    for side in 'RL':
        P, Q = J['leg_' + side], J['shin_' + side]; u = (Q - P) / np.linalg.norm(Q - P); L = float(np.linalg.norm(Q - P))
        e1 = np.array((0.0, -1.0, 0.0)); e1 -= u * e1.dot(u); e1 /= np.linalg.norm(e1); e2 = np.cross(u, e1)
        s_ = (pos - P) @ u; q = pos - P - s_[..., None] * u; th = np.arctan2(q @ e2, q @ e1); r = np.linalg.norm(q, axis=-1)
        near_ = mask & (ex[..., 1] > 0.5) & (s_ > 0.17) & (s_ < L * 0.93) & (r < 0.15) & (np.sign(x) == (1 if side == 'L' else -1)) & (~wrap)
        th0 = 0.7 * np.sin(s_ * (2 * math.pi / 0.30)) + (1.6 if side == 'L' else -1.6)
        dt = (th - th0 + math.pi) % (2 * math.pi) - math.pi
        ink = np.where(near_, np.maximum(ink, np.clip(1.0 - np.abs(dt * r) / (wid * 1.1), 0, 1)), ink)
    ink = np.clip(ink * 1.6, 0, 1)
    colr = colr * (1 - 0.62 * ink[..., None]) + np.array((0.16, 0.66, 0.72), dtype=np.float32) * 0.62 * ink[..., None]
    log('wrap and lines painted')
    # the head: graded the same, but the eye and mouth patches in the corner keep their colour
    uvh, coh, cvh = tris_of(d, head_i, co)
    hcg = tex.grade_skin(hc, ref=(0.86, 0.62, 0.52))
    # hair and stubble go near black-brown, which grading already does; the eyes' patch stays
    keep = np.zeros((S, S), dtype=bool); keep[:int(S * 0.40), :int(S * 0.37)] = True
    # the eye keeps its colour, seated a little deeper so it doesn't stare out of dark skin
    hcg = np.where(keep[..., None], hc * np.array((0.74, 0.76, 0.78), dtype=np.float32), hcg)
    # the atlas
    atlas = np.zeros((tex.H, tex.W, 3), dtype=np.float32); normal = np.zeros_like(atlas); normal[...] = (0.5, 0.5, 1.0)
    mr = np.zeros_like(atlas); mr[..., 1] = 0.46
    em = np.zeros_like(atlas)
    atlas[:S] = hcg; atlas[S:] = colr; normal[:S] = hn; normal[S:] = bnn
    mr[S:][wrap] = (0, 0.34, 0.25)
    mr[:S][keep] = (0, 0.16, 0)
    em[S:] = ink[..., None] * np.array((0.31, 0.94, 1.0), dtype=np.float32) * 0.62
    tex.swatches(atlas, normal, mr, em)
    em[tex.SW_Y + tex.SW:tex.SW_Y + 2 * tex.SW, tex.SW_X + tex.SW:tex.SW_X + 2 * tex.SW] = np.array((0.31, 0.94, 1.0), dtype=np.float32)
    files = {'albedo': os.path.join(OUT, 'hero_albedo.jpg'), 'normal': os.path.join(OUT, 'hero_normal.jpg'), 'mr': os.path.join(OUT, 'hero_mr.jpg'), 'emissive': os.path.join(OUT, 'hero_emissive.jpg')}
    sizes = {}
    sizes['albedo'] = tex.save_jpg(atlas, files['albedo'], q=3)
    sizes['normal'] = tex.save_jpg(normal, files['normal'], q=2, chroma444=True)
    small = lambda a, k: a.reshape(a.shape[0] // k, k, a.shape[1] // k, k, 3).mean(axis=(1, 3))
    sizes['mr'] = tex.save_jpg(small(mr, 4), files['mr'], q=5, chroma444=True)
    sizes['emissive'] = tex.save_jpg(np.clip(tex.resize(em, 384, 768) * 1.7, 0, 1), files['emissive'], q=3)        # 1.6 MB of the 24 MB budget
    log('atlas', sizes)
    return files
