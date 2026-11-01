# Drowned City: the mesh kit (numpy only). Every prop and creature is built from these and handed to Blender only to decimate, cut, export
# and render. A Mesh is triangles with colours in the corners (RGBA, linear; alpha 1 = plain, below 1 = glow, 1 - a its strength), so a colour
# edge can be as crisp as a mesh edge. Collision and ambient occlusion are measured from the finished mesh by voxels, never hand-sized.
import math
import numpy as np

TAU = 2.0 * math.pi


def lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def hexc(h):
    h = h.lstrip('#')
    return lin(np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]))


def sstep(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=np.float64) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def mix(a, b, t):
    return a + (b - a) * t


class Mesh:
    def __init__(self, V, T, C=None, S=True):
        self.V = np.asarray(V, dtype=np.float64).reshape(-1, 3)
        self.T = np.asarray(T, dtype=np.int64).reshape(-1, 3)
        n = len(self.T)
        self.C = np.ones((n, 3, 4))
        if C is not None:
            c = np.asarray(C, dtype=np.float64)
            if c.ndim == 1:
                self.C[..., :c.shape[0]] = c
            else:
                self.C[..., :c.shape[-1]] = c
        self.S = np.full(n, bool(S)) if np.ndim(S) == 0 else np.asarray(S, dtype=bool)

    def copy(self):
        m = Mesh(self.V.copy(), self.T.copy())
        m.C = self.C.copy()
        m.S = self.S.copy()
        return m

    @property
    def tris(self):
        return len(self.T)

    def corners(self):
        return self.V[self.T]

    def face_normals(self):
        p = self.corners()
        n = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
        L = np.linalg.norm(n, axis=1, keepdims=True)
        return n / np.maximum(L, 1e-12)

    def moved(self, x=0.0, y=0.0, z=0.0):
        m = self.copy()
        m.V = m.V + np.array([x, y, z])
        return m

    def scaled(self, s, sy=None, sz=None):
        m = self.copy()
        m.V = m.V * np.array([s, s if sy is None else sy, s if sz is None else sz])
        if (s * (s if sy is None else sy) * (s if sz is None else sz)) < 0:
            m.T = m.T[:, ::-1]
            m.C = m.C[:, ::-1]
        return m

    def rot(self, axis, a):
        c, s = math.cos(a), math.sin(a)
        m = self.copy()
        x, y, z = m.V[:, 0].copy(), m.V[:, 1].copy(), m.V[:, 2].copy()
        if axis == 'z':
            m.V[:, 0], m.V[:, 1] = x * c - y * s, x * s + y * c
        elif axis == 'x':
            m.V[:, 1], m.V[:, 2] = y * c - z * s, y * s + z * c
        else:
            m.V[:, 0], m.V[:, 2] = x * c + z * s, -x * s + z * c
        return m

    def flip(self):
        m = self.copy()
        m.T = m.T[:, ::-1]
        m.C = m.C[:, ::-1]
        return m

    def outward(self):
        """Flip a closed shell whose faces look in (signed volume about its middle)."""
        p = self.corners() - self.V.mean(axis=0)
        vol = np.einsum('ij,ij->i', p[:, 0], np.cross(p[:, 1], p[:, 2])).sum()
        return self.flip() if vol < 0 else self.copy()

    def tint(self, rgb):
        self.C[..., :3] = rgb
        return self

    def tinted(self, rgb):
        m = self.copy()
        m.C[..., :3] = rgb
        return m

    def glow(self, g):
        """g 0..1: the corners' alpha becomes 1 - g."""
        self.C[..., 3] = 1.0 - g
        return self


def join(meshes):
    meshes = [m for m in meshes if m is not None and m.tris]
    V, T, C, S = [], [], [], []
    off = 0
    for m in meshes:
        V.append(m.V)
        T.append(m.T + off)
        C.append(m.C)
        S.append(m.S)
        off += len(m.V)
    out = Mesh(np.concatenate(V), np.concatenate(T))
    out.C = np.concatenate(C)
    out.S = np.concatenate(S)
    return out


def grid(P, wrap_u=False, wrap_v=False, S=True, flip=False):
    """A grid of points (nu, nv, 3) as triangles."""
    P = np.asarray(P, dtype=np.float64)
    nu, nv = P.shape[:2]
    idx = np.arange(nu * nv).reshape(nu, nv)
    iu = np.arange(nu if wrap_u else nu - 1)
    jv = np.arange(nv if wrap_v else nv - 1)
    iu2 = (iu + 1) % nu
    jv2 = (jv + 1) % nv
    a = idx[np.ix_(iu, jv)].ravel()
    b = idx[np.ix_(iu2, jv)].ravel()
    c = idx[np.ix_(iu2, jv2)].ravel()
    d = idx[np.ix_(iu, jv2)].ravel()
    T = np.stack([np.stack([a, b, c], 1), np.stack([a, c, d], 1)], 1).reshape(-1, 3)
    if flip:
        T = T[:, ::-1]
    return Mesh(P.reshape(-1, 3), T, S=S)


def fan(ring, tip, flip=False, S=True):
    """Close a ring of points with a tip."""
    ring = np.asarray(ring, dtype=np.float64)
    n = len(ring)
    V = np.vstack([ring, np.asarray(tip, dtype=np.float64).reshape(1, 3)])
    T = np.array([[i, (i + 1) % n, n] for i in range(n)])
    if flip:
        T = T[:, ::-1]
    return Mesh(V, T, S=S)


def lathe(profile, segs=16, S=True, wob=None, flat=False, start=0.0):
    """Turned about z: profile = [(r, z), ...] bottom to top; closed at both ends if r > 0. wob(theta, z, i) -> radial multiplier."""
    pr = np.asarray(profile, dtype=np.float64)
    th = np.linspace(0.0, TAU, segs, endpoint=False) + start
    P = np.zeros((len(pr), segs, 3))
    for i, (r, z) in enumerate(pr):
        k = 1.0 if wob is None else wob(th, z, i)
        P[i, :, 0] = r * k * np.cos(th)
        P[i, :, 1] = r * k * np.sin(th)
        P[i, :, 2] = z
    parts = [grid(P, wrap_v=True, S=S, flip=False)]
    if pr[0, 0] > 1e-6:
        parts.append(fan(P[0], (P[0, :, 0].mean(), P[0, :, 1].mean(), pr[0, 1]), flip=True, S=False))
    if pr[-1, 0] > 1e-6:
        parts.append(fan(P[-1], (P[-1, :, 0].mean(), P[-1, :, 1].mean(), pr[-1, 1]), S=False))
    return join(parts).outward()


def box(x0, x1, y0, y1, z0, z1, S=False, nx=1, ny=1, nz=1):
    """An axis box, its faces cut in nx, ny, nz (colours follow those cuts)."""
    def face(o, u, v, nu, nv):
        a = np.linspace(0, 1, nu + 1)[:, None, None]
        b = np.linspace(0, 1, nv + 1)[None, :, None]
        return grid(o[None, None, :] + a * u[None, None, :] + b * v[None, None, :], S=S)

    dx, dy, dz = np.array([x1 - x0, 0, 0.]), np.array([0, y1 - y0, 0.]), np.array([0, 0, z1 - z0.__float__()])
    o = np.array([x0, y0, z0], dtype=np.float64)
    parts = [
        face(o, dz, dx, nz, nx),                          # y0 side, looking -y
        face(o + dy, dx, dz, nx, nz),                     # y1 side, looking +y
        face(o, dy, dz, ny, nz),                          # x0 side, looking -x
        face(o + dx, dz, dy, nz, ny),                     # x1 side, looking +x
        face(o, dx, dy, nx, ny),                          # bottom
        face(o + dz, dy, dx, ny, nx),                     # top
    ]
    return join(parts).outward()


def tube(points, radii, sides=5, S=True, cap_end=True, cap_start=False, twist=0.0):
    """A tapered tube along a polyline; a parallel-transport frame, so it never pinches."""
    pts = np.asarray(points, dtype=np.float64)
    rad = np.asarray(radii, dtype=np.float64)
    n = len(pts)
    d = np.gradient(pts, axis=0)
    d = d / np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    up = np.array([0.31, 0.17, 0.93])
    e1 = np.cross(d[0], up)
    e1 = e1 / max(np.linalg.norm(e1), 1e-9)
    th = np.linspace(0, TAU, sides, endpoint=False)
    P = np.zeros((n, sides, 3))
    for i in range(n):
        e1 = e1 - d[i] * np.dot(e1, d[i])
        e1 = e1 / max(np.linalg.norm(e1), 1e-9)
        e2 = np.cross(d[i], e1)
        a = th + twist * i
        P[i] = pts[i] + (np.cos(a)[:, None] * e1 + np.sin(a)[:, None] * e2) * rad[i]
    parts = [grid(P, wrap_v=True, S=S)]
    if cap_end:
        parts.append(fan(P[-1], pts[-1] + d[-1] * rad[-1] * 0.8, S=S))
    if cap_start:
        parts.append(fan(P[0], pts[0] - d[0] * rad[0] * 0.5, flip=True, S=S))
    return join(parts).outward()


def sphere(c, r, seg=10, rings=7, S=True):
    rx, ry, rz = (r, r, r) if np.ndim(r) == 0 else r
    th = np.linspace(0, np.pi, rings + 1)[1:-1]
    ph = np.linspace(0, TAU, seg, endpoint=False)
    P = np.zeros((len(th), seg, 3))
    for i, t in enumerate(th):
        P[i, :, 0] = rx * math.sin(t) * np.cos(ph)
        P[i, :, 1] = ry * math.sin(t) * np.sin(ph)
        P[i, :, 2] = -rz * math.cos(t)
    m = join([grid(P, wrap_v=True, S=S), fan(P[0], (0, 0, -rz), flip=True, S=S), fan(P[-1], (0, 0, rz), S=S)])
    return m.outward().moved(*c)


# ---------------------------------------------------------------- 3D noise
class Perlin3:
    def __init__(self, seed):
        r = np.random.RandomState(seed)
        p = r.permutation(256)
        self.p = np.concatenate([p, p, p])
        g = r.normal(size=(256, 3))
        self.g = g / np.linalg.norm(g, axis=1, keepdims=True)

    def __call__(self, x, y, z):
        x, y, z = np.asarray(x, np.float64), np.asarray(y, np.float64), np.asarray(z, np.float64)
        xi, yi, zi = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64), np.floor(z).astype(np.int64)
        xf, yf, zf = x - xi, y - yi, z - zi
        xi, yi, zi = xi & 255, yi & 255, zi & 255
        p, g = self.p, self.g

        def dot(ix, iy, iz, dx, dy, dz):
            v = g[p[p[p[ix & 255] + (iy & 255)] + (iz & 255)]]
            return v[..., 0] * dx + v[..., 1] * dy + v[..., 2] * dz

        f = lambda t: t * t * t * (t * (t * 6 - 15) + 10)
        u, v, w = f(xf), f(yf), f(zf)
        n000 = dot(xi, yi, zi, xf, yf, zf)
        n100 = dot(xi + 1, yi, zi, xf - 1, yf, zf)
        n010 = dot(xi, yi + 1, zi, xf, yf - 1, zf)
        n110 = dot(xi + 1, yi + 1, zi, xf - 1, yf - 1, zf)
        n001 = dot(xi, yi, zi + 1, xf, yf, zf - 1)
        n101 = dot(xi + 1, yi, zi + 1, xf - 1, yf, zf - 1)
        n011 = dot(xi, yi + 1, zi + 1, xf, yf - 1, zf - 1)
        n111 = dot(xi + 1, yi + 1, zi + 1, xf - 1, yf - 1, zf - 1)
        a = mix(mix(n000, n100, u), mix(n010, n110, u), v)
        b = mix(mix(n001, n101, u), mix(n011, n111, u), v)
        return mix(a, b, w) * 1.6

    def fbm(self, x, y, z, octaves=4, gain=0.5, lac=2.03):
        out, amp, tot, f = 0.0, 1.0, 0.0, 1.0
        for i in range(octaves):
            out = out + amp * self(x * f + i * 3.7, y * f - i * 1.9, z * f + i * 5.3)
            tot += amp
            amp *= gain
            f *= lac
        return out / tot

    def ridged(self, x, y, z, octaves=4, gain=0.5, lac=2.03):
        out, amp, tot, f = 0.0, 1.0, 0.0, 1.0
        for i in range(octaves):
            n = 1.0 - np.abs(self(x * f + i * 2.1, y * f + i * 4.3, z * f - i * 3.1))
            out = out + amp * n * n
            tot += amp
            amp *= gain
            f *= lac
        return out / tot


# ---------------------------------------------------------------- signed fields and their surface
def field_grid(lo, hi, pitch):
    lo = np.asarray(lo, np.float64)
    hi = np.asarray(hi, np.float64)
    n = np.ceil((hi - lo) / pitch).astype(int) + 1
    ax = [lo[i] + np.arange(n[i]) * pitch for i in range(3)]
    X, Y, Z = np.meshgrid(ax[0], ax[1], ax[2], indexing='ij')
    return X, Y, Z, lo, pitch


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return mix(b, a, h) - k * h * (1.0 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def sd_ellipsoid(X, Y, Z, c, r):
    k0 = np.sqrt(((X - c[0]) / r[0]) ** 2 + ((Y - c[1]) / r[1]) ** 2 + ((Z - c[2]) / r[2]) ** 2)
    k1 = np.sqrt(((X - c[0]) / r[0] ** 2) ** 2 + ((Y - c[1]) / r[1] ** 2) ** 2 + ((Z - c[2]) / r[2] ** 2) ** 2)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def sd_capsule(X, Y, Z, a, b, ra, rb=None):
    """A tapered capsule from a to b."""
    rb = ra if rb is None else rb
    a = np.asarray(a, np.float64)
    b = np.asarray(b, np.float64)
    ab = b - a
    L2 = max(float(np.dot(ab, ab)), 1e-9)
    t = np.clip(((X - a[0]) * ab[0] + (Y - a[1]) * ab[1] + (Z - a[2]) * ab[2]) / L2, 0.0, 1.0)
    d = np.sqrt((X - a[0] - t * ab[0]) ** 2 + (Y - a[1] - t * ab[1]) ** 2 + (Z - a[2] - t * ab[2]) ** 2)
    return d - (ra + (rb - ra) * t)


def surface_nets(F, lo, h, S=True):
    """The surface F = 0 (inside negative) of a sampled field, as a mesh. Dual: one vertex a cell, one quad a crossing edge."""
    inside = F < 0
    nx, ny, nz = F.shape
    n_in = np.zeros((nx - 1, ny - 1, nz - 1), dtype=np.int8)
    for i in (0, 1):
        for j in (0, 1):
            for k in (0, 1):
                n_in += inside[i:nx - 1 + i, j:ny - 1 + j, k:nz - 1 + k].astype(np.int8)
    act = (n_in > 0) & (n_in < 8)
    coords = np.argwhere(act)
    idx = -np.ones(act.shape, dtype=np.int64)
    idx[act] = np.arange(len(coords))
    sums = np.zeros((len(coords), 3))
    cnt = np.zeros(len(coords))
    cx, cy, cz = coords[:, 0], coords[:, 1], coords[:, 2]
    for axis in range(3):
        o1, o2 = [(1, 2), (0, 2), (0, 1)][axis]
        for u in (0, 1):
            for v in (0, 1):
                a = coords.copy()
                a[:, o1] += u
                a[:, o2] += v
                b = a.copy()
                b[:, axis] += 1
                fa = F[a[:, 0], a[:, 1], a[:, 2]]
                fb = F[b[:, 0], b[:, 1], b[:, 2]]
                m = (fa < 0) != (fb < 0)
                t = fa[m] / (fa[m] - fb[m])
                p = np.zeros((m.sum(), 3))
                p[:, axis] = t
                p[:, o1] = u
                p[:, o2] = v
                sums[m] += p
                cnt[m] += 1
    V = np.asarray(lo) + h * (coords + sums / np.maximum(cnt, 1)[:, None])
    quads = []
    for axis in range(3):
        o1, o2 = [(1, 2), (2, 0), (0, 1)][axis]
        lo_s = [slice(None)] * 3
        hi_s = [slice(None)] * 3
        lo_s[axis] = slice(0, -1)
        hi_s[axis] = slice(1, None)
        cross = inside[tuple(lo_s)] != inside[tuple(hi_s)]
        e = np.argwhere(cross)
        keep = (e[:, o1] > 0) & (e[:, o2] > 0) & (e[:, o1] < F.shape[o1] - 1) & (e[:, o2] < F.shape[o2] - 1)
        e = e[keep]
        if not len(e):
            continue
        flipit = inside[e[:, 0], e[:, 1], e[:, 2]]

        def cell(du, dv):
            c = e.copy()
            c[:, o1] -= du
            c[:, o2] -= dv
            return idx[c[:, 0], c[:, 1], c[:, 2]]

        a, b, c, d = cell(1, 1), cell(0, 1), cell(0, 0), cell(1, 0)
        q = np.stack([a, b, c, d], 1)
        q[~flipit] = q[~flipit][:, ::-1]
        quads.append(q)
    Q = np.concatenate(quads)
    Q = Q[(Q >= 0).all(axis=1)]
    T = np.concatenate([Q[:, [0, 1, 2]], Q[:, [0, 2, 3]]])
    return Mesh(V, T, S=S)


# ---------------------------------------------------------------- voxels: collision and ambient occlusion from the real mesh
def _sample_surface(mesh, pitch):
    V, T = mesh.V, mesh.T
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    L = np.max([np.linalg.norm(a - b, axis=1), np.linalg.norm(b - c, axis=1), np.linalg.norm(c - a, axis=1)], axis=0)
    n = np.ceil(L / (pitch * 0.55)).astype(int) + 1
    out = []
    for k in np.unique(n):
        sel = n == k
        u, v = np.meshgrid(np.arange(k + 1) / k, np.arange(k + 1) / k, indexing='ij')
        m = (u + v) <= 1.0 + 1e-9
        u, v = u[m].ravel(), v[m].ravel()
        A, B, C = a[sel], b[sel], c[sel]
        pts = A[:, None, :] + (B - A)[:, None, :] * u[None, :, None] + (C - A)[:, None, :] * v[None, :, None]
        out.append(pts.reshape(-1, 3))
    return np.concatenate(out)


class Voxels:
    """Inside = what no flood from outside can reach, so overlapping shells count as one solid and an opening stays open."""

    def __init__(self, mesh, pitch):
        self.h = pitch
        lo, hi = mesh.V.min(axis=0), mesh.V.max(axis=0)
        self.lo = lo - pitch * 1.5
        self.n = np.ceil((hi - lo) / pitch).astype(int) + 4
        pts = _sample_surface(mesh, pitch)
        ijk = np.floor((pts - self.lo) / pitch).astype(int)
        ijk = np.clip(ijk, 0, self.n - 1)
        occ = np.zeros(self.n, dtype=bool)
        occ[ijk[:, 0], ijk[:, 1], ijk[:, 2]] = True
        ext = np.zeros(self.n, dtype=bool)
        ext[0, :, :] = ext[-1, :, :] = True
        ext[:, 0, :] = ext[:, -1, :] = True
        ext[:, :, 0] = ext[:, :, -1] = True
        ext &= ~occ
        free = ~occ
        count = ext.sum()
        while True:
            g = ext.copy()
            g[1:, :, :] |= ext[:-1, :, :]
            g[:-1, :, :] |= ext[1:, :, :]
            g[:, 1:, :] |= ext[:, :-1, :]
            g[:, :-1, :] |= ext[:, 1:, :]
            g[:, :, 1:] |= ext[:, :, :-1]
            g[:, :, :-1] |= ext[:, :, 1:]
            g &= free
            c = g.sum()
            ext = g
            if c == count:
                break
            count = c
        self.solid = ~ext

    def blur(self, r):
        """Box blur of the solid, radius r cells (for occlusion)."""
        a = self.solid.astype(np.float32)
        for ax in range(3):
            c = np.cumsum(np.concatenate([np.zeros_like(np.take(a, [0], axis=ax)), a], axis=ax), axis=ax)
            n = a.shape[ax]
            hi = np.clip(np.arange(n) + r + 1, 0, n)
            lo = np.clip(np.arange(n) - r, 0, n)
            a = (np.take(c, hi, axis=ax) - np.take(c, lo, axis=ax))
            shape = [1, 1, 1]
            shape[ax] = n
            a = a / (hi - lo).reshape(shape)
        return a

    def lookup(self, arr, P):
        ijk = np.clip(np.floor((P - self.lo) / self.h).astype(int), 0, self.n - 1)
        return arr[ijk[..., 0], ijk[..., 1], ijk[..., 2]]

    def boxes(self, max_boxes=12, fill=1.0, cover=0.97, tries=36, seed=7):
        """Greedy boxes covering the solid. fill below 1 lets a box hold some water, to keep the count down on a rough shape."""
        s = self.solid
        rs = np.random.RandomState(seed)
        left = s.copy()
        total = max(int(s.sum()), 1)
        P = np.cumsum(np.cumsum(np.cumsum(s.astype(np.int64), 0), 1), 2)
        P = np.pad(P, ((1, 0), (1, 0), (1, 0)))

        def vol(b):
            i0, i1, j0, j1, k0, k1 = b
            return (P[i1, j1, k1] - P[i0, j1, k1] - P[i1, j0, k1] - P[i1, j1, k0] + P[i0, j0, k1] + P[i0, j1, k0] + P[i1, j0, k0] - P[i0, j0, k0])

        out = []
        while left.any() and len(out) < max_boxes and (1.0 - left.sum() / total) < cover:
            cand = np.argwhere(left)
            best, gain = None, -1
            for t in range(tries):
                c = cand[rs.randint(len(cand))]
                b = [c[0], c[0] + 1, c[1], c[1] + 1, c[2], c[2] + 1]
                grew = True
                while grew:
                    grew = False
                    for d in range(6):
                        q = list(b)
                        ax = d // 2
                        if d % 2 == 0:
                            if q[ax * 2] == 0:
                                continue
                            q[ax * 2] -= 1
                        else:
                            if q[ax * 2 + 1] >= s.shape[ax]:
                                continue
                            q[ax * 2 + 1] += 1
                        v = (q[1] - q[0]) * (q[3] - q[2]) * (q[5] - q[4])
                        if vol(q) >= fill * v:
                            b = q
                            grew = True
                g = int(left[b[0]:b[1], b[2]:b[3], b[4]:b[5]].sum())
                if g > gain:
                    best, gain = b, g
            left[best[0]:best[1], best[2]:best[3], best[4]:best[5]] = False
            out.append(best)
        res = []
        for b in out:
            x0, y0, z0 = self.lo + self.h * np.array([b[0], b[2], b[4]])
            x1, y1, z1 = self.lo + self.h * np.array([b[1], b[3], b[5]])
            res.append({'t': 'box', 'x': round(float(x0 + x1) / 2, 3), 'y': round(float(y0 + y1) / 2, 3), 'z0': round(float(z0), 3), 'z1': round(float(z1), 3),
                        'hx': round(float(x1 - x0) / 2, 3), 'hy': round(float(y1 - y0) / 2, 3)})
        return res, 1.0 - left.sum() / total

    def cyls(self, max_cyls=3, q=0.9, axis=(0.0, 0.0), tol=0.16):
        """A stack of upright cylinders from the solid's own slices: each slice's radius about the axis (its q quantile), merged while it holds."""
        idx = np.argwhere(self.solid)
        z = self.lo[2] + (idx[:, 2] + 0.5) * self.h
        x = self.lo[0] + (idx[:, 0] + 0.5) * self.h - axis[0]
        y = self.lo[1] + (idx[:, 1] + 0.5) * self.h - axis[1]
        r = np.hypot(x, y)
        ks = np.unique(idx[:, 2])
        slices = []
        for k in ks:
            m = idx[:, 2] == k
            zk = self.lo[2] + k * self.h
            slices.append([zk, zk + self.h, float(np.quantile(r[m], q)) + self.h * 0.5])
        runs = [list(slices[0])]
        for s in slices[1:]:
            if abs(s[2] - runs[-1][2]) <= tol * max(runs[-1][2], s[2]):
                runs[-1][1] = s[1]
                runs[-1][2] = max(runs[-1][2], s[2]) * 0.5 + runs[-1][2] * 0.5
            else:
                runs.append(list(s))
        while len(runs) > max_cyls:
            # merge the thinnest run into its neighbour
            i = min(range(len(runs)), key=lambda t: runs[t][1] - runs[t][0])
            j = i - 1 if i > 0 and (i == len(runs) - 1 or abs(runs[i - 1][2] - runs[i][2]) < abs(runs[i + 1][2] - runs[i][2])) else i + 1
            a, b = min(i, j), max(i, j)
            wa, wb = runs[a][1] - runs[a][0], runs[b][1] - runs[b][0]
            runs[a] = [runs[a][0], runs[b][1], (runs[a][2] * wa + runs[b][2] * wb) / (wa + wb)]
            del runs[b]
        return [{'t': 'cyl', 'x': axis[0], 'y': axis[1], 'z0': round(float(a), 3), 'z1': round(float(b), 3), 'r': round(float(c), 3)} for a, b, c in runs]


def bake_ao(mesh, pitch=None, strength=0.75, vox=None):
    """Ambient occlusion in the corners: how much solid stands round a point just off the surface. Near and far, so creases and courtyards both darken."""
    if vox is None:
        ext = (mesh.V.max(axis=0) - mesh.V.min(axis=0)).max()
        vox = Voxels(mesh, pitch or max(ext / 64.0, 0.05))
    n = mesh.face_normals()[:, None, :]
    P = mesh.corners()
    b1 = vox.blur(2)
    b2 = vox.blur(6)
    h = vox.h
    o1 = vox.lookup(b1, P + n * h * 2.5)
    o2 = vox.lookup(b2, P + n * h * 7.0)
    ao = 1.0 - strength * np.clip(0.9 * o1 + 0.75 * o2, 0.0, 1.0)
    # a lit window or a flame is light, not surface: occlusion never dims it, or the look's glow rule stops seeing it
    lit = mesh.C[..., :3].max(axis=-1) >= 0.94
    ao = np.where(lit, 1.0, ao)
    mesh.C[..., :3] *= ao[..., None]
    return vox


def relax(m, iters=3, k=0.5):
    """Laplacian smoothing: takes the folds out of a decimated surface, which are what read as flat polygons."""
    out = m.copy()
    T = out.T
    e = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
    n = len(out.V)
    c = np.zeros(n)
    np.add.at(c, e[:, 0], 1.0)
    np.add.at(c, e[:, 1], 1.0)
    c = np.maximum(c, 1.0)[:, None]
    V = out.V
    for _ in range(iters):
        s = np.zeros_like(V)
        np.add.at(s, e[:, 0], V[e[:, 1]])
        np.add.at(s, e[:, 1], V[e[:, 0]])
        V = V + k * (s / c - V)
    out.V = V
    return out


def pchip(xk, yk, x):
    """Monotone cubic through keys (never overshoots: a body's outline stays what its keys say)."""
    xk = np.asarray(xk, np.float64)
    yk = np.asarray(yk, np.float64)
    x = np.asarray(x, np.float64)
    h = np.diff(xk)
    d = np.diff(yk) / h
    m = np.zeros_like(yk)
    for i in range(1, len(yk) - 1):
        if d[i - 1] * d[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    m[0] = d[0]
    m[-1] = d[-1]
    i = np.clip(np.searchsorted(xk, x) - 1, 0, len(h) - 1)
    t = (x - xk[i]) / h[i]
    t2, t3 = t * t, t * t * t
    return (2 * t3 - 3 * t2 + 1) * yk[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * yk[i + 1] + (t3 - t2) * h[i] * m[i + 1]
