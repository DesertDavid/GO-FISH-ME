# Builds the stylised jellybean angler (public/models/jellybean.glb), from scratch: no external assets.
#   blender -b --factory-startup --threads 12 --python tools/blender/build_jellybean.py -- [--out FILE] [--preview DIR]
#
# One rounded capsule is body and head together (no neck): a navy knit with a rolled collar, an olive oilskin bib with
# suspenders and a chest pocket, a faded sou'wester with a hat-band lure, bead eyes and a nose. Arms and legs are plain
# capsules; the forearms are bare with a rolled sweater cuff; the hands are balls (no fingers); boots are dark rubber.
# Matte vertex colours only (a restrained palette plus a little noise and wear), one material, no textures.
#
# Frame = the rod handle frame, so the rig lines up with the first-person rod: +Y up, the figure FACES +Z, +X is its LEFT.
# The model is a joint hierarchy of empties with rigid meshes; the game rotates the joints (jelly.js):
#   Root > Hips > Torso > Shoulder_L/R > Elbow_L/R > Wrist_L/R (> HandBall_L/R anchor at the ball centre)
#                  Hips > Hip_L/R > Knee_L/R > Ankle_L/R
# Mesh names start with body_ / arm_ / leg_ so the first-person view can show just the arms.
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector, Matrix

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(n, d=None): return argv[argv.index(n) + 1] if n in argv else d
OUT = opt('--out', os.path.join(ROOT, 'public', 'models', 'jellybean.glb'))
PREVIEW = opt('--preview')

def B(p): return Vector((p[0], -p[2], p[1]))     # game (y up, faces +z) -> Blender
def lin(h):
    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return np.array([c((h >> 16) & 255), c((h >> 8) & 255), c(h & 255)])

# restrained palette (sRGB hex)
NAVY, NAVY_D, KNIT_L = 0x27323f, 0x1c2530, 0x3a4858
OLIVE, OLIVE_D = 0x5d6035, 0x4a4c2a
SKIN, SKIN_D = 0xc08b69, 0xa87454
BOOT, SOLE = 0x25272a, 0x6b5a3e
HAT, HAT_D = 0xb89528, 0x8f7420
STRAP, BRASS = 0x3b2f22, 0x9c7b3c
EYE, LURE_R, LURE_W = 0x15171a, 0xb23a2a, 0xd8d2c4
GLOVE = 0xa98430                  # rubber glove: the sou'wester's ochre, a touch darker

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials):
    for d in list(coll): coll.remove(d)
mat = bpy.data.materials.new('Jelly')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
vc = mat.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
mat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.9
bsdf.inputs['Specular IOR Level'].default_value = 0.15

# ------------------------------------------------------------------ geometry helpers
def lathe(profile, seg=24, scale=(1, 1, 1)):
    """profile: [(radius, y)] bottom -> top (radius 0 on the axis). Returns a bmesh around the Y axis."""
    bm = bmesh.new()
    rings = []
    for r, y in profile:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / seg) * scale[0], y * scale[1], r * math.sin(2 * math.pi * k / seg) * scale[2])) for k in range(seg)])
    for a, b in zip(rings[:-1], rings[1:]):
        for k in range(seg):
            j = (k + 1) % seg
            bm.faces.new((a[k], b[k], b[j], a[j]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def capsule_profile(r, h, steps=7):
    """capsule along Y, total length h (>= 2r), centred on the origin"""
    half = h / 2 - r
    p = [(0, -h / 2)]
    for i in range(1, steps + 1):
        a = -math.pi / 2 + (math.pi / 2) * i / steps
        p.append((r * math.cos(a), -half + r * math.sin(a)))
    for i in range(1, steps + 1):
        a = (math.pi / 2) * i / steps
        p.append((r * math.cos(a), half + r * math.sin(a)))
    p.append((0, h / 2))
    return p

def sphere_profile(r, steps=8):
    return [(r * math.cos(a), r * math.sin(a)) for a in [-math.pi / 2 + math.pi * i / (2 * steps) for i in range(2 * steps + 1)]]

def torus_profile(R, r, steps=8):
    return [(R + r * math.cos(a), r * math.sin(a)) for a in [2 * math.pi * i / steps for i in range(steps + 1)]][:-1] + [(R + r, 0)]

def transform(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    m = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X') @ Matrix.Diagonal((*scale, 1))
    bm.transform(m)
    return bm

def tube(points, r, seg=8, squash=1.0):
    """a swept tube along a polyline (game coords), flattened by `squash` across its width"""
    bm = bmesh.new()
    pts = [Vector(p) for p in points]
    rings = []
    for i, p in enumerate(pts):
        t = ((pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])).normalized()
        n = Vector((0, 0, 1)).cross(t)
        if n.length < 1e-4: n = Vector((1, 0, 0))
        n.normalize(); b = t.cross(n).normalized()
        rings.append([bm.verts.new(p + n * math.cos(2 * math.pi * k / seg) * r + b * math.sin(2 * math.pi * k / seg) * r * squash) for k in range(seg)])
    for a, c in zip(rings[:-1], rings[1:]):
        for k in range(seg):
            j = (k + 1) % seg
            bm.faces.new((a[k], c[k], c[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

rng = np.random.default_rng(11)
joints = {}
def joint(name, pos, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.03
    bpy.context.scene.collection.objects.link(e)
    e.location = B(pos)
    if parent:
        e.parent = parent
        e.location = B(pos) - parent.matrix_world.to_translation()
        bpy.context.view_layer.update()
    joints[name] = e
    return e

def piece(name, bm, parent, color, *, wear=0.05, fn=None):
    """bm vertices are in game coords (y up). color: hex or fn(p) -> hex per vertex. Adds noise `wear`."""
    me = bpy.data.meshes.new(name)
    # to Blender coords
    for v in bm.verts: v.co = B(v.co)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(mat)
    layer = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    base = None if callable(color) else lin(color)
    for poly in me.polygons:
        cen = sum((me.vertices[i].co for i in poly.vertices), Vector()) / len(poly.vertices)
        p = (cen.x, cen.z, -cen.y)     # back to game coords for the colour rule
        c = lin(color(p)) if callable(color) else base
        k = 1.0 + (rng.random() - 0.5) * wear + 0.02 * math.sin(p[0] * 41 + p[1] * 23 + p[2] * 31)
        if fn: k *= fn(p)
        col = (*(np.clip(c * k, 0, 1)), 1.0)
        for li in poly.loop_indices:
            layer.data[li].color = col
    me.color_attributes.active_color = layer
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    ob.matrix_parent_inverse = parent.matrix_world.inverted()
    return ob

# ------------------------------------------------------------------ proportions (stubby, bean-shaped)
EYE_H = 1.40
CAP_R, BODY_LO, BODY_HI, ZS = 0.275, 0.50, 1.52, 0.92
AX = 0.335                       # arm x: hugs the capsule's flank
HIPY, KNEEY, ANKY = 0.62, 0.34, 0.09
SHY, ELY, WRY, HBY = 1.15, 0.87, 0.60, 0.55
BIB_TOP, COLLAR_Y = 1.05, 1.275
def body_r(y):        # capsule radius at height y
    yc_hi = BODY_HI - CAP_R; yc_lo = BODY_LO + CAP_R
    if y > yc_hi: return math.sqrt(max(1e-6, CAP_R ** 2 - (y - yc_hi) ** 2))
    if y < yc_lo: return math.sqrt(max(1e-6, CAP_R ** 2 - (yc_lo - y) ** 2))
    return CAP_R
def surf_z(x, y, back=False, lift=0.012):
    r = body_r(y)
    z = ZS * math.sqrt(max(1e-6, r * r - x * x)) + lift
    return -z if back else z

root = joint('Root', (0, 0, 0))
hips = joint('Hips', (0, HIPY, 0), root)
torso = joint('Torso', (0, HIPY, 0), hips)
bpy.context.view_layer.update()
J = {}
for side, s in (('L', 1), ('R', -1)):
    sh = joint(f'Shoulder_{side}', (AX * s, SHY, 0.0), torso)
    el = joint(f'Elbow_{side}', (AX * s, ELY, 0.0), sh)
    wr = joint(f'Wrist_{side}', (AX * s, WRY, 0.0), el)
    hb = joint(f'HandBall_{side}', (AX * s, HBY, 0.0), wr)
    hp = joint(f'Hip_{side}', (0.12 * s, HIPY, 0.0), hips)
    kn = joint(f'Knee_{side}', (0.12 * s, KNEEY, 0.0), hp)
    an = joint(f'Ankle_{side}', (0.12 * s, ANKY, 0.0), kn)
    J[side] = dict(sh=sh, el=el, wr=wr, hb=hb, hp=hp, kn=kn, an=an)
eye = joint('EyeLevel', (0, EYE_H, 0.0), torso)

# ------------------------------------------------------------------ body: ONE capsule from belly to crown, painted in zones
def body_color(p):
    if p[1] > COLLAR_Y + 0.01: return SKIN
    if p[1] > BIB_TOP: return NAVY
    return OLIVE
ys = set([BIB_TOP, COLLAR_Y, COLLAR_Y + 0.02, 0.8, 0.95, 1.1, 1.2])
for i in range(1, 9):
    a = (math.pi / 2) * i / 9
    ys.add(BODY_LO + CAP_R - CAP_R * math.cos(a)); ys.add(BODY_HI - CAP_R + CAP_R * math.sin(a))
levels = sorted(y for y in ys if BODY_LO + 0.003 < y < BODY_HI - 0.003)
bm = lathe([(0, BODY_LO)] + [(body_r(y), y) for y in levels] + [(0, BODY_HI)], 32, (1, 1, ZS))
piece('body_capsule', bm, torso, body_color, wear=0.05, fn=lambda p: (0.84 + 0.16 * min(1, (p[1] - 0.5) / 0.4)) if p[1] < BIB_TOP else 1.0)
# knit collar roll and a stitched bib seam
piece('body_collar', transform(lathe(torus_profile(body_r(COLLAR_Y) - 0.004, 0.03), 32, (1, 1, ZS)), (0, COLLAR_Y, 0)), torso, KNIT_L, wear=0.07)
piece('body_seam', transform(lathe(torus_profile(body_r(BIB_TOP) + 0.002, 0.009), 32, (1, 1, ZS)), (0, BIB_TOP, 0)), torso, OLIVE_D, wear=0.05)
# chest pocket + flap on the bib
piece('body_pocket', transform(lathe(capsule_profile(0.05, 0.13, 4), 12, (1.0, 1.0, 0.22)), (-0.09, 0.92, surf_z(-0.09, 0.92, lift=0.005)), (0, 0, math.pi / 2)), torso, OLIVE_D, wear=0.06)
piece('body_flap', transform(lathe(capsule_profile(0.013, 0.125, 3), 8, (1, 1, 1)), (-0.09, 0.962, surf_z(-0.09, 0.962, lift=0.016)), (0, 0, math.pi / 2)), torso, OLIVE_D, wear=0.04)
# suspenders: up the front of the bib, over the shoulder line, down the back
for s in (1, -1):
    path = []
    for (x, y, back) in ((0.12, 1.00, False), (0.125, 1.13, False), (0.15, 1.22, False), (0.21, 1.27, False), (0.245, 1.255, False), (0.23, 1.21, True), (0.17, 1.14, True), (0.14, 1.0, True)):
        path.append((x * s, y, surf_z(x, y, back, 0.012)))
    piece(f'body_strap_{"L" if s > 0 else "R"}', tube(path, 0.019, 8, 0.4), torso, STRAP, wear=0.06)
    piece(f'body_buckle_{"L" if s > 0 else "R"}', transform(lathe(capsule_profile(0.013, 0.05, 3), 8, (1.0, 1, 0.5)), (0.122 * s, 1.07, surf_z(0.122, 1.07, lift=0.026))), torso, BRASS, wear=0.03)
# face: bead eyes, nose
for s in (1, -1):
    piece(f'body_eye_{"L" if s > 0 else "R"}', transform(lathe(sphere_profile(0.022, 5), 10, (1, 1.2, 0.7)), (0.085 * s, 1.385, surf_z(0.085, 1.385, lift=0.004))), torso, EYE, wear=0.01)
piece('body_nose', transform(lathe(sphere_profile(0.034, 5), 12, (1, 0.95, 0.95)), (0, 1.335, surf_z(0, 1.335, lift=0.012))), torso, SKIN_D, wear=0.02)
# sou'wester: dome, band, brim that droops longer at the back; a lure pinned in the band
BRIM_Y = 1.465
dome = [(0, 1.735), (0.12, 1.72), (0.22, 1.67), (0.268, 1.58), (0.278, BRIM_Y + 0.005)]
piece('body_hat', transform(lathe(dome, 32, (1.0, 1, ZS))), torso, HAT, wear=0.08)
brim = bmesh.new()
seg_n = 32
rim_in = [(0.278, BRIM_Y + 0.005), (0.34, BRIM_Y - 0.012), (0.40, BRIM_Y - 0.05)]
rings = []
for (r, y) in rim_in:
    ring = []
    for k in range(seg_n):
        a = 2 * math.pi * k / seg_n
        back = max(0.0, -math.sin(a))          # faces -z at the back of the head
        scale_r = 1.0 + 0.22 * back
        ring.append(brim.verts.new((r * math.cos(a) * scale_r, y - 0.2 * back * (r - 0.278) / 0.12, r * math.sin(a) * ZS * scale_r)))
    rings.append(ring)
for a, c in zip(rings[:-1], rings[1:]):
    for k in range(seg_n):
        j = (k + 1) % seg_n
        brim.faces.new((a[k], c[k], c[j], a[j]))
bmesh.ops.recalc_face_normals(brim, faces=brim.faces)
bmesh.ops.solidify(brim, geom=list(brim.faces), thickness=0.01)
piece('body_brim', brim, torso, HAT_D, wear=0.08)
piece('body_band', transform(lathe(torus_profile(0.272, 0.011), 32, (1.0, 1, ZS)), (0, BRIM_Y + 0.045, 0)), torso, STRAP, wear=0.04)
piece('body_lure', transform(lathe(capsule_profile(0.014, 0.085, 4), 10, (1, 1, 1)), (0.19, BRIM_Y + 0.06, 0.2), (0, 0, math.radians(70))), torso, LURE_R, wear=0.03)
piece('body_lure_tail', transform(lathe(capsule_profile(0.009, 0.035, 3), 8, (1, 1, 1)), (0.245, BRIM_Y + 0.045, 0.19), (0, 0, math.radians(70))), torso, LURE_W, wear=0.03)

# ------------------------------------------------------------------ arms (Y down from the shoulder)
# knit sleeves (cylinders with round ends), a rolled light cuff + dark seam ring at each wrist, and a round rubber-glove ball
# in the sou'wester's ochre. The ring and the colour change are what make the ball read as a hand, not a blob.
for side, s in (('L', 1), ('R', -1)):
    j = J[side]
    piece(f'arm_upper_{side}', transform(lathe(capsule_profile(0.064, 0.36, 8), 20), (AX * s, (SHY + ELY) / 2 + 0.01, 0)), j['sh'], NAVY, wear=0.05)
    piece(f'arm_fore_{side}', transform(lathe(capsule_profile(0.053, 0.34, 8), 20), (AX * s, (ELY + WRY) / 2 + 0.01, 0)), j['el'], NAVY, wear=0.05, fn=lambda p: 1.0 + 0.1 * math.sin(p[1] * 90))
    piece(f'arm_elbowpatch_{side}', transform(lathe(sphere_profile(0.036, 5), 12, (1, 1.25, 0.5)), (AX * s + (0.0), ELY + 0.0, -0.047)), j['el'], OLIVE_D, wear=0.06)
    piece(f'arm_cuff_{side}', transform(lathe(torus_profile(0.052, 0.024, 8), 22), (AX * s, WRY + 0.015, 0)), j['el'], KNIT_L, wear=0.07)
    piece(f'arm_cuff2_{side}', transform(lathe(torus_profile(0.054, 0.012, 6), 22), (AX * s, WRY - 0.012, 0)), j['el'], NAVY_D, wear=0.05)
    piece(f'arm_hand_{side}', transform(lathe(sphere_profile(0.074, 9), 28), (AX * s, HBY - 0.004, 0), (0, 0, 0), (1.0, 0.93, 1.0)), j['hb'], GLOVE, wear=0.045,
          fn=lambda p: 0.9 + 0.1 * min(1, max(0, (p[1] - 0.50) / 0.1)))

# ------------------------------------------------------------------ legs + boots
for side, s in (('L', 1), ('R', -1)):
    j = J[side]
    piece(f'leg_thigh_{side}', transform(lathe(capsule_profile(0.095, 0.40, 6), 18), (0.12 * s, (HIPY + KNEEY) / 2 - 0.01, 0)), j['hp'], OLIVE, wear=0.06)
    piece(f'leg_shin_{side}', transform(lathe(capsule_profile(0.088, 0.34, 6), 18), (0.12 * s, (KNEEY + ANKY) / 2, 0)), j['kn'], OLIVE_D, wear=0.07)
    piece(f'leg_boot_{side}', transform(lathe(capsule_profile(0.105, 0.34, 6), 18), (0.12 * s, 0.085, 0.07), (math.pi / 2, 0, 0), (1, 1, 0.8)), j['an'], BOOT, wear=0.08)
    piece(f'leg_shaft_{side}', transform(lathe(capsule_profile(0.096, 0.20, 5), 18), (0.12 * s, 0.17, 0.0)), j['an'], BOOT, wear=0.08)
    piece(f'leg_sole_{side}', transform(lathe(capsule_profile(0.112, 0.36, 6), 18), (0.12 * s, 0.012, 0.07), (math.pi / 2, 0, 0), (1, 1, 0.3)), j['an'], SOLE, wear=0.06)

# ------------------------------------------------------------------ export
bpy.ops.object.select_all(action='SELECT')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
    export_animations=False, export_skins=False, export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=12, export_draco_normal_quantization=9, export_draco_generic_quantization=9)
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')

# ------------------------------------------------------------------ preview renders (contact sheet pieces)
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 720, 900
    sc.render.film_transparent = False
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.58, 0.66, 0.74, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 3.2; sun.rotation_euler = (math.radians(50), 0, math.radians(35)); sun.data.angle = 0.2
    fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'SUN')); sc.collection.objects.link(fill)
    fill.data.energy = 0.8; fill.rotation_euler = (math.radians(60), 0, math.radians(-140))
    ground = bpy.data.objects.new('ground', bpy.data.meshes.new('g'))
    gm = bmesh.new(); bmesh.ops.create_grid(gm, x_segments=1, y_segments=1, size=4); gm.to_mesh(ground.data); gm.free()
    gmat = bpy.data.materials.new('gm'); gmat.use_nodes = True; gmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.36, 0.40, 0.38, 1)
    gmat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
    ground.data.materials.append(gmat); sc.collection.objects.link(ground)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = 55

    def shoot(name, pos, target, lens=55):
        cam.data.lens = lens
        cam.location = B(pos)
        d = B(target) - cam.location
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(PREVIEW, name + '.png')
        bpy.ops.render.render(write_still=True)

    shoot('front', (0, 0.95, 4.4), (0, 0.84, 0)); shoot('side', (4.4, 0.95, 0), (0, 0.84, 0))
    shoot('threeq', (2.9, 1.15, 3.4), (0, 0.84, 0))
    # first-person arms view: two-bone IK of both arms onto a rod, eye at the head, body hidden
    E = Vector((0, EYE_H, 0))
    rod_dir = Vector((0, 0.42, 0.91)).normalized()
    T_R = E + Vector((-0.16, -0.25, 0.42)); T_L = T_R + Vector((0.07, -0.09, 0.10))
    def ik(side, T):
        j = J[side]; S = Vector(joints[f'Shoulder_{side}'].matrix_world.translation)
        S = Vector((S.x, S.z, -S.y)) if False else Vector((S.x, S.z, -S.y))   # to game coords
        l1, l2 = SHY - ELY, ELY - HBY
        d = T - S; dl = min(d.length, l1 + l2 - 1e-3); dn = d.normalized()
        ang = math.acos(max(-1, min(1, (l1 * l1 + dl * dl - l2 * l2) / (2 * l1 * dl))))
        pole = Vector((0.5 * (1 if side == 'L' else -1), -1, -0.25)).normalized()
        pole = (pole - dn * pole.dot(dn)).normalized()
        elbow = S + (dn * math.cos(ang) + pole * math.sin(ang)) * l1
        wrist = S + dn * dl
        sh, el = j['sh'], j['el']
        for o in (sh, el): o.rotation_mode = 'QUATERNION'
        sh.rotation_quaternion = (sh.parent.matrix_world.to_quaternion().inverted() @ B(elbow - S).rotation_difference(Vector((0, 0, 0))) ) if False else sh.rotation_quaternion
        # shoulder: aim its local -Z (down in Blender) at the elbow
        down = Vector((0, 0, -1))
        qs = Vector((0, 0, -1)).rotation_difference(B(elbow - S).normalized())
        sh.rotation_quaternion = sh.parent.matrix_world.to_quaternion().inverted() @ qs
        bpy.context.view_layer.update()
        qe = Vector((0, 0, -1)).rotation_difference(B(T - elbow).normalized())
        el.rotation_quaternion = el.parent.matrix_world.to_quaternion().inverted() @ qe
        bpy.context.view_layer.update()
    ik('R', T_R); ik('L', T_L)
    rod = bmesh.new(); bmesh.ops.create_cone(rod, cap_ends=True, segments=12, radius1=0.018, radius2=0.008, depth=1.7)
    rm = bpy.data.meshes.new('rod'); rod.to_mesh(rm); rod.free()
    ro = bpy.data.objects.new('rod', rm); sc.collection.objects.link(ro)
    ro.location = B(T_R + rod_dir * 0.55)
    ro.rotation_mode = 'QUATERNION'
    ro.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(B(rod_dir))
    ro.data.materials.append(gmat)
    reel = bpy.data.objects.new('reel', bpy.data.meshes.new('reel')); rb = bmesh.new(); bmesh.ops.create_uvsphere(rb, u_segments=16, v_segments=10, radius=0.05); rb.to_mesh(reel.data); rb.free()
    reel.location = B(T_R + Vector((0.07, -0.07, 0.08)) + rod_dir * 0.15); reel.data.materials.append(gmat); sc.collection.objects.link(reel)
    for o in bpy.data.objects:
        if o.name.startswith(('body_', 'leg_')): o.hide_render = True
    cam.data.lens = 30
    cam.location = B(E + Vector((0, 0.08, -0.22)))
    cam.rotation_euler = (math.radians(64), 0, math.radians(180))
    sc.render.filepath = os.path.join(PREVIEW, 'fp.png'); bpy.ops.render.render(write_still=True)
