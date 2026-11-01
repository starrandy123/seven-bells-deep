# Drowned City: two ways a body gets stuck that no single solid shows, read on the game's own rules (collideOnce, pushBox, pushCyl in web/js/world.js, copied here).
#   seams: two boxes that share a face. A body between them is pushed by each toward that face and never leaves.
#   gaps:  a solid's underside close above the ground. Ground lifts a body and never stops it, so where the gap is under about his width it's lifted up into the solid.
import math
from collections import Counter, defaultdict

BODY = 0.62                                                              # his radius swimming; 0.42 on foot
GAP = 1.5


def push_cyl(p, c, r):
    dz = max(c['z0'], min(c['z1'], p[2])) - p[2]
    dx, dy = p[0] - c['x'], p[1] - c['y']
    h = math.hypot(dx, dy)
    R = c['r']
    if abs(dz) >= r or h >= R + r:
        return False
    if h > R:
        nx, ny, qx, qz = dx / h, dy / h, h - R, -dz
        dist = math.hypot(qx, qz)
        if dist >= r or dist < 1e-6:
            return False
        m = (r - dist) / dist
        p[0] += nx * qx * m
        p[1] += ny * qx * m
        p[2] += qz * m
        return True
    if dz != 0:
        p[2] += dz - r if dz > 0 else dz + r
        return True
    up, dn, out = c['z1'] - p[2], p[2] - c['z0'], R - h
    if out + r < min(up, dn) + r or (up > r * 4 and dn > r * 4):
        nx, ny = (dx / h, dy / h) if h > 1e-6 else (1.0, 0.0)
        p[0] += nx * (out + r)
        p[1] += ny * (out + r)
    elif up < dn:
        p[2] = c['z1'] + r
    else:
        p[2] = c['z0'] - r
    return True


def push_box(p, c, r):
    bc, bs = math.cos(c.get('yaw', 0.0)), math.sin(c.get('yaw', 0.0))
    dx, dy = p[0] - c['x'], p[1] - c['y']
    lx, ly, lz = dx * bc + dy * bs, -dx * bs + dy * bc, p[2]
    hx, hy, z0, z1 = c['hx'], c['hy'], c['z0'], c['z1']
    qx, qy, qz = max(-hx, min(hx, lx)), max(-hy, min(hy, ly)), max(z0, min(z1, lz))
    ex, ey, ez = lx - qx, ly - qy, lz - qz
    d2 = ex * ex + ey * ey + ez * ez
    if d2 >= r * r:
        return False
    if d2 > 1e-10:
        d = math.sqrt(d2)
        k = (r - d) / d
        lx, ly, lz = lx + ex * k, ly + ey * k, lz + ez * k
    else:
        ax, ay, az = hx - abs(lx), hy - abs(ly), min(z1 - lz, lz - z0)
        m = min(ax, ay, az)
        if m == ax:
            lx = math.copysign(hx + r, lx or 1.0)
        elif m == ay:
            ly = math.copysign(hy + r, ly or 1.0)
        else:
            lz = z1 + r if z1 - lz < lz - z0 else z0 - r
    p[0], p[1], p[2] = c['x'] + lx * bc - ly * bs, c['y'] + lx * bs + ly * bc, lz
    return True


class Near:
    """The game's own hash: 32 m cells, each solid in every cell its reach touches."""

    def __init__(self, cols):
        self.cells = defaultdict(list)
        for k, c in enumerate(cols):
            R = c['r'] if c['t'] == 'cyl' else math.hypot(c['hx'], c['hy'])
            for j in range(int((c['y'] - R) // 32), int((c['y'] + R) // 32) + 1):
                for i in range(int((c['x'] - R) // 32), int((c['x'] + R) // 32) + 1):
                    self.cells[(i, j)].append(k)
        self.cols = cols

    def around(self, x, y, r):
        seen, out = set(), []
        for j in range(int((y - r) // 32), int((y + r) // 32) + 1):
            for i in range(int((x - r) // 32), int((x + r) // 32) + 1):
                for k in self.cells.get((i, j), ()):
                    if k not in seen:
                        seen.add(k)
                        out.append(self.cols[k])
        return out


def once(p, near, r, ground):
    hit = False
    for c in near.around(p[0], p[1], r):
        if (push_cyl if c['t'] == 'cyl' else push_box)(p, c, r):
            hit = True
    floor = ground(p[0], p[1]) + r
    if p[2] < floor:
        p[2] = floor
        hit = True
    return hit


def solid_at(near, x, y, z):
    for c in near.around(x, y, 0.0):
        if holds(c, x, y, z):
            return c
    return None


def touches(near, x, y, z, r):
    R = r - 0.01
    for c in near.around(x, y, r):
        if z < c['z0'] - R or z > c['z1'] + R:
            continue
        dz = z - max(c['z0'], min(c['z1'], z))
        if c['t'] == 'cyl':
            e = max(0.0, math.hypot(x - c['x'], y - c['y']) - c['r'])
            if e * e + dz * dz < R * R:
                return True
        else:
            bc, bs = math.cos(c.get('yaw', 0.0)), math.sin(c.get('yaw', 0.0))
            dx, dy = x - c['x'], y - c['y']
            ex, ey = max(0.0, abs(dx * bc + dy * bs) - c['hx']), max(0.0, abs(-dx * bs + dy * bc) - c['hy'])
            if ex * ex + ey * ey + dz * dz < R * R:
                return True
    return False


def eject(p, near, r, c, ground):
    """A body with its centre inside a solid goes to the nearest place it fits: eight ways round, up and down."""
    a0 = math.atan2(p[1] - c['y'], p[0] - c['x']) if c['t'] == 'cyl' else c.get('yaw', 0.0)
    x0, y0, z0 = p
    at = lambda x, y, z: max(z, ground(x, y) + r)
    best = 70.0
    for w in range(10):
        a = a0 + w * math.pi / 4.0
        ux, uy = (math.cos(a), math.sin(a)) if w < 8 else (0.0, 0.0)
        uz = 1.0 if w == 8 else -1.0 if w == 9 else 0.0
        s_ = 0.5
        while s_ < best:
            x, y, z = x0 + ux * s_, y0 + uy * s_, z0 + uz * s_
            if uz < 0.0 and z < ground(x, y) + r:
                break
            if not touches(near, x, y, at(x, y, z), r):
                best = s_
                p[0], p[1], p[2] = x, y, at(x, y, z)
                break
            s_ += 0.5 if s_ < 8.0 else 1.0 if s_ < 24.0 else 2.0


def collide(p, near, r, ground):
    """world.js collide(), as promoted on 1 Nov at 05:26."""
    q = list(p)
    for i in range(8):
        c = solid_at(near, p[0], p[1], p[2])
        if c is not None:
            eject(p, near, r, c, ground)
        q = list(p)
        if not once(p, near, r, ground):
            return
        if abs(p[0] - q[0]) + abs(p[1] - q[1]) + abs(p[2] - q[2]) < 0.001:
            return
    p[0], p[1] = (p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5
    p[2] = max((p[2] + q[2]) * 0.5, ground(p[0], p[1]) + r)
    c = solid_at(near, p[0], p[1], p[2])
    if c is not None:
        eject(p, near, r, c, ground)


def holds(c, x, y, z, m=0.0):
    if z < c['z0'] + m or z > c['z1'] - m:
        return False
    if c['t'] == 'cyl':
        return math.hypot(x - c['x'], y - c['y']) < c['r'] - m
    bc, bs = math.cos(c.get('yaw', 0.0)), math.sin(c.get('yaw', 0.0))
    dx, dy = x - c['x'], y - c['y']
    return abs(dx * bc + dy * bs) < c['hx'] - m and abs(-dx * bs + dy * bc) < c['hy'] - m


def trapped(p, near, ground, r=BODY):
    """Is a body put here still inside a solid once the game's collide has had its say, for several frames?"""
    q = list(p)
    for f in range(6):
        collide(q, near, r, ground)
    return any(holds(c, q[0], q[1], q[2], 0.05) for c in near.around(q[0], q[1], 0.1)), q


def shared_faces(cols, near):
    """Every two parallel boxes that touch face to face over more than a body's width, with the point at the middle of what they share."""
    out, seen = [], set()
    for ia, a in enumerate(cols):
        if a['t'] != 'box':
            continue
        R = math.hypot(a['hx'], a['hy'])
        for b in near.around(a['x'], a['y'], R + 1.0):
            if b['t'] != 'box' or b is a or (id(b), id(a)) in seen:
                continue
            seen.add((id(a), id(b)))
            turn = (b.get('yaw', 0.0) - a.get('yaw', 0.0)) % (math.pi / 2.0)
            if min(turn, math.pi / 2.0 - turn) > 0.01:
                continue
            quarter = abs(math.sin(b.get('yaw', 0.0) - a.get('yaw', 0.0))) > 0.7
            bx, by = (b['hy'], b['hx']) if quarter else (b['hx'], b['hy'])
            ca, sa = math.cos(a.get('yaw', 0.0)), math.sin(a.get('yaw', 0.0))
            dx, dy = b['x'] - a['x'], b['y'] - a['y']
            lx, ly = dx * ca + dy * sa, -dx * sa + dy * ca
            zo = min(a['z1'], b['z1']) - max(a['z0'], b['z0'])
            if zo < 1.0:
                continue
            for ax in (0, 1):
                (l, m, ha, hb, ma, mb) = (lx, ly, a['hx'], bx, a['hy'], by) if ax == 0 else (ly, lx, a['hy'], by, a['hx'], bx)
                if abs(abs(l) - (ha + hb)) > 0.03:
                    continue
                lo, hi = max(-ma, m - mb), min(ma, m + mb)
                if hi - lo < 1.0:
                    continue
                s_ = math.copysign(ha, l)
                u, v = (s_, (lo + hi) / 2.0) if ax == 0 else ((lo + hi) / 2.0, s_)
                out.append((a, b, a['x'] + u * ca - v * sa, a['y'] + u * sa + v * ca, (max(a['z0'], b['z0']) + min(a['z1'], b['z1'])) / 2.0))
    return out


def low_gaps(cols, near, ground):
    """Where a solid's underside stands under GAP above the ground and nothing else fills the space."""
    out = []
    for c in cols:
        R = c['r'] if c['t'] == 'cyl' else max(c['hx'], c['hy'])
        if (c['r'] if c['t'] == 'cyl' else min(c['hx'], c['hy'])) < 0.3:
            continue
        n = max(1, min(7, int(2.0 * R / 2.0)))
        hit = 0
        at = None
        pts = []
        for a in range(n):
            for b in range(n):
                fa, fb = (a + 0.5) / n * 2.0 - 1.0, (b + 0.5) / n * 2.0 - 1.0
                if c['t'] == 'cyl':
                    if fa * fa + fb * fb > 1.0:
                        continue
                    x, y = c['x'] + fa * c['r'], c['y'] + fb * c['r']
                else:
                    bc, bs = math.cos(c.get('yaw', 0.0)), math.sin(c.get('yaw', 0.0))
                    u, v = fa * c['hx'], fb * c['hy']
                    x, y = c['x'] + u * bc - v * bs, c['y'] + u * bs + v * bc
                g = ground(x, y)
                gap = c['z0'] - g
                if 0.05 < gap < GAP and g < 40.0:
                    z = (g + c['z0']) / 2.0
                    if not any(o is not c and holds(o, x, y, z) for o in near.around(x, y, 0.1)):
                        hit += 1
                        at = (round(x, 1), round(y, 1), round(gap, 2))
                        pts.append((fa, fb, g))
        if hit:
            out.append((c.get('kind', 'listed'), hit, at, c, pts, n))
    return out


def wide(cols):
    return [c for c in cols if (2.0 * c['r'] if c['t'] == 'cyl' else 2.0 * min(c['hx'], c['hy'])) >= 3.0]


def plugs(cols, ground):
    """For each wide solid with a walkable gap under it, a solid that fills that part of the gap from the ground to its underside."""
    out = []
    for kind, hit, at, c, pts, n in low_gaps(wide(cols), Near(cols), ground):
        if hit < 4:
            continue
        cell = 1.0 / n
        fa0, fa1 = min(p[0] for p in pts) - cell, max(p[0] for p in pts) + cell
        fb0, fb1 = min(p[1] for p in pts) - cell, max(p[1] for p in pts) + cell
        hx, hy = (c['r'], c['r']) if c['t'] == 'cyl' else (c['hx'], c['hy'])
        yaw = c.get('yaw', 0.0)
        u, v = (fa0 + fa1) / 2.0 * hx, (fb0 + fb1) / 2.0 * hy
        cx, cy = c['x'] + u * math.cos(yaw) - v * math.sin(yaw), c['y'] + u * math.sin(yaw) + v * math.cos(yaw)
        ex, ey = (fa1 - fa0) / 2.0 * hx, (fb1 - fb0) / 2.0 * hy
        low = min(ground(cx + a * ex * math.cos(yaw) - b * ey * math.sin(yaw), cy + a * ex * math.sin(yaw) + b * ey * math.cos(yaw)) for a in (-1.0, -0.5, 0.0, 0.5, 1.0) for b in (-1.0, -0.5, 0.0, 0.5, 1.0))
        out.append({'t': 'box', 'x': round(cx, 2), 'y': round(cy, 2), 'z0': round(low - 0.4, 2), 'z1': round(c['z0'] + 0.2, 2), 'hx': round(ex, 2), 'hy': round(ey, 2), 'yaw': round(yaw, 3)})
    return out


def read(cols, ground, sample=None):
    near = Near(cols)
    pairs = shared_faces(cols, near)
    traps = []
    for a, b, x, y, z in pairs:
        t, q = trapped([x, y, z], near, ground)
        if t:
            traps.append((a.get('kind', 'listed'), b.get('kind', 'listed'), round(x, 1), round(y, 1), round(z, 1)))
    gaps = low_gaps(cols, near, ground)
    return {'pairs': len(pairs), 'pairs_by_kind': Counter(sorted((a.get('kind', 'listed'), b.get('kind', 'listed')))[0] for a, b, x, y, z in pairs), 'traps': traps, 'gaps': gaps, 'near': near}


def ray_hit(c, px, py, pz, nx, ny, most):
    """Distance along a level ray from (px, py) at height pz to solid c, or None."""
    if pz < c['z0'] or pz > c['z1']:
        return None
    if c['t'] == 'cyl':
        fx, fy = px - c['x'], py - c['y']
        b = fx * nx + fy * ny
        q = fx * fx + fy * fy - c['r'] * c['r']
        if q <= 0.0:
            return None                                                  # starts inside it: it isn't across a gap
        d = b * b - q
        if d < 0.0:
            return None
        t = -b - math.sqrt(d)
        return t if 0.0 < t < most else None
    bc, bs = math.cos(c.get('yaw', 0.0)), math.sin(c.get('yaw', 0.0))
    dx, dy = px - c['x'], py - c['y']
    lx, ly = dx * bc + dy * bs, -dx * bs + dy * bc
    ux, uy = nx * bc + ny * bs, -nx * bs + ny * bc
    t0, t1 = 0.0, most
    for o, u, h in ((lx, ux, c['hx']), (ly, uy, c['hy'])):
        if abs(u) < 1e-9:
            if abs(o) > h:
                return None
            continue
        a, b = (-h - o) / u, (h - o) / u
        if a > b:
            a, b = b, a
        t0, t1 = max(t0, a), min(t1, b)
        if t0 > t1:
            return None
    if abs(lx) <= c['hx'] and abs(ly) <= c['hy']:
        return None
    return t0 if t0 > 0.0 else None


def slits(cols, near, ground, openings=(), narrow=2.5, body=1.24, roof=10.0):
    """Places a body fits into but a camera can't: two solids facing across a gap under `narrow`, with a roof over it, read from every box's sides. Designed openings are left alone."""
    found = defaultdict(list)
    for a in cols:
        if a['t'] != 'box':
            continue
        yaw = a.get('yaw', 0.0)
        bc, bs = math.cos(yaw), math.sin(yaw)
        for ax, sg in ((0, 1.0), (0, -1.0), (1, 1.0), (1, -1.0)):
            h, m = (a['hx'], a['hy']) if ax == 0 else (a['hy'], a['hx'])
            if m < 1.0 or a['z1'] - a['z0'] < 1.24:
                continue
            nx, ny = (bc * sg, bs * sg) if ax == 0 else (-bs * sg, bc * sg)
            tx, ty = -ny, nx
            n_m, n_z = max(1, min(14, int(2.0 * m / 2.0))), max(1, min(10, int((a['z1'] - a['z0']) / 2.0)))
            fx, fy = a['x'] + nx * h, a['y'] + ny * h
            for i in range(n_m):
                s = ((i + 0.5) / n_m * 2.0 - 1.0) * m
                px, py = fx + tx * s, fy + ty * s
                for k in range(n_z):
                    pz = a['z0'] + (k + 0.5) / n_z * (a['z1'] - a['z0'])
                    if pz < ground(px, py) + 0.7:
                        continue
                    best, who = None, None
                    for o in near.around(px + nx * 1.3, py + ny * 1.3, 1.5):
                        if o is a:
                            continue
                        t = ray_hit(o, px + nx * 0.01, py + ny * 0.01, pz, nx, ny, narrow)
                        if t is not None and (best is None or t < best):
                            best, who = t, o
                    if best is None or best < body:
                        continue
                    mx, my = px + nx * best / 2.0, py + ny * best / 2.0
                    if any(holds(o, mx, my, pz) for o in near.around(mx, my, 0.1)):
                        continue
                    if not any(holds(o, mx, my, pz + z_) for z_ in (1.0, 2.0, 4.0, roof) for o in near.around(mx, my, 0.1)):
                        continue                                         # open above: the camera rises out of it
                    if any(abs(mx - q['x']) < q.get('sx', 3.0) + 1.0 and abs(my - q['y']) < q.get('sy', 3.0) + 1.0 for q in openings):
                        continue
                    found[(id(a), id(who))].append((round(mx, 1), round(my, 1), round(pz, 1), round(best, 2), a, who, nx, ny))
    # each pair once
    out, seen = [], set()
    for (ia, ib), v in found.items():
        if (ib, ia) in seen:
            continue
        seen.add((ia, ib))
        out.append(v)
    return out


def slit_plugs(cols, ground, openings, least=2):
    """A solid that fills each capped slit: from one wall to the other, as long and as high as the slit was read."""
    near = Near(cols)
    out = []
    for v in slits(cols, near, ground, openings):
        if len(v) < least:
            continue
        nx, ny = v[0][6], v[0][7]
        tx, ty = -ny, nx
        us, ws = [q[0] * tx + q[1] * ty for q in v], [q[0] * nx + q[1] * ny for q in v]
        um, wm = (min(us) + max(us)) / 2.0, (min(ws) + max(ws)) / 2.0
        out.append({'t': 'box', 'x': round(um * tx + wm * nx, 2), 'y': round(um * ty + wm * ny, 2), 'z0': round(min(q[2] for q in v) - 1.1, 2), 'z1': round(max(q[2] for q in v) + 1.1, 2),
                    'hx': round((max(ws) - min(ws)) / 2.0 + max(q[3] for q in v) / 2.0 + 0.2, 2), 'hy': round((max(us) - min(us)) / 2.0 + 1.0, 2), 'yaw': round(math.atan2(ny, nx), 3)})
    return out
