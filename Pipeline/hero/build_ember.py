# The Emberkin, on a real body (Microsoft Rocketbox Military_Male_02, MIT). Blender 5.2 headless, seeded. Same bones as the Warden, so the game's fighter code holds it; its own moves (moves_ember.py).
# No image textures: the skin is lumped into slag here and the fire burns in the game's own shader (web/js/ember.js), so a body of its own costs the phone no texture memory.
#   GLTFPACK_CLI=<path> $BL -b --factory-startup --python build_ember.py --
import bpy, json, math, os, random, sys, time
import numpy as np
from mathutils import kdtree
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import guard; guard.start(os.path.join(HERE, 'out', 'trace_ember.log'))
import base, gear, moves, common, moves_ember, dress_ember
T0 = time.time()
def log(*a): print('[%5.1f]' % (time.time() - T0), *a, flush=True)
SEED = moves.SEED + 7; random.seed(SEED); np.random.seed(SEED)
OUT = os.path.join(HERE, 'out'); ASSETS = os.environ.get('MOVE_ASSETS') or os.path.abspath(os.path.join(HERE, '..', '..', 'web', 'assets'))
SRC = os.path.join(HERE, 'base_rocketbox', 'Military_Male_02')
d = base.load(os.path.join(SRC, 'Export', 'Military_Male_02.fbx'), closeR=0.34, closeL=0.34, height=1.94)
co = d['co']; world = d['world']; BONES = common.bone_list(); BI = {b: i for i, b in enumerate(BONES)}
W = base.weights_matrix(d['groups'], BONES)
log('body', co.shape, 'tris', len(d['loop_start']), 'height', d['height'], d['mat_names'])
J = base.fit_joints(world); gR, tR = base.grip_of(world, 'R'); gL, tL = base.grip_of(world, 'L')
wv = lambda *n: sum(W[:, BI[x]] for x in n)

# the skin goes to slag: lumps a hand across, each cell raised by its own amount and sunk at its edges. Taken with the corners of the UV seams together, so it never opens there
def vertex_normals(co, d):
    n = np.zeros_like(co); ls, lt, cv = d['loop_start'], d['loop_total'], d['corner_v']
    for p in range(len(ls)):
        s, c = int(ls[p]), int(lt[p]); i0 = cv[s]; f = None
        for k in range(1, c - 1):
            a, b = co[cv[s + k]] - co[i0], co[cv[s + k + 1]] - co[i0]; f = np.cross(a, b) if f is None else f + np.cross(a, b)
        for k in range(c): n[cv[s + k]] += f
    key = np.round(co / 0.0002).astype(np.int64); h = key[:, 0] * 73856093 ^ key[:, 1] * 19349663 ^ key[:, 2] * 83492791
    order = np.argsort(h); i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and h[order[j + 1]] == h[order[i]]: j += 1
        if j > i: s = n[order[i:j + 1]].sum(0); n[order[i:j + 1]] = s
        i = j + 1
    l = np.linalg.norm(n, axis=1, keepdims=True); return n / np.maximum(l, 1e-9)
N = vertex_normals(co, d)
CELL = 0.095; lo, hi = co.min(0) - CELL, co.max(0) + CELL; cn = np.ceil((hi - lo) / CELL).astype(int); pts = []
for x in range(cn[0]):
    for y in range(cn[1]):
        for z in range(cn[2]): pts.append(lo + (np.array((x, y, z)) + np.random.random(3)) * CELL)
pts = np.array(pts); tree = kdtree.KDTree(len(pts))
for i, p in enumerate(pts): tree.insert(p, i)
tree.balance(); raise_ = np.random.random(len(pts)); A = np.zeros(len(co))
for i, p in enumerate(co):
    (a, b) = tree.find_n(p, 2); edge = min(1.0, (b[2] - a[2]) / 0.022); A[i] = (0.0035 + 0.0125 * raise_[a[1]]) * edge * edge * (3 - 2 * edge) - 0.003
soft = np.clip(1.0 - 1.2 * wv('hand_R', 'hand_L'), 0.2, 1.0) * np.where(co[:, 2] > 1.58, 0.65, 1.0)        # fingers and the face stay readable as fingers and a face
co = co + N * (A * soft)[:, None]; d['co'] = co
log('slag', float(A.min()), float(A.max()), len(pts))

# the weapon bone stays on the rig for the contract's sake; there's no weapon
back = float(co[(co[:, 2] > 1.42) & (co[:, 2] < 1.5) & (np.abs(co[:, 0]) < 0.08)][:, 1].max())
cape_z = [1.48, 1.28, 1.08, 0.88, 0.70, 0.54]; hair0 = J['head'] + np.array((0, 0.10, 0.08)); EXTRA = {}
for i in range(5): EXTRA['cape_%d' % (i + 1)] = ('spine_3' if i == 0 else 'cape_%d' % i, (0.0, back + 0.04, cape_z[i]), (0.0, back + 0.04, cape_z[i + 1]))
for i in range(3): EXTRA['hair_%d' % (i + 1)] = ('head' if i == 0 else 'hair_%d' % i, tuple(hair0 + np.array((0, 0.0, -0.08 * i))), tuple(hair0 + np.array((0, 0.0, -0.08 * (i + 1)))))
skeleton = {'joints': {k: [float(x) for x in v] for k, v in J.items()}, 'grip_R': [float(x) for x in gR], 'grip_L': [float(x) for x in gL], 'shaft_R': [float(x) for x in tR], 'shaft_L': [float(x) for x in tL]}
skeleton['joints']['weapon'] = skeleton['grip_R']
json.dump(skeleton, open(os.path.join(OUT, 'skeleton_ember.json'), 'w'), indent=1)

g = gear.Gear(random.Random(SEED)); dress_ember.dress(g, co, W, BI, BONES, J, d, [world['Bip01 REye'], world['Bip01 LEye']], log)

# a one-pixel image of each kind: the rig's material asks for them, the game takes them off
import struct, zlib
def pixel(path, rgb):
    raw = b'\0' + bytes(rgb)
    def chunk(t, v): c = struct.pack('>I', len(v)) + t + v; return c + struct.pack('>I', zlib.crc32(t + v) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
files = {}
for k, c in (('albedo', (255, 255, 255)), ('normal', (128, 128, 255)), ('mr', (0, 200, 0)), ('emissive', (0, 0, 0))): files[k] = os.path.join(OUT, 'ember_%s.png' % k); pixel(files[k], c)
rig, ob = common.assemble('ember', 'M_ember', co, d, W, BONES, g, J, gR, tR, EXTRA, files, log)

# the heat of the skin: the body's r mask. Round the heart first, then the hands, the feet and the head; it's what the shader burns by. Written after assembly, since the body's corners carry zeros there
me = ob.data; ma = me.attributes['_MASK']; cv = d['corner_v']; n_body = len(cv); msk = np.zeros(len(me.loops) * 4, dtype=np.float32); ma.data.foreach_get('color', msk); msk = msk.reshape(-1, 4)
heart = np.array((0.0, -0.05, 1.38)); P = co[cv]; r = np.linalg.norm((P - heart) * np.array((1.0, 1.0, 0.8)), axis=1)
ends = wv('hand_R', 'hand_L', 'foot_R', 'foot_L', 'toe_R', 'toe_L')[cv]; headw = (P[:, 2] > 1.62).astype(np.float32)
msk[:n_body, 0] = np.clip(0.30 + 0.70 * np.exp(-(r / 0.20) ** 2) + 0.36 * ends + 0.16 * headw, 0, 1)
ma.data.foreach_set('color', msk.ravel())
log('heat', float(msk[:n_body, 0].min()), float(msk[:n_body, 0].max()))

sk, clips = moves_ember.bake(skeleton); log('clips', {k: c['n'] for k, c in clips.items()})
common.write_actions(rig, clips, log)
json.dump(moves_ember.meta(clips), open(os.path.join(OUT, 'ember_clips.json'), 'w'), indent=1)
raw = os.path.join(OUT, 'ember_raw.glb'); common.export(rig, ob, raw, log)
common.pack(raw, os.path.join(ASSETS, 'ember.glb'), log)
log('size', os.path.getsize(os.path.join(ASSETS, 'ember.glb')))
log('done')
