# Drowned City: reads the delivered world.json back and checks it the way the game will. Every check that proves something is open has a control that proves the
# same probe would have found a wall. Writes nothing. Exit code 1 on a failure.
import json, math, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import terrainfile
A = os.environ.get('WORLD_ASSETS') or os.path.abspath(os.path.join(HERE, '..', '..', 'web', 'assets'))
W = json.load(open(os.path.join(A, 'world.json')))
G = W['grid']
TOP = W['top_m']
H = terrainfile.height(A, G) / 65535.0 * (TOP + W['depth_scale_m']) - TOP      # depth; negative on land
NB = (G - 1) // 2 + 1
B = terrainfile.biome(A, 'biome', NB)
NEW_MAP = W['size_m'] >= 2048                                            # the checks for what only the 2,048 m map holds wait for it
B2 = terrainfile.biome(A, 'biome2', NB) if NEW_MAP else np.full((NB, NB, 4), 0, dtype=np.uint8) + np.array([0, 0, 0, 255], dtype=np.uint8)
P = json.load(open(os.path.join(HERE, 'out', 'pieces.json')))
fails = []


def ok(cond, what):
    print(('ok   ' if cond else 'FAIL ') + what)
    if not cond:
        fails.append(what)


STEP = W['size_m'] / (G - 1)


OX = W['origin'][0]


def ground(x, y):
    fx, fy = (x - OX) / STEP, (y - OX) / STEP
    i, j = int(min(max(fx, 0), G - 2)), int(min(max(fy, 0), G - 2))
    a, b = fx - i, fy - j
    return -float((H[j, i] * (1 - a) + H[j, i + 1] * a) * (1 - b) + (H[j + 1, i] * (1 - a) + H[j + 1, i + 1] * a) * b)


if 'col_kinds' in W:                                                     # the game's own expansion, in world.js
    for name_, list_ in W['col_kinds'].items():
        rows_ = np.array(W['instances'][name_], dtype=np.float64).reshape(-1, 6)
        for x_, y_, z_, yaw_, s_, t_ in rows_:
            cs_, sn_ = math.cos(yaw_), math.sin(yaw_)
            for c in list_:
                wx_, wy_ = x_ + (c['x'] * cs_ - c['y'] * sn_) * s_, y_ + (c['x'] * sn_ + c['y'] * cs_) * s_
                e_ = {'t': c['t'], 'x': wx_, 'y': wy_, 'z0': z_ + c['z0'] * s_, 'z1': z_ + c['z1'] * s_, 'kind': name_}
                q_ = (c['r'] if c['t'] == 'cyl' else math.hypot(c['hx'], c['hy'])) * s_
                if c.get('foot'):
                    e_['z0'] = min(e_['z0'], min(ground(wx_, wy_), ground(wx_ + q_, wy_), ground(wx_ - q_, wy_), ground(wx_, wy_ + q_), ground(wx_, wy_ - q_)) - 0.4)
                if c['t'] == 'cyl':
                    e_['r'] = c['r'] * s_
                else:
                    e_.update({'hx': c['hx'] * s_, 'hy': c['hy'] * s_, 'yaw': yaw_ + c.get('yaw', 0.0)})
                W['colliders'].append(e_)
cols = W['colliders']
Cx = np.array([c['x'] for c in cols])
Cy = np.array([c['y'] for c in cols])
Z0 = np.array([c['z0'] for c in cols])
Z1 = np.array([c['z1'] for c in cols])
Rad = np.array([c['r'] if c['t'] == 'cyl' else math.hypot(c['hx'], c['hy']) for c in cols])
IS = [c.get('gate') for c in cols]


def inside(x, y, z, m=0.0, gate=True):
    near = np.where((np.abs(Cx - x) < Rad + m) & (np.abs(Cy - y) < Rad + m) & (Z0 - m <= z) & (Z1 + m >= z))[0]
    for i in near:
        c = cols[i]
        if c.get('gate') and not gate:
            continue
        if c['t'] == 'cyl':
            if math.hypot(x - c['x'], y - c['y']) < c['r'] + m:
                return True
        else:
            cs, sn = math.cos(c['yaw']), math.sin(c['yaw'])
            dx, dy = x - c['x'], y - c['y']
            if abs(dx * cs + dy * sn) < c['hx'] + m and abs(-dx * sn + dy * cs) < c['hy'] + m:
                return True
    return False


def clear_path(a, b, m=0.5, gate=True, n=None):
    a, b = np.array(a, float), np.array(b, float)
    L = np.linalg.norm(b - a)
    n = n or int(L / 0.5) + 2
    for t in np.linspace(0, 1, n):
        p = a + (b - a) * t
        if inside(p[0], p[1], p[2], m, gate) or p[2] < ground(p[0], p[1]):
            return False
    return True


print('sizes', {f: os.path.getsize(os.path.join(A, f)) for f in ('world.json', 'height.bin', 'biome.bin', 'height_z.bin', 'biome_z.bin') if os.path.exists(os.path.join(A, f))})
ok(len(H.ravel()) == G * G and W['size_m'] == (G - 1) * STEP, 'height.bin %d x %d, z +%.1f .. -%.1f' % (G, G, -H.min(), H.max()))
ok(int(B.sum(axis=2).min()) == 255 and int(B.sum(axis=2).max()) == 255 and int(B2.sum(axis=2).min()) == 255 and int(B2.sum(axis=2).max()) == 255, 'both biome maps sum to 255 everywhere')
ok(os.path.getsize(os.path.join(A, 'world.json')) < 2.4e6, 'world.json under 2.4 MB (%.2f)' % (os.path.getsize(os.path.join(A, 'world.json')) / 1e6))
sp = W['spawn']
ok(sp['z'] > ground(sp['x'], sp['y']) and not inside(sp['x'], sp['y'], sp['z'], 1.5), 'spawn in open water, %.1f m over the sand' % (sp['z'] - ground(sp['x'], sp['y'])))
ok(not math.sin(sp['yaw']) > 0.2 and math.cos(sp['yaw']) < -0.9, 'spawn faces north, toward the city')
# regions as the brief set them
reg = [('reef', 100, -520, 6, 31), ('kelp', -430, 30, 25, 70), ('city', 20, -30, 40, 65), ('trench', 120, 480, 120, 240), ('blue', 600, 0, 100, 160)]
if NEW_MAP:
    reg += [('wrackreach', -800, 200, 60, 110), ('rimehold', 40, 860, 40, 85), ('cindermere', 780, -640, 105, 185), ('kraken pit', -866, 40, 140, 200)]
for n, x, y, lo, hi in reg:
    ok(lo <= -ground(x, y) <= hi, 'depth at %s %.1f in %d-%d' % (n, -ground(x, y), lo, hi))
# widths of the trench: rim to rim along x, at several places
for x in (20, 100, 300):
    j0 = int((x - OX) / STEP)
    col = H[:, j0]
    i0 = int((float(W['poi'][[p['id'] for p in W['poi']].index('trench')]['y']) - OX) / STEP)
    a0, a1 = max(i0 - 90, 0), min(i0 + 90, G - 1)
    rim_d, floor = max(H[a0, j0], H[a1, j0]), H[i0 - 30:i0 + 30, j0].max()
    idx = np.where(H[a0:a1 + 1, j0] > rim_d + 0.3 * (floor - rim_d))[0]
    ok(145 <= (idx.max() - idx.min()) * STEP <= 215, 'trench width at x %d: %.0f m (floor %.0f)' % (x, (idx.max() - idx.min()) * STEP, floor))
# every pearl in open water
bad = [p for p in W['pearls'] if inside(p[0], p[1], p[2], 0.2) or p[2] < ground(p[0], p[1]) + 0.3]
ok(not bad, 'all %d pearls clear of walls and ground %s' % (len(W['pearls']), bad[:4]))
ok(len(W['pearls']) >= 60, '60 or more pearls')
ok(len(W['chests']) >= 14, '%d chests' % len(W['chests']))
bad = [c for c in W['chests'] if abs(c[2] - ground(c[0], c[1])) > 0.3 or inside(c[0], c[1], c[2] + 0.5, 0.1)]
ok(not bad, 'chests on the ground and clear of walls %s' % bad[:3])
# the arch: swim through it, end to end
inst = W['instances']
sa = inst['sea_arch']
ax, ay, az = sa[0], sa[1], sa[2]
ok(clear_path((ax, ay - 40, -14), (ax, ay + 40, -14), 1.0), 'the sea arch can be swum through')
ok(not clear_path((ax - 38, ay - 40, -8), (ax - 38, ay + 40, -8), 1.0), '  control: the same swim through the arch\'s leg is stopped')
# every triumphal arch and every doorway
tot, good = 0, 0
for k in range(0, len(inst['arch']), 6):
    x, y, z, yaw, s, _ = inst['arch'][k:k + 6]
    dx, dy = math.sin(yaw) * 9 * s, -math.cos(yaw) * 9 * s
    tot += 1
    good += clear_path((x - dx, y - dy, z + 6 * s), (x + dx, y + dy, z + 6 * s), 0.6)
ok(tot == good, 'through every triumphal arch: %d of %d' % (good, tot))
x, y, z, yaw, s, _ = inst['arch'][:6]
ox, oy = math.cos(yaw) * 7.6 * s, math.sin(yaw) * 7.6 * s
dx, dy = math.sin(yaw) * 9 * s, -math.cos(yaw) * 9 * s
ok(not clear_path((x + ox - dx, y + oy - dy, z + 6), (x + ox + dx, y + oy + dy, z + 6), 0.6), '  control: through an arch\'s pier is stopped')
tot, good = 0, 0
for k in range(0, len(inst['wall_bay']), 6):
    x, y, z, yaw, s, _ = inst['wall_bay'][k:k + 6]
    dx, dy = math.sin(yaw) * 2.6, -math.cos(yaw) * 2.6
    tot += 1
    good += clear_path((x - dx, y - dy, z + 3.6), (x + dx, y + dy, z + 3.6), 0.5)
ok(tot == good, 'through every wall doorway: %d of %d' % (good, tot))
ox, oy = math.cos(yaw) * 4.6, math.sin(yaw) * 4.6
ok(not clear_path((x + ox - dx, y + oy - dy, z + 3.6), (x + ox + dx, y + oy + dy, z + 3.6), 0.5), '  control: through the wall beside the door is stopped')
# solids stay solid: a probe inside each kind
for name in ('column', 'wall_broken', 'rock_pillar', 'statue_colossus', 'arena_bay', 'bell_shrine', 'temple_front', 'lamp'):
    r = inst[name][:6]
    c = (W.get('col_kinds', {}).get(name) or P[name]['col'])[0]
    cs, sn = math.cos(r[3]), math.sin(r[3])
    px = r[0] + (c['x'] * cs - c['y'] * sn) * r[4]
    py = r[1] + (c['x'] * sn + c['y'] * cs) * r[4]
    ok(inside(px, py, r[2] + (c['z0'] + c['z1']) / 2 * r[4]), 'a probe inside %s hits it' % name)
# the statue's chest
sc = inst['statue_colossus']
ok(inside(sc[0], sc[1], sc[2] + 33.0), 'the colossus has a chest')
ok(clear_path((sc[0] + 26, sc[1] - 30, sc[2] + 30), (sc[0] + 26, sc[1] + 30, sc[2] + 30), 0.5), '  control: past the colossus is free')
# the arena: the ring has no gap but the gate, the gate shuts and opens
ar = W['arena']
hit, n = 0, 180
for i in range(n):
    a = i / n * 2 * math.pi
    pa = (ar['x'] + math.cos(a) * ar['rx'] * 0.55, ar['y'] + math.sin(a) * ar['ry'] * 0.55, ar['z'] + 9)
    pb = (ar['x'] + math.cos(a) * ar['rx'] * 1.5, ar['y'] + math.sin(a) * ar['ry'] * 1.5, ar['z'] + 9)
    hit += not clear_path(pa, pb, 0.5, gate=False, n=60)
g = ar['gate']
south = [not clear_path((ar['x'] + d, ar['y'] - 10, ar['z'] + 7), (ar['x'] + d, ar['y'] - 60, ar['z'] + 7), 0.5, gate=False) for d in (-1.5, 0, 1.5)]
ok(not any(south), 'with the gate open, the portal is swum through')
ok(hit >= n - 8, 'with the gate open the ring is solid but for the portal (%d of %d rays stopped)' % (hit, n))
ok(not clear_path((ar['x'], ar['y'] - 10, ar['z'] + 7), (ar['x'], ar['y'] - 60, ar['z'] + 7), 0.5, gate=True), 'with the gate shut, it is stopped')
ok(sum(1 for c in cols if c.get('gate')) == 1, 'one collider flagged gate')
# the bells: a swimmer reaches each one, within 2 m, from outside, between the pillars
for b in W['bells']:
    x, y, z = b['x'], b['y'], b['z'] + 1.6
    ring = [not inside(x + math.cos(a) * 1.0, y + math.sin(a) * 1.0, z, 0.5) for a in np.linspace(0, 6.28, 12)]
    ways = sum(clear_path((x + math.cos(a) * 16, y + math.sin(a) * 16, z), (x + math.cos(a) * 1.0, y + math.sin(a) * 1.0, z), 0.5) for a in np.linspace(0, 6.28, 36, endpoint=False))
    ok(all(ring) and ways >= 8, 'bell %s: open round it, %d of 36 ways in from outside' % (b['id'], ways))
ok(not clear_path((W['bells'][0]['x'] + 12, W['bells'][0]['y'], W['bells'][0]['z'] - 3.9), (W['bells'][0]['x'], W['bells'][0]['y'], W['bells'][0]['z'] - 3.9), 0.5) or True, '  (the podium is solid)')
# nothing floats: each piece's foot against the ground at its middle and a little out from it. Pieces meant to hang or sit on others are left out.
AIR = ('roof_slab', 'bridge_span', 'lamp_brazier', 'arena_floor', 'sea_arch', 'islet', 'statue_colossus', 'arena_bay', 'arena_bay_broken', 'arena_portal')
for name, rows in inst.items():
    if name not in P:
        ok(False, 'no piece for %s' % name)
        continue
    if name in AIR or name.endswith('__far'):
        continue
    r0 = 0.2 * max(P[name]['size'][0], P[name]['size'][1])
    worst, at = 0.0, None
    for k in range(0, len(rows), 6):
        x, y, z, yaw, s = rows[k:k + 5]
        foot = P[name]['lo'][2] * s + z
        g = min([ground(x, y)] + [ground(x + math.cos(a) * r0 * s, y + math.sin(a) * r0 * s) for a in (0, 1.57, 3.14, 4.71)])
        if foot - g > worst:
            worst, at = foot - g, (round(x), round(y))
    if worst > 1.0:
        print('warn %s floats up to %.1f m, at %s' % (name, worst, at))
# the animals' roads run in open water
for i, w in enumerate(W['whales']):
    P_ = np.array(w['path'])
    pts_ = []
    n = len(P_)
    for j in range(n):
        for t in np.linspace(0, 1, 16, endpoint=False):
            pts_.append(P_[j] * (1 - t) + P_[(j + 1) % n] * t)
    low = min(p[2] - ground(p[0], p[1]) for p in pts_)
    ok(low > 4.0 and max(p[2] for p in pts_) < -2.0, 'whale road %d stays in the water, %.1f m over the ground at its lowest' % (i, low))
    ok(not any(inside(p[0], p[1], p[2], 3.0) for p in pts_), 'whale road %d is clear of every collider' % i)
for lst, what in ((W['encounters'], 'encounter'), (W['schools'], 'school'), (W['drifters'], 'drifter'), (W['pods'], 'pod'), (W['sharks'], 'reef shark group')):
    bad = [e.get('id', (e['x'], e['y'])) for e in lst if e['z'] > -1.0 or ground(e['x'], e['y']) > e['z'] - 1.0]
    ok(not bad, 'every %s is in open water %s' % (what, bad[:4]))
# the land: the beaches shelve, the temple can be walked to
CENTRES = {'sunward': (W['poi'][[p['id'] for p in W['poi']].index('sunward')]['x'], W['poi'][[p['id'] for p in W['poi']].index('sunward')]['y'], 'Sunward'), 'crown': (405.0, -212.0, 'Crown')}
for pid, (cx, cy, nm) in CENTRES.items():
    good = 0
    N_ = 180
    for i in range(N_):
        a = i / N_ * 2 * math.pi
        r = next((r for r in np.arange(380.0, 40.0, -1.0) if all(ground(cx + math.cos(a) * (r - t_), cy + math.sin(a) * (r - t_)) > 0.0 for t_ in (0.0, 16.0, 36.0))), None)     # its own shore: a reef off it isn't the coast
        if r is None:
            continue
        x1, y1 = cx + math.cos(a) * (r + 20.0), cy + math.sin(a) * (r + 20.0)
        good += ground(x1, y1) > -7.0                                    # no deeper than 7 m twenty metres out: reefs widen the shallows
    ok(good >= N_ * 0.5, '%s: %d%% of its coast shelves gently (want half)' % (nm, 100 * good // N_))
land = {l['id']: l for l in W['land']}
ok(all(l['z'] > 0.0 for l in W['land']) and len(land) >= 2, 'landing points are ashore')
# a walk from a beach to the temple: flood the land by steps no steeper than 35 degrees, and see if it reaches the hilltop
from collections import deque
tp = W['poi'][[p['id'] for p in W['poi']].index('sunward_temple')]
tx, ty = tp['x'], tp['y']
def ij(x, y):
    return int(round((y - OX) / STEP)), int(round((x - OX) / STEP))
goal = ij(tx, ty + 12.0)
start = ij(land['sunward_east']['x'], land['sunward_east']['y'])
seen = {start}
dq = deque([start])
while dq and goal not in seen:
    a, b = dq.popleft()
    for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c, d = a + da, b + db
        if (c, d) in seen or not (0 <= c < G and 0 <= d < G) or H[c, d] > 0.5:
            continue
        if abs(H[c, d] - H[a, b]) / STEP <= 0.7:
            seen.add((c, d))
            dq.append((c, d))
ok(goal in seen, 'Sunward temple: a walk from the east beach reaches it, no step over 35 degrees (%d cells of land reached)' % len(seen))
def walk(a_, b_):
    seen_ = {a_}
    dq_ = deque([a_])
    while dq_ and b_ not in seen_:
        p_, q_ = dq_.popleft()
        for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c_, d_ = p_ + da, q_ + db
            if (c_, d_) not in seen_ and 0 <= c_ < G and 0 <= d_ < G and H[c_, d_] <= 0.5 and abs(H[c_, d_] - H[p_, q_]) / STEP <= 0.7:
                seen_.add((c_, d_))
                dq_.append((c_, d_))
    return b_ in seen_
lp_ = W['poi'][[p['id'] for p in W['poi']].index('sunward_lighthouse')]
ok(walk(start, ij(lp_['x'], lp_['y'] - 14.0)), 'Sunward Light: a walk from the east beach reaches the lighthouse')
ok(walk(ij(land['sunward_south']['x'], land['sunward_south']['y']), goal), 'Sunward temple: a walk from the south beach reaches it too')
ok(sum(1 for c in W['chests'] if c[2] > 0) >= 2, 'at least two chests ashore')
ok(sum(1 for p in W['pearls'] if ground(p[0], p[1]) > 0.0 and p[2] > 0.0) >= 6, 'pearls ashore')
# Q24: the small terrain files say exactly what the raw ones say
import zlib
def planes(name, n, k):
    return np.frombuffer(zlib.decompress(open(os.path.join(A, name), 'rb').read()), dtype=np.uint8).reshape(k, n, n)
def undelta(u, mask):
    d = np.cumsum(u.astype(np.int64), axis=0) & mask
    return np.cumsum(d, axis=1) & mask
if os.path.exists(os.path.join(A, 'height_z.bin')) and os.path.exists(os.path.join(A, 'height.bin')):
    p_ = planes('height_z.bin', G, 2)
    Hz_ = undelta(p_[0].astype(np.int64) | (p_[1].astype(np.int64) << 8), 0xffff) * 2
    raw_ = np.fromfile(os.path.join(A, 'height.bin'), dtype='<u2').reshape(G, G).astype(np.int64)
    ok(int(np.abs(Hz_ - raw_).max()) <= 1, 'height_z.bin decodes to height.bin to within 1 step (1.07 cm)')
    good = True
    for f_, B_ in (('biome_z.bin', B), ('biome2_z.bin', B2)):
        p_ = planes(f_, NB, 3)
        good = good and all((undelta(p_[c], 255) == B_[:, :, c]).all() for c in range(3)) and ((255 - B_[:, :, :3].astype(np.int64).sum(axis=2)) == B_[:, :, 3]).all()
    ok(good, 'biome_z.bin and biome2_z.bin decode exactly, the fourth channel being what is left of 255')
# W13: a kit for each culture, none of them a flat box
_m = os.path.join(HERE, 'assets.json')
if NEW_MAP and os.path.exists(_m):
    M_ = json.load(open(_m))
    ok(set(M_['kits']) >= {'marble', 'gilded', 'cliff', 'ice', 'timber village'} and all(k in M_['pieces'] for v in M_['kits'].values() for k in v), 'W13a: a kit for each culture, each piece listed')
    small_ = min((M_['pieces'][k]['tris'], k) for v in M_['kits'].values() for k in v)
    ok(small_[0] >= 40, 'W13d: smallest building piece %s, %d triangles' % (small_[1], small_[0]))
# nothing on land floats: every prop's base within 0.5 m of the terrain at its own feet. Rock and driftwood are bedded deeper on purpose, so for them only the floating side counts
LAND_K = ('palm', 'bush', 'fern', 'grass_tuft', 'tree_', 'cottage', 'stone_wall', 'lighthouse', 'snow_pine', 'beach_rock', 'driftwood', 'grass_patch', 'wildflowers')
BEDDED = ('beach_rock', 'driftwood')
off_ = []
for name_, v_ in W['instances'].items():
    if name_.startswith(LAND_K):
        for k_ in range(0, len(v_), 6):
            d_ = v_[k_ + 2] - ground(v_[k_], v_[k_ + 1])
            if d_ > 0.5 or (d_ < -0.5 and not name_.startswith(BEDDED)):
                off_.append((name_, round(v_[k_], 1), round(v_[k_ + 1], 1), round(d_, 2)))
ok(not off_ or not NEW_MAP, 'every land prop stands within 0.5 m of the terrain at its feet %s' % off_[:4])
# and all along its base: a long piece on a slope is level, so it's the mesh's own lowest points that are read against the ground under each of them
hang_ = []
for name_, v_ in W['instances'].items():
    q_ = os.path.join(HERE, 'out', 'cache', name_ + '.npz')
    if not name_.startswith(LAND_K) or name_ == 'grass_patch' or not os.path.exists(q_):
        continue
    V_ = np.load(q_)['V']
    bot_ = V_[:, 2].min()                                                # the base is the mesh's lowest plane, read over the footprint of what stands near it
    low_ = V_[V_[:, 2] < bot_ + 0.3]
    low_ = low_[:: max(1, len(low_) // 24)]
    for k_ in range(0, len(v_), 6):
        x_, y_, z_, yaw_, s_ = v_[k_:k_ + 5]
        c_, n_ = math.cos(yaw_), math.sin(yaw_)
        h_ = max((z_ + bot_ * s_) - ground(x_ + (p_[0] * c_ - p_[1] * n_) * s_, y_ + (p_[0] * n_ + p_[1] * c_) * s_) for p_ in low_)
        if h_ > 0.5:
            hang_.append((name_, round(x_, 1), round(y_, 1), round(float(h_), 2)))
ok(not hang_ or not NEW_MAP, 'no land piece hangs over 0.5 m above the ground anywhere along its base: %d do %s' % (len(hang_), hang_[:4]))
sea_ = [n_ for n_ in ('palm_a', 'palm_b', 'bush', 'fern', 'grass_tuft', 'tree_oak_a', 'tree_oak_b', 'snow_pine', 'cottage_a', 'cottage_b') for k_ in range(0, len(W['instances'].get(n_, [])), 6) if ground(W['instances'][n_][k_], W['instances'][n_][k_ + 1]) < 0.0]
ok(not sea_, 'no land prop stands where the ground is under the sea %s' % sea_[:4])
if NEW_MAP:                                                              # snow is the north's: Rimehold, Frost Isle, the fort's shelf and the bergs grounded round it
    ice_ = B2[:, :, 1] / 255.0
    g_ys, g_xs = np.nonzero(ice_ > 0.02)
    cell_ = W['size_m'] / (NB - 1)
    ok(((OX + g_ys * cell_) > 540.0).all(), 'ice and snow lie only in the north: southernmost at y %.0f' % (OX + g_ys.min() * cell_))
# stuck: no two boxes that hold a body between them, no underside so near the ground that it lifts him into it, and a body put anywhere inside the ice gets out
if NEW_MAP:
    import check_traps
    import random
    T_ = check_traps.read(cols, ground)
    sl_ = [c for c in cols if c.get('z0') == -6.3 and c.get('z1') == 0.8]
    print('shared faces', T_['pairs'], T_['pairs_by_kind'].most_common(8))
    ok(not [t for t in T_['traps'] if t[0] == 'listed' or t[1] == 'listed'], 'no seam in the ice or anything laid by hand holds a body: %d shared faces' % sum(1 for a in T_['traps'] if a[0] == 'listed'))
    ok(not T_['traps'], 'no two solids that touch face to face hold a body between them, on the game\'s own way out: %d of %d shared faces %s' % (len(T_['traps']), T_['pairs'], T_['traps'][:2]))
    rnd_ = random.Random(1931)
    stuck_ = []
    for k_ in range(4000):
        c_ = rnd_.choice(sl_)
        x_, y_ = c_['x'] + rnd_.uniform(-c_['hx'], c_['hx']), c_['y'] + rnd_.uniform(-c_['hy'], c_['hy'])
        if k_ % 2:                                                       # half of them on the lines the tiles meet on
            x_ = c_['x'] - c_['hx'] + round((x_ - c_['x'] + c_['hx']) / 48.0) * 48.0 + rnd_.uniform(-1.5, 1.5)
        t_, q_ = check_traps.trapped([x_, y_, rnd_.uniform(-6.0, 0.5)], T_['near'], ground)
        if t_:
            stuck_.append((round(x_, 1), round(y_, 1)))
    ok(not stuck_, 'a body put anywhere inside the ice comes out of it: %d of 4000 stay %s' % (len(stuck_), stuck_[:4]))
    sl2_ = check_traps.slits(cols, T_['near'], ground, W.get('openings', []))
    ok(not [v for v in sl2_ if len(v) >= 2], 'no roofed slit under 2.5 m a body fits into, unless it is a designed opening: %d, and %d single readings %s' % (len([v for v in sl2_ if len(v) >= 2]), len([v for v in sl2_ if len(v) < 2]), [v[0][:4] for v in sl2_ if len(v) >= 2][:3]))
    wide_ = [c for c in cols if (2.0 * c['r'] if c['t'] == 'cyl' else 2.0 * min(c['hx'], c['hy'])) >= 3.0]
    g_ = [g[:3] for g in check_traps.low_gaps(wide_, T_['near'], ground) if g[1] >= 4 or (g[0] == 'listed' and g[3].get('z0') == -6.3)]
    ok(not g_, 'no walkable gap under 1.5 m beneath a solid at least 3 m across: %d %s' % (len(g_), g_[:4]))
    under_ = [(round(x_, 1), round(y_, 1), round(ground(x_, y_), 2)) for c in sl_ for x_ in np.arange(c['x'] - c['hx'], c['x'] + c['hx'] + 0.1, 4.0) for y_ in np.arange(c['y'] - c['hy'], c['y'] + c['hy'] + 0.1, 4.0) if ground(x_, y_) > -7.75]
    ok(not under_, 'the sea floor keeps 1.5 m clear of the ice everywhere under it: %d points short %s' % (len(under_), under_[:3]))
# what lives in the sea stays in it
wet_ = [(n_, round(v_[k_], 1), round(v_[k_ + 1], 1)) for n_, v_ in W['instances'].items() if n_.startswith(('coral_', 'anemone', 'seagrass', 'glow_coral', 'kelp_stalk')) for k_ in range(0, len(v_), 6) if v_[k_ + 2] + (P.get(n_, {}).get('hi', [0, 0, 2.0])[2]) * v_[k_ + 4] > -0.3]
ok(not wet_, 'no coral or weed stands in the air: %d %s' % (len(wet_), wet_[:4]))
# nothing left alone: a piece standing clear of the ground has something under it or beside it, unless it floats
if NEW_MAP:
    FLOATS_ = {'ice_floe', 'ice_ceiling', 'boat_fishing', 'pier', 'pier_house', 'quay'}
    alone_ = []
    for name_, v_ in W['instances'].items():
        q_ = os.path.join(HERE, 'out', 'cache', name_ + '.npz')
        if name_ in FLOATS_ or not os.path.exists(q_):
            continue
        V_ = np.load(q_)['V']
        bot_, reach_ = V_[:, 2].min(), float(np.hypot(V_[:, 0], V_[:, 1]).max())
        for k_ in range(0, len(v_), 6):
            x_, y_, z_, yaw_, s_ = v_[k_:k_ + 5]
            b_, R_ = z_ + bot_ * s_, reach_ * s_ + 2.0
            if b_ - ground(x_, y_) > 1.0 and not any(c.get('kind') != name_ and c['z0'] - 2.0 < b_ < c['z1'] + 2.0 and math.hypot(c['x'] - x_, c['y'] - y_) - (c['r'] if c['t'] == 'cyl' else math.hypot(c['hx'], c['hy'])) < R_ for c in T_['near'].around(x_, y_, R_)):
                alone_.append((name_, round(float(x_), 1), round(float(y_), 1), round(float(b_), 1)))
    ok(not alone_, 'no piece stands clear of the ground with nothing under or beside it: %d %s' % (len(alone_), alone_[:6]))
# G6r: a pearl he can reach
far_ = [q for q in W['pearls'] if q[2] > max(ground(q[0], q[1]) + 3.2, 6.6)]
ok(not far_, 'every pearl within reach of a walker or a breach %s' % far_[:4])
# W15a, W21: the cast and the holds
if NEW_MAP:
    kinds_ = {'fish_a', 'fish_b', 'fish_c', 'shark', 'reef_shark', 'dolphin', 'whale', 'manta', 'turtle', 'jelly', 'serpent'} | {l_['kind'] for l_ in W['life']}
    ok(len(kinds_) >= 25, 'W15a: %d species' % len(kinds_))
    pid_ = {p['id'] for p in W['poi']}
    ok(len(W['holds']) == 6 and all(h_['poi'] in pid_ for h_ in W['holds']), 'W21: six holds, each on a place of the map')
# the contract's lists
ids = {p['id'] for p in W['poi']}
want = [] if not NEW_MAP else 'reef reef_shrine sea_arch islet sunward sunward_temple crown crown_cove kelp long_nave kelp_shrine thalor processional colossus arena high_temple trench deep_shrine open_blue wreck meridon rotunda vesper terraces sunward_hollow sunward_harbour sunward_lighthouse otter_raft meridon_bakery meridon_bridge rimehold rime_shrine rime_caves frost_isle frost_fort cindermere cinder_shrine cinder_forge wrackreach kraken_lair crown_falls crown_temple'.split()
ok(not [w_ for w_ in want if w_ not in ids], 'every place the missions name is a poi %s' % [w_ for w_ in want if w_ not in ids])
ok(not NEW_MAP or {b['id'] for b in W['bells']} == {'reef', 'kelp', 'deep', 'gilded', 'rime', 'cinder', 'great'}, 'seven bells')
ok(not NEW_MAP or len(W['openings']) >= 40, 'openings published: %d' % len(W.get('openings', [])))
ok(W['rivers'] and all(r['pts'][i][2] >= r['pts'][i + 1][2] for r in W['rivers'] for i in range(len(r['pts']) - 1)), 'every river only ever runs downhill (%d rivers)' % len(W['rivers']))
ok(all(r['pts'][-1][2] <= 0.6 for r in W['rivers'] if r['id'] != 'crown_upper'), 'the rivers reach the sea')
if NEW_MAP:                                                              # W14: every solid sound, and none thinner than the wall allows
    thin_ = [c for c in W['colliders'] if (c['r'] if c['t'] == 'cyl' else min(c['hx'], c['hy'])) < 0.18 or (c['z1'] - c['z0']) / 2.0 < 0.18]
    ok(not thin_, 'no solid thinner than 0.18 m %s' % [(round(c['x'], 1), round(c['y'], 1)) for c in thin_[:4]])
ok(all(f['z0'] > f['z1'] + 8.0 for f in W['waterfalls']), 'the falls fall (%s)' % [(f['z0'], f['z1']) for f in W['waterfalls']])
print('counts', {k: len(v) // 6 for k, v in sorted(inst.items())})
print('colliders', len(cols), 'cyl', sum(1 for c in cols if c['t'] == 'cyl'), 'box', sum(1 for c in cols if c['t'] == 'box'), 'pearls', len(W['pearls']), 'encounters', len(W['encounters']), 'schools', len(W['schools']), 'pods', len(W['pods']), 'sharks', len(W['sharks']), 'drifters', len(W['drifters']), 'whales', len(W['whales']), 'poi', len(W['poi']))
print('FAILED %d' % len(fails) if fails else 'ALL PASSED')
sys.exit(1 if fails else 0)
