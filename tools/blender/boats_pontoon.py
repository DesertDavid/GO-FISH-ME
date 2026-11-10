# 22' fishing pontoon: two aluminium tubes, flat deck with a fence all round, helm console, lounge seats, bimini. exec'd by build_boats.py.
# Footprint is mirrored in src/game/boatVisual.js (pontoonAt): keep in sync.

PONTOON = dict(length=6.9, beam=2.6, depth=1.2, deckDrop=0.5, sheer=0.0)
P_DECK, P_W, P_STERN, P_BOW0, P_BOWA = 0.70, 1.2, -3.2, 2.55, 0.8      # deck height, half width, stern x, bow arc start, bow arc length

def pont_outline(n_arc=14):
    """Closed outline (x, y) CCW seen from above, starting at the stern-starboard corner."""
    pts = [(P_STERN, -P_W), (0.0, -P_W), (P_BOW0, -P_W)]
    for k in range(1, n_arc):
        th = -math.pi / 2 + math.pi * k / n_arc
        pts.append((P_BOW0 + P_BOWA * math.cos(th), P_W * math.sin(th)))
    pts += [(P_BOW0, P_W), (0.0, P_W), (P_STERN, P_W)]
    return pts

def ribbon(name, pts, z0, z1, material, parent, thick=0.025, off=0.0, closed=False, skip=None):
    """Vertical strip along a polyline, optionally pushed outward, thickened with a solidify modifier."""
    n = len(pts)
    bm = bmesh.new()
    def at(i):
        a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy) or 1
        return (pts[i][0] - dy / l * off * 0, pts[i][1] + dx / l * off * 0)
    vs = []
    for i in range(n):
        a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy) or 1
        nx, ny = dy / l, -dx / l                    # outward for a CCW outline
        px, py = pts[i][0] + nx * off, pts[i][1] + ny * off
        vs.append((bm.verts.new((px, py, z0)), bm.verts.new((px, py, z1))))
    for i in range(n - 1):
        if skip and skip(pts[i], pts[i + 1]):
            continue
        bm.faces.new((vs[i][0], vs[i + 1][0], vs[i + 1][1], vs[i][1]))
    o = mesh_obj(name, bm, material, parent, smooth=False)
    if thick:
        m = o.modifiers.new('sol', 'SOLIDIFY'); m.thickness = thick; m.offset = 0
    return o

def build_pontoon(root):
    spec = dict(PONTOON)
    L = spec['length']
    alu = mat('bottom', srgb(0xa9b0b5), 0.85, 0.38)              # mill-finish tubes
    trim = mat('trim', srgb(0xb9c0c6), 0.85, 0.3)               # anodised rails and posts
    panel = mat('fence_panel', srgb(0xe6e1d2), 0.1, 0.4)         # painted fence panels
    stripe = mat('stripe', srgb(0x20525a), 0.1, 0.4)
    deck = mat('deck_nonskid', srgb(0x4b4e4f), 0.0, 0.9)         # marine vinyl over ply
    vinyl = mat('seat_vinyl', srgb(0xd6ceb6), 0.0, 0.55)
    vinyl_dk = mat('seat_vinyl_dk', srgb(0x45403a), 0.0, 0.6)
    cabinet = mat('cabinet', srgb(0xc9c1a8), 0.0, 0.6)
    black = mat('pont_black', srgb(0x17191b), 0.3, 0.55)
    glass = mat('glass', srgb(0x0e171c), 0.25, 0.06)
    wood = mat('laminate', srgb(0x8b6b45), 0.0, 0.5)
    steel = mat('steel', srgb(0xc4cad0), 1.0, 0.22)

    # ---- tubes (hull*): 16-point rings along x; bullnose lifts and closes, stern is capped
    def circ(r, zc, x):
        return [(x, r * math.cos(a), zc + r * math.sin(a)) for a in [k * 2 * math.pi / 18 for k in range(18)]]
    xs = [-3.25, -3.2, -3.05, -2.7, -1.8, -0.6, 0.6, 1.8, 2.55]
    for k in range(1, 15):
        s_ = k / 15
        xs.append(2.55 + 0.95 * math.sin(s_ * math.pi / 2) * 1.0)
    xs = sorted(set(round(v, 4) for v in xs))
    for sy in (1, -1):
        rings = []
        for x in xs:
            r, zc = 0.315, 0.32
            if x < -2.95:
                r *= 0.78 + 0.22 * (x + 3.25) / 0.3
            if x > 2.55:
                s_ = min(1.0, (x - 2.55) / 0.95)
                r *= max(0.07, math.sqrt(max(0.0, 1 - s_ ** 2.2)))
                zc += 0.12 * s_ ** 1.6
            rings.append([(px, py + sy * 0.88, pz) for (px, py, pz) in circ(r, zc, x)])
        loft('hull_tube', rings, alu, root)
        # weld rings, lifting strake, tube-to-deck brackets
        for xw in (-2.2, -0.9, 0.4, 1.7):
            cyl('weld_ring', 0.322, 0.03, (xw, sy * 0.88, 0.32), alu, root, rot=(0, math.pi / 2, 0), seg=18)
        box('lifting_strake', (4.8, 0.025, 0.05), (-0.2, sy * (0.88 + 0.245), 0.155), alu, root, bevel=0.01, rot=(0.55 * sy, 0, 0))
    # cross members + deck frame visible between the tubes
    for xc in (-2.9, -1.9, -0.9, 0.1, 1.1, 2.1):
        box('crossmember', (0.08, 2.1, 0.08), (xc, 0, P_DECK - 0.155), alu, root, bevel=0.012)
        for sy in (1, -1):
            box('tube_saddle', (0.16, 0.12, 0.2), (xc, sy * 0.88, P_DECK - 0.2), trim, root, bevel=0.015)

    # ---- deck plate + skirt
    ol = pont_outline()
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, y, P_DECK)) for (x, y) in ol[::-1]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if f.normal.z < 0:
        f.normal_flip()
    d = mesh_obj('deck', bm, deck, root)
    m_ = d.modifiers.new('sol', 'SOLIDIFY'); m_.thickness = 0.06; m_.offset = -1
    ribbon('deck_skirt', ol + [ol[0]], P_DECK - 0.075, P_DECK - 0.0, trim, root, thick=0.02, off=0.01)

    # ---- fence: painted panel (hull*), accent stripe, top / bottom rail, posts, bow gate gap
    gap = lambda a, b: a[0] > 2.4 and abs(a[1]) < 0.42 and abs(b[1]) < 0.42
    ribbon('hull_fence', ol + [ol[0]], P_DECK + 0.05, P_DECK + 0.46, panel, root, thick=0.03, skip=gap)
    ribbon('fence_stripe', ol + [ol[0]], P_DECK + 0.14, P_DECK + 0.2, stripe, root, thick=0.0, off=0.018, skip=gap)
    # rails as tubes along the outline, split at the gate
    seg_a = [p for p in ol if not (p[0] > 2.4 and p[1] < 0.42)]
    right = [p for p in ol if p[1] <= -0.42 + 1e-6 and not (p[0] < 2.4 and False)]
    pts_r = [p for p in ol if p[1] <= -0.42]
    pts_l = [p for p in ol if p[1] >= 0.42]
    rail_pts = pts_r + [(P_BOW0 + P_BOWA * math.cos(math.asin(0.42 / P_W)), -0.42)] if False else None
    def rail_run(zh, name, r=0.018):
        # one continuous run: port stern -> bow gate edge, and starboard
        right_run = [p for p in ol if p[1] <= -0.42 or p[0] < 0.0]
        left_run = [p for p in ol if p[1] >= 0.42 or p[0] < 0.0]
        ordered = []
        run = []
        for p in ol + [ol[0]]:
            if p[0] > 2.4 and abs(p[1]) < 0.42:
                if run:
                    ordered.append(run); run = []
            else:
                run.append(p)
        if run:
            ordered.append(run)
        if len(ordered) == 2 and ordered[0][0] == ordered[-1][-1] if False else False:
            pass
        for rr in ordered:
            tube(name, [(x, y, P_DECK + zh) for (x, y) in rr], r, trim, root)
    rail_run(0.5, 'fence_rail_top')
    rail_run(0.05, 'fence_rail_low', 0.012)
    # posts every ~0.85 m of outline
    acc = 0.0
    last = ol[0]
    posts = [ol[0]]
    for p in ol[1:]:
        acc += math.hypot(p[0] - last[0], p[1] - last[1]); last = p
        if acc >= 0.85:
            posts.append(p); acc = 0.0
    for (x, y) in posts:
        if x > 2.4 and abs(y) < 0.46:
            continue
        cyl('post', 0.014, 0.52, (x, y, P_DECK + 0.26), trim, root, seg=8)
    # gate posts + a swing gate bar closed across the bow gap
    for sy in (1, -1):
        cyl('gate_post', 0.022, 0.62, (P_BOW0 + P_BOWA * math.cos(math.asin(0.42 / P_W)), sy * 0.46, P_DECK + 0.31), trim, root, seg=10)
    xg = P_BOW0 + P_BOWA * math.cos(math.asin(0.42 / P_W))
    tube('gate_bar', [(xg, 0.46, P_DECK + 0.5), (xg + 0.01, -0.46, P_DECK + 0.5)], 0.016, trim, root)
    tube('gate_bar2', [(xg, 0.46, P_DECK + 0.3), (xg + 0.01, -0.46, P_DECK + 0.3)], 0.014, trim, root)
    box('gate_latch', (0.05, 0.06, 0.04), (xg + 0.005, -0.44, P_DECK + 0.4), black, root, bevel=0.006)

    Z = P_DECK
    # ---- helm console to starboard, windscreen, wheel, gauges, captain's chair
    xh, yh = 0.55, -0.76
    box('console', (0.62, 0.62, 0.78), (xh, yh, Z + 0.39), cabinet, root, bevel=0.05)
    box('console_dash', (0.34, 0.6, 0.05), (xh - 0.12, yh, Z + 0.81), black, root, bevel=0.015, rot=(0, -0.28, 0))
    box('console_screen', (0.02, 0.26, 0.17), (xh - 0.12, yh + 0.12, Z + 0.88), mat('screen', srgb(0x0a2030), 0, 0.2, emit=srgb(0x2aa6ff)), root, bevel=0.0, rot=(0, -0.7, 0))
    for k in range(3):
        cyl('gauge', 0.03, 0.01, (xh - 0.17, yh - 0.12 - k * 0.0, Z + 0.84 + 0.0), black, root, rot=(0, -0.28 + math.pi / 2, 0)) if False else None
    wheel = [(xh - 0.28 + 0.0 * math.cos(a), yh + 0.0 + 0.15 * math.cos(a), Z + 0.92 + 0.15 * math.sin(a)) for a in [k * math.pi / 8 for k in range(17)]]
    tube('wheel', [(xh - 0.28 - 0.06 * math.sin(a) * 0.4, yh + 0.15 * math.cos(a), Z + 0.94 + 0.15 * math.sin(a)) for a in [k * math.pi / 8 for k in range(17)]], 0.012, wood, root)
    cyl('wheel_hub', 0.035, 0.05, (xh - 0.27, yh, Z + 0.94), black, root, rot=(0, math.pi / 2, 0))
    for a in range(6):
        tube('wheel_spoke', [(xh - 0.27, yh, Z + 0.94), (xh - 0.28 - 0.0, yh + 0.15 * math.cos(a * math.pi / 3), Z + 0.94 + 0.15 * math.sin(a * math.pi / 3))], 0.006, wood, root)
    # windscreen: three-panel frame with tinted glass, raked back
    for sy_ in (-1, 1):
        tube('ws_post', [(xh + 0.24, yh + sy_ * 0.3, Z + 0.78), (xh + 0.12, yh + sy_ * 0.3, Z + 1.28)], 0.016, trim, root)
    box('ws_glass', (0.02, 0.6, 0.46), (xh + 0.18, yh, Z + 1.03), glass, root, bevel=0.0, rot=(0, 0.23, 0))
    tube('ws_top', [(xh + 0.12, yh - 0.3, Z + 1.28), (xh + 0.12, yh + 0.3, Z + 1.28)], 0.014, trim, root)
    # captain's chair behind the console: pedestal, bucket seat, armrests
    xc = xh - 0.7
    cyl('chair_pedestal', 0.045, 0.34, (xc, yh, Z + 0.17), trim, root, seg=12)
    cyl('chair_base', 0.17, 0.03, (xc, yh, Z + 0.02), trim, root, seg=16)
    box('chair_seat', (0.5, 0.5, 0.1), (xc, yh, Z + 0.4), vinyl, root, bevel=0.04)
    box('chair_back', (0.1, 0.5, 0.52), (xc - 0.22, yh, Z + 0.72), vinyl, root, bevel=0.05, rot=(0, -0.12, 0))
    for sy_ in (-1, 1):
        box('chair_arm', (0.36, 0.05, 0.05), (xc, yh + sy_ * 0.26, Z + 0.55), vinyl_dk, root, bevel=0.015)

    # ---- aft lounge: full-width stern bench + long port bench, with cabinets under; round table
    def bench(name, x0, y0, sx, sy_, back_axis):
        box(name + '_base', (sx, sy_, 0.36), (x0, y0, Z + 0.18), cabinet, root, bevel=0.03)
        box(name + '_cush', (sx - 0.02, sy_ - 0.02, 0.1), (x0, y0, Z + 0.41), vinyl, root, bevel=0.045)
    bench('stern_bench', -2.78, 0.0, 0.52, 2.12, 'x')
    box('stern_back', (0.1, 2.1, 0.5), (-3.02, 0.0, Z + 0.7), vinyl, root, bevel=0.05)
    bench('port_bench', -1.15, 0.92, 2.2, 0.5, 'y')
    box('port_back', (2.2, 0.1, 0.5), (-1.15, 1.1, Z + 0.7), vinyl, root, bevel=0.05)
    cyl('table_post', 0.035, 0.44, (-1.35, 0.0, Z + 0.22), trim, root, seg=10)
    cyl('table_base', 0.16, 0.025, (-1.35, 0.0, Z + 0.015), trim, root, seg=16)
    cyl('table_top', 0.33, 0.035, (-1.35, 0.0, Z + 0.46), wood, root, seg=24)
    # ---- bow: two swivel fishing chairs + a cooler seat on the gate side
    for sy_ in (1, -1):
        cyl('fchair_post', 0.04, 0.3, (1.85, sy_ * 0.58, Z + 0.15), trim, root, seg=12)
        cyl('fchair_base', 0.14, 0.025, (1.85, sy_ * 0.58, Z + 0.015), trim, root, seg=14)
        box('fchair_seat', (0.4, 0.4, 0.09), (1.85, sy_ * 0.58, Z + 0.34), vinyl_dk, root, bevel=0.04)
        box('fchair_back', (0.08, 0.4, 0.4), (1.67, sy_ * 0.58, Z + 0.58), vinyl_dk, root, bevel=0.04, rot=(0, -0.1, 0))
    cooler = mat('cooler_blue', srgb(0x2a5f8d), 0.0, 0.55)
    box('cooler', (0.8, 0.45, 0.36), (2.45, 0.0, Z + 0.18) if False else (0.0, 0.0, 0.0), cooler, root) if False else None
    box('cooler', (0.55, 0.36, 0.34), (0.95, 0.72, Z + 0.17), cooler, root, bevel=0.03)
    box('cooler_lid', (0.57, 0.38, 0.04), (0.95, 0.72, Z + 0.36), mat('cooler_lid', srgb(0xe8e6de), 0.0, 0.5), root, bevel=0.015)

    # (no canopy in the model: the Bimini top upgrade in the boat yard fits one, so the over-the-shoulder camera is not boxed in)

    # ---- stern: engine plate, 90 hp outboard, boarding ladder, cleats, rod holders, nav lights
    box('engine_plate', (0.1, 1.1, 0.5), (-3.38, 0.0, P_DECK), trim, root, bevel=0.015)
    for sy_ in (1, -1):
        tube('engine_brace', [(-3.34, sy_ * 0.5, 0.78), (-3.0, sy_ * 0.86, 0.5)], 0.02, trim, root)
    outboard(root, -3.55, 0.0, P_DECK + 0.28, 1.05, mat('cowl_pontoon', srgb(0xe4e6e2), 0.2, 0.3))
    for k in range(4):
        tube('ladder_step', [(-3.28 - 0.1, -0.78 - 0.0, Z - 0.02 - k * 0.14), (-3.28 - 0.1, -0.5, Z - 0.02 - k * 0.14)], 0.014, trim, root) if False else None
    tube('ladder_rail', [(-3.3, -0.62, Z + 0.5), (-3.45, -0.62, Z + 0.1), (-3.45, -0.62, Z - 0.45)], 0.014, trim, root)
    tube('ladder_rail', [(-3.3, -0.98, Z + 0.5), (-3.45, -0.98, Z + 0.1), (-3.45, -0.98, Z - 0.45)], 0.014, trim, root)
    for k in range(3):
        tube('ladder_step', [(-3.45, -0.62, Z - 0.05 - k * 0.15), (-3.45, -0.98, Z - 0.05 - k * 0.15)], 0.013, trim, root)
    for (cx, cy) in ((-2.5, 1.2), (-2.5, -1.2), (2.0, 1.2), (2.0, -1.2)):
        box('cleat', (0.16, 0.04, 0.035), (cx, cy + (0.03 if cy > 0 else -0.03), P_DECK - 0.0), steel, root, bevel=0.012)
    for k, xr in enumerate((0.7, 1.15, 1.6)):
        cyl('rod_holder', 0.028, 0.24, (xr, 1.14, Z + 0.58), black, root, rot=(0.38, 0, 0), seg=12)
        cyl('rod_holder_cap', 0.04, 0.03, (xr, 1.14, Z + 0.47), trim, root, seg=12)
    for sy_, col, gl in ((1, 0xc82828, 0xff3030), (-1, 0x1f9c4a, 0x28ff70)):
        box('nav_light', (0.06, 0.05, 0.05), (2.2, sy_ * 1.1, Z + 0.56), mat('nav_' + str(sy_), srgb(col), 0, 0.3, emit=srgb(gl)), root, bevel=0.01)
    return spec
