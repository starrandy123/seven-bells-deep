# The Reaver, on a real body (Microsoft Rocketbox Military_Male_02, MIT). Blender 5.2 headless, seeded. Same bones and clip names as the Warden; his moves are solved again
# on this body, with a hunch added.   $BL -b --factory-startup --python build_reaver.py --
import bpy, json, math, os, random, sys, time
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import guard; guard.start(os.path.join(HERE, 'out', 'trace_reaver.log'))
import base, tex, gear, moves, common, paint_reaver, dress_reaver
T0 = time.time()
def log(*a): print('[%5.1f]' % (time.time() - T0), *a, flush=True)
SEED = moves.SEED + 1; random.seed(SEED); np.random.seed(SEED)
OUT = os.path.join(HERE, 'out'); ASSETS = os.path.abspath(os.path.join(HERE, '..', '..', 'web', 'assets'))
ASSETS = os.environ.get('MOVE_ASSETS') or ASSETS       # a private folder while the walls aren't green
SRC = os.path.join(HERE, 'base_rocketbox', 'Military_Male_02')
d = base.load(os.path.join(SRC, 'Export', 'Military_Male_02.fbx'), closeR=1.0, closeL=0.9, height=1.80)
co = d['co']; world = d['world']; BONES = common.bone_list(); BI = {b: i for i, b in enumerate(BONES)}
W = base.weights_matrix(d['groups'], BONES)
log('body', co.shape, 'tris', len(d['loop_start']), 'height', d['height'], d['mat_names'])
J = base.fit_joints(world); gR, tR = base.grip_of(world, 'R'); gL, tL = base.grip_of(world, 'L')
back = float(co[(co[:, 2] > 1.42) & (co[:, 2] < 1.5) & (np.abs(co[:, 0]) < 0.08)][:, 1].max())
cape_z = [1.48, 1.28, 1.08, 0.88, 0.70, 0.54]; hair0 = J['head'] + np.array((0, 0.10, 0.08)); EXTRA = {}
for i in range(5): EXTRA['cape_%d' % (i + 1)] = ('spine_3' if i == 0 else 'cape_%d' % i, (0.0, back + 0.04, cape_z[i]), (0.0, back + 0.04, cape_z[i + 1]))
for i in range(3): EXTRA['hair_%d' % (i + 1)] = ('head' if i == 0 else 'hair_%d' % i, tuple(hair0 + np.array((0, 0.0, -0.08 * i))), tuple(hair0 + np.array((0, 0.0, -0.08 * (i + 1)))))
skeleton = {'joints': {k: [float(x) for x in v] for k, v in J.items()}, 'grip_R': [float(x) for x in gR], 'grip_L': [float(x) for x in gL], 'shaft_R': [float(x) for x in tR], 'shaft_L': [float(x) for x in tL],
            'bias': {'spine': (-32, 0, 0), 'head': (28, 0, 0)}}
skeleton['joints']['weapon'] = skeleton['grip_R']
json.dump(skeleton, open(os.path.join(OUT, 'skeleton_reaver.json'), 'w'), indent=1)
files, layout = paint_reaver.paint(d, co, W, BI, J, OUT, SRC, log)
g = gear.Gear(random.Random(SEED)); dress_reaver.dress(g, co, W, BI, BONES, J, gR, tR, d, [world['Bip01 REye'], world['Bip01 LEye']], log)
rig, ob = common.assemble('reaver', 'M_reaver', co, d, W, BONES, g, J, gR, tR, EXTRA, files, log, layout=layout)
sk, clips = moves.bake(skeleton, moves.REAVER_CLIPS); log('clips', list(clips))
common.write_actions(rig, clips, log)
# his hit windows, reach and arc, read from his own spear's real path: the hunch changes all three
path = os.path.join(ASSETS, 'moves.json'); table = json.load(open(path)) if os.path.exists(path) else {}
table['reaver'] = moves.meta(sk, clips); json.dump(table, open(path, 'w'), indent=1); log('reaver windows', {k: (v['hit'], v['reach']) for k, v in table['reaver'].items() if v['hit']})
raw = os.path.join(OUT, 'reaver_raw.glb'); common.export(rig, ob, raw, log)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'reaver.blend'))
common.pack(raw, os.path.join(ASSETS, 'reaver.glb'), log)
import phone_glb; phone_glb.main(os.path.join(ASSETS, 'reaver.glb'), os.path.join(ASSETS, 'reaver_phone.glb'))       # the phone's: textures at half size, about 4 MB less in memory
log('done')
