# Drowned City: the Blender side of the kit: decimate, boolean cuts, the GLB export, the preview frames. Runs only inside Blender.
import math
import os
import bpy
import numpy as np
from mathutils import Vector

from meshkit import Mesh, join


def to_object(mesh, name='tmp', link=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(mesh.V.tolist(), [], mesh.T.tolist())
    me.update()
    ob = bpy.data.objects.new(name, me)
    if link:
        bpy.context.scene.collection.objects.link(ob)
    return ob


def from_evaluated(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    V = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', V)
    T = np.zeros(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get('vertices', T)
    ev.to_mesh_clear()
    return Mesh(V.reshape(-1, 3), T.reshape(-1, 3))


def remove(ob):
    me = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)


def decimate(mesh, target):
    """Quadric collapse to about `target` triangles."""
    if mesh.tris <= target:
        return mesh.copy()
    ob = to_object(mesh)
    bpy.context.view_layer.update()
    mod = ob.modifiers.new('d', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = target / float(mesh.tris)
    mod.use_collapse_triangulate = True
    out = from_evaluated(ob)
    remove(ob)
    return out


def cut(mesh, cutters):
    """Boolean difference: each cutter a closed Mesh (a broken edge, a bite). Solver EXACT holds up on these small meshes."""
    ob = to_object(mesh)
    cob = []
    for i, c in enumerate(cutters):
        co = to_object(c, 'cut%d' % i)
        co.hide_render = True
        mod = ob.modifiers.new('b%d' % i, 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = co
        mod.solver = 'EXACT'
        cob.append(co)
    bpy.context.view_layer.update()
    out = from_evaluated(ob)
    for co in cob:
        remove(co)
    remove(ob)
    return out


def shaded_object(name, mesh, material, sharp_deg=38.0):
    """The final Blender object: colours in the corners, smooth by angle, flat where the mesh says flat."""
    me = bpy.data.meshes.new(name)
    me.from_pydata(mesh.V.tolist(), [], mesh.T.tolist())
    me.update()
    me.polygons.foreach_set('use_smooth', mesh.S.astype(bool).tolist())
    me.update()
    try:
        me.set_sharp_from_angle(angle=math.radians(sharp_deg))
    except Exception:
        pass
    if getattr(mesh, 'N', None) is not None:                             # foliage: normals from the clump, not the card
        me.normals_split_custom_set(mesh.N.reshape(-1, 3).tolist())
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    attr.data.foreach_set('color', mesh.C.astype(np.float32).ravel())
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = 0
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def vc_material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    va = nt.nodes.new('ShaderNodeVertexColor')
    va.layer_name = 'Col'
    nt.links.new(va.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.7
    return m


def export_glb(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_yup=True, export_animations=False,
                              export_skins=False, export_materials='EXPORT', export_vertex_color='ACTIVE', export_normals=True, export_texcoords=False,
                              export_tangents=False)


def scene_clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_render(w=1280, h=720, sky=(0.32, 0.52, 0.62), sun=3.0, sun_rot=(50, 0, 35), fill=0.9):
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            pass
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'Standard'
    try:
        sc.eevee.taa_render_samples = 16
    except Exception:
        pass
    wd = bpy.data.worlds.new('w')
    sc.world = wd
    wd.use_nodes = True
    bg = wd.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*sky, 1)
    bg.inputs[1].default_value = fill
    s = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    s.data.energy = sun
    s.rotation_euler = tuple(math.radians(a) for a in sun_rot)
    sc.collection.objects.link(s)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def shoot(cam, path, loc, look, lens=40, ortho=None):
    sc = bpy.context.scene
    cam.location = loc
    d = Vector(look) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.clip_end = 6000
    if ortho:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = ortho
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
