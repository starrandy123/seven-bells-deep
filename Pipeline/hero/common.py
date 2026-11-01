# What the Warden and the Reaver share: the bone list, the mesh + rig assembly, the actions, the export and the packing.
import bpy, bmesh, json, math, os, struct, subprocess
import numpy as np
from mathutils import Vector, Quaternion, Matrix
from mathutils.bvhtree import BVHTree
import moves

HERE = os.path.dirname(os.path.abspath(__file__))
GP = os.environ.get('GLTFPACK_CLI') or os.path.join(HERE, '..', 'node_modules', 'gltfpack', 'cli.js')       # node_modules is a relative link: a git worktree sits too deep for it, and names the tool here

def bone_list():
    return list(moves.ORDER) + ['weapon_tip'] + ['cape_%d' % i for i in range(1, 6)] + ['hair_%d' % i for i in range(1, 4)]

def top4(W):
    """Four influences at most, summing to one."""
    idx = np.argsort(-W, axis=1)[:, :4]
    out = np.zeros_like(W); r = np.arange(len(W))[:, None]
    out[r, idx] = W[r, idx]
    s = out.sum(axis=1, keepdims=True); s[s == 0] = 1
    return out / s

def make_rig(name, J, gR, tR, EXTRA):
    ad = bpy.data.armatures.new(name + '_rig'); ao = bpy.data.objects.new(name + '_rig', ad)
    bpy.context.scene.collection.objects.link(ao); bpy.context.view_layer.objects.active = ao; ao.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    pos = {k: Vector(tuple(v)) for k, v in J.items()}
    gv, tv = Vector(tuple(gR)), Vector(tuple(tR))
    pos['weapon'] = gv
    tail = {'root': pos['root'] + Vector((0, 0, 0.1)), 'hips': pos['spine_1'], 'spine_1': pos['spine_2'], 'spine_2': pos['spine_3'], 'spine_3': pos['neck'], 'neck': pos['head'],
            'head': pos['head'] + Vector((0, 0, 0.2)), 'weapon': gv + tv * 0.3}
    for s in 'RL':
        tail.update({'clav_' + s: pos['arm_' + s], 'arm_' + s: pos['fore_' + s], 'fore_' + s: pos['hand_' + s],
                     'leg_' + s: pos['shin_' + s], 'shin_' + s: pos['foot_' + s], 'foot_' + s: pos['toe_' + s], 'toe_' + s: pos['toe_' + s] + Vector((0, -0.07, 0))})
    tail['hand_R'] = gv
    tail['hand_L'] = pos['hand_L'] + (pos['hand_L'] - pos['fore_L']).normalized() * 0.09
    for b in moves.ORDER:
        e = ad.edit_bones.new(b); e.head = pos[b]; e.tail = tail[b]; e.use_connect = False
    for b in moves.ORDER:
        if moves.PARENT[b]: ad.edit_bones[b].parent = ad.edit_bones[moves.PARENT[b]]
    e = ad.edit_bones.new('weapon_tip'); e.head = gv + tv * moves.TIP_LEN; e.tail = gv + tv * (moves.TIP_LEN + 0.1); e.parent = ad.edit_bones['weapon']
    for b, (par, h, t) in EXTRA.items():
        e = ad.edit_bones.new(b); e.head = Vector(h); e.tail = Vector(t); e.parent = ad.edit_bones[par]; e.align_roll(Vector((0, 1, 0)))
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ao.pose.bones: pb.rotation_mode = 'QUATERNION'
    return ao

def shade_corners(me, V, faces, msk, log, rays=12, reach=0.11, floor=0.42):
    """Ambient shade, baked per vertex with rays in the rest pose and multiplied into COLOR_0, so armour sits on the body and the folds have depth under any light.
    Lines of light are left out."""
    tris = []
    for f in faces:
        for k in range(1, len(f) - 1): tris.append((f[0], f[k], f[k + 1]))
    pts = [tuple(p) for p in V.tolist()]
    bvh = BVHTree.FromPolygons(pts, tris, all_triangles=True)
    nrm = np.zeros_like(V)
    for f in faces:
        a, b, c = V[f[0]], V[f[1]], V[f[2]]
        nrm[list(f)] += np.cross(b - a, c - a)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    # a fixed, even fan of directions
    fan = []
    for i in range(rays):
        y = 1 - (i + 0.5) / rays; r = math.sqrt(max(1 - y * y, 0)); a = i * 2.39996
        fan.append((math.cos(a) * r, math.sin(a) * r, y))
    ao = np.ones(len(V))
    for i in range(len(V)):
        n = Vector(nrm[i]); t = n.orthogonal().normalized(); b = n.cross(t)
        o = Vector(V[i]) + n * 0.003; hit = 0.0
        for fx, fy, fz in fan:
            d = t * fx + b * fy + n * fz
            r = bvh.ray_cast(o, d, reach)
            if r[0] is not None: hit += fz * (1.0 - r[3] / reach * 0.6)
        ao[i] = hit
    ao = np.clip(1.0 - ao / (0.5 * rays) * 1.15, floor, 1.0)
    data = np.zeros(len(me.loops) * 4, dtype=np.float32); ca = me.color_attributes['Col']; ca.data.foreach_get('color', data); data = data.reshape(-1, 4)
    cv = np.zeros(len(me.loops), dtype=np.int64); me.loops.foreach_get('vertex_index', cv)
    k = ao[cv]
    M = np.array(msk, dtype=np.float32)
    k[M[:, 1] > 0.5] = 1.0
    k[np.abs(M[:, 3] - 0.02) < 1e-4] = 0.94            # the small bosses keep their metal
    # on the bronze the shade turns to patina: green settles in the crevices and the open faces keep their light
    metal = M[:, 2] > 0.75
    P = V[cv]
    mott = 0.5 + 0.5 * np.sin(P[:, 0] * 23.0 + 1.1) * np.sin(P[:, 1] * 29.0 + 0.4) * np.sin(P[:, 2] * 19.0 + 2.3)       # broad soft patches, 10 cm or so: age, never grain
    p_ = np.maximum(np.clip((1.0 - k) ** 0.7 * 2.5 - 0.10, 0.0, 0.85), np.clip((mott - 0.58) * 1.5, 0.0, 0.42))[:, None]
    verd = np.array((0.085, 0.235, 0.185), dtype=np.float32)
    rgb = data[:, :3] * k[:, None]
    rgb[metal] = (data[:, :3] * (0.62 + 0.38 * k[:, None]))[metal] * (1 - p_[metal]) + verd * p_[metal]
    data[:, :3] = rgb
    ca.data.foreach_set('color', data.ravel())
    log('shade', 'mean %.3f min %.3f' % (ao.mean(), ao.min()))

def assemble(name, mat_name, co, d, W, BONES, g, J, gR, tR, EXTRA, files, log, vert_ao=None, layout=None):
    """Body + gear in one mesh: UVs into the atlas, COLOR_0 white on the skin (or its baked shade), _MASK per corner."""
    nb = len(co)
    gv = np.array(g.v, dtype=np.float64).reshape(-1, 3)
    V = np.concatenate((co, gv)) if len(gv) else co
    cv, ls, lt, uvb, mats = d['corner_v'], d['loop_start'], d['loop_total'], d['uv'], d['mat']
    head_i = next((i for i, n in enumerate(d['mat_names']) if 'head' in n.lower()), 1)
    (hv0, hdv), (bv0, bdv) = layout or ((0.0, 0.5), (0.5, 0.5))           # where each block sits, as (start, height) in the atlas's v
    faces = []; uv = []; col = []; msk = []; hard = []
    for p in range(len(ls)):
        s, n = int(ls[p]), int(lt[p]); f = tuple(int(x) for x in cv[s:s + n]); faces.append(f); hard.append(False)
        hd = mats[p] == head_i
        for c in range(s, s + n):
            u, v = min(max(float(uvb[c, 0]), 0.0), 1.0), min(max(float(uvb[c, 1]), 0.0), 1.0)
            uv.append((u, hv0 + hdv * v if hd else bv0 + bdv * v))
            shade = 1.0 if vert_ao is None else float(vert_ao[cv[c]])
            col.append((shade, shade, shade, 1.0)); msk.append((0.0, 0.0, 0.0, 0.0))
    for i, f in enumerate(g.f):
        faces.append(tuple(a + nb for a in f)); hard.append(g.hard[i])
        c = g.col[i]; m = g.mask[i]
        for k in range(len(f)):
            cc = c[k] if isinstance(c, list) else c
            uv.append(tuple(g.uv[i][k])); col.append((cc[0], cc[1], cc[2], 1.0)); msk.append(tuple(m))
    me = bpy.data.meshes.new(name)
    me.from_pydata(V.tolist(), [], faces)
    me.update()
    L = len(me.loops)
    assert L == len(uv), (L, len(uv))
    ul = me.uv_layers.new(name='UV'); ul.data.foreach_set('uv', np.array(uv, dtype=np.float32).ravel())
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER'); ca.data.foreach_set('color', np.array(col, dtype=np.float32).ravel())
    ma = me.attributes.new('_MASK', 'FLOAT_COLOR', 'CORNER'); ma.data.foreach_set('color', np.array(msk, dtype=np.float32).ravel())
    me.color_attributes.active_color = me.color_attributes['Col']; me.color_attributes.render_color_index = me.color_attributes.find('Col')
    shade_corners(me, V, faces, msk, log)
    # smooth everywhere; hard edges on the bronze only
    me.shade_smooth()
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); lim = math.radians(38)
    for e in bm.edges:
        lf = e.link_faces
        if len(lf) == 2 and (hard[lf[0].index] or hard[lf[1].index]) and e.calc_face_angle(0.0) > lim: e.smooth = False
    bm.to_mesh(me); bm.free()
    me.color_attributes.active_color = me.color_attributes['Col']; me.color_attributes.render_color_index = me.color_attributes.find('Col')
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    # weights
    Wb = top4(W)
    groups = {b: ob.vertex_groups.new(name=b) for b in BONES}
    for i in range(nb):
        for b in np.nonzero(Wb[i])[0]: groups[BONES[b]].add([i], float(Wb[i, b]), 'REPLACE')
    for i, w in enumerate(g.w):
        tot = sum(w.values()); items = sorted(w.items(), key=lambda kv: -kv[1])[:4]; tot = sum(v for _, v in items)
        for b, x in items:
            if x > 0: groups[b].add([nb + i], x / tot, 'REPLACE')
    # the rig
    rig = make_rig(name, J, gR, tR, EXTRA)
    ob.parent = rig; mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = rig
    # the material
    m = bpy.data.materials.new(mat_name); m.use_nodes = True; nt = m.node_tree; bsdf = nt.nodes.get('Principled BSDF')
    def image(path, noncolor):
        im = bpy.data.images.load(path); im.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = im; return n
    alb = image(files['albedo'], False); nt.links.new(alb.outputs['Color'], bsdf.inputs['Base Color'])
    nrm = image(files['normal'], True); nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(nrm.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    mr = image(files['mr'], True); sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(mr.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness']); nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    em = image(files['emissive'], False); nt.links.new(em.outputs['Color'], bsdf.inputs['Emission Color']); bsdf.inputs['Emission Strength'].default_value = 1.0
    m.use_backface_culling = False
    me.materials.append(m)
    log('mesh verts', len(me.vertices), 'tris', sum(len(f) - 2 for f in faces))
    return rig, ob

def write_actions(rig, clips, log):
    """Every clip as one action on its own NLA track. Turns come in rest-aligned axes; a pose bone wants them in its own."""
    rig.animation_data_create()
    R = {b.name: b.matrix_local.to_quaternion() for b in rig.data.bones}
    for name, c in clips.items():
        act = bpy.data.actions.new(name); act.use_fake_user = True
        slot = act.slots.new(id_type='OBJECT', name=rig.name)
        layer = act.layers.new('L'); strip = layer.strips.new(type='KEYFRAME'); cb = strip.channelbags.new(slot)
        n = c['n']; frames = np.arange(n + 1, dtype=np.float32)
        for b in moves.KEYED:
            r = R[b]; ri = r.inverted(); qs = np.zeros((n + 1, 4), dtype=np.float32); prev = None
            for i in range(n + 1):
                q = ri @ Quaternion(c['q'][b][i]) @ r
                v = np.array((q.w, q.x, q.y, q.z), dtype=np.float32)
                if prev is not None and v.dot(prev) < 0: v = -v
                qs[i] = v; prev = v
            if b != 'hips' and np.abs(qs - qs[0]).max() < 1e-5 and abs(qs[0, 0] - 1) < 1e-5: continue
            path = 'pose.bones["%s"].rotation_quaternion' % b
            for k in range(4):
                fc = cb.fcurves.new(path, index=k, group_name=b)
                fc.keyframe_points.add(n + 1); fc.keyframe_points.foreach_set('co', np.stack((frames, qs[:, k]), 1).ravel()); fc.update()
        r = R['hips'].inverted(); os_ = np.array([tuple(r @ Vector(o)) for o in c['off']], dtype=np.float32)
        path = 'pose.bones["hips"].location'
        for k in range(3):
            fc = cb.fcurves.new(path, index=k, group_name='hips')
            fc.keyframe_points.add(n + 1); fc.keyframe_points.foreach_set('co', np.stack((frames, os_[:, k]), 1).ravel()); fc.update()
        tr = rig.animation_data.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, 0, act); tr.mute = False
    log('actions', len(clips))

def export(rig, ob, raw, log, also=()):
    sc = bpy.context.scene; sc.render.fps = 30; sc.frame_start = 0
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = rig
    for o in also: o.select_set(True)       # a second mesh on the same rig
    bpy.ops.export_scene.gltf(filepath=raw, export_format='GLB', use_selection=True, export_yup=True, export_apply=False, export_image_format='AUTO',
                              export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1, export_anim_slide_to_zero=False,
                              export_skins=True, export_morph=False, export_attributes=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_materials='EXPORT', export_def_bones=False,
                              export_texcoords=True, export_normals=True, export_tangents=False, export_optimize_animation_size=False, export_leaf_bone=False, export_rest_position_armature=True)
    log('raw', os.path.getsize(raw))

def glb_read(path):
    b = open(path, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + n]), b[20 + n:]

def glb_write(path, j, rest):
    s = json.dumps(j, separators=(',', ':')).encode()
    s += b' ' * ((4 - len(s) % 4) % 4)
    total = 12 + 8 + len(s) + len(rest)
    open(path, 'wb').write(b'glTF' + struct.pack('<II', 2, total) + struct.pack('<I', len(s)) + b'JSON' + s + rest)

def pack(raw, out, log, extra=()):
    """gltfpack drops custom attributes but keeps a second colour set. So _MASK crosses it as COLOR_1, and gets its contract name back on the far side.
    (Blender's own export_all_vertex_colors can't do this: with it on, COLOR_0 comes out solid white.)"""
    j, rest = glb_read(raw)
    for mesh in j['meshes']:
        for pr in mesh['primitives']:
            a = pr['attributes']
            if '_MASK' in a: a['COLOR_1'] = a.pop('_MASK')
    mid = raw.replace('_raw.glb', '_mid.glb'); glb_write(mid, j, rest)
    tmp = raw.replace('_raw.glb', '_pk.glb')
    subprocess.run(['node', GP, '-i', mid, '-o', tmp, '-cc', '-kn', '-km', '-kv', '-vn', '10', '-ar', '14'] + list(extra), check=True, stdout=subprocess.DEVNULL)
    os.remove(mid)
    j, rest = glb_read(tmp)
    for mesh in j['meshes']:
        for pr in mesh['primitives']:
            a = pr['attributes']
            assert 'COLOR_0' in a and 'COLOR_1' in a, list(a)
            a['_MASK'] = a.pop('COLOR_1')
    glb_write(out, j, rest)
    log('packed', out, os.path.getsize(out), 'animations', len(j.get('animations', [])), 'images', [(im.get('mimeType'), j['bufferViews'][im['bufferView']]['byteLength']) for im in j.get('images', [])])
