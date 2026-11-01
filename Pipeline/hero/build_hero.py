# The Warden, on a real body (Microsoft Rocketbox Sports_Male_01, MIT). Blender 5.2 headless, seeded.
#   $BL -b --factory-startup --python build_hero.py -- [--nopack]
# out/skeleton_hero.json, out/hero_raw.glb, out/hero.blend; then ../../web/assets/hero.glb and moves.json
import bpy, bmesh, json, math, os, random, subprocess, sys, time
import numpy as np
from mathutils import Vector, Quaternion, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import guard; guard.start(os.path.join(HERE, 'out', 'trace_hero.log'))
import base, tex, gear, moves, common
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
T0 = time.time()
def log(*a): print('[%5.1f]' % (time.time() - T0), *a, flush=True)

SEED = moves.SEED; random.seed(SEED); np.random.seed(SEED)
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
ASSETS = os.path.abspath(os.path.join(HERE, '..', '..', 'web', 'assets'))
ASSETS_OUT = os.environ.get('MOVE_ASSETS') or ASSETS       # a private folder while the walls aren't green: the live one is read by everyone
SRC = os.path.join(HERE, 'base_rocketbox', 'Sports_Male_01')

# ------------------------------------------------------------------ the body
d = base.load(os.path.join(SRC, 'Export', 'Sports_Male_01.fbx'), closeR=1.0, closeL=0.86, height=1.85)
co = d['co']; world = d['world']
BONES = common.bone_list()
BI = {b: i for i, b in enumerate(BONES)}
W = base.weights_matrix(d['groups'], BONES)
log('body', co.shape, 'tris', len(d['loop_start']), 'height', d['height'], 'materials', d['mat_names'])

def wt(*names): return sum(W[:, BI[n]] for n in names)
# a heroic build, by the skin's own weights, so nothing tears: shoulders out, chest and arms and thighs fuller, waist in. The head is left alone.
SHOULDER = 0.016
for sgn, S in ((-1, 'R'), (1, 'L')):
    limb = wt('arm_' + S, 'fore_' + S, 'hand_' + S) + 0.62 * wt('clav_' + S)
    co[:, 0] += sgn * SHOULDER * limb
    for n in list(world):
        if n.startswith('Bip01 %s ' % S) and any(k in n for k in ('UpperArm', 'Forearm', 'Hand', 'Finger')): world[n] = world[n] + np.array((sgn * SHOULDER, 0, 0))
J = base.fit_joints(world)
def inflate(bone, a, b, k, kside=None):
    A, B = J[a], J[b]; u = (B - A) / np.linalg.norm(B - A)
    t = (co - A) @ u; q = co - (A + t[:, None] * u)
    co[:] += q * ((k - 1.0) * W[:, BI[bone]])[:, None]
inflate('arm_R', 'arm_R', 'fore_R', 1.13); inflate('arm_L', 'arm_L', 'fore_L', 1.13)
inflate('fore_R', 'fore_R', 'hand_R', 1.09); inflate('fore_L', 'fore_L', 'hand_L', 1.09)
inflate('leg_R', 'leg_R', 'shin_R', 1.06); inflate('leg_L', 'leg_L', 'shin_L', 1.06)
inflate('shin_R', 'shin_R', 'foot_R', 1.06); inflate('shin_L', 'shin_L', 'foot_L', 1.06)
inflate('neck', 'neck', 'head', 1.12)
ch = wt('spine_3'); co[:, 0] *= 1 + 0.055 * ch; co[:, 1] += (np.minimum(co[:, 1], 0.0) * 0.12) * ch          # chest wider, pecs fuller
wa = wt('spine_1', 'spine_2') * np.clip((1.34 - co[:, 2]) / 0.2, 0, 1); co[:, 0] *= 1 - 0.05 * wa         # waist in
J = base.fit_joints(world)

gR, tR = base.grip_of(world, 'R'); gL, tL = base.grip_of(world, 'L')
TOP_BACK_Y = float(co[(co[:, 2] > 1.42) & (co[:, 2] < 1.5) & (np.abs(co[:, 0]) < 0.08)][:, 1].max())
log('grip', gR, tR, 'back', TOP_BACK_Y)

# ------------------------------------------------------------------ the extra bones: mantle and head-band tails, not keyed
cape_z = [1.50, 1.30, 1.10, 0.90, 0.72, 0.56]
cape_top = np.array((0.0, TOP_BACK_Y + 0.012, 1.50))
crown = co[(wt('head') > 0.5) & (np.abs(co[:, 0]) < 0.03) & (co[:, 2] > 1.74)]; hair0 = np.array((0.0, float(crown[:, 1].max()) - 0.004, 1.775))
EXTRA = {}
for i in range(5):
    EXTRA['cape_%d' % (i + 1)] = ('spine_3' if i == 0 else 'cape_%d' % i, (0.0, cape_top[1] + 0.03 * i, cape_z[i]), (0.0, cape_top[1] + 0.03 * (i + 1), cape_z[i + 1]))
for i in range(3):
    EXTRA['hair_%d' % (i + 1)] = ('head' if i == 0 else 'hair_%d' % i, tuple(hair0 + np.array((0, 0.035 * i, -0.125 * i))), tuple(hair0 + np.array((0, 0.035 * (i + 1), -0.125 * (i + 1)))))

skeleton = {'joints': {k: [float(x) for x in v] for k, v in J.items()}, 'grip_R': [float(x) for x in gR], 'grip_L': [float(x) for x in gL], 'shaft_R': [float(x) for x in tR], 'shaft_L': [float(x) for x in tL]}
skeleton['joints']['weapon'] = skeleton['grip_R']
json.dump(skeleton, open(os.path.join(OUT, 'skeleton_hero.json'), 'w'), indent=1)

# ------------------------------------------------------------------ the textures
import paint_hero
atlas_files = paint_hero.paint(d, co, W, BI, J, OUT, SRC, log)

# ------------------------------------------------------------------ the added pieces
g = gear.Gear(random.Random(SEED))
import dress_hero
dress_hero.dress(g, co, W, BI, BONES, J, gR, tR, gL, cape_top, cape_z, hair0, d, log)
log('gear tris', g.tris(), 'body tris', len(d['loop_start']))

# ------------------------------------------------------------------ one mesh, one material, one rig
rig, ob = common.assemble('hero', 'M_hero', co, d, W, BONES, g, J, gR, tR, EXTRA, atlas_files, log)
sk, clips = moves.bake(skeleton)
log('clips', list(clips))
meta = moves.meta(sk, clips)
# the Reaver's own numbers travel in the same file: his windows are read off his own body (build_reaver.py)
prior = os.path.join(ASSETS, 'moves.json')
if os.path.exists(prior):
    was = json.load(open(prior))
    if 'reaver' in was: meta['reaver'] = was['reaver']
json.dump(meta, open(os.path.join(OUT, 'moves.json'), 'w'), indent=1)
common.write_actions(rig, clips, log)
raw = os.path.join(OUT, 'hero_raw.glb')
common.export(rig, ob, raw, log)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'hero.blend'))
if '--nopack' not in ARGS:
    common.pack(raw, os.path.join(ASSETS_OUT, 'hero.glb'), log)
    import shutil; shutil.copy(os.path.join(OUT, 'moves.json'), os.path.join(ASSETS_OUT, 'moves.json'))
    import phone_glb; phone_glb.main(os.path.join(ASSETS_OUT, 'hero.glb'), os.path.join(ASSETS_OUT, 'hero_phone.glb'))
log('done')
