# Drowned City: which file each kind lives in. Q24: only what the first view needs loads before first play; the rest streams after it, nearest first.
#   python plan_packs.py [world.json]     writes out/packs.json
# The rule agreed with the look: props.glb is the boot pack: every __far mesh, everything within 250 m of the spawn, the shared rock and the names code asks for. A kind in a region pack must have a far mesh in boot,
# because until its near mesh arrives the far one is drawn at every distance, so there is never a hole. A kind sits in exactly one file.
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
SHARED = {'rock_a', 'rock_b', 'rock_c', 'rock_pillar', 'cliff_rock', 'beach_rock', 'pearl', 'chest', 'bell', 'lamp'}
PACKS = ['cities', 'land', 'far']                                       # QS-B1n, web_check/load.mjs: at most three files after first play


def ell(x, y, cx, cy, rx, ry):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1.0


def region(x, y):
    if ell(x, y, 22, 54, 310, 290) or ell(x, y, 440, 246, 220, 170) or (y > 360 and y < 640 and -580 < x < 660):
        return 'cities'                                                  # Thalor, Meridon, Vesper
    if ell(x, y, -490, -628, 330, 260) or ell(x, y, 405, -212, 250, 250):
        return 'land'
    if y > 640 or ell(x, y, 752, -640, 270, 330) or x < -640:
        return 'far'                                                     # the ice, the vents, the wrecks
    return None


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT, 'stage', 'world.json')
    W = json.load(open(path))
    P = json.load(open(os.path.join(OUT, 'pieces.json')))
    sp = W['spawn']
    packs = {k: [] for k in PACKS}
    boot, why = [], {}
    for name, rows in sorted(W['instances'].items()):
        a = np.array(rows, dtype=np.float64).reshape(-1, 6)
        far = (name + '__far') in P
        near_spawn = bool((np.hypot(a[:, 0] - sp['x'], a[:, 1] - sp['y']) < 250.0).any())
        if name in SHARED or near_spawn or not far or name.startswith('tree_'):       # a tree's leaf cards are built from its near mesh at load: the stream can't build them on arrival
            boot.append(name)
            why[name] = 'shared' if name in SHARED else 'near the spawn' if near_spawn else 'tree' if name.startswith('tree_') else 'no far mesh'
            continue
        votes = {}
        for x, y in a[:, :2]:
            r = region(x, y)
            votes[r] = votes.get(r, 0) + 1
        votes.pop(None, None)
        if not votes:
            boot.append(name)
            why[name] = 'in no region'
            continue
        packs[max(votes, key=votes.get)].append(name)
    placed = set(boot) | {k for v in packs.values() for k in v}
    rest = [n for n in P if n not in placed and '__far' not in n]         # what the map doesn't place (code asks for these by name): boot
    fars = [n for n in P if n.endswith('__far')]
    out = {'boot': sorted(boot + rest + fars), 'packs': {k: sorted(v) for k, v in packs.items()}, 'why': why}
    json.dump(out, open(os.path.join(OUT, 'packs.json'), 'w'), indent=0)
    t = lambda names: sum(P.get(n, {}).get('tris', 0) for n in names)
    print('BOOT', len(out['boot']), 'kinds', t(out['boot']), 'tris')
    for k, v in out['packs'].items():
        print('%-16s %3d kinds %7d tris  %s' % (k, len(v), t(v), ' '.join(v)[:120]))
    print('no far yet:', sorted((P.get(n, {}).get('tris', 0), n) for n, w in why.items() if w == 'no far mesh')[-24:])


if __name__ == '__main__':
    main()
