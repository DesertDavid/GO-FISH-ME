# 22' bay boat: shallow-V centre console with a hard T-top, casting platform and single outboard. exec'd by build_boats.py.
# Hull recipe is mirrored in src/game/boatVisual.js (SPEC.bay): keep in sync.

BAY = dict(length=6.9, beam=2.5, depth=0.92, deadrise=15, transom=0.9, bowPow=1.7, bowRise=0.55,
           sheer=0.16, flare=0.09, deckDrop=0.5, waterline=0.33)

def platform(name, spec, x0, x1, rise, material, parent, inset=0.96, skirt=None, steps=12):
    """A raised deck section between x0 and x1 following the hull width, with skirts down to the deck."""
    bm = bmesh.new()
    rows = []
    for k in range(steps + 1):
        x = x0 + (x1 - x0) * k / steps
        t = (x + spec['length'] / 2) / spec['length']
        b, kk, ch, sh = hull_profile(spec, min(t, 0.985))
        dz = deck_z(spec, x)
        w = b * (1 + spec.get('flare', 0.06)) * inset
        rows.append((x, w, dz, dz + rise))
    top = [(bm.verts.new((x, w, zt)), bm.verts.new((x, -w, zt))) for (x, w, dz, zt) in rows]
    bot = [(bm.verts.new((x, w, dz)), bm.verts.new((x, -w, dz))) for (x, w, dz, zt) in rows]
    for k in range(steps):
        bm.faces.new((top[k][0], top[k + 1][0], top[k + 1][1], top[k][1]))                       # top
        bm.faces.new((bot[k][0], top[k][0], top[k + 1][0], bot[k + 1][0]))                       # port skirt
        bm.faces.new((bot[k + 1][1], top[k + 1][1], top[k][1], bot[k][1]))                       # starboard skirt
    bm.faces.new((bot[0][0], bot[0][1], top[0][1], top[0][0]))                                    # aft face
    bm.faces.new((bot[-1][0], top[-1][0], top[-1][1], bot[-1][1]))                                # forward face
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, material, parent, smooth=False)

def build_bay(root):
    spec = dict(BAY)
    L = spec['length']
    mats = {
        'topside': mat('topside', srgb(0x7f97a3), 0.05, 0.22),            # fog-blue gelcoat
        'bottom': mat('bottom', srgb(0x1c2a33), 0.0, 0.55),
        'stripe': mat('stripe', srgb(0xcdb98a), 0.1, 0.3),                 # sand cove stripe
        'deck': mat('deck_nonskid', srgb(0xd6cfba), 0.0, 0.85),
        'trim': mat('trim', srgb(0xb7bec5), 0.9, 0.25),
    }
    build_hull(spec, root, mats)
    gel = mat('gel_white', srgb(0xeceee9), 0.0, 0.2)
    deck = mats['deck']
    steel, black = mats['trim'], mat('bay_black', srgb(0x16181a), 0.3, 0.5)
    glass = mat('glass', srgb(0x0e171c), 0.25, 0.05)
    cush = mat('vinyl_sand', srgb(0xd3c7a6), 0.0, 0.55)
    cush_dk = mat('vinyl_navy', srgb(0x23303c), 0.0, 0.6)
    lid_blue = mat('livewell_lid', srgb(0x1e6b8a), 0.0, 0.4)
    dz = lambda x: deck_z(spec, x)
    hw = lambda x: hull_profile(spec, min((x + L / 2) / L, 0.985))[0] * (1 + spec['flare'])

    # ---- forward casting platform with hatches, trolling-motor plate, anchor locker and a low pulpit
    platform('casting_deck', spec, 1.55, 3.28, 0.3, deck, root)
    box('casting_edge', (0.05, hw(1.55) * 1.9, 0.045), (1.55, 0, dz(1.55) + 0.3), steel, root, bevel=0.01)
    for (hx, hy, hs) in ((2.1, 0.46, 0.4), (2.1, -0.46, 0.4), (2.7, 0.0, 0.34)):
        box('hatch', (hs, hs * 0.85, 0.022), (hx, hy, dz(hx) + 0.312), mats['topside'], root, bevel=0.01)
        box('hatch_lip', (hs + 0.04, hs * 0.85 + 0.04, 0.012), (hx, hy, dz(hx) + 0.304), steel, root, bevel=0.004)
        cyl('hatch_pull', 0.022, 0.012, (hx + hs * 0.3, hy, dz(hx) + 0.328), black, root, seg=12)
    box('tm_plate', (0.45, 0.3, 0.02), (3.1, 0.0, dz(3.1) + 0.31), black, root, bevel=0.008)
    for s in (1, -1):
        box('cast_cleat', (0.16, 0.04, 0.03), (2.55, s * (hw(2.55) - 0.1), dz(2.55) + 0.325), steel, root, bevel=0.01)
    # pulpit + anchor roller + nav light mast
    pts = []
    for k in range(13):
        t = k / 12
        x = 2.75 + 0.55 * t
        b = hw(x)
        pts.append((x, b * 0.82, dz(x) + 0.3))
    full = pts + [(p[0], -p[1], p[2]) for p in reversed(pts)]
    tube('pulpit', [(p[0], p[1], p[2] + 0.34) for p in full], 0.016, steel, root)
    for p in pts[::4] + [pts[-1]]:
        for s in (1, -1):
            tube('stanchion', [(p[0], p[1] * s, p[2]), (p[0], p[1] * s, p[2] + 0.34)], 0.013, steel, root)
    cyl('anchor_roller', 0.03, 0.18, (3.34, 0, dz(3.28) + 0.34), steel, root, rot=(math.pi / 2, 0, 0), seg=12)
    tube('nav_mast', [(3.05, 0.0, dz(3.05) + 0.3), (3.05, 0.0, dz(3.05) + 0.78)], 0.012, steel, root)
    cyl('nav_light', 0.03, 0.04, (3.05, 0.0, dz(3.05) + 0.8), mat('nav_white', srgb(0xf4f4ee), 0, 0.3, emit=srgb(0xffffff)), root, seg=10)

    # ---- centre console: faired box, door, sloped dash with two screens, wheel, raked windshield and grab rail
    cx = -0.05
    d0 = dz(cx)
    box('console', (1.15, 0.84, 0.98), (cx, 0, d0 + 0.49), gel, root, bevel=0.07)
    box('console_door', (0.02, 0.5, 0.64), (cx + 0.58, 0, d0 + 0.5), mats['topside'], root, bevel=0.005)
    box('console_door_edge', (0.015, 0.54, 0.68), (cx + 0.582, 0, d0 + 0.5), steel, root, bevel=0.004)
    cyl('console_latch', 0.02, 0.015, (cx + 0.595, -0.14, d0 + 0.5), black, root, rot=(0, math.pi / 2, 0))
    box('dash', (0.46, 0.8, 0.07), (cx - 0.12, 0, d0 + 1.03), black, root, bevel=0.02, rot=(0, -0.32, 0))
    for sy in (0.2, -0.2):
        box('mfd', (0.02, 0.3, 0.2), (cx - 0.04, sy, d0 + 1.12), mat('screen', srgb(0x0a2030), 0, 0.2, emit=srgb(0x2aa6ff)), root, bevel=0.0, rot=(0, -0.55, 0))
    wh = [(cx - 0.32 + 0.03 * math.sin(a), 0.0 + 0.16 * math.cos(a), d0 + 1.2 + 0.16 * math.sin(a)) for a in [k * math.pi / 8 for k in range(17)]]
    tube('helm_wheel', wh, 0.014, black, root)
    cyl('helm_hub', 0.04, 0.05, (cx - 0.3, 0.0, d0 + 1.2), steel, root, rot=(0, math.pi / 2, 0))
    for k in range(5):
        a = k * 2 * math.pi / 5
        tube('helm_spoke', [(cx - 0.3, 0.0, d0 + 1.2), (cx - 0.32, 0.16 * math.cos(a), d0 + 1.2 + 0.16 * math.sin(a))], 0.007, black, root)
    box('throttle', (0.1, 0.05, 0.08), (cx - 0.1, 0.38, d0 + 1.05), black, root, bevel=0.02)
    # windshield: raked frame with a centre and two wrap panels, stainless grab rail over it
    top = d0 + 1.62
    for yy in (-0.42, 0.42):
        tube('ws_post', [(cx + 0.28, yy, d0 + 1.0), (cx + 0.1, yy * 0.96, top)], 0.017, steel, root)
    for yy in (-0.14, 0.14):
        tube('ws_mid', [(cx + 0.27, yy, d0 + 1.0), (cx + 0.1, yy, top)], 0.011, steel, root)
    box('ws_glass', (0.016, 0.8, 0.58), (cx + 0.19, 0.0, d0 + 1.31), glass, root, bevel=0.0, rot=(0, 0.3, 0))
    tube('ws_header', [(cx + 0.1, -0.44, top), (cx + 0.1, 0.44, top)], 0.016, steel, root)
    tube('grab_rail', [(cx + 0.02, -0.52, top + 0.02), (cx + 0.02, 0.52, top + 0.02)], 0.013, steel, root)

    # ---- T-top: raked front legs from the console, aft legs to the gunwale, hardtop with rocket launcher + lights
    tz = d0 + 2.18
    for s in (1, -1):
        tube('ttop_leg_f', [(cx + 0.28, s * 0.42, d0 + 1.0), (cx - 0.05, s * 0.5, tz)], 0.024, steel, root)
        tube('ttop_leg_a', [(-1.55, s * (hw(-1.55) - 0.04), dz(-1.55) + 0.02), (-1.45, s * 0.58, tz)], 0.022, steel, root)
        tube('ttop_brace', [(-1.5, s * (hw(-1.5) - 0.06), dz(-1.5) + 0.7), (-0.45, s * 0.52, tz - 0.12)], 0.013, steel, root)
    box('ttop_top', (2.05, 1.35, 0.06), (-0.62, 0, tz + 0.03), gel, root, bevel=0.025)
    box('ttop_lip', (2.05, 1.4, 0.03), (-0.62, 0, tz - 0.01), steel, root, bevel=0.008)
    tube('ttop_aft_rail', [(-1.62, -0.6, tz - 0.06), (-1.68, 0, tz - 0.02), (-1.62, 0.6, tz - 0.06)], 0.018, steel, root)
    for k in range(6):
        yy = -0.5 + k * 0.2
        cyl('rocket_holder', 0.027, 0.3, (-1.74, yy, tz + 0.07), black, root, rot=(0, 0.55, 0), seg=12)
    for s in (1, -1):
        cyl('spreader_light', 0.045, 0.1, (0.28, s * 0.38, tz - 0.07), black, root, rot=(0, math.pi / 2, 0), seg=12)
        cyl('spreader_lens', 0.04, 0.01, (0.335, s * 0.38, tz - 0.07), mat('spreader_glow', srgb(0xfff4d8), 0, 0.3, emit=srgb(0xfff0c8)), root, rot=(0, math.pi / 2, 0), seg=12)
    sphere('gps_dome', 0.07, (-0.9, 0.0, tz + 0.08), gel, root, scale=(1, 1, 0.7))
    tube('vhf_whip', [(-1.2, 0.5, tz + 0.06), (-1.28, 0.5, tz + 1.15)], 0.007, steel, root)

    # ---- leaning post with rod holders and a drink tray; aft livewell lid; transom jump seats; gunwale rod holders
    lp = -0.95
    box('leaning_base', (0.5, 0.85, 0.5), (lp, 0, dz(lp) + 0.25), gel, root, bevel=0.05)
    box('leaning_pad', (0.18, 0.8, 0.34), (lp - 0.2, 0, dz(lp) + 0.78), cush, root, bevel=0.06, rot=(0, -0.18, 0))
    tube('leaning_rail', [(lp - 0.24, -0.46, dz(lp) + 0.45), (lp - 0.3, -0.46, dz(lp) + 1.0), (lp - 0.3, 0.46, dz(lp) + 1.0), (lp - 0.24, 0.46, dz(lp) + 0.45)], 0.018, steel, root)
    for k in range(4):
        cyl('lp_rod_holder', 0.026, 0.2, (lp - 0.3, -0.33 + k * 0.22, dz(lp) + 1.04), black, root, rot=(0, 0.5, 0), seg=12)
    box('livewell', (0.85, 0.75, 0.3), (-2.15, 0, dz(-2.15) + 0.15), gel, root, bevel=0.04)
    box('livewell_lid', (0.8, 0.7, 0.03), (-2.15, 0, dz(-2.15) + 0.315), lid_blue, root, bevel=0.01)
    cyl('livewell_latch', 0.025, 0.015, (-2.15 + 0.3, 0, dz(-2.15) + 0.34), black, root)
    for s in (1, -1):
        sx = -3.05
        box('jump_seat', (0.34, 0.6, 0.12), (sx, s * 0.62, dz(sx) + 0.32), cush_dk, root, bevel=0.04)
        box('jump_back', (0.1, 0.6, 0.3), (sx - 0.14, s * 0.62, dz(sx) + 0.5), cush_dk, root, bevel=0.04)
        box('jump_base', (0.38, 0.62, 0.26), (sx, s * 0.62, dz(sx) + 0.13), gel, root, bevel=0.03)
    for k, x_ in enumerate((-2.6, -1.9, -1.1, -0.2, 0.5, 1.2)):
        for s in (1, -1):
            cyl('gunwale_holder', 0.026, 0.1, (x_, s * (hw(x_) - 0.07), hull_profile(spec, (x_ + L / 2) / L)[3] - 0.02), black, root, rot=(-s * 0.55, 0, 0), seg=12)
    for x_ in (-2.8, -0.4, 1.9):
        for s in (1, -1):
            box('pop_cleat', (0.15, 0.035, 0.025), (x_, s * (hw(x_) - 0.03), hull_profile(spec, (x_ + L / 2) / L)[3] - 0.015), steel, root, bevel=0.01)
    # rub rail (outer gunwale strake) in black vinyl-insert stainless
    for s in (1, -1):
        pts = []
        for i in range(0, 31):
            t = i / 30
            b, k_, ch, sh = hull_profile(spec, t)
            pts.append((-L / 2 + L * t, s * b * (1 + spec['flare']) * 1.012, sh - 0.045))
        tube('rubrail', pts, 0.016, black, root)

    # ---- transom: bracket, 200 hp outboard, fuel gauge, ladder
    box('jackplate', (0.14, 0.62, 0.5), (-L / 2 - 0.05, 0, dz(-L / 2) - 0.02), steel, root, bevel=0.02)
    outboard(root, -L / 2 - 0.28, 0, 0.82, 1.3, mat('cowl_bay', srgb(0x1a1d20), 0.35, 0.28))
    box('trim_tab', (0.28, 0.4, 0.015), (-L / 2 - 0.2, 0.55, 0.2), steel, root, bevel=0.004)
    box('trim_tab', (0.28, 0.4, 0.015), (-L / 2 - 0.2, -0.55, 0.2), steel, root, bevel=0.004)
    return spec
