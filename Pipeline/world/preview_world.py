# Drowned City: looks at the world as placed: the delivered height.bin and world.json, the cached pieces, a camera at a swimmer's eye. Only for judging layout: the real look is in the browser.
#   $BL -b --factory-startup --python preview_world.py -- <shot,shot,...>
# Lit windows and flames glow here too, by the same rule as the look (max rgb >= 0.95, or the lamp's flame), so a city can be judged from 150 m.
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'hero'))
import guard                                    # a runaway job ends itself: swap and time limits, the machine's hard rule
guard.start(os.path.join(HERE, 'out', 'guard_%s.log' % os.path.basename(__file__)), seconds=170, grow_mb=1500)
import bpy
import numpy as np
from mathutils import Vector

from meshkit import Mesh, grid
import bl

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
A = os.environ.get('WORLD_ASSETS') or os.path.abspath(os.path.join(HERE, '..', '..', 'web', 'assets'))
W = json.load(open(os.path.join(A, 'world.json')))
G = W['grid']
TOP = W.get('top_m', 0.0)
SPAN = TOP + W['depth_scale_m']
import terrainfile
Hz = TOP - terrainfile.height(A, G) / 65535.0 * SPAN
NB = (G - 1) // 2 + 1
BI = terrainfile.biome(A, 'biome', NB) / 255.0
OX, STEP = W['origin'][0], W['size_m'] / (G - 1.0)
OUT = os.path.join(HERE, 'preview')
CACHE = os.path.join(HERE, 'out', 'cache')

ar = W['arena']
pts = {p['id']: p for p in W['poi']}
SHOTS = {
    # name: camera (x, y, z), look at, lens, how far to draw, what colour the water is
    'thalor': ((20.0, -262.0, -30.0), (20.0, -96.0, -35.0), 28, 520, (0.03, 0.2, 0.3)),
    'avenue': ((20.0, -190.0, -50.0), (20.0, -96.0, -24.0), 24, 300, (0.03, 0.2, 0.3)),
    'arena': ((ar['x'] - 34.0, ar['y'] - 2.0, ar['z'] + 11.0), (ar['x'] + 22.0, ar['y'] + 26.0, ar['z'] + 12.0), 22, 200, (0.03, 0.2, 0.3)),
    'arena_top': ((ar['x'] - 60.0, ar['y'] - 84.0, ar['z'] + 60.0), (ar['x'], ar['y'], ar['z'] + 6.0), 30, 300, (0.03, 0.2, 0.3)),
    'meridon': ((278.0, 176.0, -34.0), (452.0, 256.0, -40.0), 30, 460, (0.02, 0.1, 0.18)),
    'vesper': ((-205.0, 420.0, -176.0), (-205.0, 590.0, -150.0), 26, 330, (0.005, 0.02, 0.05)),
    'sunward': ((-82.0, -432.0, 10.0), (-300.0, -470.0, 18.0), 34, 460, (0.55, 0.72, 0.85)),
    'temple': ((-262.0, -486.0, 56.0), (-336.0, -470.0, 62.0), 28, 260, (0.55, 0.72, 0.85)),
    'crown': ((210.0, -430.0, 16.0), (402.0, -214.0, 40.0), 32, 560, (0.55, 0.72, 0.85)),
    'kelp': ((-300.0, 28.0, -52.0), (-430.0, 30.0, -40.0), 26, 260, (0.02, 0.12, 0.14)),
    'map': ((0.0, 0.0, 1400.0), (0.0, 0.0, 0.0), None, 2000, (0.05, 0.25, 0.4)),
}


def ground_mesh(cx, cy, reach, step=2):
    """The terrain near the camera, sampled from the delivered height, coloured by the delivered biome."""
    i0 = int(max((cx - reach - OX) / STEP, 0)) // step * step
    i1 = int(min((cx + reach - OX) / STEP, G - 1))
    j0 = int(max((cy - reach - OX) / STEP, 0)) // step * step
    j1 = int(min((cy + reach - OX) / STEP, G - 1))
    ii = np.arange(i0, i1 + 1, step)
    jj = np.arange(j0, j1 + 1, step)
    X, Y = np.meshgrid(OX + ii * STEP, OX + jj * STEP)
    Z = Hz[np.ix_(jj, ii)]
    m = grid(np.stack([X, Y, Z], 2))
    if m.face_normals()[0, 2] < 0:
        m = m.flip()
    b = BI[np.ix_(jj // 2, ii // 2)]
    land = Z > 0
    pal_sea = np.array([[0.72, 0.65, 0.46], [0.2, 0.26, 0.14], [0.46, 0.46, 0.41], [0.05, 0.06, 0.09]])
    pal_land = np.array([[0.9, 0.84, 0.66], [0.14, 0.3, 0.1], [0.6, 0.58, 0.52], [0.04, 0.04, 0.05]])
    col = b @ pal_sea
    col[land] = (b @ pal_land)[land]
    C = col.reshape(-1, 3)
    m.C[..., :3] = C[m.T]
    return m


def glow_material():
    mat = bpy.data.materials.new('M_world')
    mat.use_nodes = True
    mat.use_backface_culling = False
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    va = nt.nodes.new('ShaderNodeVertexColor')
    va.layer_name = 'Col'
    nt.links.new(va.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.8
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(va.outputs['Color'], sep.inputs[0])
    mx = nt.nodes.new('ShaderNodeMath')
    mx.operation = 'MAXIMUM'
    nt.links.new(sep.outputs[0], mx.inputs[0])
    nt.links.new(sep.outputs[1], mx.inputs[1])
    mx2 = nt.nodes.new('ShaderNodeMath')
    mx2.operation = 'MAXIMUM'
    nt.links.new(mx.outputs[0], mx2.inputs[0])
    nt.links.new(sep.outputs[2], mx2.inputs[1])
    gt = nt.nodes.new('ShaderNodeMath')
    gt.operation = 'GREATER_THAN'
    gt.inputs[1].default_value = 0.94
    nt.links.new(mx2.outputs[0], gt.inputs[0])
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(va.outputs['Color'], em.inputs['Color'])
    em.inputs['Strength'].default_value = 7.0
    ms = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(gt.outputs[0], ms.inputs[0])
    nt.links.new(bsdf.outputs[0], ms.inputs[1])
    nt.links.new(em.outputs[0], ms.inputs[2])
    nt.links.new(ms.outputs[0], out.inputs['Surface'])
    return mat


def load_piece(name):
    z = np.load(os.path.join(CACHE, name + '.npz'))
    m = Mesh(z['V'], z['T'])
    m.C = z['C']
    m.S = z['S']
    return m


def shot(name):
    cam_p, look, lens, reach, water = SHOTS[name]
    bl.scene_clear()
    mat = glow_material()
    sc = bpy.context.scene
    underwater = cam_p[2] < 0
    cam = bl.setup_render(1280, 640, sky=water, sun=1.8 if not underwater else 1.3, sun_rot=(38, 0, 30), fill=1.0 if not underwater else 0.7)
    sc.render.film_transparent = False
    cx, cy = (cam_p[0] + look[0]) / 2.0 + 0.0, (cam_p[1] + look[1]) / 2.0
    g = bl.shaded_object('ground', ground_mesh(cam_p[0], cam_p[1], reach, 4 if name == 'map' else 2), mat, 180.0)
    d = np.array(look) - np.array(cam_p)
    d = d / np.linalg.norm(d)
    n_inst = 0
    libs = {}
    coll = bpy.data.collections.new('w')
    sc.collection.children.link(coll)
    for nm, rows in W['instances'].items():
        if not os.path.exists(os.path.join(CACHE, nm + '.npz')):
            continue
        R = np.array(rows).reshape(-1, 6)
        dx, dy = R[:, 0] - cam_p[0], R[:, 1] - cam_p[1]
        dist = np.hypot(dx, dy)
        vis = (dist < reach) & (((dx * d[0] + dy * d[1]) > -40.0) | (name == 'map'))
        if name == 'map' and nm in ('seagrass', 'grass_tuft', 'fern'):
            continue
        R = R[vis]
        if not len(R):
            continue
        lib = bl.shaded_object('lib_' + nm, load_piece(nm), mat, 60.0)
        lib.hide_render = True
        lib.hide_viewport = True
        for r in R:
            o = bpy.data.objects.new(nm, lib.data)
            o.location = (r[0], r[1], r[2])
            o.rotation_euler = (0.0, 0.0, r[3])
            o.scale = (r[4], r[4], r[4])
            coll.objects.link(o)
            n_inst += 1
    print('SHOT', name, 'instances', n_inst, flush=True)
    if lens is None:
        bl.shoot(cam, os.path.join(OUT, 'world_%s.png' % name), cam_p, look, ortho=1300.0)
    else:
        bl.shoot(cam, os.path.join(OUT, 'world_%s.png' % name), cam_p, look, lens=lens)


for s in (ARGS[0].split(',') if ARGS else ['thalor']):
    shot(s)
