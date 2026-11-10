# Fishing kayak (sit-on-top, rotomoulded polyethylene). exec'd by build_boats.py, shares its helpers.
# Hull recipe is mirrored in src/game/boatVisual.js (kayakAt) for decals / upgrade parts: keep in sync.

def loft(name, rings, materials, parent, seg_mat=None, cap=True, smooth=True):
    """Closed lofted surface through rings (each a list of (x,y,z), same count). seg_mat(j) -> material index."""
    bm = bmesh.new()
    vr = [[bm.verts.new(p) for p in r] for r in rings]
    M = len(vr[0])
    for i in range(len(vr) - 1):
        for j in range(M):
            f = bm.faces.new((vr[i][j], vr[i + 1][j], vr[i + 1][(j + 1) % M], vr[i][(j + 1) % M]))
            if seg_mat:
                f.material_index = seg_mat(j)
    if cap:
        for r, flip in ((vr[0], True), (vr[-1], False)):
            f = bm.faces.new(r[::-1] if flip else r)
            if seg_mat:
                f.material_index = seg_mat(0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, materials, parent, smooth=smooth)

KAYAK = dict(length=3.66, beam=0.90, depth=0.5, deckDrop=0.16, sheer=0.0)

def kayak_prof(x):
    L, B = KAYAK['length'], KAYAK['beam'] / 2
    u = min(1.0, abs(2 * (x + L / 2) / L - 1))
    w = B * max(0.04, (1 - u ** 2.3)) ** 0.55
    zd = 0.285 + 0.17 * u ** 2.6
    zk = 0.035 + (zd - 0.095) * u ** 3.2
    return w, zk, zd

def build_kayak(root):
    spec = dict(KAYAK)
    L = spec['length']
    top = mat('topside', srgb(0x505e36), 0.0, 0.55)         # matte olive polyethylene
    accent = mat('stripe', srgb(0xc9b684), 0.0, 0.5)
    under = mat('bottom', srgb(0x8f7d58), 0.0, 0.6)
    trim = mat('trim', srgb(0xb8bec4), 0.85, 0.35)         # anodised aluminium track and hardware
    dark = mat('kayak_black', srgb(0x1b1d1f), 0.0, 0.7)
    mesh_ = mat('seat_mesh', srgb(0x2d3033), 0.0, 0.9)
    cord = mat('bungee', srgb(0x161616), 0.0, 0.8)
    rope = mat('rope_yellow', srgb(0xd8b93a), 0.0, 0.8)
    wood = mat('paddle_blade', srgb(0x4f5f3a), 0.0, 0.5)

    # ---- hull: 14-point section, lofted along x (denser rings toward the ends)
    N = 34
    rings = []
    for i in range(N + 1):
        x = -L / 2 + L * (0.5 - 0.5 * math.cos(math.pi * i / N))
        w, zk, zd = kayak_prof(x)
        zc = zk + (zd - zk) * 0.45
        half = [(0.0, zk), (w * 0.52, zk + 0.012), (w * 0.93, zk + (zd - zk) * 0.2), (w, zc), (w * 0.97, zd - 0.045),
                (w * 0.86, zd - 0.006), (w * 0.62, zd + 0.012), (w * 0.3, zd + 0.027), (0.0, zd + 0.033)]
        pts = half + [(-y, z) for (y, z) in reversed(half[1:-1])]
        rings.append([(x, y, z) for (y, z) in pts])
    M = len(rings[0])

    def seg(j):
        k = min(j, M - 1 - j)
        return 0 if k <= 1 else (1 if k == 3 else 2)
    loft('hull', rings, [under, accent, top], root, seg_mat=seg)

    zdx = lambda x: kayak_prof(x)[2] + 0.033
    # ---- side rails / moulded handles + scuppers
    for s in (1, -1):
        tube('rubrail', [(x, s * kayak_prof(x)[0] * 0.995, kayak_prof(x)[1] + (kayak_prof(x)[2] - kayak_prof(x)[1]) * 0.45) for x in [-L / 2 + 0.16 + k * (L - 0.32) / 20 for k in range(21)]], 0.011, dark, root)
    for k in range(6):
        x = -0.35 + k * 0.14
        for s in (1, -1):
            cyl('scupper', 0.024, 0.004, (x, s * 0.17, zdx(x) + 0.001), dark, root, seg=10)
    # carry handles (toggle loops) at both ends
    for sx in (1, -1):
        x = sx * (L / 2 - 0.2)
        z = zdx(x) + 0.004
        arch = [(x + sx * 0.0, 0.1 * math.cos(a), z + 0.065 * math.sin(a)) for a in [k * math.pi / 8 for k in range(9)]]
        tube('handle', arch, 0.011, dark, root)
        box('handle_base', (0.07, 0.24, 0.012), (x, 0, z + 0.004), dark, root, bevel=0.004)
        tube('bow_painter' if sx > 0 else 'stern_painter', [(x + sx * 0.09, 0.0, z + 0.05), (x + sx * 0.28, 0.0, z - 0.07)], 0.008, rope, root)

    # ---- cockpit: seat well recess shown as a darker moulded pad, foot rests, gear tracks
    xs0 = -0.12
    z0 = zdx(xs0)
    box('seat_pad', (0.5, 0.4, 0.006), (xs0 + 0.05, 0, z0 + 0.003), dark, root, bevel=0.002)
    for s in (1, -1):
        box('gear_track', (0.78, 0.03, 0.014), (xs0 + 0.18, s * 0.255, z0 + 0.004), trim, root, bevel=0.003)
        for k in range(12):
            box('track_slot', (0.016, 0.018, 0.004), (xs0 - 0.14 + k * 0.062, s * 0.255, z0 + 0.012), dark, root, bevel=0.0)
    for k, (fx, sx_) in enumerate([(0.62, 1), (0.74, 1)]):
        for s in (1, -1):
            box('foot_brace', (0.05, 0.12, 0.05), (fx, s * 0.12, zdx(fx) + 0.012), dark, root, bevel=0.012, rot=(0, -0.45, 0))
    # high-back frame seat on aluminium rails: base + back
    sz = z0 + 0.1
    box('seat_base', (0.4, 0.36, 0.05), (xs0 + 0.02, 0, sz), mesh_, root, bevel=0.018)
    box('seat_back', (0.05, 0.36, 0.34), (xs0 - 0.2, 0, sz + 0.2), mesh_, root, bevel=0.02, rot=(0, -0.2, 0))
    for s in (1, -1):
        tube('seat_frame', [(xs0 + 0.2, s * 0.19, sz - 0.03), (xs0 - 0.17, s * 0.19, sz - 0.03), (xs0 - 0.27, s * 0.19, sz + 0.36)], 0.011, trim, root)
        tube('seat_strut', [(xs0 + 0.06, s * 0.19, sz - 0.03), (xs0 + 0.1, s * 0.24, z0 + 0.015)], 0.009, trim, root)
    tube('seat_cross', [(xs0 - 0.27, 0.19, sz + 0.36), (xs0 - 0.27, -0.19, sz + 0.36)], 0.011, trim, root)

    # ---- hatches: round bow hatch, rectangular centre hatch with rim and strap
    xb = 0.95
    cyl('hatch_ring', 0.19, 0.016, (xb, 0, zdx(xb) + 0.006), dark, root, seg=28)
    cyl('hatch_lid', 0.168, 0.02, (xb, 0, zdx(xb) + 0.012), top, root, seg=28)
    box('hatch_latch', (0.07, 0.025, 0.02), (xb - 0.03, 0, zdx(xb) + 0.026), dark, root, bevel=0.006)
    cyl('hatch_dome', 0.07, 0.01, (xb + 0.06, 0, zdx(xb) + 0.024), dark, root, seg=14)
    xc = 0.42
    box('day_hatch', (0.34, 0.26, 0.018), (xc, 0, zdx(xc) + 0.008), accent, root, bevel=0.008)

    # ---- stern tank well: moulded recess, bungee grid and a milk-crate rod pod
    xt = -1.02
    box('tank_pad', (0.62, 0.42, 0.006), (xt, 0, zdx(xt) + 0.003), dark, root, bevel=0.002)
    crate = mat('crate', srgb(0x2c3032), 0.0, 0.7)
    zc_ = zdx(xt) + 0.007
    for s in (1, -1):
        tube('crate_rail', [(xt - 0.17, s * 0.17, zc_), (xt + 0.17, s * 0.17, zc_), (xt + 0.17, s * 0.17, zc_ + 0.27), (xt - 0.17, s * 0.17, zc_ + 0.27), (xt - 0.17, s * 0.17, zc_)], 0.008, crate, root)
    for xx in (-0.17, 0.17):
        tube('crate_end', [(xt + xx, 0.17, zc_ + 0.27), (xt + xx, -0.17, zc_ + 0.27), (xt + xx, -0.17, zc_), (xt + xx, 0.17, zc_)], 0.008, crate, root)
        tube('crate_slat', [(xt + xx, 0.17, zc_ + 0.135), (xt + xx, -0.17, zc_ + 0.135)], 0.006, crate, root)
    for sy in (1, -1):
        tube('bungee', [(xt - 0.31, sy * 0.2, zdx(xt - 0.31) + 0.006), (xt + 0.0, -sy * 0.0, zc_ + 0.29), (xt + 0.31, sy * 0.2, zdx(xt + 0.31) + 0.006)], 0.0055, cord, root)
        tube('bungee', [(xt - 0.31, -sy * 0.2, zdx(xt - 0.31) + 0.006), (xt + 0.31, sy * 0.2, zdx(xt + 0.31) + 0.006)], 0.0055, cord, root)
    for sx in (1, -1):
        for sy in (1, -1):
            cyl('padeye', 0.014, 0.012, (xt + sx * 0.31, sy * 0.2, zdx(xt + sx * 0.31) + 0.008), trim, root, seg=10)
    # two rods in the pod: tips reaching aft and up (read as a spare spinning rod and a fly rod)
    rodm = mat('kayak_rod', srgb(0x23262a), 0.0, 0.5)
    for k, yy in enumerate((0.08, -0.06)):
        tube('rod', [(xt + 0.05, yy, zc_ + 0.05), (xt - 0.32, yy * 2.0, zc_ + 0.34), (xt - 0.62, yy * 2.6, zc_ + 0.62)], 0.0055, rodm, root)

    # ---- rod holders (flush-mount, behind the seat), anchor trolley rope, paddle clip
    for s in (1, -1):
        xh = -0.52
        zh = zdx(xh)
        cyl('rod_holder_base', 0.036, 0.02, (xh, s * 0.3, zh + 0.008), trim, root, seg=14)
        cyl('rod_holder', 0.026, 0.2, (xh - 0.04, s * 0.31, zh + 0.1), dark, root, rot=(s * 0.12, -0.42, 0), seg=14)
    # ---- paddle held under two bungees along the port side
    py = 0.27
    tube('paddle_shaft', [(-0.85, py, zdx(-0.85) + 0.05), (0.85, py, zdx(0.85) + 0.05)], 0.014, mat('paddle_shaft', srgb(0x1c1f22), 0.5, 0.4), root)
    for sx in (1, -1):
        b = sphere('paddle_blade', 0.1, (sx * 1.02, py - 0.03, zdx(sx * 1.0) + 0.06), wood, root, scale=(1.75, 0.82, 0.07))
        b.rotation_euler = (0, 0.12 * sx, 0)
    for xx in (-0.55, 0.35):
        tube('paddle_bungee', [(xx, 0.34, zdx(xx) + 0.012), (xx, py + 0.02, zdx(xx) + 0.075), (xx, 0.14, zdx(xx) + 0.012)], 0.0055, cord, root)
    # ---- bow: small fairlead and an eye for a bow light
    cyl('bow_fairlead', 0.016, 0.016, (L / 2 - 0.06, 0, zdx(L / 2 - 0.06) + 0.004), trim, root, seg=10)
    return spec
