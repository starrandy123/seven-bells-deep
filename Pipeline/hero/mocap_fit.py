# What a capture's feet did. These files have the hips nailed to one spot: the motion was taken out of them. A body only goes where its feet on the ground send it, so where it really went
# (how it rose and fell, how it swayed, how fast it was going through a stride) is read back from the feet that were down. Plain Python, no Blender.
#   fit_cycle(frames): frames = per frame {'R': (heel, ball, pitch), 'L': ...}, points with the hips held at rest, on the body that will wear it. Heights are over its own floor.
import math
FPS = 30.0
NEAR = 0.05         # m over the floor: a sole point this close is on the ground
TOUCH = 0.015       # m a frame: near isn't down. The sole has touched when it stops falling faster than this
def on_runs(on):
    """The one stretch a foot is down in a stride: gaps of up to two frames closed, then the longest run round the loop. Returns (first frame, frames)."""
    m = len(on); o = list(on)
    for i in range(m):
        if not o[i] and o[(i - 1) % m] and (o[(i + 1) % m] or o[(i + 2) % m]): o[i] = True
    if all(o): return 0, m
    best = (0, 0)
    for i in range(m):
        if o[i] and not o[i - 1]:
            l = 0
            while o[(i + l) % m] and l < m: l += 1
            if l > best[1]: best = (i, l)
    return best
def sole(p, c): return min(p[0][2], p[1][2] - c)
def pivot(p, c):
    """Which point the foot is turning about: 0 the heel, 1 the ball."""
    return 1 if p[2] < -3 else 0 if p[2] > 3 else (1 if p[1][2] - c < p[0][2] else 0)
def soften(u, times, loop=True):
    m = len(u)
    for _ in range(times):
        if loop: u = [(u[(i - 1) % m] + 2 * u[i] + u[(i + 1) % m]) / 4 for i in range(m)]
        else: u = [u[0]] + [(u[i - 1] + 2 * u[i] + u[i + 1]) / 4 for i in range(1, m - 1)] + [u[-1]]
    return u
def fit_cycle(F, c, g=9.81):
    n = len(F); all_low = sorted(sole(f[s], c) for f in F for s in 'RL'); floor = all_low[max(0, len(all_low) // 14)]
    win = {}; on = {}
    for s in 'RL':
        a, l = on_runs([sole(f[s], c) - floor < NEAR for f in F])
        while l > 2 and sole(F[(a + 1) % n][s], c) - sole(F[a % n][s], c) < -TOUCH: a = (a + 1) % n; l -= 1
        win[s] = (a, l); on[s] = [(i - a) % n < l for i in range(n)]
    # the body's step between frames, from the feet that stay down over it
    ux, uy = [None] * n, [None] * n
    for i in range(n):
        j = (i + 1) % n; xs, ys = [], []
        for s in 'RL':
            if not (on[s][i] and on[s][j]): continue
            a, b = F[i][s], F[j][s]; k = pivot(a, c); xs.append(a[k][0] - b[k][0]); ys.append(a[k][1] - b[k][1])
        if xs: ux[i] = sum(xs) / len(xs); uy[i] = sum(ys) / len(ys)
    def fill(u):
        idx = [i for i, x in enumerate(u) if x is not None]; out = list(u)
        for i in range(n):
            if out[i] is None:
                a = max([k for k in idx if k < i] or [idx[-1] - n]); b = min([k for k in idx if k > i] or [idx[0] + n]); t = (i - a) / float(b - a)
                out[i] = u[a % n] * (1 - t) + u[b % n] * t
        return out
    ux, uy = soften(fill(ux), 2), soften(fill(uy), 2)
    sx, sy = sum(ux), sum(uy); L = math.hypot(sx, sy)
    # the sway and surge round the steady line
    rx, ry = [], []; ax = ay = 0.0
    for i in range(n): rx.append(ax); ry.append(ay); ax += ux[i] - sx / n; ay += uy[i] - sy / n
    mx, my = sum(rx) / n, sum(ry) / n; rx = [x - mx for x in rx]; ry = [y - my for y in ry]
    # the height: over a foot that's down it's that foot's; off the ground, a thrown body's curve from one to the next
    Z = [None] * n
    for i in range(n):
        zs = [sole(F[i][s], c) for s in 'RL' if on[s][i]]
        if zs: Z[i] = -min(zs)
    idx = [i for i, z in enumerate(Z) if z is not None]; G = g / (FPS * FPS); out = list(Z)
    for i in range(n):
        if out[i] is None:
            a = max([k for k in idx if k < i] or [idx[-1] - n]); b = min([k for k in idx if k > i] or [idx[0] + n]); T = float(b - a); t = i - a
            out[i] = Z[a % n] + (Z[b % n] - Z[a % n]) * t / T + 0.5 * G * t * (T - t)
    return dict(n=n, floor=floor, win=win, L=L, way=(sx / (L or 1), sy / (L or 1)), x=rx, y=ry, z=soften(out, 2), ux=ux, uy=uy)

def fit_once(F, on, c, g=9.81):
    """The same for a start or a stop: on says which feet are down in each frame (read by eye from the files: a body that's crouching or braking fools a height test). x: the sway, z: the height, v: the speed he's going at, m/s."""
    n = len(F); ux, uy = [None] * (n - 1), [None] * (n - 1)
    for i in range(n - 1):
        xs, ys = [], []
        for s in 'RL':
            if not (on[s][i] and on[s][i + 1]): continue
            a, b = F[i][s], F[i + 1][s]; k = pivot(a, c); xs.append(a[k][0] - b[k][0]); ys.append(a[k][1] - b[k][1])
        if xs: ux[i] = sum(xs) / len(xs); uy[i] = sum(ys) / len(ys)
    def fill(u):
        idx = [i for i, x in enumerate(u) if x is not None]; out = list(u)
        for i in range(len(u)):
            if out[i] is None:
                L = [k for k in idx if k < i]; R = [k for k in idx if k > i]
                if L and R: a, b = L[-1], R[0]; t = (i - a) / float(b - a); out[i] = u[a] * (1 - t) + u[b] * t
                else: out[i] = u[L[-1]] if L else u[R[0]] if R else 0.0
        return out
    ux, uy = soften(fill(ux), 2, False), soften(fill(uy), 2, False)
    rx = [0.0]
    for x in ux: rx.append(rx[-1] + x)
    trend = rx[-1] / max(n - 1, 1); rx = [x - trend * i for i, x in enumerate(rx)]
    Z = [None] * n
    for i in range(n):
        zs = [sole(F[i][s], c) for s in 'RL' if on[s][i]]
        if zs: Z[i] = -min(zs)
    idx = [i for i, z in enumerate(Z) if z is not None]; G = g / (FPS * FPS); out = list(Z)
    for i in range(n):
        if out[i] is None:
            L = [k for k in idx if k < i]; R = [k for k in idx if k > i]
            if L and R: a, b = L[-1], R[0]; T = float(b - a); t = i - a; out[i] = Z[a] + (Z[b] - Z[a]) * t / T + 0.5 * G * t * (T - t)
            else: out[i] = Z[L[-1]] if L else Z[R[0]]
    return dict(x=rx, z=soften(out, 2, False), v=[-y * FPS for y in uy])
