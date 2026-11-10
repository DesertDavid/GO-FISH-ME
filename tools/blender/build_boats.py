# Builds every boat in the game and exports one GLB per boat to public/models/boats/.
# Run:  blender -b --factory-startup --python tools/blender/build_boats.py
# Axes (Blender): +X = bow, +Y = port, +Z = up. Origin: keel bottom at midship.
import bpy, bmesh, math, os, sys, json
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models', 'boats')
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- helpers
def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for d in list(coll):
            coll.remove(d)

_mats = {}
def mat(name, color, metal=0.0, rough=0.5, emit=None):
    key = name
    if key in _mats and _mats[key].name in bpy.data.materials:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 2.0
    _mats[key] = m
    return m

def srgb(h):
    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c((h >> 16) & 255), c((h >> 8) & 255), c(h & 255))

def link(obj, parent):
    bpy.context.scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj

def mesh_obj(name, bm, material, parent, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    if material is not None:
        if isinstance(material, (list, tuple)):
            for mm in material:
                o.data.materials.append(mm)
        else:
            o.data.materials.append(material)
    return link(o, parent)

def box(name, size, loc, material, parent, bevel=0.02, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    o = mesh_obj(name, bm, material, parent)
    o.location = loc
    o.rotation_euler = rot
    if bevel > 0:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = 3
        m.limit_method = 'ANGLE'
        for p in o.data.polygons:
            p.use_smooth = True
    return o

def cyl(name, r, depth, loc, material, parent, rot=(0, 0, 0), seg=20, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    o = mesh_obj(name, bm, material, parent, smooth=True)
    o.location = loc
    o.rotation_euler = rot
    return o

def sphere(name, r, loc, material, parent, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=r)
    o = mesh_obj(name, bm, material, parent, smooth=True)
    o.location = loc
    o.scale = scale
    return o

def tube(name, pts, r, material, parent, cyclic=False):
    """Polyline rail/pipe through pts, converted to a mesh."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1)
    sp.use_cyclic_u = cyclic
    tmp = bpy.data.objects.new(name + '_c', cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp, do_unlink=True)
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(material)
    return link(o, parent)

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

# ---------------------------------------------------------------- hull
def hull_profile(spec, t):
    """t: 0 stern .. 1 bow. Returns half-beam, keel z, chine z, sheer z."""
    B, D = spec['beam'] / 2, spec['depth']
    tw, bowMin = spec.get('transom', 0.85), spec.get('bowMin', 0.02)
    if t < 0.55:
        b = tw + (1 - tw) * math.sin(t / 0.55 * math.pi / 2)
    else:
        u = (t - 0.55) / 0.45
        b = max(bowMin, (1 - u ** spec.get('bowPow', 1.9)) ** 0.62)
    b *= B
    rise = spec.get('bowRise', 0.55)
    k = D * rise * max(0.0, (t - spec.get('forefoot', 0.68)) / (1 - spec.get('forefoot', 0.68))) ** 2
    dead = math.tan(math.radians(spec.get('deadrise', 18) * (1 + 0.8 * smoothstep(0.5, 1.0, t))))
    chine = k + b * dead * 0.9
    sheer = D * (1 + spec.get('sheer', 0.18) * smoothstep(0.35, 1.0, t) ** 1.5)
    chine = min(chine, sheer - 0.1 * D)
    return b, k, chine, sheer

def build_hull(spec, parent, mats):
    L = spec['length']
    NS, flare = 28, spec.get('flare', 0.06)
    bm = bmesh.new()
    rings = []
    for i in range(NS + 1):
        t = i / NS
        x = -L / 2 + L * t
        b, k, ch, sh = hull_profile(spec, t)
        # port sheer -> port chine -> bottom -> keel -> mirror
        sec = [(b * (1 + flare), sh), (b, ch), (b * 0.55, k + (ch - k) * 0.5), (0.0, k)]
        pts = sec + [(-y, z) for (y, z) in reversed(sec[:-1])]
        rings.append([bm.verts.new((x, y, z)) for (y, z) in pts])
    M = len(rings[0])
    for i in range(NS):
        for j in range(M - 1):
            bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]))
    transom = bm.faces.new(list(reversed(rings[0])))  # transom
    bm.faces.new(rings[-1])                           # stem cap (tiny)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # paint: bottom (antifoul), boot stripe, topsides, transom
    wl = spec['depth'] * spec.get('waterline', 0.38)
    for f in bm.faces:
        zc = sum(v.co.z for v in f.verts) / len(f.verts)
        if zc < wl:
            f.material_index = 0
        elif zc < wl + spec['depth'] * 0.12:
            f.material_index = 1
        else:
            f.material_index = 2
    transom.material_index = 2
    o = mesh_obj('hull', bm, [mats['bottom'], mats['stripe'], mats['topside']], parent, smooth=True)
    sub = o.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = 2
    sol = o.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = max(0.03, L * 0.004)
    sol.offset = -1
    # deck
    dz = spec.get('deckDrop', 0.35)
    bm = bmesh.new()
    prev = None
    for i in range(1, NS):
        t = i / NS
        x = -L / 2 + L * t
        b, k, ch, sh = hull_profile(spec, t)
        z = sh - dz * (1 - 0.6 * smoothstep(0.75, 1.0, t))
        w = b * 0.97
        row = (bm.verts.new((x, w, z)), bm.verts.new((x, -w, z)))
        if prev:
            bm.faces.new((prev[0], prev[1], row[1], row[0]))
        prev = row
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    deck = mesh_obj('deck', bm, mats['deck'], parent)
    # gunwale cap rail
    pts = []
    for i in range(0, NS + 1):
        t = i / NS
        b, k, ch, sh = hull_profile(spec, t)
        pts.append((-L / 2 + L * t, b * (1 + flare), sh))
    for s in (1, -1):
        tube('gunwale', [(p[0], p[1] * s, p[2]) for p in pts], max(0.025, L * 0.0035), mats['trim'], parent)
    return o

def sheer_at(spec, x):
    t = (x + spec['length'] / 2) / spec['length']
    return hull_profile(spec, t)

def deck_z(spec, x):
    b, k, ch, sh = sheer_at(spec, x)
    t = (x + spec['length'] / 2) / spec['length']
    return sh - spec.get('deckDrop', 0.35) * (1 - 0.6 * smoothstep(0.75, 1.0, t))

# ---------------------------------------------------------------- parts
def outboard(parent, x, y, z, scale, paint, name='outboard'):
    s = scale
    dark = mat('engine_dark', srgb(0x1a1c1f), 0.2, 0.45)
    box(name + '_cowl', (0.55 * s, 0.42 * s, 0.55 * s), (x - 0.15 * s, y, z + 0.32 * s), paint, parent, bevel=0.12 * s)
    box(name + '_mid', (0.22 * s, 0.16 * s, 0.75 * s), (x - 0.1 * s, y, z - 0.25 * s), dark, parent, bevel=0.04 * s)
    box(name + '_plate', (0.42 * s, 0.03 * s, 0.05 * s), (x - 0.12 * s, y, z - 0.55 * s), dark, parent, bevel=0.01 * s)
    cyl(name + '_gear', 0.07 * s, 0.4 * s, (x - 0.12 * s, y, z - 0.7 * s), dark, parent, rot=(0, math.pi / 2, 0), r2=0.05 * s)
    box(name + '_skeg', (0.12 * s, 0.02 * s, 0.18 * s), (x - 0.12 * s, y, z - 0.82 * s), dark, parent, bevel=0.005)
    chrome = mat('prop_steel', srgb(0xc8ccd0), 1.0, 0.2)
    for k in range(3):
        a = k * 2 * math.pi / 3
        box(name + '_blade', (0.02 * s, 0.13 * s, 0.07 * s), (x - 0.35 * s, y + math.cos(a) * 0.08 * s, z - 0.7 * s + math.sin(a) * 0.08 * s), chrome, parent, bevel=0.005, rot=(a, 0.3, 0))

def console(parent, x, z, w, h, d, white, glass, name='console'):
    box(name, (d, w, h), (x, 0, z + h / 2), white, parent, bevel=0.05)
    box(name + '_dash', (d * 0.5, w * 0.92, 0.04), (x + d * 0.15, 0, z + h + 0.02), mat('dash', srgb(0x202326), 0, 0.6), parent, bevel=0.01, rot=(0, -0.35, 0))
    box(name + '_glass', (0.02, w * 0.95, h * 0.35), (x + d * 0.42, 0, z + h + h * 0.15), glass, parent, bevel=0.0, rot=(0, -0.45, 0))
    cyl(name + '_wheel', 0.17, 0.03, (x - d * 0.1, 0.12 * w, z + h + 0.12), mat('wheel', srgb(0x111111), 0.3, 0.4), parent, rot=(0, 1.1, 0), seg=24)
    # helm display glow
    box(name + '_screen', (0.02, 0.32 * w, 0.18), (x + d * 0.05, -0.12 * w, z + h + 0.1), mat('screen', srgb(0x0a2030), 0, 0.2, emit=srgb(0x2aa6ff)), parent, bevel=0, rot=(0, -0.6, 0))

def seat(parent, x, y, z, vinyl, pedestal=True, name='seat'):
    steel = mat('steel', srgb(0xb8bec4), 1.0, 0.25)
    if pedestal:
        cyl(name + '_post', 0.04, 0.5, (x, y, z + 0.25), steel, parent)
    zz = z + (0.5 if pedestal else 0.0)
    box(name + '_cush', (0.45, 0.45, 0.1), (x, y, zz + 0.05), vinyl, parent, bevel=0.04)
    box(name + '_back', (0.08, 0.42, 0.35), (x - 0.2, y, zz + 0.25), vinyl, parent, bevel=0.03)

def rod_holders(parent, pts, steel):
    for i, p in enumerate(pts):
        cyl('holder%d' % i, 0.025, 0.25, p, steel, parent, rot=(0, -0.5, 0))

def ttop(parent, x, z, L, W, H, top_mat, frame, legs=4):
    hx = L / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            tube('ttop_leg', [(x + sx * hx * 0.8, sy * W / 2 * 0.9, z), (x + sx * hx * 0.8, sy * W / 2 * 0.9, z + H)], 0.03, frame, parent)
    box('ttop_top', (L, W, 0.08), (x, 0, z + H + 0.04), top_mat, parent, bevel=0.03)
    tube('ttop_rail', [(x - hx, W / 2, z + H + 0.1), (x + hx, W / 2, z + H + 0.1), (x + hx, -W / 2, z + H + 0.1), (x - hx, -W / 2, z + H + 0.1)], 0.02, frame, parent, cyclic=True)

def bow_rail(spec, parent, steel, start=0.62, h=0.6):
    L = spec['length']
    pts = []
    for i in range(14):
        t = start + (1.0 - start) * i / 13
        b, k, ch, sh = hull_profile(spec, min(t, 0.985))
        pts.append((-L / 2 + L * t, b * 0.85, sh + h))
    full = pts + [(p[0], -p[1], p[2]) for p in reversed(pts)]
    tube('bowrail', full, 0.022, steel, parent)
    for p in pts[::3]:
        for s in (1, -1):
            b, k, ch, sh = sheer_at(spec, p[0])
            tube('stanchion', [(p[0], p[1] * s, sh), (p[0], p[1] * s, p[2])], 0.016, steel, parent)

def cabin(parent, x, z, L, W, H, white, glass, name='cabin'):
    box(name, (L, W, H), (x, 0, z + H / 2), white, parent, bevel=0.12)
    for s in (1, -1):
        box(name + '_win', (L * 0.7, 0.03, H * 0.35), (x, s * (W / 2 + 0.005), z + H * 0.62), glass, parent, bevel=0.0)
    box(name + '_front', (0.03, W * 0.85, H * 0.4), (x + L / 2 + 0.005, 0, z + H * 0.62), glass, parent, bevel=0.0, rot=(0, -0.25, 0))

def outrigger(parent, x, y, z, side, steel):
    tip = (x - 3.0, y + side * 5.5, z + 6.5)
    tube('outrigger', [(x, y, z), tip], 0.035, steel, parent)
    tube('outrigger_line', [tip, (x - 6, y + side * 0.5, z - 0.5)], 0.004, mat('line', srgb(0xeeeeee), 0, 0.5), parent)

def life_ring(parent, loc, rot):
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, segments=20, radius=0.3)
    o = mesh_obj('lifering_c', bm, None, parent)
    bpy.data.objects.remove(o, do_unlink=True)
    pts = [(0.3 * math.cos(a * 2 * math.pi / 24), 0.3 * math.sin(a * 2 * math.pi / 24), 0) for a in range(24)]
    r = tube('lifering', pts, 0.06, mat('lifering', srgb(0xff5a1f), 0, 0.5), parent, cyclic=True)
    r.location = loc
    r.rotation_euler = rot

# ---------------------------------------------------------------- boats
def common_mats(top, bottom, stripe, deck, trim=0x9aa3ab):
    return {
        'topside': mat('topside', srgb(top), 0.05 if top != 0xb7bcc0 else 0.8, 0.25 if top != 0xb7bcc0 else 0.35),
        'bottom': mat('bottom', srgb(bottom), 0.0, 0.6),
        'stripe': mat('stripe', srgb(stripe), 0.1, 0.3),
        'deck': mat('deck_nonskid', srgb(deck), 0.0, 0.85),
        'trim': mat('trim', srgb(trim), 0.8, 0.3),
    }

# ---------------------------------------------------------------- jon boat (riveted aluminium)
JON = dict(length=3.8, beam=1.55, depth=0.55, deckDrop=0.42, sheer=0.20)

def jon_sections(t):
    """t 0 stern..1 bow. Returns (top half-width, bottom half-width, bottom z, sheer z)."""
    L, B, D = JON['length'], JON['beam'] / 2, JON['depth']
    # plan: parallel sides to ~50%, then a long taper to a squared punt bow
    if t < 0.5:
        w = B * (0.93 + 0.07 * math.sin(t / 0.5 * math.pi / 2))
    else:
        u = (t - 0.5) / 0.5
        w = B * (0.05 + 0.95 * (1 - u ** 1.6) ** 0.85)
    bw = w * 0.78 - 0.02                                   # flat bottom, sides flare out
    rake = 0.34 * smoothstep(0.55, 1.0, t) ** 1.5          # bow rocker / raked stem
    zs = D * (1 + JON['sheer'] * smoothstep(0.35, 1.0, t) ** 1.5)
    return w, bw, rake, zs

def jon_z(x):
    return jon_sections((x + JON['length'] / 2) / JON['length'])

def build_jon(root):
    spec = dict(JON)
    green = mat('jon_paint', srgb(0x1b58a6), 0.0, 0.45)
    bare = mat('alu_bare', srgb(0xb4bbc0), 0.9, 0.35)
    alu = mat('jon_grey', srgb(0x8e9498), 0.0, 0.7)
    alu_dark = mat('jon_grey_dk', srgb(0x676c70), 0.0, 0.8)
    rivet = mat('rivet', srgb(0xc9cfd3), 0.95, 0.3)
    weld = mat('weld', srgb(0x6f777b), 0.7, 0.6)
    ply = mat('transom_ply', srgb(0x6b5233), 0.0, 0.8)
    black = mat('jon_black', srgb(0x141517), 0.3, 0.5)
    steel = mat('steel', srgb(0xb8bec4), 1.0, 0.25)
    L = spec['length']
    NS = 40
    xs = [-L / 2 + L * i / NS for i in range(NS + 1)]
    T = 0.014

    def ring(i, inset=0.0):
        w, bw, zb, zs = jon_sections(i / NS)
        w2, bw2, zb2 = w - inset * 1.1, bw - inset, zb + inset
        zm = zb2 + (zs - zb2) * 0.30
        wm = bw2 + (w2 - bw2) * 0.30
        return [(xs[i], w2, zs), (xs[i], wm, zm), (xs[i], bw2, zb2), (xs[i], -bw2, zb2), (xs[i], -wm, zm), (xs[i], -w2, zs)]

    def shell(name, inset, material, outward):
        bm = bmesh.new()
        rs = [[bm.verts.new(p) for p in ring(i, inset)] for i in range(NS + 1)]
        for i in range(NS):
            for j in range(5):
                f = bm.faces.new((rs[i][j], rs[i + 1][j], rs[i + 1][j + 1], rs[i][j + 1]))
                f.material_index = 0 if j == 0 or j == 4 else 1
        bm.faces.new(rs[0][::-1])
        bm.faces.new(rs[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)   # outward
        if not outward:
            for f in bm.faces:
                f.normal_flip()
        return mesh_obj(name, bm, material, root)

    shell('hull_out', 0.0, [green, bare], True)
    # inner skin shows bare aluminium; open at the top, so drop the end caps' visibility issue
    shell('hull_in', T, [alu, alu], False)

    # rolled gunwale + rolled transom/bow edges
    for s in (1, -1):
        tube('gunwale', [(xs[i], s * (jon_sections(i / NS)[0] + 0.004), jon_sections(i / NS)[3]) for i in range(NS + 1)], 0.022, alu, root)
    w0, bw0, zb0, zs0 = jon_sections(0.0)
    tube('transom_roll', [(xs[0], w0, zs0), (xs[0], -w0, zs0)], 0.022, alu, root)
    w1, bw1, zb1, zs1 = jon_sections(1.0)
    tube('bow_roll', [(xs[-1], w1, zs1), (xs[-1], -w1, zs1)], 0.022, alu, root)

    # floor plate (walking surface = game eye reference) + corrugation ribs
    zf = spec['depth'] - spec['deckDrop']
    bm = bmesh.new()
    prev = None
    for i in range(2, NS - 7):
        w, bw, zb, zs = jon_sections(i / NS)
        z = zf + zb
        row = (bm.verts.new((xs[i], bw * 0.97, z)), bm.verts.new((xs[i], -bw * 0.97, z)))
        if prev:
            bm.faces.new((prev[0], prev[1], row[1], row[0]))
        prev = row
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    mesh_obj('floor', bm, alu_dark, root)
    x = xs[3]
    while x < xs[NS - 8]:
        w, bw, zb, zs = jon_z(x)
        box('rib', (0.035, bw * 1.9, 0.022), (x, 0, zf + zb + 0.011), alu, root, bevel=0.006)
        x += 0.22

    # boxy bench seats (trapezoid section follows the flared sides), ribbed tops
    def wid_at(x, z):
        w, bw, zb, zs = jon_z(x)
        return bw + (w - bw) * max(0.0, min(1.0, (z - zb) / (zs - zb)))
    for bx, bd, full in ((-1.22, 0.36, True), (-0.12, 0.34, False), (0.98, 0.32, True)):
        w, bw, zb, zs = jon_z(bx)
        zt = zs - 0.14
        zlow = zf + 0.01
        hw_t, hw_b = wid_at(bx, zt) - 0.06, wid_at(bx, zlow) - 0.06
        bm = bmesh.new()
        v = [[bm.verts.new((bx + sx * bd / 2, sy * hw, z)) for sy, hw, z in ((1, hw_t, zt), (-1, hw_t, zt), (-1, hw_b, zlow), (1, hw_b, zlow))] for sx in (-1, 1)]
        for k in range(4):
            bm.faces.new((v[0][k], v[1][k], v[1][(k + 1) % 4], v[0][(k + 1) % 4]))
        bm.faces.new(v[0][::-1]); bm.faces.new(v[1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        mesh_obj('bench_box', bm, alu, root)
        box('bench_top', (bd + 0.02, hw_t * 2, 0.02), (bx, 0, zt + 0.01), alu_dark, root, bevel=0.006)
        for k in range(10):
            box('bench_rib', (0.018, hw_t * 1.85, 0.008), (bx - bd / 2 + 0.04 + k * (bd - 0.08) / 9, 0, zt + 0.024), alu, root, bevel=0.002)
    # centre bench has an open front lip gap: floor frame rails under the walking surface
    for s_ in (1, -1):
        box('floor_rail', (2.0, 0.04, 0.03), (-0.3, s_ * 0.34, zf + 0.015), alu, root, bevel=0.005)
    # bow tip cap and transom corner caps (bright aluminium)
    for s_ in (1, -1):
        w0_, _, _, zs_ = jon_z(xs[0])
        box('corner_cap', (0.13, 0.13, 0.025), (xs[0] + 0.06, s_ * (w0_ - 0.05), zs_ + 0.004), bare, root, bevel=0.01)
    box('bow_cap', (0.22, 0.12, 0.025), (xs[-1] - 0.08, 0, jon_z(xs[-1])[3] + 0.004), bare, root, bevel=0.01)
    # transom: plywood cap, rolled top, corner posts
    box('transom_ply', (0.05, 0.92, 0.26), (xs[0] + 0.03, 0, zs0 - 0.15), alu_dark, root, bevel=0.01)
    box('transom_cap', (0.06, 0.98, 0.025), (xs[0] + 0.03, 0, zs0 - 0.02), alu, root, bevel=0.005)
    # bow: welded stem band, eye, cleats
    box('stem_band', (0.03, 0.10, zs1 - zb1), (xs[-1] + 0.01, 0, (zs1 + zb1) / 2), weld, root, bevel=0.006)
    ring_pts = [(xs[-1] + 0.02 + 0.06 * math.sin(a / 12 * 2 * math.pi), 0, zs1 - 0.20 + 0.06 * math.cos(a / 12 * 2 * math.pi)) for a in range(13)]
    tube('bow_eye', ring_pts, 0.01, steel, root, cyclic=True)
    for s in (1, -1):
        cw = jon_z(1.6)
        box('cleat', (0.16, 0.035, 0.03), (1.6, s * (cw[0] - 0.12), cw[3] - 0.03), steel, root, bevel=0.01)
    # fuel tank, tackle box, rod holders
    tz = zf + 0.14
    box('fuel_tank', (0.42, 0.26, 0.28), (-1.5, -0.42, tz), mat('fuel_red', srgb(0xb3261c), 0.0, 0.4), root, bevel=0.05)
    cyl('fuel_cap', 0.04, 0.03, (-1.5, -0.42, tz + 0.15), black, root)
    tube('fuel_hose', [(-1.5, -0.42, tz + 0.12), (-1.7, -0.3, tz + 0.05), (-1.78, -0.1, tz + 0.05), (-1.9, 0.0, zf + 0.3)], 0.012, black, root)
    box('tackle_box', (0.38, 0.22, 0.16), (-0.55, 0.42, zf + 0.09), mat('tackle', srgb(0x2e6a52), 0.0, 0.5), root, bevel=0.03)
    for s in (1, -1):
        w, bw, zb, zs = jon_z(0.3)
        cyl('rod_holder', 0.026, 0.22, (0.3, s * (w - 0.08), zs - 0.02), black, root)
    # tiller outboard
    ob_x, ob_z = xs[0] - 0.04, zs0 + 0.02
    cowl = mat('cowl_jon', srgb(0xc8cbc7), 0.15, 0.35)
    stripe = mat('cowl_stripe', srgb(0x2d4a63), 0.15, 0.35)
    box('ob_cowl', (0.46, 0.34, 0.34), (ob_x - 0.20, 0, ob_z + 0.12), cowl, root, bevel=0.10)
    box('ob_stripe', (0.47, 0.345, 0.045), (ob_x - 0.20, 0, ob_z + 0.06), stripe, root, bevel=0.01)
    box('ob_clamp', (0.12, 0.30, 0.22), (ob_x - 0.05, 0, ob_z - 0.02), black, root, bevel=0.02)
    for s in (1, -1):
        cyl('ob_screw', 0.022, 0.14, (ob_x - 0.07, s * 0.19, ob_z - 0.02), steel, root, rot=(math.pi / 2, 0, 0))
        box('ob_knob', (0.05, 0.025, 0.05), (ob_x - 0.07, s * 0.27, ob_z - 0.02), black, root, bevel=0.01)
    box('ob_leg', (0.24, 0.12, 0.66), (ob_x - 0.16, 0, ob_z - 0.38), cowl, root, bevel=0.04)
    box('ob_plate', (0.36, 0.20, 0.025), (ob_x - 0.18, 0, ob_z - 0.68), cowl, root, bevel=0.01)
    cyl('ob_gear', 0.065, 0.42, (ob_x - 0.20, 0, ob_z - 0.78), black, root, rot=(0, math.pi / 2, 0), r2=0.045)
    cyl('ob_nose', 0.05, 0.12, (ob_x - 0.40, 0, ob_z - 0.78), black, root, rot=(0, math.pi / 2, 0), r2=0.025)
    box('ob_skeg', (0.14, 0.02, 0.16), (ob_x - 0.18, 0, ob_z - 0.91), black, root, bevel=0.004)
    for k in range(3):
        a = k * 2 * math.pi / 3
        box('prop_blade', (0.03, 0.15, 0.06), (ob_x - 0.41, math.cos(a) * 0.08, ob_z - 0.78 + math.sin(a) * 0.08), steel, root, bevel=0.004, rot=(a, 0.35, 0))
    box('tiller_mount', (0.10, 0.10, 0.09), (ob_x + 0.03, 0.0, ob_z + 0.08), black, root, bevel=0.02)
    tube('tiller', [(ob_x + 0.0, 0.0, ob_z + 0.09), (ob_x + 0.20, 0.01, ob_z + 0.13), (ob_x + 0.45, 0.04, ob_z + 0.19)], 0.016, black, root)
    cyl('tiller_grip', 0.025, 0.14, (ob_x + 0.52, 0.05, ob_z + 0.20), mat('grip', srgb(0x1d1d1f), 0.0, 0.8), root, rot=(0, math.pi / 2, 0))
    for m_ in (green, bare, alu, alu_dark):
        m_.use_backface_culling = True            # no outer-hull backfaces showing through the cockpit
    return spec

def build_bass(root):
    spec = dict(length=6.2, beam=2.35, depth=0.78, deadrise=22, transom=0.88, bowPow=1.6, bowRise=0.5,
                sheer=0.12, flare=0.04, deckDrop=0.18, waterline=0.4)
    m = common_mats(0xb3121c, 0x1d1f24, 0xe8e8e8, 0x2a2e33)
    m['topside'] = mat('metalflake_red', srgb(0xb3121c), 0.75, 0.22)
    build_hull(spec, root, m)
    white = mat('gel_white', srgb(0xf2f2ef), 0.0, 0.2)
    glass = mat('glass', srgb(0x10181c), 0.2, 0.05)
    console(root, 0.2, deck_z(spec, 0.2), 0.55, 0.55, 0.5, white, glass)
    vinyl = mat('vinyl_grey', srgb(0x3c4148), 0, 0.55)
    seat(root, -0.5, 0.42, deck_z(spec, -0.5), vinyl, pedestal=False, name='seat_d')
    seat(root, -0.5, -0.42, deck_z(spec, -0.5), vinyl, pedestal=False, name='seat_p')
    seat(root, -2.3, 0, deck_z(spec, -2.3), vinyl, pedestal=True, name='seat_rear')
    seat(root, 2.2, 0, deck_z(spec, 2.2), vinyl, pedestal=True, name='seat_front')
    outboard(root, -3.25, 0, 0.75, 1.25, mat('cowl_bass', srgb(0x0f1012), 0.4, 0.25))
    # trolling motor on the bow
    tm = mat('tm', srgb(0x1a1a1a), 0.3, 0.5)
    box('tm_mount', (0.4, 0.2, 0.08), (2.9, 0.25, deck_z(spec, 2.9) + 0.05), tm, root, bevel=0.02)
    tube('tm_shaft', [(3.0, 0.25, deck_z(spec, 3.0) + 0.1), (3.05, 0.25, -0.3)], 0.02, tm, root)
    cyl('tm_motor', 0.06, 0.3, (3.05, 0.25, -0.35), tm, root, rot=(0, math.pi / 2, 0))
    return spec

def build_skiff(root):
    spec = dict(length=5.6, beam=2.1, depth=0.62, deadrise=10, transom=0.9, bowPow=1.7, bowRise=0.45,
                sheer=0.14, flare=0.05, deckDrop=0.2, waterline=0.35)
    m = common_mats(0xf4f4f0, 0x9fb7c2, 0x7fc1d6, 0xcfe3ea)
    build_hull(spec, root, m)
    white = mat('gel_white', srgb(0xf4f4f0), 0.0, 0.2)
    glass = mat('glass', srgb(0x10181c), 0.2, 0.05)
    console(root, 0.0, deck_z(spec, 0.0), 0.6, 0.85, 0.5, white, glass)
    vinyl = mat('vinyl_tan', srgb(0xcbbf9e), 0, 0.6)
    box('cooler_seat', (0.45, 0.7, 0.45), (0.6, 0, deck_z(spec, 0.6) + 0.22), vinyl, root, bevel=0.05)
    outboard(root, -2.95, 0, 0.6, 1.0, mat('cowl_skiff', srgb(0xe9e9e9), 0.2, 0.25))
    steel = mat('steel', srgb(0xb8bec4), 1.0, 0.25)
    # poling platform over the engine
    z0 = deck_z(spec, -2.5)
    for sx in (-2.2, -2.75):
        for sy in (0.45, -0.45):
            tube('pp_leg', [(sx, sy, z0), (sx - 0.3, sy * 0.8, z0 + 1.15)], 0.025, steel, root)
    box('pp_top', (0.6, 0.85, 0.05), (-2.75, 0, z0 + 1.18), mat('pp_deck', srgb(0xd8e6eb), 0, 0.8), root, bevel=0.02)
    tube('pushpole', [(-1.5, 1.0, deck_z(spec, -1.5) + 0.08), (2.4, 0.9, deck_z(spec, 2.4) + 0.08)], 0.02, mat('pole', srgb(0xe7d9a8), 0, 0.5), root)
    return spec

def build_center(root):
    spec = dict(length=8.6, beam=2.8, depth=1.35, deadrise=24, transom=0.86, bowPow=1.7, bowRise=0.5,
                sheer=0.16, flare=0.06, deckDrop=0.75, waterline=0.38)
    m = common_mats(0xf5f5f2, 0x10234a, 0x10234a, 0xe6e8e4)
    build_hull(spec, root, m)
    white = mat('gel_white', srgb(0xf5f5f2), 0.0, 0.2)
    glass = mat('glass', srgb(0x10181c), 0.2, 0.05)
    steel = mat('steel', srgb(0xc6ccd2), 1.0, 0.2)
    dz = deck_z(spec, 0.4)
    console(root, 0.4, dz, 1.0, 1.15, 0.9, white, glass)
    vinyl = mat('vinyl_white', srgb(0xe8e6df), 0, 0.5)
    box('leaning_post', (0.6, 1.0, 0.95), (-0.6, 0, dz + 0.48), white, root, bevel=0.08)
    box('lp_cush', (0.2, 0.95, 0.45), (-0.88, 0, dz + 1.05), vinyl, root, bevel=0.06)
    ttop(root, 0.1, dz, 2.3, 1.9, 2.15, mat('ttop', srgb(0xf2f2f0), 0, 0.3), steel)
    rod_holders(root, [(-0.6 + i * 0.25, 0.95, dz + 2.3) for i in range(4)] + [(-0.6 + i * 0.25, -0.95, dz + 2.3) for i in range(4)], steel)
    for y in (0.48, -0.48):
        outboard(root, -4.55, y, 1.25, 1.55, mat('cowl_cc', srgb(0xf0f0f0), 0.2, 0.2), name='ob%d' % (1 if y > 0 else 2))
    bow_rail(spec, root, steel, 0.6, 0.55)
    box('bow_seat', (1.1, 1.5, 0.35), (2.7, 0, deck_z(spec, 2.7) + 0.17), vinyl, root, bevel=0.06)
    life_ring(root, (-1.8, 1.1, dz + 0.7), (math.pi / 2, 0, 0))
    return spec

def build_sport(root):
    spec = dict(length=14.0, beam=4.6, depth=2.5, deadrise=17, transom=0.9, bowPow=1.6, bowRise=0.45,
                sheer=0.2, flare=0.07, deckDrop=0.95, waterline=0.4)
    m = common_mats(0xf6f6f3, 0x0d1a2c, 0x0d1a2c, 0xd9c7a2)
    m['deck'] = mat('teak', srgb(0xb08552), 0, 0.6)
    build_hull(spec, root, m)
    white = mat('gel_white', srgb(0xf6f6f3), 0.0, 0.18)
    glass = mat('glass', srgb(0x0b1216), 0.3, 0.04)
    steel = mat('steel', srgb(0xc6ccd2), 1.0, 0.2)
    dz = deck_z(spec, 0.0)
    cabin(root, 1.6, dz, 6.5, 3.9, 2.1, white, glass)
    # flybridge + tower
    fz = dz + 2.1
    box('flybridge', (4.0, 3.6, 0.9), (0.9, 0, fz + 0.45), white, root, bevel=0.1)
    box('fly_glass', (0.03, 3.3, 0.45), (2.95, 0, fz + 1.1), glass, root, bevel=0, rot=(0, -0.4, 0))
    ttop(root, 0.9, fz + 0.9, 3.4, 3.2, 2.0, white, steel)
    for s in (1, -1):
        outrigger(root, 0.6, s * 1.7, fz + 0.9, s, steel)
    # cockpit + fighting chair
    cz = deck_z(spec, -4.5)
    cyl('chair_post', 0.12, 0.6, (-4.5, 0, cz + 0.3), steel, root)
    box('chair', (0.7, 0.75, 0.15), (-4.5, 0, cz + 0.68), mat('vinyl_white', srgb(0xe8e6df), 0, 0.5), root, bevel=0.06)
    box('chair_back', (0.15, 0.7, 0.7), (-4.85, 0, cz + 1.05), mat('vinyl_white', srgb(0xe8e6df), 0, 0.5), root, bevel=0.06)
    tube('footrest', [(-3.9, 0.35, cz + 0.4), (-3.9, -0.35, cz + 0.4)], 0.03, steel, root)
    bow_rail(spec, root, steel, 0.65, 0.7)
    life_ring(root, (-2.0, 1.97, dz + 1.0), (math.pi / 2, 0, 0))
    return spec

def build_trawler(root):
    spec = dict(length=20.0, beam=6.4, depth=3.4, deadrise=14, transom=0.82, bowPow=1.5, bowRise=0.4,
                sheer=0.24, flare=0.08, deckDrop=1.1, waterline=0.42)
    m = common_mats(0x1f4f7a, 0x8c2a1f, 0xf0f0f0, 0x5d6266, trim=0x2a2c2f)
    m['topside'] = mat('steel_blue', srgb(0x1f4f7a), 0.35, 0.45)
    build_hull(spec, root, m)
    white = mat('house_white', srgb(0xeeeeea), 0.1, 0.35)
    glass = mat('glass', srgb(0x0b1216), 0.3, 0.05)
    rust = mat('rust_orange', srgb(0xd1471c), 0.3, 0.5)
    steel = mat('galv', srgb(0x9aa0a6), 0.9, 0.4)
    dz = deck_z(spec, 3.5)
    box('wheelhouse', (4.5, 4.6, 2.6), (4.2, 0, dz + 1.3), white, root, bevel=0.12)
    box('wh_upper', (2.6, 3.6, 1.4), (4.6, 0, dz + 3.3), white, root, bevel=0.1)
    for s in (1, -1):
        box('wh_win', (2.2, 0.03, 0.55), (4.6, s * 1.81, dz + 3.4), glass, root, bevel=0)
    box('wh_front', (0.03, 3.3, 0.6), (5.93, 0, dz + 3.4), glass, root, bevel=0, rot=(0, -0.2, 0))
    tube('mast', [(5.0, 0, dz + 4.0), (5.0, 0, dz + 9.5)], 0.12, steel, root)
    for s in (1, -1):
        tube('boom', [(5.0, 0, dz + 5.0), (2.0, s * 4.5, dz + 6.5)], 0.08, steel, root)
    sphere('radar', 0.35, (5.0, 0, dz + 9.6), white, root, scale=(2.2, 0.7, 0.3))
    # stern A-frame gantry + net drum
    sz = deck_z(spec, -8.5)
    for s in (1, -1):
        tube('gantry_leg', [(-8.0, s * 2.6, sz), (-9.3, s * 2.4, sz + 5.0)], 0.18, rust, root)
    tube('gantry_top', [(-9.3, 2.4, sz + 5.0), (-9.3, -2.4, sz + 5.0)], 0.18, rust, root)
    cyl('net_drum', 1.0, 4.0, (-5.5, 0, sz + 1.2), mat('net_green', srgb(0x2c6b3a), 0, 0.9), root, rot=(math.pi / 2, 0, 0), seg=28)
    for s in (1, -1):
        cyl('drum_flange', 1.3, 0.12, (-5.5, s * 2.05, sz + 1.2), rust, root, rot=(math.pi / 2, 0, 0), seg=28)
    for s in (1, -1):
        box('otter_board', (1.6, 0.15, 1.0), (-8.6, s * 3.25, sz + 0.6), rust, root, bevel=0.04)
    for i in range(6):
        box('fishbox', (0.9, 0.6, 0.4), (-2.0 - (i % 3) * 1.0, (1 if i < 3 else -1) * 1.6, deck_z(spec, -2) + 0.2), mat('fishbox_blue', srgb(0x2a6fd6), 0, 0.5), root, bevel=0.03)
    box('funnel', (1.0, 1.0, 2.4), (2.2, 0, dz + 3.0), mat('funnel', srgb(0xd8b31a), 0.2, 0.4), root, bevel=0.1)
    life_ring(root, (2.0, 2.31, dz + 1.6), (math.pi / 2, 0, 0))
    return spec

def build_seiner(root):
    spec = dict(length=26.0, beam=8.0, depth=3.9, deadrise=12, transom=0.8, bowPow=1.4, bowRise=0.4,
                sheer=0.26, flare=0.08, deckDrop=1.2, waterline=0.42)
    m = common_mats(0x16263a, 0x7a1d18, 0xf2c230, 0x4c5156, trim=0x2a2c2f)
    m['topside'] = mat('steel_navy', srgb(0x16263a), 0.35, 0.45)
    build_hull(spec, root, m)
    white = mat('house_white', srgb(0xeeeeea), 0.1, 0.35)
    glass = mat('glass', srgb(0x0b1216), 0.3, 0.05)
    steel = mat('galv', srgb(0x9aa0a6), 0.9, 0.4)
    yellow = mat('crane_yellow', srgb(0xf2c230), 0.3, 0.45)
    dz = deck_z(spec, 6.0)
    box('wheelhouse', (6.0, 6.2, 2.8), (6.5, 0, dz + 1.4), white, root, bevel=0.15)
    box('wh_upper', (3.6, 5.0, 1.6), (7.2, 0, dz + 3.6), white, root, bevel=0.12)
    for s in (1, -1):
        box('wh_win', (3.0, 0.03, 0.6), (7.2, s * 2.51, dz + 3.7), glass, root, bevel=0)
    box('wh_front', (0.03, 4.6, 0.65), (9.01, 0, dz + 3.7), glass, root, bevel=0, rot=(0, -0.2, 0))
    tube('mast', [(7.0, 0, dz + 4.4), (7.0, 0, dz + 13.0)], 0.15, steel, root)
    box('crowsnest', (1.2, 1.2, 0.9), (7.0, 0, dz + 11.5), white, root, bevel=0.05)
    # power block on a boom + seine net pile + skiff on the stern
    sz = deck_z(spec, -5.0)
    tube('boom', [(3.0, 0, sz + 1.0), (-6.0, 0, sz + 9.0)], 0.22, yellow, root)
    cyl('power_block', 0.7, 0.5, (-6.0, 0, sz + 8.4), mat('block', srgb(0x222222), 0.3, 0.5), root, rot=(math.pi / 2, 0, 0), seg=24)
    net = mat('net_black', srgb(0x14171a), 0, 0.95)
    for i in range(5):
        box('net_pile', (5.0 - i * 0.6, 5.5 - i * 0.7, 0.35), (-7.0, 0, sz + 0.2 + i * 0.32), net, root, bevel=0.15)
    for i in range(14):
        sphere('cork', 0.18, (-9.0 + (i % 7) * 0.6, 2.4 * (1 if i < 7 else -1), sz + 1.6), mat('cork', srgb(0xf2c230), 0, 0.6), root, scale=(1.3, 1, 0.8))
    skiff = mat('skiff_orange', srgb(0xe2621e), 0.2, 0.4)
    box('seine_skiff', (3.2, 2.4, 1.2), (-11.6, 0, sz + 1.6), skiff, root, bevel=0.3)
    life_ring(root, (4.0, 3.1, dz + 1.8), (math.pi / 2, 0, 0))
    return spec

# newer boats live in their own files (they share this file's helpers)
for _f in ('boats_kayak.py', 'boats_pontoon.py', 'boats_bay.py', 'boats_yacht.py'):
    _p = os.path.join(os.path.dirname(os.path.abspath(__file__)), _f)
    if os.path.exists(_p):
        exec(compile(open(_p, encoding='utf8').read(), _p, 'exec'))

BOATS = {
    'jon': build_jon, 'bass': build_bass, 'skiff': build_skiff, 'center': build_center,
    'sport': build_sport, 'trawler': build_trawler, 'seiner': build_seiner,
}
for _n, _fn in (('kayak', 'build_kayak'), ('pontoon', 'build_pontoon'), ('bay', 'build_bay'), ('yacht', 'build_yacht')):
    if _fn in globals():
        BOATS[_n] = globals()[_fn]
# `-- --only kayak,bay` builds just those boats (default: all)
ONLY = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None

meta = {}
_mp = os.path.join(OUT, 'boats.json')
if ONLY and os.path.exists(_mp):
    meta = json.load(open(_mp))
for name, fn in BOATS.items():
    if ONLY and name not in ONLY:
        continue
    reset()
    _mats.clear()
    root = bpy.data.objects.new('boat_' + name, None)
    bpy.context.scene.collection.objects.link(root)
    spec = fn(root)
    meta[name] = {k: spec[k] for k in ('length', 'beam', 'depth')}
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True)
    print('EXPORTED', name, os.path.getsize(path))

with open(os.path.join(OUT, 'boats.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print('DONE')
