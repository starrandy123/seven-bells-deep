# A real body under the contract skeleton: read a Rocketbox FBX, close his hands by posing its own finger bones, turn every Bip01 group into our
# bones, and fit our joints to the Bip01 joints. Blender 5.2, run from build_hero.py or build_reaver.py. Everything comes back as plain arrays.
import bpy, math
import numpy as np
from mathutils import Vector, Quaternion

BIP = {'Bip01 Pelvis': 'hips', 'Bip01 Spine': 'spine_1', 'Bip01 Spine1': 'spine_2', 'Bip01 Spine2': 'spine_3', 'Bip01 Neck': 'neck', 'Bip01 Head': 'head',
       'Bip01 R Clavicle': 'clav_R', 'Bip01 R UpperArm': 'arm_R', 'Bip01 R Forearm': 'fore_R', 'Bip01 R Hand': 'hand_R',
       'Bip01 L Clavicle': 'clav_L', 'Bip01 L UpperArm': 'arm_L', 'Bip01 L Forearm': 'fore_L', 'Bip01 L Hand': 'hand_L',
       'Bip01 R Thigh': 'leg_R', 'Bip01 R Calf': 'shin_R', 'Bip01 R Foot': 'foot_R', 'Bip01 R Toe0': 'toe_R',
       'Bip01 L Thigh': 'leg_L', 'Bip01 L Calf': 'shin_L', 'Bip01 L Foot': 'foot_L', 'Bip01 L Toe0': 'toe_L'}

def contract_bone(name):
    if name in BIP: return BIP[name]
    if ' R Finger' in name: return 'hand_R'
    if ' L Finger' in name: return 'hand_L'
    return 'head'                 # eyes, jaw, lips, brows: all of the face rides on the head

def curl_axes(world, side):
    """The hand's own frame at rest: wrist, knuckle middle, its forward (h), its knuckle line (k, pinky to index), palm normal (n)."""
    s = 'R' if side == 'R' else 'L'
    W = world['Bip01 %s Hand' % s]
    idx, pky = world['Bip01 %s Finger1' % s], world['Bip01 %s Finger4' % s]
    K = (idx + world['Bip01 %s Finger2' % s] + world['Bip01 %s Finger3' % s] + pky) / 4
    h = (K - W).normalized(); k = (idx - pky).normalized()
    k = (k - h * k.dot(h)).normalized()
    n = h.cross(k).normalized()
    inward = Vector((1, 0, 0)) if side == 'R' else Vector((-1, 0, 0))
    if n.dot(inward) < 0: n = -n
    return W, K, h, k, n

def pose_hands(arm, world, closeR=1.0, closeL=0.86):
    """Closes both hands round a shaft of about 34 mm by turning the finger bones, in the armature's own pose: the mesh then keeps that shape."""
    to_arm = arm.matrix_world.to_3x3().inverted()
    for side, close in (('R', closeR), ('L', closeL)):
        W, K, h, k, n = curl_axes(world, side)
        for fi, (a, b, c) in zip('1234', ((58, 86, 56), (66, 90, 58), (70, 92, 60), (74, 92, 60))):
            base = 'Bip01 %s Finger%s' % (side, fi)
            names = (base, base + '1', base + '2')
            d0 = (world[names[1]] - world[names[0]]).normalized()
            ax = d0.cross(n).normalized()            # turns the finger towards the palm
            for nm, ang in zip(names, (a, b, c)):
                pb = arm.pose.bones[nm]; bone = arm.data.bones[nm]
                local = (bone.matrix_local.to_3x3().inverted() @ (to_arm @ ax)).normalized()
                pb.rotation_mode = 'QUATERNION'
                pb.rotation_quaternion = Quaternion(local, math.radians(ang * close))
        # the thumb folds across the front of the fingers
        tb = 'Bip01 %s Finger0' % side
        names = (tb, tb + '1', tb + '2')
        ax0 = (h * 0.75 + k * -0.15 + n * 0.45).normalized()
        if side == 'L': pass
        d0 = (world[names[1]] - world[names[0]]).normalized()
        flex = d0.cross(n).normalized()
        for nm, ang, ax in zip(names, (34, 30, 42), (flex, flex, flex)):
            pb = arm.pose.bones[nm]; bone = arm.data.bones[nm]
            local = (bone.matrix_local.to_3x3().inverted() @ (to_arm @ ax)).normalized()
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = Quaternion(local, math.radians(ang * close))
    bpy.context.view_layer.update()

def load(fbx, closeR=1.0, closeL=0.86, height=None):
    """Returns d: co (N,3) posed and scaled to `height`; polys (start, total lists), corner_v; uv (corners, 2); mat (per poly);
    w (N, bones) by BONE_LIST; world joints; grip places; body parts' names."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx, automatic_bone_orientation=False, ignore_leaf_bones=False)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.animation_data_clear()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in bpy.data.objects:
        if o.animation_data: o.animation_data_clear()
    bpy.context.view_layer.update()
    world = {b.name: arm.matrix_world @ b.head_local for b in arm.data.bones}
    tails = {b.name: arm.matrix_world @ b.tail_local for b in arm.data.bones}
    pose_hands(arm, world, closeR, closeL)
    dg = bpy.context.evaluated_depsgraph_get()
    cos, polys_loop_start, polys_total, corner_v, uvs, mats, groups, offset = [], [], [], [], [], [], [], 0
    mat_names = []
    for ob in meshes:
        ev = ob.evaluated_get(dg); me = ev.to_mesh()
        co = np.array([tuple(ob.matrix_world @ v.co) for v in me.vertices], dtype=np.float64)
        cos.append(co)
        L = len(me.loops)
        cv = np.zeros(L, dtype=np.int64); me.loops.foreach_get('vertex_index', cv)
        uv = np.zeros(L * 2, dtype=np.float64); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
        P = len(me.polygons)
        ls = np.zeros(P, dtype=np.int64); lt = np.zeros(P, dtype=np.int64); mi = np.zeros(P, dtype=np.int64)
        me.polygons.foreach_get('loop_start', ls); me.polygons.foreach_get('loop_total', lt); me.polygons.foreach_get('material_index', mi)
        base_mat = len(mat_names)
        mat_names += [m.name for m in ob.data.materials]
        polys_loop_start.append(ls + sum(len(c) for c in corner_v)); polys_total.append(lt)
        corner_v.append(cv + offset); uvs.append(uv); mats.append(mi + base_mat)
        names = [g.name for g in ob.vertex_groups]
        for i, v in enumerate(ob.data.vertices):
            groups.append([(contract_bone(names[g.group]), g.weight) for g in v.groups if g.weight > 1e-4])
        offset += len(co)
        ev.to_mesh_clear()
    co = np.concatenate(cos)
    world = {k: np.array(tuple(v)) for k, v in world.items()}
    tails = {k: np.array(tuple(v)) for k, v in tails.items()}
    z0 = float(co[:, 2].min())
    h = float(co[:, 2].max() - z0)
    k = (height / h) if height else 1.0
    def S(p): return np.array((p[0] * k, p[1] * k, (p[2] - z0) * k))
    co = np.stack((co[:, 0] * k, co[:, 1] * k, (co[:, 2] - z0) * k), axis=1)
    world = {n: S(p) for n, p in world.items()}
    # the FBX has given us its numbers: nothing of it stays in the file
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    for c in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images, bpy.data.actions):
        for x in list(c): c.remove(x)
    return dict(co=co, loop_start=np.concatenate(polys_loop_start), loop_total=np.concatenate(polys_total), corner_v=np.concatenate(corner_v), uv=np.concatenate(uvs),
                mat=np.concatenate(mats), mat_names=mat_names, groups=groups, world=world, scale=k, height=h * k)

def weights_matrix(groups, bones):
    idx = {b: i for i, b in enumerate(bones)}
    W = np.zeros((len(groups), len(bones)), dtype=np.float64)
    for i, g in enumerate(groups):
        for b, w in g: W[i, idx[b]] += w
    s = W.sum(axis=1, keepdims=True); s[s == 0] = 1
    return W / s

def fit_joints(world):
    """Our joints from the Bip01 ones. The contract's hips sit midway up the pelvis (Bip01's Pelvis is down at the hip sockets)."""
    w = world; g = lambda n: w['Bip01 ' + n]
    J = {'root': np.zeros(3), 'hips': (g('Pelvis') + g('Spine')) * 0.5, 'spine_1': g('Spine'), 'spine_2': g('Spine1'), 'spine_3': g('Spine2'), 'neck': g('Neck'), 'head': g('Head')}
    for s, S in (('R', 'R'), ('L', 'L')):
        J['clav_' + s] = g(S + ' Clavicle'); J['arm_' + s] = g(S + ' UpperArm'); J['fore_' + s] = g(S + ' Forearm'); J['hand_' + s] = g(S + ' Hand')
        J['leg_' + s] = g(S + ' Thigh'); J['shin_' + s] = g(S + ' Calf'); J['foot_' + s] = g(S + ' Foot'); J['toe_' + s] = g(S + ' Toe0')
    return J

def grip_of(world, side):
    """The middle of the closed hand and the line of a rod through it, on the thumb side (the point of a held shaft)."""
    wv = {k: Vector(v) for k, v in world.items() if k.startswith('Bip01 %s' % side)}
    W, K, h, k, n = curl_axes(wv, side)
    G = K - h * 0.012 + n * 0.042
    t = (k + h * 0.22).normalized()
    return np.array(tuple(G)), np.array(tuple(t))
