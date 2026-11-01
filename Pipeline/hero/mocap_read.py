# Reads the Rocketbox motion files into plain numbers: per frame, each bone's world turn from its own rest and the joints' places. Blender 5.2, headless:
#   blender -b --factory-startup --python mocap_read.py -- out/mocap_land.json
# Data only: nothing here is shipped. moves.py builds the clips from what this writes.
import bpy, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import guard; guard.start(os.path.join(HERE, 'out', 'trace_mocap.log'))
import base
out_path = sys.argv[sys.argv.index('--') + 1]
FILES = sorted(f for f in os.listdir(os.path.join(HERE, 'mocap', 'rocketbox')) if f.endswith('.fbx'))
out = {}
SRC = os.path.join(HERE, 'base_rocketbox', 'Sports_Male_01')
HERO_FBX = os.path.join(SRC, 'Export', 'Sports_Male_01.fbx')
for f in FILES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(HERE, 'mocap', 'rocketbox', f), automatic_bone_orientation=False, ignore_leaf_bones=False)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    ad = arm.animation_data; act = ad.action if ad else None
    if not act: print('NO ACTION', f); continue
    a, b = int(act.frame_range[0]), int(act.frame_range[1]); scn = bpy.context.scene; fps = scn.render.fps / scn.render.fps_base
    A = arm.matrix_world.copy(); rows = {n: [] for n in base.BIP.values()}; pos = {n: [] for n in base.BIP.values()}
    rest = {base.BIP[n]: list((A @ arm.data.bones[n].matrix_local).to_quaternion()) for n in base.BIP if n in arm.data.bones}
    restp = {base.BIP[n]: list((A @ arm.data.bones[n].matrix_local).to_translation()) for n in base.BIP if n in arm.data.bones}
    for fr in range(a, b + 1):
        scn.frame_set(fr)
        for n, c in base.BIP.items():
            if n not in arm.pose.bones: continue
            M = A @ arm.pose.bones[n].matrix; R = A @ arm.data.bones[n].matrix_local
            D = M.to_quaternion() @ R.to_quaternion().inverted()
            rows[c].append([round(x, 5) for x in D]); pos[c].append([round(x, 4) for x in M.to_translation()])
    out[f.replace('.max.fbx', '')] = dict(fps=fps, a=a, b=b, q=rows, p=pos, restq=rest, restp=restp)
    print('read', f, a, b, fps, flush=True)
# the bones' own frames in the body we dress: a turn read from the motion is put on him through these
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=HERO_FBX, automatic_bone_orientation=False, ignore_leaf_bones=False)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE'); A = arm.matrix_world.copy()
out['_hero'] = dict(restq={base.BIP[n]: list((A @ arm.data.bones[n].matrix_local).to_quaternion()) for n in base.BIP if n in arm.data.bones}, restp={base.BIP[n]: list((A @ arm.data.bones[n].matrix_local).to_translation()) for n in base.BIP if n in arm.data.bones})
json.dump(out, open(out_path, 'w')); print('WROTE', out_path, len(out))
bpy.ops.wm.quit_blender()
