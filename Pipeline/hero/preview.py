# A look at the work: EEVEE renders from the built .blend. Small, because the machine is shared.
#   $BL -b out/hero.blend --python preview.py -- turn                      a turntable sheet in the guard
#   $BL -b out/hero.blend --python preview.py -- strip atk1 [frames=8]     a strip of one clip, side-on and from the front
#   $BL -b out/hero.blend --python preview.py -- swim swim_fast            tilted 80 degrees forward, as the game shows it
#   $BL -b out/hero.blend --python preview.py -- close                     hand, face, torso close-ups
import bpy, math, os, subprocess, sys
from mathutils import Vector
ARGS = sys.argv[sys.argv.index('--') + 1:]
HERE = os.path.dirname(os.path.abspath(__file__)); PV = os.path.join(HERE, 'preview'); os.makedirs(PV, exist_ok=True)
sys.path.insert(0, HERE)
import guard; guard.start(os.path.join(HERE, 'out', 'trace_preview.log'), seconds=170, grow_mb=2200)
NAME = next((a.split('=')[1] for a in ARGS if a.startswith('name=')), 'hero'); ARGS = [a for a in ARGS if not a.startswith('name=')]
sc = bpy.context.scene
rig = bpy.data.objects[NAME + '_rig']; ob = bpy.data.objects[NAME]

for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try: sc.render.engine = eng; break
    except TypeError: pass
try: sc.eevee.taa_render_samples = 16
except Exception: pass
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.render.film_transparent = False

# the material for a look: the atlas times the corner colours, metal and glow as the game will have them
m = ob.data.materials[0]; nt = m.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
alb = bsdf.inputs['Base Color'].links[0].from_node
va = nt.nodes.new('ShaderNodeVertexColor'); va.layer_name = 'Col'
mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
nt.links.new(alb.outputs['Color'], mix.inputs[6]); nt.links.new(va.outputs['Color'], mix.inputs[7]); nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
bsdf.inputs['Emission Strength'].default_value = 3.0

w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.05, 0.27, 0.36, 1); bg.inputs[1].default_value = 0.85
def sun(rx, rz, e, c):
    s = bpy.data.objects.new('s', bpy.data.lights.new('s', 'SUN')); s.data.energy = e; s.data.color = c; s.rotation_euler = (math.radians(rx), 0, math.radians(rz)); sc.collection.objects.link(s)
sun(38, -28, 4.0, (1.0, 0.95, 0.85)); sun(70, 150, 1.6, (0.55, 0.85, 1.0))
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
sc.render.image_settings.file_format = 'PNG'

def look(pos, target, ortho):
    cam.location = pos; d = Vector(target) - Vector(pos); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.ortho_scale = ortho

def action(name):
    rig.animation_data.action = None
    for t in rig.animation_data.nla_tracks: t.mute = t.name != name
    rig.animation_data.use_nla = True
    for t in rig.animation_data.nla_tracks: t.is_solo = t.name == name

def shoot(path, w_, h_):
    sc.render.resolution_x, sc.render.resolution_y = w_, h_; sc.render.filepath = path; bpy.ops.render.render(write_still=True)

def tile(files, out, cols):
    n = len(files); lst = out + '.txt'
    d = os.path.dirname(files[0]); pat = os.path.join(d, 'f_%02d.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '1', '-i', pat, '-vf', 'tile=%dx%d' % (cols, math.ceil(n / cols)), '-frames:v', '1', out], check=True)

def frames_of(name):
    t = rig.animation_data.nla_tracks[name]; return int(t.strips[0].action_frame_end)

mode = ARGS[0]
tmp = os.path.join(PV, '_t'); os.makedirs(tmp, exist_ok=True)
for f in os.listdir(tmp): os.remove(os.path.join(tmp, f))
if mode == 'turn':
    clip = ARGS[1] if len(ARGS) > 1 else 'idle_combat'
    action(clip); sc.frame_set(0)
    views = [(-0, -4), (3, -3), (4, 0), (3, 3), (0, 4), (-3, 3), (-4, 0), (-3, -3)]
    fl = []
    for i, (x, y) in enumerate(views):
        look((x, y, 1.15), (0.0, 0.0, 1.0), 2.5); p = os.path.join(tmp, 'f_%02d.png' % i); shoot(p, 340, 520); fl.append(p)
    tile(fl, os.path.join(PV, '%s_turn_%s.png' % (NAME, clip)), 4)
elif mode == 'strip':
    n = 8
    for clip in ARGS[1:]:
        for f in os.listdir(tmp): os.remove(os.path.join(tmp, f))
        action(clip); end = frames_of(clip); fl = []
        for i in range(n):
            fr = round(end * i / (n - 1)); sc.frame_set(fr)
            look((-2.2, -3.4, 1.35), (0, 0.15, 1.1), 3.0); p = os.path.join(tmp, 'f_%02d.png' % i); shoot(p, 340, 400); fl.append(p)
        tile(fl, os.path.join(PV, '%s_strip_%s.png' % (NAME, clip)), 4)
elif mode == 'side':
    n = 8
    for clip in ARGS[1:]:
        for f in os.listdir(tmp): os.remove(os.path.join(tmp, f))
        action(clip); end = frames_of(clip); fl = []
        for i in range(n):
            fr = round(end * i / n); sc.frame_set(fr)
            look((-4.2, 0.0, 1.0), (0, 0.0, 1.0), 2.6); p = os.path.join(tmp, 'f_%02d.png' % i); shoot(p, 340, 340); fl.append(p)
        tile(fl, os.path.join(PV, '%s_side_%s.png' % (NAME, clip)), 4)
elif mode == 'swim':
    n = 8
    rig.rotation_mode = 'XYZ'; rig.rotation_euler = (math.radians(80), 0, 0); rig.location = (0, 0.9, 0.2)
    for clip in ARGS[1:]:
        for f in os.listdir(tmp): os.remove(os.path.join(tmp, f))
        action(clip); end = frames_of(clip); fl = []
        for i in range(n):
            fr = round(end * i / n); sc.frame_set(fr)
            look((-5.0, 0.0, 0.3), (0, 0.15, 0.2), 3.4); p = os.path.join(tmp, 'f_%02d.png' % i); shoot(p, 340, 230); fl.append(p)
        tile(fl, os.path.join(PV, '%s_swim_%s.png' % (NAME, clip)), 4)
elif mode == 'close':
    clip = ARGS[1] if len(ARGS) > 1 else 'idle_combat'
    action(clip); sc.frame_set(0)
    bpy.context.view_layer.update()
    pb = rig.pose.bones
    def P(b): return rig.matrix_world @ pb[b].head
    fl = []
    shots = [(P('head') + Vector((0.12, 0.05, 0.08)), (0.5, -1.2, 0.2), 0.5), (P('head') + Vector((0.0, 0, 0.08)), (0, 1.2, 0.2), 0.5), (P('spine_3') + Vector((0, 0, 0.05)), (0, -1.2, 0.1), 0.95), (P('hand_R'), (-0.8, -0.8, 0.3), 0.45)]
    for i, (t, d, o) in enumerate(shots):
        look(t + Vector(d) * 2, t, o); p = os.path.join(tmp, 'f_%02d.png' % i); shoot(p, 420, 420); fl.append(p)
    tile(fl, os.path.join(PV, '%s_close.png' % NAME), 4)
print('PREVIEW done')
