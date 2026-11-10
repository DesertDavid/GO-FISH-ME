"""Importer mode "rod" (called from import_assets.py): turn a downloaded fishing-rod model into a game rod GLB.

Output convention (glTF axes, what src/game/rodModel.js expects): the rod lies along +Z with the tip at +Z, the reel hangs
below the blank (-Y), the crank handle is on +X (the angler's left, because the game cranks with the left hand). Metres.
The reel centre sits at z = REEL_Z so the hands' fixed grip/crank placement (hands.js) lands on the real seat and reel.
Nodes: `rod_skin` (skinned blank + grip + guides, a chain of equal bones `bend0..bendN-1` from `flex_z` to the tip, root
`bend_root` for the rigid grip), `rod_reel` (rigid), `crank` (origin on the handle axle, rotates about X; child
empty `knob` at the grip knob), empties `tip`, `guide_i`, `spool` (where the line leaves the reel). Rod meta (flex_z, tip_z,
bones, crank radius ...) rides on the armature as extras (userData.rod).

Sources are untrusted: only geometry/images are read through Blender's importer, nothing from the download is executed.
Manifest keys (mode "rod"): input, out, length (butt->tip metres), tris {skin,reel}, tex, rest_pose, flip, drop/crank/reel
(rule lists: {obj: name prefix, box: [[zmin,zmax],[ymin,ymax],[xmin,xmax]]} on island centres in the butt-origin metre frame),
flex_z (blank starts bending, metres from the butt), bones, spool [x,y,z] (final frame, optional), guides_auto (bool),
crank_pivot / knob (final frame, optional), mirror (force the x flip), keep_normal_maps.
"""
import bpy, bmesh, os, sys, json, math
import numpy as np
from mathutils import Vector, Matrix

REEL_Z = 0.07          # reel centre along the rod, as in rod.js's procedural reel (hands are placed for it)


def log(*a):
    print('ROD', *a)


# ---------------------------------------------------------------- loading
def load_parts(a, src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, a['input']))
    if a.get('rest_pose'):
        for o in bpy.data.objects:
            if o.type == 'ARMATURE':
                o.data.pose_position = 'REST'
    dg = bpy.context.evaluated_depsgraph_get()
    parts = []
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and any(m for m in o.data.materials):
            ev = o.evaluated_get(dg)
            me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
            me.transform(o.matrix_world)
            nm = o.parent.name if (o.parent and o.name.startswith('defaultMaterial')) else o.name   # Collada-style exports: the mesh node is anonymous, its parent has the part's name
            parts.append((nm, me))
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    out = []
    for n, me in parts:
        ob = bpy.data.objects.new(n, me)
        bpy.context.scene.collection.objects.link(ob)
        out.append(ob)
    return out


def verts(ob):
    n = len(ob.data.vertices)
    p = np.empty(n * 3, dtype=np.float64)
    ob.data.vertices.foreach_get('co', p)
    return p.reshape(n, 3)


def match(rules, name):
    return [r for r in rules if 'obj' not in r or name.startswith(r['obj'])]


# ---------------------------------------------------------------- frame
def build_frame(core, a):
    Pall = np.vstack([verts(o) for o in core])
    ax_objs = a.get('axis_obj')
    if ax_objs:
        core = [o for o in core if any(o.name.startswith(n) for n in ax_objs)] or core
    P = np.vstack([verts(o) for o in core])
    c = P.mean(0)
    u, s, vt = np.linalg.svd(P - c, full_matrices=False)
    ax = vt[0]
    t = (P - c) @ ax
    lo, hi = t.min(), t.max()

    def radial(sel):
        Q = P[sel] - c
        Q = Q - np.outer(Q @ ax, ax)
        return np.sqrt((Q ** 2).sum(1)).mean()
    if radial(t > hi - 0.15 * (hi - lo)) > radial(t < lo + 0.15 * (hi - lo)):
        ax = -ax
    if a.get('flip'):
        ax = -ax
    t = (P - c) @ ax
    lo, hi = t.min(), t.max()
    L = hi - lo
    # refine the direction on the blank only (the reel drags the whole-model axis off the rod's)
    sel = (t > lo + 0.5 * L) & (t < lo + 0.95 * L)
    q = P[sel] - P[sel].mean(0)
    d2 = np.linalg.svd(q, full_matrices=False)[2][0]
    ax = d2 if d2 @ ax > 0 else -d2
    t = (P - c) @ ax
    lo, hi = t.min(), t.max()
    L = hi - lo
    # axis line through the blank (the middle of the tip half is nothing but blank)
    blank = (t > lo + 0.55 * L) & (t < lo + 0.9 * L)
    pb = P[blank]
    axis_pt = pb.mean(0) - ax * ((pb - c) @ ax).mean()
    qb = pb - axis_pt
    qb = qb - np.outer(qb @ ax, ax)
    thin = float(np.median(np.sqrt((qb ** 2).sum(1)))) if len(pb) else 0.01
    # reel side: mean sideways offset of the fat things in the butt half (all parts, not just the axis ones)
    P = Pall
    t = (P - c) @ ax
    lo, hi = t.min(), t.max()
    L = hi - lo
    Q = P - axis_pt
    Q = Q - np.outer(Q @ ax, ax)
    rad = np.sqrt((Q ** 2).sum(1))
    butt = (t < lo + 0.4 * L)
    big = butt & (rad > max(3 * thin, 0.02 * L))
    side = Q[big].mean(0)
    down = side - ax * (side @ ax)
    down /= np.linalg.norm(down)
    z = ax / np.linalg.norm(ax)
    y = -down
    x = np.cross(y, z)
    origin = axis_pt + z * ((P[np.argmin(t)] - axis_pt) @ z)
    return origin, x, y, z, L


# ---------------------------------------------------------------- islands
def islands(ob):
    me = ob.data
    key = {}
    vid = np.empty(len(me.vertices), dtype=np.int64)
    co = verts(ob)
    r = np.round(co * 1e4).astype(np.int64)
    for i in range(len(r)):
        vid[i] = key.setdefault((r[i, 0], r[i, 1], r[i, 2]), len(key))
    par = list(range(len(key)))

    def f(q):
        while par[q] != q:
            par[q] = par[par[q]]
            q = par[q]
        return q
    for p in me.polygons:
        vs = [vid[v] for v in p.vertices]
        for k in range(1, len(vs)):
            a, b = f(vs[0]), f(vs[k])
            if a != b:
                par[a] = b
    face_isl = np.array([f(vid[p.vertices[0]]) for p in me.polygons], dtype=np.int64)
    return face_isl


def tri_count(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


def decimate(ob, tris):
    n = tri_count(ob)
    if not tris or n <= tris:
        return n
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    m = ob.modifiers.new('dec', 'DECIMATE')
    m.ratio = tris / n
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=m.name)
    return tri_count(ob)


def shrink_textures(maxpx, keep_normal):
    for im in list(bpy.data.images):
        if im.size[0] == 0:
            continue
        w, h = im.size
        if max(w, h) > maxpx:
            k = maxpx / max(w, h)
            im.scale(max(1, int(w * k)), max(1, int(h * k)))
        im.pack()
    if not keep_normal:
        for m in bpy.data.materials:
            if not m.use_nodes:
                continue
            for n in list(m.node_tree.nodes):
                if n.type == 'NORMAL_MAP':
                    for l in list(m.node_tree.links):
                        if l.to_node == n or l.from_node == n:
                            m.node_tree.links.remove(l)


# ---------------------------------------------------------------- main
def process_rod(a, src, out_dir, preview=None, report=False):
    parts = load_parts(a, src)
    drop = a.get('drop', [])
    # 1. frame from everything that is not dropped by object name
    core = [o for o in parts if not any(('box' not in r) and o.name.startswith(r.get('obj', '\0')) for r in drop)]
    origin, x, y, z, L = build_frame(core, a)
    if a.get('roll'):
        r = Matrix.Rotation(math.radians(a['roll']), 3, Vector(z))
        x, y = np.array(r @ Vector(x)), np.array(r @ Vector(y))
    s = a['length'] / L
    R = Matrix(((x[0], x[1], x[2], 0), (y[0], y[1], y[2], 0), (z[0], z[1], z[2], 0), (0, 0, 0, 1)))
    M = Matrix.Scale(s, 4) @ R @ Matrix.Translation(-Vector(origin))
    mirror = bool(a.get('mirror'))
    for o in parts:
        o.data.transform(M)
    log(a['id'], 'model length', round(L, 3), 'scale', round(s, 5), 'objects', len(parts))
    # island table
    info = []
    isl_cache = {}
    for pi, o in enumerate(parts):
        isl = islands(o)
        isl_cache[pi] = isl
        co = verts(o)
        faces = o.data.polygons
        fc = np.array([tuple(p.center) for p in faces])    # (z-first? no: bf frame x,y,z)
        for i in np.unique(isl):
            sel = isl == i
            c = fc[sel].mean(0)
            vs = np.unique(np.concatenate([np.array(faces[k].vertices) for k in np.nonzero(sel)[0][:4000]]))
            bb = np.vstack([co[vs].min(0), co[vs].max(0)])
            info.append((pi, int(i), int(sel.sum()), c, bb))
    if report:
        seen = {}
        rows = []
        for r in sorted(info, key=lambda r: (r[0], -r[2])):
            seen[r[0]] = seen.get(r[0], 0) + 1
            if seen[r[0]] <= 40 and r[2] >= 40:
                rows.append(r)
        for pi_, i, nf, c, bb in rows:
            n = parts[pi_].name
            log(f'{n[:30]:30s} isl{i:6d} f={nf:6d} centre(x,y,z)=({c[0]:+.3f},{c[1]:+.3f},{c[2]:+.3f}) '
                f'box z[{bb[0][2]:.3f},{bb[1][2]:.3f}] y[{bb[0][1]:+.3f},{bb[1][1]:+.3f}] x[{bb[0][0]:+.3f},{bb[1][0]:+.3f}]')

    def inbox(c, r):
        b = r['box']
        return b[0][0] <= c[2] <= b[0][1] and b[1][0] <= c[1] <= b[1][1] and b[2][0] <= c[0] <= b[2][1]

    def klass(o, isl_i, c):
        for r in drop:
            if r.get('obj') is not None and not o.name.startswith(r['obj']):
                continue
            if 'box' in r and not inbox(c, r):
                continue
            return 'drop'
        for r in a.get('crank', []):
            if (r.get('obj') is None or o.name.startswith(r['obj'])) and ('box' not in r or inbox(c, r)):
                return 'crank'
        for r in a.get('reel', []):
            if (r.get('obj') is None or o.name.startswith(r['obj'])) and ('box' not in r or inbox(c, r)):
                return 'reel'
        return 'skin'

    # crank side: it must be on +x (left); mirror the whole rod otherwise
    wsum = sum(nf * c[0] for (pi_, i, nf, c, bb) in info if klass(parts[pi_], i, c) == 'crank')
    if wsum and not mirror:
        mirror = wsum < 0
    if mirror:
        for o in parts:
            o.data.transform(Matrix.Scale(-1, 4, Vector((1, 0, 0))))
            o.data.flip_normals()
        info = [(pi_, i, nf, np.array([-c[0], c[1], c[2]]), np.vstack([[-bb[1][0], bb[0][1], bb[0][2]], [-bb[0][0], bb[1][1], bb[1][2]]])) for pi_, i, nf, c, bb in info]
    log('mirror', mirror)

    # 2. split faces into classes
    groups = {'skin': [], 'reel': [], 'crank': []}
    for pi, o in enumerate(parts):
        isl = isl_cache[pi]
        centres = {}
        for pi_, i, nf, c, bb in info:
            if pi_ == pi:
                centres[i] = c
        cls = np.array([klass(o, isl[k], centres[isl[k]]) for k in range(len(o.data.polygons))])
        for kname in groups:
            idx = np.nonzero(cls == kname)[0]
            if not len(idx):
                continue
            bm = bmesh.new()
            bm.from_mesh(o.data)
            bm.faces.ensure_lookup_table()
            kill = [bm.faces[k] for k in range(len(bm.faces)) if cls[k] != kname]
            bmesh.ops.delete(bm, geom=kill, context='FACES')
            me = bpy.data.meshes.new(o.name + '_' + kname)
            bm.to_mesh(me)
            bm.free()
            for m in o.data.materials:
                me.materials.append(m)
            ob = bpy.data.objects.new(o.name + '_' + kname, me)
            bpy.context.scene.collection.objects.link(ob)
            groups[kname].append(ob)
    for o in parts:
        bpy.data.objects.remove(o, do_unlink=True)

    def join(lst, name):
        if not lst:
            return None
        bpy.ops.object.select_all(action='DESELECT')
        for o in lst:
            o.select_set(True)
        bpy.context.view_layer.objects.active = lst[0]
        if len(lst) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        ob.name = name
        ob.data.name = name
        return ob
    skin = join(groups['skin'], 'rod_skin')
    reel = join(groups['reel'], 'rod_reel')
    crank = join(groups['crank'], 'crank')
    tr = a.get('tris', {})
    log('tris before', {k: tri_count(v) for k, v in (('skin', skin), ('reel', reel), ('crank', crank)) if v})
    skin_n = decimate(skin, tr.get('skin', 12000))
    reel_n = decimate(reel, tr.get('reel', 8000)) if reel else 0
    crank_n = decimate(crank, tr.get('crank', 2500)) if crank else 0

    # 3. placement: reel centre -> z = REEL_Z, rod axis through the origin
    rv = verts(reel) if reel else verts(skin)
    zc = (rv[:, 2].min() + rv[:, 2].max()) / 2 if not a.get('seat_z') else a['seat_z']
    dz = REEL_Z - zc
    T = Matrix.Translation((0, 0, dz))
    for o in (skin, reel, crank):
        if o:
            o.data.transform(T)
    sv = verts(skin)
    tip_z = float(sv[:, 2].max())
    butt_z = float(sv[:, 2].min())
    flex_z = a.get('flex_z', 0.25) + dz
    nb = a.get('bones', 10)
    seg = (tip_z - flex_z) / nb
    log('placed: butt z', round(butt_z, 3), 'reel z', REEL_Z, 'flex z', round(flex_z, 3), 'tip z', round(tip_z, 3),
        'reel size', None if not reel else [round(float(v), 3) for v in (rv.max(0) - rv.min(0))],
        'reel y', None if not reel else [round(float(rv[:, 1].min()), 3), round(float(rv[:, 1].max()), 3)])

    # crank pivot / knob from the arm's thin and fat ends
    pivot = knob = None
    crank_r = 0.05
    if crank:
        cv = verts(crank)
        cc = cv.mean(0)
        u_, s_, vt_ = np.linalg.svd(cv - cc, full_matrices=False)
        d = vt_[0]
        tt = (cv - cc) @ d
        lo_, hi_ = tt.min(), tt.max()

        def spread(sel):
            q = cv[sel] - cv[sel].mean(0)
            q = q - np.outer(q @ d, d)
            return np.sqrt((q ** 2).sum(1)).mean()
        e0, e1 = tt < lo_ + 0.18 * (hi_ - lo_), tt > hi_ - 0.18 * (hi_ - lo_)
        thin_end, fat_end = (e0, e1) if spread(e0) < spread(e1) else (e1, e0)
        pivot = cv[thin_end].mean(0)
        knob = cv[fat_end].mean(0)
        if a.get('crank_pivot'):
            pivot = np.array(a['crank_pivot'], dtype=float) + np.array([0, 0, dz])   # manifest values are in the report frame
        if a.get('knob'):
            knob = np.array(a['knob'], dtype=float) + np.array([0, 0, dz])
        # the handle turns about the X axle through the pivot: radius in the y-z plane
        crank_r = float(np.hypot(knob[1] - pivot[1], knob[2] - pivot[2]))
        knob[0] = knob[0]
        crank.data.transform(Matrix.Translation(-Vector(pivot)))
        crank.location = Vector(pivot)
        log('crank pivot', [round(float(v), 4) for v in pivot], 'knob', [round(float(v), 4) for v in knob], 'radius', round(crank_r, 4))

    # 4. guides (detected: rings that stick out of the blank, below it), spool anchor
    guides = []
    if a.get('guides_z'):
        # a ring or eye at each listed z (report frame): the line passes through its lowest inner point
        for gz in a['guides_z']:
            zz = gz + dz
            m = np.abs(sv[:, 2] - zz) < 0.006
            q = sv[m]
            ymin = float(q[:, 1].min())
            low = q[q[:, 1] < ymin + 0.004]
            guides.append([round(float(low[:, 0].mean()), 4), round(ymin + a.get('guide_inset', 0.004), 4), round(zz, 4)])
    elif a.get('guides'):
        guides = a['guides']
    elif a.get('guides_auto', True):
        zs = sv[:, 2]
        bins = np.linspace(flex_z, tip_z, 120)
        ext = []
        for b0, b1 in zip(bins[:-1], bins[1:]):
            m = (zs >= b0) & (zs < b1)
            ext.append(float(np.sqrt(sv[m][:, 0] ** 2 + sv[m][:, 1] ** 2).max()) if m.any() else 0.0)
        ext = np.array(ext)
        med = np.median(ext[ext > 0])
        peaks = []
        i = 1
        while i < len(ext) - 1:
            if ext[i] > 1.9 * med and ext[i] >= ext[i - 1] and ext[i] >= ext[i + 1]:
                zc_ = (bins[i] + bins[i + 1]) / 2
                m = (zs >= bins[i] - 0.004) & (zs < bins[i + 1] + 0.004)
                q = sv[m]
                far = q[np.argmax(np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2))]
                peaks.append([round(float(far[0] * 0.6), 4), round(float(far[1] * 0.6), 4), round(float(zc_), 4)])
                i += 4
            else:
                i += 1
        guides = peaks
    log('guides', len(guides), guides)
    if a.get('spool'):
        spool = a['spool']
    elif reel:
        spool = [0.0, float(rv[:, 1].max() - 0.3 * (rv[:, 1].max() - rv[:, 1].min())), float(rv[:, 2].max())]
    else:
        spool = [0, -0.05, REEL_Z + 0.04]

    # 5. materials: dedupe by name stem, shrink textures
    shrink_textures(a.get('tex', 1024), a.get('keep_normal_maps', False))

    # 6. to glTF axes (Blender: x, -z, y), skeleton, vertex weights
    Rg = Matrix.Rotation(math.pi / 2, 4, 'X')
    for o in (skin, reel, crank):
        if o:
            o.data.transform(Rg)
    if crank:
        crank.location = Rg @ Vector(pivot)
    def B(v):
        return Vector((v[0], -v[2], v[1]))

    arm_d = bpy.data.armatures.new('rod_arm')
    arm = bpy.data.objects.new('rod_arm', arm_d)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    names = ['bend_root'] + [f'bend{i}' for i in range(nb)]
    root = arm_d.edit_bones.new('bend_root')
    root.head, root.tail = B((0, 0, butt_z)), B((0, 0, flex_z))
    prev = root
    for i in range(nb):
        bn = arm_d.edit_bones.new(f'bend{i}')
        bn.head, bn.tail = B((0, 0, flex_z + i * seg)), B((0, 0, flex_z + (i + 1) * seg))
        bn.parent = prev
        bn.use_connect = True
        prev = bn
    bpy.ops.object.mode_set(mode='OBJECT')
    # weights: root = rigid grip; from flex_z each bone blends into the next across one segment
    for n in names:
        skin.vertex_groups.new(name=n)
    zs = np.array([-v.co.y for v in skin.data.vertices])
    wi = {n: ([], []) for n in names}
    for k, zv in enumerate(zs):
        f = (zv - flex_z) / seg
        if f <= 0:
            wi['bend_root'][0].append(k); wi['bend_root'][1].append(1.0)
        else:
            f = min(f, nb - 1e-6)
            i0 = int(math.floor(f)); fr = f - i0
            # joint-to-joint blend: bone i0 -> i0+1 (bone 0 blends from the root at the flex start)
            if i0 == 0:
                wi['bend0'][0].append(k); wi['bend0'][1].append(1.0)
                continue
            wi[f'bend{i0 - 1}'][0].append(k); wi[f'bend{i0 - 1}'][1].append(1 - fr)
            wi[f'bend{i0}'][0].append(k); wi[f'bend{i0}'][1].append(fr)
    for n in names:
        idx, w = wi[n]
        for k, ww in zip(idx, w):
            skin.vertex_groups[n].add([k], ww, 'REPLACE')
    skin.parent = arm
    mod = skin.modifiers.new('arm', 'ARMATURE')
    mod.object = arm

    # empties
    def empty(name, pos, parent=None):
        e = bpy.data.objects.new(name, None)
        e.empty_display_size = 0.01
        bpy.context.scene.collection.objects.link(e)
        e.location = B(pos)
        return e
    tip = empty('tip', (0, 0, tip_z))
    empties = [tip, empty('spool', spool)]
    for i, g in enumerate(guides):
        empties.append(empty(f'guide_{i}', g))
    if crank:
        kn = empty('knob', knob)
        kn.parent = crank
        kn.matrix_parent_inverse = Matrix.Translation(-crank.location)
        empties.append(kn)
    meta = {'flex_z': flex_z, 'tip_z': tip_z, 'butt_z': butt_z, 'bones': nb, 'reel_z': REEL_Z,
            'crank_r': crank_r, 'crank_x': None if pivot is None else float(pivot[0]),
            'knob': None if knob is None else [float(v) for v in knob],
            'pivot': None if pivot is None else [float(v) for v in pivot],
            'spool': [float(v) for v in spool], 'tier': a.get('tier'), 'guides': guides}
    arm['rod'] = json.dumps(meta)

    out = os.path.join(out_dir, a['out'])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_skins=True, export_animations=False, export_morph=False, export_cameras=False, export_lights=False,
        export_extras=True, export_image_format='WEBP', export_image_quality=80,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_draco_color_quantization=10, export_draco_generic_quantization=12)
    log('IMPORTED', a['id'], 'tris', skin_n, reel_n, crank_n, 'bytes', os.path.getsize(out))
    return out
