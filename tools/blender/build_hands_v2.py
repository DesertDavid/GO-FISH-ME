# Builds hands2.glb from the downloaded "Rigged hand" model (Elena FF, Sketchfab, CC-BY-SA-4.0).
#
#   python -I tools/blender/bake_gltf_rest.py <extracted zip dir> rest.npz
#   blender -b --factory-startup --python tools/blender/build_hands_v2.py -- \
#       --rest rest.npz --tex <dir>/textures/lambert1_baseColor.jpeg [--out public/models/hands2.glb] [--preview DIR]
#
# The sketchfab glTF mixes unit scales (the Blender importer wrecks the skin), so the bind pose is read
# straight from the file (bake_gltf_rest.py) and the rig is rebuilt here: a clean right hand in the game's
# hand frame (metres; +z fingers, +y back of the hand, +x thumb side), 22 deform bones with plain names,
# a texture shrunk to 1024 webp, plus a separate rigid forearm "Arm" (bare skin, rolled cuff, plaid flannel
# sleeve) and an "Elbow" empty at its far end. The left hand is this mesh mirrored at runtime (scale.x = -1).
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
REST = opt('--rest'); TEX = opt('--tex')
OUT = opt('--out', os.path.join(ROOT, 'public', 'models', 'hands2.glb'))
PREVIEW = opt('--preview')
S = float(opt('--scale', 0.135))       # model units -> metres (a ~21 cm hand)
ARM_LEN = 0.46
TEX_SIZE = 1024

def B(p3):   # game (three.js) coords -> Blender coords
    return Vector((p3[0], -p3[2], p3[1]))

d = np.load(REST)
raw, rawn = d['rawpos'], d['rawnrm']
ji, jw, uv, idx = d['ji'], d['w'], d['uv'], d['idx']
names = [str(n) for n in d['jnames']]
heads_raw = np.linalg.inv(d['ibm'])[:, :3, 3]

# wrist ring: the lowest slab of the mesh. raw axes: x = back of hand, y = fingers, z = thumb side
lo = raw[:, 1].min()
slab = raw[raw[:, 1] < lo + 0.012]
C = np.array([slab[:, 0].mean(), lo, slab[:, 2].mean()])
def to3(r):  # raw -> hand frame (x = raw z, y = raw x, z = raw y), metres
    r = np.asarray(r, float)
    return np.stack([(r[..., 2] - C[2]) * S, (r[..., 0] - C[0]) * S, (r[..., 1] - C[1]) * S], -1)
slab2 = raw[raw[:, 1] < lo + 0.06]                          # a little higher up, where the stub has filled out
wrist_rx = (np.percentile(slab2[:, 2], 98) - np.percentile(slab2[:, 2], 2)) * S / 2     # across
wrist_ry = (np.percentile(slab2[:, 0], 98) - np.percentile(slab2[:, 0], 2)) * S / 2     # back of hand - palm
print('wrist half widths (across, depth) m:', wrist_rx, wrist_ry)

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
    for x in list(coll):
        coll.remove(x)

# ------------------------------------------------------------------ mesh
P3 = to3(raw)
N3 = np.stack([rawn[:, 2], rawn[:, 0], rawn[:, 1]], -1)
me = bpy.data.meshes.new('HandSkin')
me.from_pydata([tuple(B(p)) for p in P3], [], idx.tolist())
uvl = me.uv_layers.new(name='UV0')
for l in me.loops:
    u = uv[l.vertex_index]
    uvl.data[l.index].uv = (u[0], 1.0 - u[1])
me.shade_smooth()
me.normals_split_custom_set_from_vertices([tuple(B(n)) for n in N3])
hand = bpy.data.objects.new('HandSkin', me)
bpy.context.scene.collection.objects.link(hand)

# ------------------------------------------------------------------ materials
def principled(m):
    m.use_nodes = True
    return m.node_tree.nodes['Principled BSDF']

img = bpy.data.images.load(TEX)
img.scale(TEX_SIZE, TEX_SIZE)
img.pack()
skin = bpy.data.materials.new('Skin')
b = principled(skin)
tn = skin.node_tree.nodes.new('ShaderNodeTexImage'); tn.image = img
skin.node_tree.links.new(tn.outputs['Color'], b.inputs['Base Color'])
b.inputs['Roughness'].default_value = 0.55
me.materials.append(skin)
px = np.array(img.pixels[:]).reshape(TEX_SIZE, TEX_SIZE, 4)[..., :3]
tc = np.clip((uv * TEX_SIZE).astype(int), 0, TEX_SIZE - 1)
avg_skin = np.median(px[TEX_SIZE - 1 - tc[:, 1], tc[:, 0]], axis=0)   # colour the hand actually shows (texels under the mesh), for the forearm
avg_skin = np.clip(avg_skin * 1.12, 0, 1)
avg_skin = np.where(avg_skin <= 0.04045, avg_skin / 12.92, ((avg_skin + 0.055) / 1.055) ** 2.4)   # pixels read back sRGB-encoded -> linear base colour
print('skin average (linear):', avg_skin)

def flannel_image():
    n = 256
    y, x = np.mgrid[0:n, 0:n] / n
    band = lambda t, k, w: (np.abs(((t * k) % 1.0) - 0.5) < w).astype(float)
    # buffalo-ish teal plaid: wide dark stripes both ways, thin light threads, woven noise
    # colours in sRGB, written out as linear because Blender stores the raw floats as linear
    base = np.array([0.14, 0.42, 0.46]); dark = np.array([0.07, 0.24, 0.28]); thread = np.array([0.72, 0.78, 0.74])
    wide = np.clip(band(x, 2, 0.25) + band(y, 2, 0.25), 0, 1)
    col = base[None, None] * (1 - wide[..., None] * 0.65) + dark[None, None] * wide[..., None] * 0.65
    th = np.clip(band(x, 8, 0.03) + band(y, 8, 0.03), 0, 1) * 0.35
    col = col * (1 - th[..., None]) + thread * th[..., None]
    rng = np.random.default_rng(7)
    weave = 0.93 + 0.07 * np.sin(x * n * 2 * math.pi * 1.0) * np.sin(y * n * 2 * math.pi * 1.0) + rng.normal(0, 0.02, (n, n))
    col = np.clip(col * weave[..., None], 0, 1) ** 2.2
    im = bpy.data.images.new('flannel', n, n)
    im.pixels = np.dstack([col, np.ones((n, n))]).ravel().tolist()
    im.pack()
    return im

flan = bpy.data.materials.new('Sleeve')
b = principled(flan)
fn = flan.node_tree.nodes.new('ShaderNodeTexImage'); fn.image = flannel_image()
flan.node_tree.links.new(fn.outputs['Color'], b.inputs['Base Color'])
b.inputs['Roughness'].default_value = 0.92
cuffm = bpy.data.materials.new('Cuff'); b = principled(cuffm)
b.inputs['Base Color'].default_value = (0.012, 0.07, 0.092, 1); b.inputs['Roughness'].default_value = 0.9
armskin = bpy.data.materials.new('ArmSkin'); b = principled(armskin)
b.inputs['Base Color'].default_value = (*avg_skin, 1); b.inputs['Roughness'].default_value = 0.58

# ------------------------------------------------------------------ rig: 22 deform bones with plain names
FING = ['Index', 'Middle', 'Ring', 'Pinky']
rig_map = {1: 'Pulse', 2: 'Wrist', 3: 'Thumb0', 10: 'Thumb1', 11: 'Thumb2', 12: 'Thumb3'}
src_fing = {'Index': 15, 'Middle': 26, 'Ring': 37, 'Pinky': 48}
for f in FING:
    s0 = src_fing[f]
    rig_map[s0] = f + '0'
for f, base in (('Index', 22), ('Middle', 33), ('Ring', 44), ('Pinky', 55)):
    rig_map[base] = f + '1'; rig_map[base + 1] = f + '2'; rig_map[base + 2] = f + '3'
parent_of = {'Pulse': None, 'Wrist': 'Pulse', 'Thumb0': 'Wrist', 'Thumb1': 'Thumb0', 'Thumb2': 'Thumb1', 'Thumb3': 'Thumb2'}
for f in FING:
    parent_of[f + '0'] = 'Wrist'; parent_of[f + '1'] = f + '0'; parent_of[f + '2'] = f + '1'; parent_of[f + '3'] = f + '2'
bhead = {nm: B(to3(heads_raw[j])) for j, nm in rig_map.items()}
# wrist is the carpal joint: put the Pulse/Wrist heads where the mesh actually starts
btail = {}
children = {}
for nm, par in parent_of.items():
    if par: children.setdefault(par, []).append(nm)
for nm in parent_of:
    ch = children.get(nm)
    if ch:
        btail[nm] = sum((bhead[c] for c in ch), Vector()) / len(ch)
    else:   # fingertip: continue the last bone's direction
        pv = bhead[nm] - bhead[parent_of[nm]]
        btail[nm] = bhead[nm] + pv * 0.6

arm = bpy.data.armatures.new('HandRigData')
rig = bpy.data.objects.new('HandRig', arm)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
ebs = {}
for nm in parent_of:
    e = arm.edit_bones.new(nm)
    e.head = bhead[nm]; e.tail = btail[nm]
    if (e.tail - e.head).length < 0.004:
        e.tail = e.head + Vector((0, 0, 0.004))
    ebs[nm] = e
for nm, par in parent_of.items():
    if par: ebs[nm].parent = ebs[par]
bpy.ops.object.mode_set(mode='OBJECT')

inv_map = {j: nm for j, nm in rig_map.items()}
vgs = {nm: hand.vertex_groups.new(name=nm) for nm in parent_of}
for k in range(4):
    for j in np.unique(ji[:, k]):
        if j not in inv_map: continue
        sel = np.where((ji[:, k] == j) & (jw[:, k] > 0))[0]
        for v in sel:
            vgs[inv_map[j]].add([int(v)], float(jw[v, k]), 'ADD')
mod = hand.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
hand.parent = rig

# ------------------------------------------------------------------ forearm + rolled flannel sleeve (rigid, in the hand frame)
ring_n, seg = 32, 40
SKIN_END, CUFF_END = 0.0, 0.055       # the cuff sits right at the wrist so it hides where the hand mesh is cut
def profile(dist):
    """(across radius, depth radius, material index, bulge) at `dist` metres behind the wrist."""
    t = dist / ARM_LEN
    ra = min(wrist_rx, 0.024) * (1.0 + 0.25 * t); rd = min(wrist_ry, 0.018) * (1.0 + 0.25 * t)
    if dist <= CUFF_END:      # rolled cuff: a fat rounded band
        u = dist / CUFF_END
        bulge = 0.003 + 0.004 * math.sin(u * math.pi)
        mat = 1
    else:                     # looser, creased sleeve above it
        u = (dist - CUFF_END) / (ARM_LEN - CUFF_END)
        bulge = 0.005 + 0.008 * u
        mat = 2
    return ra + bulge, rd + bulge, mat, bulge

bm = bmesh.new()
uvlay = bm.loops.layers.uv.new('UV0')
rings = []
dists = [CUFF_END * (i / 8) for i in range(0, 9)] + [CUFF_END + 0.001] + [CUFF_END + (ARM_LEN - CUFF_END) * (i / 16) for i in range(1, 17)]
dists = sorted(set(round(x, 5) for x in dists))
for dist in dists:
    ra, rd, mat, bul = profile(dist)
    ring = []
    for a in range(ring_n):
        th = 2 * math.pi * a / ring_n
        crease = 0.0
        if dist > CUFF_END:
            crease = 0.0035 * math.sin(th * 5 + dist * 38) * math.sin(th * 3 - dist * 21)
        x3 = (ra + crease) * math.cos(th); y3 = (rd + crease) * math.sin(th)
        ring.append(bm.verts.new(B((x3, y3, -dist + 0.012 * (dist == 0)))))   # start inside the wrist so the cut edge is hidden
    rings.append((dist, ring))
for (d0, r0), (d1, r1) in zip(rings[:-1], rings[1:]):
    mid = (d0 + d1) / 2
    mi = 1 if mid <= CUFF_END else 2
    for a in range(ring_n):
        b_ = (a + 1) % ring_n
        f = bm.faces.new((r0[a], r0[b_], r1[b_], r1[a]))
        f.material_index = mi
        f.smooth = True
        for l, (uu, dd, aa) in zip(f.loops, ((a, d0, 0), (a + 1, d0, 1), (a + 1, d1, 1), (a, d1, 0))):
            l[uvlay].uv = (uu / ring_n * 3.0, dd * 9.0)
last = rings[-1][1]
cap = bm.faces.new(last[::-1]); cap.material_index = 2
bm.normal_update()
ame = bpy.data.meshes.new('Arm'); bm.to_mesh(ame); bm.free()
ame.materials.append(armskin); ame.materials.append(cuffm); ame.materials.append(flan)
ame.shade_smooth()
armo = bpy.data.objects.new('Arm', ame)
bpy.context.scene.collection.objects.link(armo)
elbow = bpy.data.objects.new('Elbow', None)
elbow.location = B((0, 0, -ARM_LEN))
bpy.context.scene.collection.objects.link(elbow)

# ------------------------------------------------------------------ export
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in (hand, rig, armo, elbow):
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_yup=True,
    export_apply=False, export_skins=True, export_animations=False, export_morph=False,
    export_image_format='WEBP', export_image_quality=82,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    export_draco_generic_quantization=10)
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')

# ------------------------------------------------------------------ optional preview renders (bind pose)
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x = sc.render.resolution_y = 800
    cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.8
    centre = Vector((0, -0.05, 0.08))
    for name, dv in (('back', Vector((0, 0, -1))), ('palm', Vector((0, 0, 1))), ('side', Vector((1, 0, 0))), ('top', Vector((0, 1, 0)))):
        cam.location = centre - dv * 3
        cam.rotation_euler = dv.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(PREVIEW, name + '.png')
        bpy.ops.render.render(write_still=True)
