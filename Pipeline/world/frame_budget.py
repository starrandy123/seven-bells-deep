# Drowned City: what a frame can see. From a camera at each named place, looking each of eight ways with the game's field of view, the triangles in reach of the look's own rule (world.js), counted from world.json and the pieces' real sizes.
import json, math, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
A = os.environ.get('WORLD_ASSETS') or os.path.abspath(os.path.join(HERE, '..', '..', 'web', 'assets'))
W = json.load(open(os.path.join(A, 'world.json')))
P = json.load(open(os.path.join(HERE, 'out', 'pieces.json')))


def base_reach(n):
    if 'kelp' in n: return 300
    if 'palm' in n: return 440
    if n in ('wall_windows', 'wall_windows_cold', 'tower', 'tower_cold', 'dome_hall'): return 430
    if n in ('beach_rock', 'cliff_rock', 'driftwood'): return 340
    if n in ('grass_tuft', 'seagrass'): return 95
    if n in ('bush', 'fern'): return 170
    if 'coral' in n or n == 'anemone': return 150
    if 'lamp' in n or 'glow' in n: return 240
    return 150


T = {}
for n, flat in W['instances'].items():
    if n not in P:
        continue
    R = np.array(flat).reshape(-1, 6)
    sz = P[n]['size']
    rad = 0.5 * math.sqrt(sz[0] ** 2 + sz[1] ** 2 + sz[2] ** 2) * R[:, 4].max()
    T[n] = (R, min(460.0, base_reach(n) + rad * 7.0), P[n]['tris'])
fov = math.radians(100.0)
rows = []
for p in W['poi'] + [{'id': 'spawn', 'x': W['spawn']['x'], 'y': W['spawn']['y']}]:
    x, y = p['x'], p['y']
    best = 0
    per = None
    for k in range(8):
        a = k / 8.0 * 2 * math.pi
        dx, dy = math.cos(a), math.sin(a)
        tot, parts = 0, {}
        for n, (R, reach, tris) in T.items():
            ex, ey = R[:, 0] - x, R[:, 1] - y
            d = np.hypot(ex, ey)
            vis = (d < reach) & ((d < 30.0) | ((ex * dx + ey * dy) / np.maximum(d, 1e-3) > math.cos(fov / 2.0)))
            c = int(vis.sum()) * tris
            tot += c
            parts[n] = c
        if tot > best:
            best, per = tot, parts
    rows.append((best, p['id'], sorted(per.items(), key=lambda t: -t[1])[:4]))
rows.sort(key=lambda r: -r[0])
for b, i, top in rows[:12]:
    print('%8d  %-16s %s' % (b, i, ' '.join('%s:%d' % (n, c // 1000) for n, c in top)))
print('worst', rows[0][0], 'median', rows[len(rows) // 2][0], 'unique triangles in props', sum(P[n]['tris'] for n in T))
