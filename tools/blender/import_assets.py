"""Clean downloaded glTF models and export game-ready Draco GLBs (repeatable, driven by tools/assets/manifest.json).

  blender -b --factory-startup --python tools/blender/import_assets.py -- --src <extracted dir> [--only a,b] [--preview DIR]

Source models are untrusted data: this only reads geometry/images through Blender's importer and never runs anything
from them. Mode "fish": bake the pose at `frame` into one static mesh, nose +x, back +y (glTF), length `length`,
decimate to `tris`, textures <= `tex` px, export WEBP textures + Draco. The game animates it with the same vertex
swim wave as the procedural fish, so no skeleton is exported.
(Mode "rigged" for animals with clips is not implemented yet.)
"""
import bpy, sys, os, json, math, bmesh
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
SRC = arg('--src')
ONLY = arg('--only').split(',') if arg('--only') else None
PREVIEW = arg('--preview')
OUT_DIR = os.path.join(ROOT, 'public', 'models')
AX = {'x': Vector((1, 0, 0)), 'y': Vector((0, 1, 0)), 'z': Vector((0, 0, 1))}

def axis(s):
    v = AX[s[-1]].copy()
    return -v if s.startswith('-') else v

def bake_to_single_mesh(frame, drop=()):
    bpy.context.scene.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    made = []
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        if not any(m for m in o.data.materials) or o.name in drop:   # Sketchfab bone-display icospheres have no material
            continue
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        me.transform(o.matrix_world)
        n = bpy.data.objects.new(o.name, me)
        bpy.context.scene.collection.objects.link(n)
        made.append(n)
    for o in [o for o in bpy.data.objects if o not in made]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in made:
        o.select_set(True)
    bpy.context.view_layer.objects.active = made[0]
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active

def orient(o, head, up, length):
    x = axis(head); z = axis(up); y = z.cross(x)
    R = Matrix(((x.x, x.y, x.z, 0), (y.x, y.y, y.z, 0), (z.x, z.y, z.z, 0), (0, 0, 0, 1)))
    o.data.transform(R)
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for v in o.data.vertices:
        for i in range(3):
            mn[i] = min(mn[i], v.co[i]); mx[i] = max(mx[i], v.co[i])
    s = length / (mx.x - mn.x)
    o.data.transform(Matrix.Translation(-(mn + mx) / 2))
    o.data.transform(Matrix.Scale(s, 4))
    return s

def apply_diffuse(path):
    # specular-glossiness sources import without a colour texture: wire the diffuse map to Base Color
    img = bpy.data.images.load(path)
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf or bsdf.inputs['Base Color'].is_linked:
            continue
        t = next((n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and 'diffuse' in n.image.name.lower()), None)
        if not t:
            t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = img
        m.node_tree.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.45

def decimate(o, tris):
    o.data.calc_loop_triangles()
    n = len(o.data.loop_triangles)
    if n <= tris:
        return n
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free()
    m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = tris / n
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)

def shrink_textures(maxpx):
    for im in bpy.data.images:
        if im.size[0] == 0:
            continue
        w, h = im.size
        if max(w, h) > maxpx:
            k = maxpx / max(w, h)
            im.scale(max(1, int(w * k)), max(1, int(h * k)))
        im.pack()

def export(path, rigged=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_yup=True, export_apply=True,
        export_image_format='WEBP', export_image_webp_fallback=False,
        export_animations=rigged, export_skins=rigged, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_draco_color_quantization=10, export_draco_generic_quantization=12)

def preview(png):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'FLAT'; sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x, sc.render.resolution_y = 640, 320
    sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.55, 0.62, 0.68)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.3
    cam.location = (0, -5, 0); cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.camera = cam; sc.render.filepath = png
    bpy.ops.render.render(write_still=True)

def process(a):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, a['input']))
    o = bake_to_single_mesh(int(a.get('frame', 0)), a.get('drop', ()))
    if a.get('diffuse'):
        apply_diffuse(os.path.join(os.path.dirname(os.path.join(SRC, a['input'])), a['diffuse']))
    s = orient(o, a['head'], a['up'], a.get('length', 1.0))
    n = decimate(o, a.get('tris', 10000))
    shrink_textures(a.get('tex', 1024))
    out = os.path.join(OUT_DIR, a['out'])
    if PREVIEW:
        preview(os.path.join(PREVIEW, a['id'] + '.png'))
    export(out)
    print('IMPORTED', a['id'], 'tris', n, 'scale', round(s, 5), 'bytes', os.path.getsize(out))

manifest = json.load(open(os.path.join(ROOT, 'tools', 'assets', 'manifest.json'), encoding='utf-8'))
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
for a in manifest['assets']:
    if ONLY and a['id'] not in ONLY:
        continue
    if a['mode'] != 'fish':
        print('SKIP (mode not implemented yet)', a['id'])
        continue
    process(a)
