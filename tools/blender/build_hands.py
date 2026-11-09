# Builds the first-person angler hands and exports public/models/hands.glb.
# Run:  blender -b --factory-startup --python tools/blender/build_hands.py [-- --preview DIR]
#
# Coordinates are written in the game's rod-handle frame (three.js, metres): +z along the rod
# toward the tip, +y up, +x to the angler's left. P() converts to Blender axes so the exported
# glTF comes out in that same frame.
#   HandR: right hand on the grip, the reel stem between the middle and ring fingers.
#   HandL: left hand around the crank knob (origin = knob centre, knob axis = x).
# Each hand is built as a skeleton (finger bones of real proportions, metacarpals, thumb),
# swept with spheres, fused with a voxel remesh and smoothed, so joints blend like flesh.
import bpy, bmesh, math, os, sys
from mathutils import Vector

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'public', 'models', 'hands.glb')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = argv[argv.index('--preview') + 1] if '--preview' in argv else None

def P(x, y, z):
    return Vector((x, -z, y))

def V3(x, y, z):
    return Vector((x, y, z))

def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials):
        for d in list(coll):
            coll.remove(d)

def srgb(h):
    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c((h >> 16) & 255), c((h >> 8) & 255), c(h & 255))

def material(name, color, rough, use_vcol=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)   # what the workbench preview shows
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    if use_vcol:
        n = m.node_tree.nodes.new('ShaderNodeVertexColor')
        n.layer_name = 'Col'
        m.node_tree.links.new(n.outputs['Color'], b.inputs['Base Color'])
    return m

# ---------------------------------------------------------------- skeleton -> skin
class Skeleton:
    """Bones as (a, b, ra, rb) in three.js handle coordinates; joints get a knuckle bulge."""
    def __init__(self):
        self.bones = []
        self.palm = []       # bones whose spheres are wrapped in one convex pad (palm + heel)
        self.knuckles = []   # (point, radius, dorsal dir) for the reddened knuckle tint
        self.tips = []

    def bone(self, a, b, ra, rb):
        self.bones.append((V3(*a), V3(*b), ra, rb))

    def chain(self, pts, radii, knuckle_dirs=None):
        for i in range(len(pts) - 1):
            self.bone(pts[i], pts[i + 1], radii[i], radii[i + 1])
        for i, p in enumerate(pts[1:-1], 1):
            self.knuckles.append((V3(*p), radii[i]))
        self.tips.append((V3(*pts[-1]), radii[-1]))

def sweep_mesh(name, skel, step=0.0012):
    """Union of spheres along every bone (dense enough to read as tubes)."""
    bm = bmesh.new()
    for a, b, ra, rb in skel.bones:
        n = max(2, int((b - a).length / step) + 1)
        for i in range(n):
            t = i / (n - 1)
            p = a.lerp(b, t)
            r = ra + (rb - ra) * t
            # knuckle bulge at the joint ends
            r *= 1 + 0.07 * (math.exp(-((t * (b - a).length) / 0.006) ** 2) + math.exp(-(((1 - t) * (b - a).length) / 0.006) ** 2))
            m = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=7, radius=r)
            bmesh.ops.translate(bm, vec=P(*p), verts=m['verts'])
    # the palm: a convex hull round spheres on the metacarpals, heel and wrist
    hb = bmesh.new()
    for a, b, ra, rb in skel.palm:
        n = max(2, int((b - a).length / 0.004) + 1)
        for i in range(n):
            t = i / (n - 1)
            m = bmesh.ops.create_icosphere(hb, subdivisions=2, radius=ra + (rb - ra) * t)
            bmesh.ops.translate(hb, vec=P(*a.lerp(b, t)), verts=m['verts'])
    if skel.palm:
        res = bmesh.ops.convex_hull(hb, input=hb.verts[:])
        bmesh.ops.delete(hb, geom=[g for g in res['geom_interior'] if isinstance(g, bmesh.types.BMVert)], context='VERTS')
        bmesh.ops.delete(hb, geom=[v for v in hb.verts if not v.link_faces], context='VERTS')
        # round the hull's flat planes and hard edges: Catmull-Clark pulls it into a soft pad
        # (it shrinks a little, so scale back out about the hull's centre first)
        c = sum((v.co for v in hb.verts), Vector()) / len(hb.verts)
        for v in hb.verts:
            v.co = c + (v.co - c) * 1.1
        tmp = bpy.data.meshes.new('hull')
        hb.to_mesh(tmp)
        tob = bpy.data.objects.new('hull', tmp)
        bpy.context.collection.objects.link(tob)
        sub = tob.modifiers.new('sub', 'SUBSURF')
        sub.levels = 3
        dg = bpy.context.evaluated_depsgraph_get()
        ev = tob.evaluated_get(dg)
        bm.from_mesh(ev.to_mesh())
        ev.to_mesh_clear()
        bpy.data.objects.remove(tob, do_unlink=True)
        bpy.data.meshes.remove(tmp)
    hb.free()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob

def fuse(ob, voxel=0.0005, smooth_iters=30, faces=18000):
    bpy.context.view_layer.objects.active = ob
    r = ob.modifiers.new('remesh', 'REMESH')
    r.mode = 'VOXEL'
    r.voxel_size = voxel
    s = ob.modifiers.new('smooth', 'CORRECTIVE_SMOOTH')
    s.iterations = smooth_iters
    s.smooth_type = 'LENGTH_WEIGHTED'
    s.use_only_smooth = True
    l = ob.modifiers.new('lap', 'LAPLACIANSMOOTH')
    l.iterations = 12
    l.lambda_factor = 0.8
    l.use_volume_preserve = True
    # Final topology: re-voxelise the smoothed shape at a coarser size chosen for the face
    # budget. That gives even, square-ish faces (decimating instead leaves long slivers whose
    # shading sparkles), then smooth away the voxel stair-steps that catch the sun.
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    area = sum(p.area for p in ob.data.polygons)
    r2 = ob.modifiers.new('remesh2', 'REMESH')
    r2.mode = 'VOXEL'
    r2.voxel_size = max(voxel, math.sqrt(area / faces))
    l2 = ob.modifiers.new('lap2', 'LAPLACIANSMOOTH')
    l2.iterations = 8
    l2.lambda_factor = 0.7
    l2.use_volume_preserve = True
    s2 = ob.modifiers.new('smooth2', 'SMOOTH')
    s2.factor = 0.5
    s2.iterations = 6
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    # air pockets trapped inside a fist come out of the remesh as extra inner shells that
    # flicker through the skin; keep only the outer surface (the largest shell)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    seen, shells = set(), []
    for v in bm.verts:
        if v in seen:
            continue
        stack, shell = [v], []
        seen.add(v)
        while stack:
            a = stack.pop()
            shell.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b not in seen:
                    seen.add(b)
                    stack.append(b)
        shells.append(shell)
    shells.sort(key=len, reverse=True)
    junk = [v for sh in shells[1:] for v in sh]
    if junk:
        bmesh.ops.delete(bm, geom=junk, context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()
    print(ob.name, 'shells', len(shells), 'removed verts', len(junk))
    for p in ob.data.polygons:
        p.use_smooth = True

def tint_skin(ob, skel, base=0xc58c6c):
    """Vertex colour: even skin, flushed knuckles and fingertips, a paler palm side."""
    me = ob.data
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    b = Vector(srgb(base))
    flush = Vector(srgb(0xb46a5c))
    pale = Vector(srgb(0xd8a488))
    knuck = [(P(*k), r) for k, r in skel.knuckles]
    tips = [(P(*t), r) for t, r in skel.tips]
    for v in me.vertices:
        c = b.copy()
        w = 0.0
        for p, r in knuck:
            d = (v.co - p).length
            w = max(w, math.exp(-((d - r) / 0.004) ** 2) if d > r * 0.7 else 0.0)
        for p, r in tips:
            d = (v.co - p).length
            w = max(w, math.exp(-(d / 0.009) ** 2))
        c = c.lerp(flush, 0.55 * w)
        c = c.lerp(pale, 0.25 * max(0.0, -v.normal.dot(skel.palm_normal)) if hasattr(skel, 'palm_normal') else 0)
        col.data[v.index].color = (c.x, c.y, c.z, 1)

def nail(name, tip, dirv, out, width, mat, skin=None):
    """A slightly domed fingernail on the back of the last bone, laid on the skin surface."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    d = P(*dirv).normalized()
    o = P(*out).normalized()
    o = (o - d * o.dot(d)).normalized()
    centre = P(*tip) - d * (width * 0.7) + o * (width * 0.46)
    if skin is not None:
        # snap to the skin: nearest surface point to the rough spot, its normal as 'out'
        ok, loc, nrm, _ = skin.closest_point_on_mesh(centre)
        # only when that surface is this fingertip (tucked tips can find the palm instead)
        if ok and (loc - centre).length < width * 0.5 and nrm.dot(o) > 0.3:
            o = (nrm - d * nrm.dot(d)).normalized()
            centre = loc + o * (width * 0.02)
        else:   # a tip tucked into the fist: its nail can't be seen, so leave it out
            bpy.data.objects.remove(ob, do_unlink=True)
            return None
    side = d.cross(o).normalized()
    for v in me.vertices:
        x, y, z = v.co
        v.co = centre + side * (x * width * 0.46) + d * (y * width * 0.6) + o * (z * width * 0.07)
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    return ob

def sleeve(name, wrist, dirv, mat, start=0.05, length=0.3, r0=0.036, r1=0.046):
    bm = bmesh.new()
    seg, rings = 18, 10
    d = P(*dirv).normalized()
    up = Vector((0, 0, 1))
    a = d.cross(up).normalized()
    b = d.cross(a).normalized()
    w = P(*wrist)
    verts = []
    for j in range(rings + 1):
        t = j / rings
        r = r0 + (r1 - r0) * t
        ring = []
        for i in range(seg):
            ang = i / seg * math.tau
            fold = 1 + 0.06 * math.sin(ang * 3 + t * 9) * (0.3 + t)   # loose cloth folds
            pt = w + d * (start + length * t) + (a * math.cos(ang) + b * math.sin(ang)) * r * fold
            ring.append(bm.verts.new(pt))
        verts.append(ring)
    for j in range(rings):
        for i in range(seg):
            bm.faces.new((verts[j][i], verts[j][(i + 1) % seg], verts[j + 1][(i + 1) % seg], verts[j + 1][i]))
    # rolled cuff: a fat ring at the open end nearest the hand
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in ob.data.polygons:
        p.use_smooth = True
    sol = ob.modifiers.new('thick', 'SOLIDIFY')
    sol.thickness = 0.004
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier='thick')
    me.materials.append(mat)
    return ob

# ---------------------------------------------------------------- finger wrapping
def wrap_finger(frame, s0, s1, theta0, lengths, radii, core):
    """Joint positions for a finger curled round an axis. frame = (O, A, e1, e2) in three
    coords; each straight bone is a chord whose middle just clears `core` (grip radius)."""
    O, A, e1, e2 = frame
    rhos = [math.sqrt(core ** 2 + (L / 2) ** 2) for L in lengths]
    joint_rho = [rhos[0]] + [(rhos[i] + rhos[i + 1]) / 2 for i in range(len(rhos) - 1)] + [rhos[-1] * 0.97]
    th = theta0
    pts = []
    total = sum(lengths)
    acc = 0.0
    for i in range(len(lengths) + 1):
        s = s0 + (s1 - s0) * (acc / total)
        r = joint_rho[i]
        pts.append(tuple(O + A * s + (e1 * math.cos(th) + e2 * math.sin(th)) * r))
        if i < len(lengths):
            th += 2 * math.asin(min(0.99, lengths[i] / (2 * rhos[i])))
            acc += lengths[i]
    return pts

FINGERS = {  # bone lengths (proximal, middle, distal) and radii at MCP, PIP, DIP, tip
    'index': ((0.044, 0.026, 0.019), (0.0094, 0.0088, 0.0080, 0.0072)),
    'middle': ((0.047, 0.029, 0.020), (0.0096, 0.0090, 0.0082, 0.0074)),
    'ring': ((0.044, 0.027, 0.020), (0.0090, 0.0085, 0.0078, 0.0070)),
    'pinky': ((0.035, 0.021, 0.018), (0.0080, 0.0075, 0.0069, 0.0062)),
}

def lerp3(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def build_hand(name, frame, fingers, wrist, palm_bases, thumb, forearm_dir, palm_normal, skin_mat, nail_mat, sleeve_mat, thumb_nail=(0, 1, 0), split_arm=False, finger_nails=True):
    """fingers: list of (finger name, s at knuckle, s at tip, theta at knuckle, core radius)."""
    sk = Skeleton()
    sk.palm_normal = P(*palm_normal).normalized()
    O, A, e1, e2 = frame
    mcps = []
    nails = []
    for (fname, s0, s1, th0, core), base in zip(fingers, palm_bases):
        L, R = FINGERS[fname]
        pts = wrap_finger(frame, s0, s1, th0, L, R, core)
        sk.chain(pts, R)
        mcps.append((pts[0], R[0]))
        # metacarpal: from the palm base near the wrist to the knuckle (part of the palm pad)
        sk.palm.append((V3(*base), V3(*pts[0]), 0.011, R[0] * 1.1))
        # web of flesh between each knuckle and a point a little down the finger
        sk.bone(pts[0], lerp3(pts[0], pts[1], 0.3), R[0] * 1.12, R[0] * 1.02)
        tipv = V3(*pts[-1]) - V3(*pts[-2])
        mid = V3(*pts[-1]) - (O + A * ((V3(*pts[-1]) - O).dot(A)))
        if finger_nails:   # a fist's nails face its palm, out of sight
            nails.append((pts[-1], tuple(tipv), tuple(mid), R[-1] * 2))
    # heel of the hand and wrist (in the palm pad)
    sk.palm.append((V3(*palm_bases[0]), V3(*palm_bases[-1]), 0.013, 0.0135))
    sk.palm.append((V3(*lerp3(palm_bases[0], palm_bases[-1], 0.5)), V3(*wrist), 0.015, 0.019))
    # thumb: CMC -> MCP -> IP -> tip, with the thenar pad from the wrist
    tR = (0.0125, 0.0108, 0.0098, 0.0086)
    sk.chain(thumb, tR)
    sk.bone(wrist, thumb[1], 0.017, 0.012)
    sk.bone(palm_bases[0], thumb[1], 0.013, 0.0115)
    tipv = V3(*thumb[-1]) - V3(*thumb[-2])
    if finger_nails:
        nails.append((thumb[-1], tuple(tipv), None, tR[-1] * 2.1))
    # forearm (skin) back toward the sleeve; a separate arm piece when the hand moves on its own
    fd = V3(*forearm_dir).normalized()
    fw = V3(*wrist)
    arm_sk = Skeleton() if split_arm else sk
    arm_sk.bone(tuple(fw - fd * (0.012 if split_arm else 0)), tuple(fw + fd * 0.08), 0.0185, 0.025)

    ob = sweep_mesh(name, sk)
    fuse(ob)
    tint_skin(ob, sk)
    ob.data.materials.append(skin_mat)
    parts = [ob]
    for i, (tip, dirv, out, w) in enumerate(nails):
        if out is None:
            out = thumb_nail
        n = nail(f'{name}_nail{i}', tip, dirv, out, w, nail_mat, skin=ob)
        if n:
            parts.append(n)
        else:
            print(name, 'nail', i, 'tucked away, skipped')
    arm_parts = parts
    if split_arm:
        arm = sweep_mesh(name.replace('Hand', 'Arm'), arm_sk)
        fuse(arm, faces=9000)
        tint_skin(arm, arm_sk)
        arm.data.materials.append(skin_mat)
        arm_parts = [arm]
    arm_parts.append(sleeve(f'{name}_sleeve', wrist, forearm_dir, sleeve_mat))
    # join into one object per piece (materials stay separate primitives in the glTF)
    def join(objs, keep):
        bpy.ops.object.select_all(action='DESELECT')
        for p in objs:
            p.select_set(True)
        bpy.context.view_layer.objects.active = keep
        bpy.ops.object.join()
        return keep
    join(parts, ob).name = name
    if not split_arm:
        return ob, None
    arm = join(arm_parts, arm_parts[0])
    arm.name = name.replace('Hand', 'Arm')
    # pivots for the game: the wrist (where the forearm meets the hand) and the elbow
    for nm, pt in ((name.replace('Hand', 'Wrist'), fw), (name.replace('Hand', 'Elbow'), fw + fd * 0.3)):
        e = bpy.data.objects.new(nm, None)
        e.location = P(*pt)
        bpy.context.collection.objects.link(e)
    return ob, arm

# ---------------------------------------------------------------- the two hands
reset()
skin = material('Skin', srgb(0xc58c6c), 0.55, use_vcol=True)
nailm = material('Nail', srgb(0xd9a898), 0.35)
sleevem = material('Sleeve', srgb(0x1f5f6a), 0.85)

# Right hand on the grip. Axis = rod (z); theta 0 = angler's right (-x), 90 = down.
fr = (V3(0, 0, 0), V3(0, 0, 1), V3(-1, 0, 0), V3(0, -1, 0))
CORE_R = 0.0125 + 0.0088 + 0.0006
right, _ = build_hand(
    'HandR', fr,
    fingers=[('index', 0.112, 0.116, math.radians(20), CORE_R),
             ('middle', 0.094, 0.097, math.radians(22), CORE_R),
             ('ring', 0.046, 0.044, math.radians(25), CORE_R),
             ('pinky', 0.029, 0.026, math.radians(30), 0.0142 + 0.0078 + 0.0006)],
    wrist=(-0.034, 0.034, -0.006),
    palm_bases=[(-0.036, 0.03, 0.05), (-0.037, 0.029, 0.035), (-0.037, 0.026, 0.02), (-0.036, 0.022, 0.006)],
    thumb=[(-0.03, 0.032, 0.022), (-0.017, 0.029, 0.058), (-0.006, 0.0255, 0.086), (-0.001, 0.024, 0.106)],
    forearm_dir=(-0.15, -0.35, -1),
    palm_normal=(1, -0.3, 0), thumb_nail=(-0.2, 1, 0),
    skin_mat=skin, nail_mat=nailm, sleeve_mat=sleevem)

# Left hand round the crank knob. Axis = knob (x); theta 0 = back (-z), 90 = up.
fl = (V3(0, 0, 0), V3(1, 0, 0), V3(0, 0, -1), V3(0, 1, 0))
KNOB = 0.008 + 0.0086 + 0.0006
left, arm_l = build_hand(
    'HandL', fl,
    fingers=[('index', -0.005, -0.004, math.radians(14), KNOB),
             ('middle', 0.0115, 0.012, math.radians(12), KNOB),
             ('ring', 0.028, 0.029, math.radians(14), 0.0115),
             ('pinky', 0.043, 0.043, math.radians(18), 0.0105)],
    wrist=(0.026, -0.05, -0.082),
    palm_bases=[(-0.004, -0.04, -0.06), (0.011, -0.042, -0.064), (0.026, -0.042, -0.064), (0.04, -0.04, -0.06)],
    thumb=[(-0.008, -0.045, -0.058), (-0.02, -0.032, -0.026), (-0.017, -0.019, 0.0), (-0.011, -0.008, 0.017)],
    forearm_dir=(0.3, -0.35, -1),
    palm_normal=(0, 0.5, 0.85), thumb_nail=(-0.4, -0.6, 0.6), split_arm=True, finger_nails=False,
    skin_mat=skin, nail_mat=nailm, sleeve_mat=sleevem)

# Roll the left fist forward round the knob so, seen from the angler's eye, it shows its
# knuckles rather than the backs of the curled fingers.
from mathutils import Matrix
roll = Matrix.Rotation(math.radians(35), 4, 'X')
bpy.context.view_layer.update()   # so matrix_world reflects the empties' locations
for o in (left, arm_l, bpy.data.objects['WristL'], bpy.data.objects['ElbowL']):
    o.matrix_world = roll @ o.matrix_world
bpy.ops.object.select_all(action='DESELECT')
for o in (left, arm_l):
    o.select_set(True)
bpy.context.view_layer.objects.active = left
bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action='DESELECT')
right.select_set(True)
left.select_set(True)
arm_l.select_set(True)
bpy.data.objects['WristL'].select_set(True)
bpy.data.objects['ElbowL'].select_set(True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
kw = dict(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
          # Draco keeps the smooth subsurf'd skin at ~1/15 the size; fine quantisation so it is visually lossless
          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
          export_draco_position_quantization=16, export_draco_normal_quantization=12,
          export_draco_color_quantization=10, export_draco_generic_quantization=12)
try:
    bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
print('exported', OUT, len(right.data.polygons), len(left.data.polygons))

# ---------------------------------------------------------------- optional preview renders
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    cork = material('Cork', srgb(0xb08a5a), 0.9)
    black = material('Black', srgb(0x15171a), 0.4)
    def cyl(r, z0, z1, mat, axis='z', at=(0, 0, 0)):
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(z1 - z0), vertices=24)
        o = bpy.context.object
        mid = (z0 + z1) / 2
        if axis == 'z':
            o.location = P(at[0], at[1], at[2] + mid)
            o.rotation_euler = (math.pi / 2, 0, 0)
        else:
            o.location = P(at[0] + mid, at[1], at[2])
            o.rotation_euler = (0, math.pi / 2, 0)
        o.data.materials.append(mat)
        return o
    cyl(0.015, -0.27, 0.03, cork); cyl(0.0125, 0.03, 0.12, black); cyl(0.0115, 0.12, 0.24, cork)
    bpy.ops.mesh.primitive_cube_add(size=1)
    f = bpy.context.object; f.scale = (0.012, 0.03, 0.06); f.location = P(0, -0.04, 0.07); f.data.materials.append(black)
    # the left hand is previewed beside the reel at an arbitrary knob spot
    left.location = P(0.057, -0.025, 0.07)
    arm_l.location = left.location
    cyl(0.008, -0.0125, 0.0125, black, axis='x', at=(0.057, -0.025, 0.07))
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_cavity = True
    sc.render.resolution_x, sc.render.resolution_y = 900, 700
    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 50
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    target = P(0.01, -0.01, 0.06)
    views = {'firstperson': P(-0.09, 0.22, -0.32), 'side_right': P(-0.35, 0.05, 0.05), 'side_left': P(0.35, 0.02, 0.0), 'below': P(0.02, -0.35, 0.08), 'top': P(0.0, 0.38, 0.06)}
    for vname, pos in views.items():
        cam.location = pos
        d = (target - pos).normalized()
        cam.rotation_euler = d.to_track_quat('-Z', 'Z').to_euler()
        sc.render.filepath = os.path.join(PREVIEW, f'hands_{vname}.png')
        bpy.ops.render.render(write_still=True)
