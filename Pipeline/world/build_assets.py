# Drowned City: builds every prop and creature, measures it, exports the GLBs, renders a look. Headless Blender, seeded.
#   $BL -b --factory-startup --python build_assets.py -- props [--only a,b] [--no-export] [--sheet rocks,coral,city,hero]
#   $BL -b --factory-startup --python build_assets.py -- creatures [--only a,b] [--sheet animals]
# Each finished piece is cached in out/cache/<name>.npz, so one piece can be rebuilt without the rest. Writes out/props.glb, out/creatures.glb,
# out/pieces.json (each piece's real size, triangles and the collision measured from its mesh) and preview/*.png.
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'hero'))
import guard                                    # a runaway job ends itself: swap and time limits, the machine's hard rule
guard.start(os.path.join(HERE, 'out', 'guard_%s.log' % os.path.basename(__file__)), seconds=170, grow_mb=1500)
import bpy
import numpy as np

import meshkit
from meshkit import Mesh, Perlin3, Voxels, bake_ao, join, relax, sphere
import bl
import gen_nature as N
import gen_city as C
import gen_land as L
import gen_arch as R
import gen_village as VL
import gen_far as FAR
import gen_biomes as BI

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
WHAT = ARGS[0] if ARGS else 'props'


def opt(name, default=None):
    if name in ARGS:
        return ARGS[ARGS.index(name) + 1]
    return default


ONLY = opt('--only')
ONLY = set(ONLY.split(',')) if ONLY else None
SHEETS = opt('--sheet')
SHEETS = SHEETS.split(',') if SHEETS else []
NOEXPORT = '--no-export' in ARGS
OUT = os.path.join(HERE, 'out')
CACHE = os.path.join(OUT, 'cache')
PREVIEW = os.path.join(HERE, 'preview')
for d in (OUT, CACHE, PREVIEW):
    os.makedirs(d, exist_ok=True)
PIECES_P = os.path.join(OUT, 'pieces.json')
PIECES = json.load(open(PIECES_P)) if os.path.exists(PIECES_P) else {}

bl.scene_clear()


def rough_ball(c, r, seed):
    m = sphere((0, 0, 0), r, seg=14, rings=9, S=False)
    pn = Perlin3(seed)
    k = 1.0 + 0.3 * pn.fbm(m.V[:, 0] / r * 1.5, m.V[:, 1] / r * 1.5, m.V[:, 2] / r * 1.5, 3)
    m.V = m.V * k[:, None] + np.asarray(c, dtype=np.float64)
    return m


def smooth_decimate(mesh, target, iters=3):
    """Decimate, then take out the folds: a clean silhouette and no flat polygons."""
    return relax(bl.decimate(mesh, target), iters)


def rock_piece(size, seed, target, facets=9):
    return smooth_decimate(N.rock(size, seed, facets=facets), target)


def colossus():
    body = smooth_decimate(C.colossus_body(), int(opt('--colossus', 3400)), 2)
    C.paint_statue(body)
    return join([C.plinth(), body, C.trident()])


def wreck_stand():
    """The Stood Ship: a great hull that went down bow first and stuck there, half again the size of the others, her stern reaching out of the water over the graveyard, a lantern at her rail."""
    m = load_piece('wreck_hull') if os.path.exists(os.path.join(CACHE, 'wreck_hull.npz')) else C.wreck_hull()
    out = m.scaled(2.05).rot('y', -math.radians(84.0))                    # all but upright: the lean is what a stack of solids can't follow
    lo = out.V.min(axis=0)
    hi = out.V.max(axis=0)
    return out.moved(-(lo[0] + hi[0]) / 2.0, -(lo[1] + hi[1]) / 2.0, -lo[2] - 2.0)


def half_wreck(sgn):
    """One end of a ship broken in two: the same hull, the break a jagged line across her frames, every long plank ending at it, and the dark of her inside closing the end."""
    m = load_piece('wreck_hull') if os.path.exists(os.path.join(CACHE, 'wreck_hull.npz')) else C.wreck_hull()

    def line(y, z):
        return 1.5 * np.sin(z * 0.9 + y * 0.5) + 1.1 * np.sin(y * 1.9 + z * 0.37)

    side = (m.V[:, 0] - line(m.V[:, 1], m.V[:, 2])) * sgn
    keep = (side[m.T] > 0.0).any(axis=1)
    V = m.V.copy()
    gone = side < 0.0
    V[gone, 0] = line(V[gone, 1], V[gone, 2])                            # what ran past the break stops at it
    T = m.T[keep]
    used, inv = np.unique(T, return_inverse=True)
    out = Mesh(V[used], inv.reshape(-1, 3))
    out.C = np.array(m.C[keep])
    out.S = np.array(m.S[keep])
    near = m.V[np.abs(m.V[:, 0] - sgn * 3.0) < 3.0][:, 1:3]              # her section just inside the break, as an outline
    c = near.mean(axis=0)
    a = np.arctan2(near[:, 1] - c[1], near[:, 0] - c[0])
    ring = []
    for k in range(20):                                                  # the farthest point in each of 20 bearings
        w = np.abs((a - (k / 20.0 * meshkit.TAU - math.pi) + math.pi) % meshkit.TAU - math.pi) < math.pi / 20.0
        if w.any():
            q = near[w]
            ring.append(q[np.argmax(np.sum((q - c) ** 2, axis=1))])
    ring = c + (np.array(ring) - c) * 0.96
    cap = meshkit.fan(np.column_stack([np.full(len(ring), sgn * 3.0), ring[:, 0], ring[:, 1]]), (sgn * 3.0, c[0], c[1]), S=False)
    R.face_dir(cap, (-sgn, 0.0, 0.0))
    cap.C[..., :3] = np.array([0.012, 0.014, 0.016])
    return join([out, cap])


def statue_torso():
    """A second Warden's torso, thrown down on the arena floor: the same carved figure, cut at the hips and the neck, lying on its back."""
    m = smooth_decimate(C.colossus_body((21.5, 38.5), no_mantle=True), 1450, 2)
    C.paint_statue(m, 6)
    m = m.moved(0, 0, -30.0).rot('x', 1.42).rot('z', 0.35)
    m.V[:, 2] -= m.V[:, 2].min() + 1.0
    return m


def statue_feet():
    """All that still stands of that statue: two legs cut at the thigh, on a broken plinth."""
    body = smooth_decimate(C.colossus_body((0.0, 13.0), no_mantle=True), 1100, 2)
    C.paint_statue(body, 7)
    body.V[:, 2] -= 4.0
    pl = C.plinth().moved(0, 0, -4.6).scaled(0.76, 0.76, 1.0)
    return join([pl, body])


def head():
    m = smooth_decimate(C.statue_head(), 1480, 2)
    return C.paint_marble(m, 46, 0.8, course=99.0, stone=99.0)


# name: (maker, how it collides, how many shapes, voxel pitch, ao strength)
# Collision classes, as the framework says: 'cyl' an upright stack, 'box' greedy boxes that leave openings open, None for what you swim through.
PROPS = {
    # the reef and its rock
    'coral_branch': (N.coral_branch, None, 0, 0.07, 0.8),
    'coral_fan': (N.coral_fan, None, 0, 0.05, 0.3),
    'coral_brain': (N.coral_brain, 'cyl', 2, 0.14, 0.55),
    'coral_table': (N.coral_table, 'cyl', 2, 0.12, 0.7),
    'coral_tube': (N.coral_tube, None, 0, 0.07, 0.7),
    'anemone': (N.anemone, None, 0, 0.05, 0.6),
    'glow_coral': (N.glow_coral, None, 0, 0.06, 0.2),
    'seagrass': (N.seagrass, None, 0, 0.06, 0.0),
    'kelp_stalk': (N.kelp_stalk, None, 0, 0.3, 0.0),
    'rock_a': (lambda: N.crag((8.0, 7.0, 5.0), 101, 0.48), 'cyl', 2, 0.2, 0.75),
    'rock_b': (lambda: N.crag((11.0, 8.0, 7.5), 102, 0.66, 13), 'cyl', 3, 0.25, 0.75),
    'rock_c': (lambda: N.crag((6.0, 6.5, 8.5), 103, 0.52, 9), 'cyl', 3, 0.2, 0.75),
    'rock_pillar': (N.rock_pillar, 'cyl', 3, 0.5, 0.45),
    'sea_arch': (lambda: N.paint_rock(relax(N.sea_arch(), 1), 105), 'box', 46, 1.1, 0.8),
    # the land
    'palm_a': (L.palm_a, 'parts', 0, 0.12, 0.0),
    'palm_b': (L.palm_b, 'parts', 0, 0.12, 0.0),
    'bush': (L.bush, None, 0, 0.1, 0.5),
    'fern': (L.fern, None, 0, 0.1, 0.0),
    'grass_tuft': (L.grass_tuft, None, 0, 0.1, 0.0),
    'beach_rock': (lambda: N.crag((6.0, 4.4, 2.2), 606, 0.32, 12, 3.0, 0.12, 1.3), 'cyl', 2, 0.14, 0.7),
    'cliff_rock': (L.cliff_rock, 'box', 10, 0.9, 0.45),
    'driftwood': (L.driftwood, None, 0, 0.1, 0.3),
    # Sunward: the grasslands, the village, the harbour
    'tree_oak_a': (VL.tree_oak_a, 'parts0', 0, 0.3, 0.0),
    'tree_oak_b': (VL.tree_oak_b, 'parts0', 0, 0.3, 0.0),
    'grass_patch': (VL.grass_patch, None, 0, 0.2, 0.0),
    'wildflowers': (VL.wildflowers, None, 0, 0.2, 0.0),
    'stone_wall': (VL.stone_wall, 'bbox', 1, 0.1, 0.5),
    'cottage_a': (VL.cottage_a, 'bbox', 1, 0.2, 0.55),
    'cottage_b': (VL.cottage_b, 'bbox', 1, 0.2, 0.55),
    'quay': (VL.quay, 'bbox', 1, 0.2, 0.5),
    'pier': (VL.pier, None, 0, 0.1, 0.3),
    'pier_house': (VL.pier_house, 'bbox', 1, 0.15, 0.5),
    'boat_fishing': (VL.boat_fishing, 'bbox', 1, 0.1, 0.4),
    'lighthouse': (VL.lighthouse, 'cyl', 3, 0.3, 0.4),
    # the new seas
    'ice_ceiling': (BI.ice_ceiling, None, 0, 0.8, 0.0),
    'ice_floe': (BI.ice_floe, None, 0, 0.4, 0.0),
    'kelp_spire': (BI.kelp_spire, None, 0, 1.0, 0.0),
    'stair_crown': (BI.stair_crown, None, 0, 0.5, 0.0),
    'wreck_stand': (wreck_stand, None, 0, 1.0, 0.0),
    'ice_pillar': (BI.ice_pillar, 'cyl', 3, 0.8, 0.0),
    'ice_wall': (BI.ice_wall, 'bbox', 1, 0.3, 0.4),
    'ice_tower': (BI.ice_tower, 'cyl', 3, 0.4, 0.3),
    'ice_gate': (BI.ice_gate, 'list', 0, 0.3, 0.3),
    'snow_pine': (BI.snow_pine, 'parts0', 0, 0.3, 0.0),
    'smoker': (BI.smoker, 'cyl', 2, 0.25, 0.0),
    'lava_crack': (BI.lava_crack, None, 0, 0.3, 0.0),
    'forge_hall': (BI.forge_hall, 'list', 0, 0.3, 0.5),
    'lamp_ghost': (BI.lamp_ghost, None, 0, 0.1, 0.0),
    'rib_bone': (BI.rib_bone, 'cyl', 2, 0.5, 0.3),
    'wreck_bow': (lambda: half_wreck(1.0), 'box', 8, 0.7, 0.6),
    'wreck_stern': (lambda: half_wreck(-1.0), 'box', 8, 0.7, 0.6),
    # the two new cities
    'dome_hall': (R.dome_hall, 'cyl', 4, 0.7, 0.0),
    'tower': (R.tower, 'cyl', 3, 0.4, 0.0),
    'tower_cold': (R.tower_cold, 'cyl', 3, 0.4, 0.0),
    'bridge_span': (C.bridge_span, 'box', 7, 0.3, 0.0),
    'wall_windows': (R.wall_windows, 'bbox', 1, 0.3, 0.5),
    'wall_windows_cold': (R.wall_windows_cold, 'bbox', 1, 0.3, 0.5),
    # Thalor
    'column': (R.column, 'cyl', 3, 0.18, 0.55),
    'column_broken': (R.column_broken, 'cyl', 2, 0.18, 0.55),
    'column_fallen': (R.column_fallen, 'box', 6, 0.2, 0.6),
    'arch': (R.arch, 'list', 0, 0.3, 0.7),
    'wall_bay': (R.wall_bay, 'list', 0, 0.25, 0.6),
    'wall_broken': (R.wall_broken, 'box', 7, 0.25, 0.6),
    'stair': (R.stair, 'box', 6, 0.25, 0.5),
    'stair_steep': (C.stair_steep, 'box', 7, 0.25, 0.3),
    'temple_front': (R.temple_front, 'box', 16, 0.32, 0.75),
    'roof_slab': (R.roof_slab, 'box', 8, 0.3, 0.45),
    'lamp': (C.lamp, 'cyl', 2, 0.1, 0.3),
    'statue_colossus': (colossus, 'box', 44, 0.7, 0.8),
    'statue_head': (head, 'box', 10, 0.28, 0.75),
    'arena_bay': (C.arena_bay, 'bbox', 1, 0.3, 0.85),
    'arena_bay_broken': (C.arena_bay_broken, 'box', 6, 0.32, 0.8),
    'arena_seats': (C.arena_seats, 'list', 0, 0.25, 0.45),
    'arena_floor': (C.arena_floor, None, 0, 0.5, 0.0),
    'lamp_brazier': (C.lamp_brazier, 'cyl', 2, 0.12, 0.3),
    'statue_torso': (statue_torso, 'box', 8, 0.32, 0.75),
    'statue_feet': (statue_feet, 'box', 8, 0.32, 0.75),
    'arena_portal': (C.arena_portal, 'box', 7, 0.3, 0.75),
    'arena_gate': (C.arena_gate, 'bbox', 1, 0.2, 0.0),
    'bell_shrine': (C.bell_shrine, 'parts', 0, 0.2, 0.7),
    'bell': (C.bell, None, 0, 0.1, 0.0),
    'chest': (C.chest, 'box', 1, 0.08, 0.5),
    'pearl': (C.pearl, None, 0, 0.05, 0.0),
    'wreck_hull': (C.wreck_hull, 'box', 20, 0.7, 0.75),
    'wreck_mast': (C.wreck_mast, 'box', 5, 0.3, 0.4),
    'anchor': (C.anchor, None, 0, 0.1, 0.3),
}

# the angle past which an edge stays sharp: masonry keeps its edges, rock and sculpture flow, animals are all one skin
# what the world holds by the hundred: past its range, the same shape in this many triangles, painted from the near mesh
DECIM = {'ice_pillar': 290, 'wreck_hull': 500, 'wreck_bow': 270, 'wreck_stern': 270, 'ice_floe': 120, 'smoker': 150, 'rock_a': 300, 'rock_b': 300, 'rock_c': 300, 'beach_rock': 280,
         'coral_fan': 250, 'coral_brain': 240, 'coral_branch': 240, 'coral_table': 240, 'coral_tube': 240, 'glow_coral': 200,
         # a kind in a region pack must have a far mesh in the boot pack: until its near mesh arrives, the far one is drawn at every distance
         'statue_colossus': 900, 'statue_head': 300, 'statue_torso': 320, 'statue_feet': 300, 'column_fallen': 160, 'roof_slab': 240, 'lamp_brazier': 130, 'arena_portal': 320, 'arena_bay_broken': 260,
         'stair': 130, 'bridge_span': 100, 'stone_wall': 110, 'quay': 110, 'pier': 110, 'pier_house': 420, 'lighthouse': 320, 'boat_fishing': 140, 'stair_steep': 130, 'ice_wall': 140, 'ice_tower': 320,
         'ice_gate': 520, 'forge_hall': 1000, 'wreck_mast': 60, 'kelp_spire': 520, 'wreck_stand': 500, 'arena_floor': 140}
CFAR = {'fish_a': 120, 'fish_b': 120, 'fish_c': 120, 'turtle': 900, 'reef_shark': 900, 'shark': 1000, 'whale': 1800, 'dolphin': 800, 'manta': 900}       # the look swaps fish at 26 m, the rest at 60 m
NATURAL = ('iceberg_great', 'kelp_spire', 'ice_floe', 'ice_pillar', 'iceberg', 'ice_ceiling', 'smoker', 'rib_bone', 'snow_pine', 'rock_a', 'rock_b', 'rock_c', 'rock_pillar', 'sea_arch', 'islet', 'coral_branch', 'coral_fan', 'coral_brain', 'coral_table', 'coral_tube', 'anemone', 'glow_coral', 'seagrass', 'kelp_stalk',
           'palm_a', 'palm_b', 'bush', 'fern', 'grass_tuft', 'beach_rock', 'cliff_rock', 'driftwood')
SHARP = {'statue_colossus': 80, 'statue_head': 80}                       # flat shading only where stone is cut
SHARP.update({n: 180.0 for n in NATURAL})
SHARP.update({n: 38.0 for n in ('rock_a', 'rock_b', 'rock_c', 'beach_rock')})      # fresh-broken rock keeps its edges
CREATURE_SHARP = 180.0


def sharp_of(name):
    if WHAT != 'props':
        return 62.0 if name == 'turtle' else CREATURE_SHARP
    return SHARP.get(name, 38.0)


SHEET = {
    'rocks': ['rock_a', 'rock_b', 'rock_c', 'rock_pillar'],
    'coral': ['coral_branch', 'coral_fan', 'coral_brain', 'coral_table', 'coral_tube', 'anemone', 'glow_coral', 'seagrass'],
    'kelp': ['kelp_stalk'],
    'green': ['tree_oak_a', 'tree_oak_b', 'grass_patch', 'wildflowers', 'stone_wall', 'bush'],
    'village': ['cottage_a', 'cottage_b', 'quay', 'pier', 'pier_house', 'boat_fishing', 'lighthouse'],
    'land': ['palm_a', 'palm_b', 'bush', 'fern', 'grass_tuft', 'beach_rock', 'driftwood'],
    'cliff': ['cliff_rock'],
    'cities': ['dome_hall', 'tower', 'tower_cold', 'bridge_span', 'wall_windows', 'wall_windows_cold'],
    'far': ['column__far', 'wall_bay__far', 'arch__far', 'temple_front__far', 'dome_hall__far', 'tower__far', 'wall_windows__far', 'arena_bay__far', 'tree_oak_a__far', 'cottage_a__far'],
    'ice': ['ice_ceiling', 'ice_floe', 'ice_pillar', 'ice_wall', 'ice_tower', 'ice_gate', 'snow_pine'],
    'fire': ['smoker', 'lava_crack', 'forge_hall', 'lamp_ghost', 'rib_bone', 'wreck_bow', 'wreck_stern'],
    'city': ['column', 'column_broken', 'column_fallen', 'wall_bay', 'wall_broken', 'arch', 'stair', 'lamp', 'roof_slab'],
    'temple': ['temple_front', 'bell_shrine', 'bell', 'chest', 'pearl'],
    'arena': ['arena_bay', 'arena_bay_broken', 'arena_portal', 'arena_seats', 'lamp_brazier'],
    'fallen': ['statue_torso', 'statue_feet', 'statue_head'],
    'mosaic': ['arena_floor'],
    'hero': ['statue_colossus', 'statue_head'],
    'arch': ['sea_arch'],
    'wreck': ['wreck_hull', 'wreck_mast', 'anchor'],
}


def save_piece(name, m, kind, n, pitch, ao):
    t0 = time.time()
    vox = None
    if ao > 0 or kind in ('cyl', 'box'):
        vox = Voxels(m, pitch)
    if ao > 0:
        bake_ao(m, strength=ao, vox=vox)
    col, cover = [], 0
    lo, hi = m.V.min(axis=0), m.V.max(axis=0)
    if kind == 'list':                                                   # the generator's own solids, from the same numbers that made the mesh
        col = m.col_list
    elif kind == 'parts':                                                  # each real part its own shapes: what stands between them stays open
        for part, k, ax, ay in m.col_parts:
            col += Voxels(part, pitch).cyls(k, q=0.97, axis=(float(ax), float(ay)))
    elif kind == 'parts0':                                               # a tree: only its bole stops a swimmer or a walker
        h_ = PIECES.get(name, {}).get('size', [0, 0, 12.0])[2]
        col = [{'t': 'cyl', 'x': 0.0, 'y': 0.0, 'z0': -0.6, 'z1': 6.0, 'r': 0.85}]
    elif kind == 'bbox':                                                 # one solid: its bounds, or the faces the generator measured
        hx, hy = getattr(m, 'col_box', ((hi[0] - lo[0]) / 2.0, (hi[1] - lo[1]) / 2.0))
        col = [{'t': 'box', 'x': round(float(lo[0] + hi[0]) / 2, 3), 'y': round(float(lo[1] + hi[1]) / 2, 3), 'z0': round(float(lo[2]), 3), 'z1': round(float(hi[2]), 3), 'hx': round(float(hx), 3), 'hy': round(float(hy), 3)}]
    elif kind == 'cyl':
        col = vox.cyls(n, q=0.84)
    elif kind == 'box':
        rough = name in ('islet', 'statue_colossus', 'statue_head', 'statue_torso', 'statue_feet', 'wreck_hull', 'wreck_mast', 'column_fallen', 'cliff_rock', 'bridge_span')
        col, cover = vox.boxes(n, fill=0.88 if rough else 0.97, cover=0.93 if name == 'sea_arch' else 0.95, tries=48)
        if hasattr(m, 'col_low'):                                        # a storey solid to its faces, and the ruin over it in boxes of its own
            zc = vox.lo[2] + (np.arange(vox.n[2]) + 0.5) * vox.h
            vox.solid[:, :, zc < m.col_low['z1']] = False
            col = [m.col_low] + vox.boxes(5, fill=0.9, cover=0.9, tries=48)[0]
    extra = {'N': m.N.astype(np.float32)} if getattr(m, 'N', None) is not None else {}
    np.savez_compressed(os.path.join(CACHE, name + '.npz'), V=m.V.astype(np.float32), T=m.T.astype(np.int32), C=m.C.astype(np.float32), S=m.S, **extra)
    PIECES[name] = {'size': [round(float(hi[0] - lo[0]), 3), round(float(hi[1] - lo[1]), 3), round(float(hi[2]), 3)], 'lo': [round(float(v), 3) for v in lo],
                    'hi': [round(float(v), 3) for v in hi], 'tris': m.tris, 'col': col}
    print('PIECE %-16s %5d tris  size %s  col %d (%.2f)  %.1fs' % (name, m.tris, PIECES[name]['size'], len(col), cover, time.time() - t0), flush=True)


def load_piece(name):
    z = np.load(os.path.join(CACHE, name + '.npz'))
    m = Mesh(z['V'], z['T'])
    m.C = z['C']
    m.S = z['S']
    if 'N' in z:
        m.N = z['N']
    return m


def sheet(group, names, material):
    """A row of pieces on a pale floor, in plain light, with backface culling on, so a flipped face shows."""
    objs = []
    x = 0.0
    gap = max(PIECES[n]['size'][0] for n in names) * 0.14 + 0.6
    tall = 0.0
    for n in names:
        m = load_piece(n)
        w = PIECES[n]['hi'][0] - PIECES[n]['lo'][0]
        ob = bl.shaded_object('p_' + n, m, material, sharp_of(n))
        ob.location = (x + w / 2 - (PIECES[n]['hi'][0] + PIECES[n]['lo'][0]) / 2, 0, 0)
        x += w + gap
        objs.append(ob)
        tall = max(tall, PIECES[n]['size'][2])
    span = x - gap
    for ob in objs:
        ob.location.x -= span / 2
    W = max(span * 1.08, tall * 1.9)
    h = int(1280 * max(tall * 1.25, span * 0.3) / W)
    h = max(420, min(h + 120, 900))
    cam = bl.setup_render(1400, h, sky=(0.5, 0.58, 0.64), sun=1.9, sun_rot=(58, 0, -40), fill=0.62)
    d = W * 1.6
    bl.shoot(cam, os.path.join(PREVIEW, 'sheet_%s.png' % group), (0.0, -d, d * 0.28 + tall * 0.5), (0.0, 0.0, tall * 0.46), ortho=W)
    for ob in objs:
        bl.remove(ob)


def animal(name, material):
    """Side-on, three-quarter and from above, in open water light, to judge the animal against the real one."""
    m = load_piece(name)
    ob = bl.shaded_object('p_' + name, m, material, sharp_deg=180.0 if name not in ('turtle',) else 60.0)
    lo, hi = np.array(PIECES[name]['lo']), np.array(PIECES[name]['hi'])
    c = (lo + hi) / 2.0
    L = max(hi[1] - lo[1], hi[0] - lo[0])
    cam = bl.setup_render(1200, 520, sky=(0.5, 0.55, 0.6), sun=2.4, sun_rot=(28, 0, 40), fill=0.95)
    below = bpy.data.objects.new('below', bpy.data.lights.new('below', 'SUN'))
    below.data.energy = 1.1
    below.rotation_euler = (math.radians(150), 0.0, math.radians(-30))
    bpy.context.scene.collection.objects.link(below)
    d = L * 2.2
    bl.shoot(cam, os.path.join(PREVIEW, 'animal_%s_side.png' % name), (d, c[1], c[2]), tuple(c), ortho=L * 1.1)
    bl.shoot(cam, os.path.join(PREVIEW, 'animal_%s_q.png' % name), (c[0] + L * 0.62, c[1] - L * 0.8, c[2] + L * 0.1), (c[0], c[1] - L * 0.12, c[2]), lens=62)
    ob.rotation_euler = (0.0, 0.0, math.pi / 2)
    bl.shoot(cam, os.path.join(PREVIEW, 'animal_%s_top.png' % name), (-c[1], c[0], c[2] + d), (-c[1], c[0], c[2]), ortho=L * 1.1)
    ob.rotation_euler = (0.0, 0.0, 0.0)
    bl.shoot(cam, os.path.join(PREVIEW, 'animal_%s_low.png' % name), (c[0] + L * 0.28, c[1] - L * 0.5, c[2] - L * 0.62), (c[0], c[1] - L * 0.05, c[2]), lens=50)
    bl.remove(ob)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def close(name, material, pt=None):
    """Three metres off, a little below eye height, in a plain cool light: the distance W13 is judged at."""
    m = load_piece(name)
    ob = bl.shaded_object('p_' + name, m, material, sharp_of(name))
    lo, hi = np.array(PIECES[name]['lo']), np.array(PIECES[name]['hi'])
    tall = hi[2] - max(lo[2], 0.0)
    target = np.array([hi[0] * 0.28, lo[1], min(tall * 0.42, 5.0)])
    cam = bl.setup_render(1100, 620, sky=(0.42, 0.56, 0.62), sun=1.7, sun_rot=(60, 0, -35), fill=0.6)
    bl.shoot(cam, os.path.join(PREVIEW, 'close_%s.png' % name), tuple(target + np.array([-1.8, -3.0, -0.6])), tuple(target + np.array([0.6, 0.0, 0.6])), lens=24)
    bl.remove(ob)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def main():
    if WHAT == 'props':
        table = PROPS
    else:
        import gen_creatures as G
        import gen_creatures2 as G2
        table = dict(G.CREATURES)
        table.update(G2.CREATURES2)
    mat = bl.vc_material('M_prop')
    mat.use_backface_culling = True
    for name, (make, kind, n, pitch, ao) in table.items():
        if (ONLY and name not in ONLY) or '--far-only' in ARGS:
            continue
        t0 = time.time()
        m = make()
        if not isinstance(m.C, np.ndarray) or m.C.dtype != np.float64:
            m.C = np.asarray(m.C, dtype=np.float64)
        m.C[..., :3] = np.clip(m.C[..., :3], 0.0, 1.0)
        print('MADE %-16s %5d tris %.1fs' % (name, m.tris, time.time() - t0), flush=True)
        save_piece(name, m, kind, n, pitch, ao)
    if WHAT == 'props':
        for name, make in FAR.FAR.items():
            if (ONLY and name not in ONLY) or not os.path.exists(os.path.join(CACHE, name + '.npz')):
                continue
            near = load_piece(name)
            far = FAR.bake_from(make(), near)
            np.savez_compressed(os.path.join(CACHE, name + '__far.npz'), V=far.V.astype(np.float32), T=far.T.astype(np.int32), C=far.C.astype(np.float32), S=far.S, **({'N': far.N.astype(np.float32)} if getattr(far, 'N', None) is not None else {}))
            PIECES[name + '__far'] = {'tris': far.tris, 'size': PIECES[name]['size'], 'lo': PIECES[name]['lo'], 'hi': PIECES[name]['hi'], 'col': []}
            print('FAR   %-16s %5d of %5d tris' % (name, far.tris, near.tris), flush=True)
        for name in ('rock_pillar', 'cliff_rock'):                       # every other row and column of the loft: the same silhouette
            if (ONLY and name not in ONLY) or not os.path.exists(os.path.join(CACHE, name + '.npz')):
                continue
            near = load_piece(name)
            import gen_land
            P = (N.rock_pillar() if name == 'rock_pillar' else gen_land.cliff_rock()).P
            g_ = meshkit.grid(P[::2, ::2], wrap_v=True)
            if np.mean(np.sum(g_.face_normals()[:6] * (g_.corners().mean(axis=1)[:6] - np.array([0.0, 0.0, P[0, :, 2].mean()])), axis=1)) < 0:
                g_ = g_.flip()
            far = FAR.bake_from(g_, near)
            np.savez_compressed(os.path.join(CACHE, name + '__far.npz'), V=far.V.astype(np.float32), T=far.T.astype(np.int32), C=far.C.astype(np.float32), S=far.S)
            PIECES[name + '__far'] = {'tris': far.tris, 'size': PIECES[name]['size'], 'lo': PIECES[name]['lo'], 'hi': PIECES[name]['hi'], 'col': []}
            print('FAR   %-16s %5d of %5d tris' % (name, far.tris, near.tris), flush=True)
        for name, target in DECIM.items():
            if (ONLY and name not in ONLY) or not os.path.exists(os.path.join(CACHE, name + '.npz')):
                continue
            near = load_piece(name)
            far = FAR.bake_from(bl.decimate(near, target), near)
            np.savez_compressed(os.path.join(CACHE, name + '__far.npz'), V=far.V.astype(np.float32), T=far.T.astype(np.int32), C=far.C.astype(np.float32), S=far.S)
            PIECES[name + '__far'] = {'tris': far.tris, 'size': PIECES[name]['size'], 'lo': PIECES[name]['lo'], 'hi': PIECES[name]['hi'], 'col': []}
            print('FAR   %-16s %5d of %5d tris' % (name, far.tris, near.tris), flush=True)
    if WHAT == 'creatures':
        for name, target in CFAR.items():
            if (ONLY and name not in ONLY) or not os.path.exists(os.path.join(CACHE, name + '.npz')):
                continue
            near = load_piece(name)
            low = bl.decimate(near, target)
            lo0, hi0, lo1, hi1 = near.V.min(axis=0), near.V.max(axis=0), low.V.min(axis=0), low.V.max(axis=0)
            low.V = lo0 + (low.V - lo1) * (hi0 - lo0) / np.maximum(hi1 - lo1, 1e-6)      # exactly the near mesh's box: the shaders bend along it
            far = FAR.bake_from(low, near, lit=2.0)
            np.savez_compressed(os.path.join(CACHE, name + '__far.npz'), V=far.V.astype(np.float32), T=far.T.astype(np.int32), C=far.C.astype(np.float32), S=far.S)
            print('FAR   %-16s %5d of %5d tris' % (name, far.tris, near.tris), flush=True)
    json.dump(PIECES, open(PIECES_P, 'w'), indent=0, separators=(',', ':'))
    if not NOEXPORT:
        objs = []
        for name in list(table) + ([n + '__far' for n in list(FAR.FAR) + ['rock_pillar', 'cliff_rock'] + list(DECIM)] if WHAT == 'props' else [n + '__far' for n in CFAR]):
            if os.path.exists(os.path.join(CACHE, name + '.npz')):
                objs.append(bl.shaded_object(name, load_piece(name), mat, sharp_of(name.replace('__far', ''))))
        path = os.path.join(OUT, WHAT + '.glb')
        plan_p = os.path.join(OUT, 'packs.json')
        if '--live' in ARGS:                                             # the map that is live now: all its kinds and every far mesh in one file, without the new seas' kits
            NEW = ('ice_', 'iceberg', 'snow_pine', 'smoker', 'lava_crack', 'forge_hall', 'lamp_ghost', 'rib_bone', 'wreck_bow', 'wreck_stern', 'kelp_spire', 'wreck_stand', 'stair_crown')
            keep = [o for o in objs if not o.name.startswith(NEW)]
            path = os.path.join(OUT, 'live_' + WHAT + '.glb')
            bl.export_glb(path, keep)
            print('EXPORTED', path, os.path.getsize(path), 'objects', len(keep), flush=True)
        elif WHAT == 'props' and os.path.exists(plan_p):                   # the boot pack, then each region's near meshes
            plan = json.load(open(plan_p))
            by = {o.name: o for o in objs}
            bl.export_glb(path, [by[n] for n in plan['boot'] if n in by])
            print('EXPORTED', path, os.path.getsize(path), flush=True)
            for k, names in plan['packs'].items():
                if names:
                    q = os.path.join(OUT, 'props_%s.glb' % k)
                    bl.export_glb(q, [by[n] for n in names if n in by])
                    print('EXPORTED', q, os.path.getsize(q), flush=True)
        else:
            bl.export_glb(path, objs)
            print('EXPORTED', path, os.path.getsize(path), 'objects', len(objs), flush=True)
        for o in objs:
            bl.remove(o)
    for a in (opt('--animals').split(',') if opt('--animals') else []):
        animal(a, mat)
    for a in (opt('--close').split(',') if opt('--close') else []):
        close(a, mat)
    for s in SHEETS:
        names = [n for n in SHEET_ALL()[s] if n in PIECES]
        if names:
            sheet(s, names, mat)


def SHEET_ALL():
    out = dict(SHEET)
    try:
        import gen_creatures as G
        out.update(G.SHEET)
    except ImportError:
        pass
    return out


main()
