# 58' convertible sportfishing yacht: flared graphite hull with a gold cove, teak cockpit, enclosed salon, flybridge under a
# hardtop, tuna tower, outriggers and a swim platform. exec'd by build_boats.py.
# Hull recipe is mirrored in src/game/boatVisual.js (SPEC.yacht): keep in sync.

YACHT = dict(length=18.4, beam=5.5, depth=2.35, deadrise=21, transom=0.88, bowPow=1.5, bowRise=0.52,
             sheer=0.22, flare=0.11, deckDrop=0.82, waterline=0.42)

def build_yacht(root):
    spec = dict(YACHT)
    L = spec['length']
    mats = {
        'topside': mat('topside', srgb(0x1b2733), 0.1, 0.18),          # graphite gelcoat, high gloss
        'bottom': mat('bottom', srgb(0x23201e), 0.0, 0.5),
        'stripe': mat('stripe', srgb(0xc19b3c), 0.55, 0.3),            # gold cove / boot
        'deck': mat('teak', srgb(0x9d7449), 0.0, 0.65),
        'trim': mat('trim', srgb(0xc8ced4), 1.0, 0.2),
    }
    build_hull(spec, root, mats)
    white = mat('house_white', srgb(0xf1f1ed), 0.05, 0.2)
    glass = mat('glass', srgb(0x0a1217), 0.35, 0.04)
    steel = mats['trim']
    black = mat('yacht_black', srgb(0x15171a), 0.3, 0.5)
    teak = mats['deck']
    teak_dk = mat('teak_dark', srgb(0x6b4c2d), 0.0, 0.6)
    gold = mats['stripe']
    vinyl = mat('vinyl_white', srgb(0xeeebe2), 0.0, 0.5)
    vinyl_dk = mat('vinyl_graphite', srgb(0x363c42), 0.0, 0.55)
    dz = lambda x: deck_z(spec, x)
    hp = lambda x: hull_profile(spec, min(max((x + L / 2) / L, 0.0), 0.985))
    side = lambda x: hp(x)[0] * (1 + spec['flare'])
    d0 = dz(-1.0)                                      # main deck height amidships
    sal_h = 2.25
    fly_z = d0 + sal_h                                  # flybridge deck
    hard_z = fly_z + 2.25                                # hardtop underside

    # ---- hull dressing: gold cove stripe, stainless rub rail, port lights
    for s in (1, -1):
        for zoff, mt, r in ((0.5, gold, 0.03), (0.1, steel, 0.028)):
            pts = []
            for i in range(0, 41):
                t = i / 40
                b, k_, ch, sh = hp(-L / 2 + L * t)
                pts.append((-L / 2 + L * t, s * b * (1 + spec['flare']) * (1.012 if mt is gold else 1.008), sh - zoff))
            tube('cove' if mt is gold else 'rubrail', pts, r, mt, root)
        for k in range(7):
            x = -3.0 + k * 1.15
            b, k_, ch, sh = hp(x)
            zp = sh - 0.95
            cyl('port', 0.13, 0.04, (x, s * (b * (1 + spec['flare']) - 0.06), zp), black, root, rot=(math.pi / 2, 0, 0), seg=18)
            cyl('port_glass', 0.1, 0.045, (x, s * (b * (1 + spec['flare']) - 0.055), zp), glass, root, rot=(math.pi / 2, 0, 0), seg=18)
    # ---- cockpit: teak-lined, flush fish-box hatches, tackle centre, mezzanine settee, live-bait tank
    cx0, cx1 = -8.9, -4.7
    cz = dz(-6.5)
    for (hx, hy) in ((-5.6, 1.15), (-5.6, -1.15), (-7.8, 1.2), (-7.8, -1.2)):
        box('fish_hatch', (0.9, 0.7, 0.025), (hx, hy, cz + 0.013), teak_dk, root, bevel=0.01)
        box('hatch_rim', (0.96, 0.76, 0.012), (hx, hy, cz + 0.006), steel, root, bevel=0.004)
        cyl('hatch_pull', 0.03, 0.02, (hx, hy, cz + 0.03), steel, root, seg=12)
    box('tackle_center', (0.9, 1.8, 0.9), (-4.95, 0, cz + 0.45), white, root, bevel=0.06)
    box('tackle_top', (0.94, 1.84, 0.05), (-4.95, 0, cz + 0.92), teak, root, bevel=0.015)
    box('tackle_sink', (0.38, 0.4, 0.02), (-4.95, 0.5, cz + 0.95), steel, root, bevel=0.01)
    for k in range(3):
        box('tackle_drawer', (0.02, 0.5, 0.2), (-4.49, -0.55 + k * 0.55, cz + 0.55), vinyl_dk, root, bevel=0.005)
    box('mezz_seat', (0.7, 3.0, 0.72), (-4.0, 0, cz + 0.36), white, root, bevel=0.05)
    box('mezz_cushion', (0.66, 2.9, 0.13), (-4.0, 0, cz + 0.79), vinyl, root, bevel=0.05)
    box('mezz_back', (0.12, 2.9, 0.46), (-3.78, 0, cz + 1.14), vinyl, root, bevel=0.05)
    box('baittank', (0.9, 1.1, 0.5), (-8.55, 0, cz + 0.25), white, root, bevel=0.05)
    box('baittank_lid', (0.86, 1.06, 0.03), (-8.55, 0, cz + 0.52), mat('baittank_blue', srgb(0x1e6b8a), 0.0, 0.35), root, bevel=0.01)
    # fighting chair: base plate, pedestal, bucket, arms, footrest, gimbal tube
    fx = -6.8
    cyl('chair_plate', 0.34, 0.04, (fx, 0, cz + 0.02), steel, root, seg=24)
    cyl('chair_post', 0.09, 0.62, (fx, 0, cz + 0.33), steel, root, seg=18)
    box('chair_seat', (0.66, 0.66, 0.14), (fx, 0, cz + 0.72), vinyl, root, bevel=0.07)
    box('chair_back', (0.14, 0.66, 0.8), (fx - 0.28, 0, cz + 1.18), vinyl, root, bevel=0.07, rot=(0, -0.14, 0))
    for s in (1, -1):
        box('chair_arm', (0.46, 0.07, 0.06), (fx + 0.02, s * 0.38, cz + 0.98), vinyl_dk, root, bevel=0.02)
        tube('chair_arm_post', [(fx - 0.1, s * 0.38, cz + 0.78), (fx - 0.1, s * 0.38, cz + 0.97)], 0.02, steel, root)
    tube('footrest', [(fx + 0.55, 0.38, cz + 0.45), (fx + 0.75, 0.38, cz + 0.2), (fx + 0.75, -0.38, cz + 0.2), (fx + 0.55, -0.38, cz + 0.45)], 0.03, steel, root)
    box('rod_gimbal', (0.1, 0.1, 0.1), (fx + 0.2, 0, cz + 0.8), steel, root, bevel=0.02)
    # gunwale rod holders and cleats along the cockpit coaming
    for s in (1, -1):
        for x_ in (-8.3, -7.4, -6.5, -5.6, -4.9):
            b, k_, ch, sh = hp(x_)
            cyl('gunwale_holder', 0.04, 0.16, (x_, s * (b * (1 + spec['flare']) - 0.1), sh - 0.02), steel, root, rot=(-s * 0.5, 0, 0), seg=14)
        for x_ in (-8.7, -4.8):
            b, k_, ch, sh = hp(x_)
            box('cleat', (0.28, 0.06, 0.045), (x_, s * (b * (1 + spec['flare']) - 0.06), sh + 0.01), steel, root, bevel=0.015)
    # ---- transom: door outline, twin exhausts, swim platform with rail and ladder
    b0, k0, ch0, sh0 = hp(-L / 2)
    box('transom_door', (0.03, 0.9, 1.35), (-L / 2 - 0.02, 0.0, cz + 0.8), mats['topside'], root, bevel=0.01)
    tube('door_outline', [(-L / 2 - 0.045, -0.46, cz + 0.12), (-L / 2 - 0.045, 0.46, cz + 0.12), (-L / 2 - 0.045, 0.46, cz + 1.48), (-L / 2 - 0.045, -0.46, cz + 1.48), (-L / 2 - 0.045, -0.46, cz + 0.12)], 0.012, steel, root)
    for s in (1, -1):
        cyl('exhaust', 0.14, 0.05, (-L / 2 - 0.03, s * 1.55, 0.95), black, root, rot=(0, math.pi / 2, 0), seg=18)
        cyl('exhaust_rim', 0.15, 0.03, (-L / 2 - 0.045, s * 1.55, 0.95), steel, root, rot=(0, math.pi / 2, 0), seg=18)
    box('swim_platform', (1.0, 3.5, 0.1), (-L / 2 - 0.5, 0, 0.62), teak, root, bevel=0.03)
    box('swim_platform_edge', (1.04, 3.54, 0.05), (-L / 2 - 0.5, 0, 0.56), white, root, bevel=0.02)
    for s in (1, -1):
        tube('swim_rail', [(-L / 2 - 0.1, s * 1.7, 0.67), (-L / 2 - 0.1, s * 1.7, 1.25), (-L / 2 - 0.7, s * 1.7, 1.25), (-L / 2 - 0.9, s * 1.55, 0.67)], 0.022, steel, root)
    for yy in (0.3, 0.7):
        tube('ladder', [(-L / 2 - 0.9, yy + 0.2, 0.67), (-L / 2 - 0.9, yy + 0.2, 0.25)], 0.014, steel, root)
    # ---- salon deckhouse + window band + sliding door
    bx0, bx1 = -3.4, 3.6
    sal_w = 1.95
    box('salon', (bx1 - bx0, sal_w * 2, sal_h), ((bx0 + bx1) / 2, 0, d0 + sal_h / 2), white, root, bevel=0.14)
    for s in (1, -1):
        box('salon_window', (bx1 - bx0 - 1.7, 0.03, 0.85), (0.4, s * (sal_w + 0.005), d0 + 1.45), glass, root, bevel=0.0)
        box('salon_window_frame', (bx1 - bx0 - 1.62, 0.025, 0.93), (0.4, s * (sal_w + 0.002), d0 + 1.45), steel, root, bevel=0.0)
    box('salon_rear_glass', (0.03, 1.5, 1.4), (bx0 - 0.005, 0, d0 + 1.0), glass, root, bevel=0.0)
    box('salon_door_frame', (0.025, 1.6, 1.5), (bx0 - 0.003, 0, d0 + 1.0), steel, root, bevel=0.0)
    tube('door_handle', [(bx0 - 0.04, 0.1, d0 + 0.7), (bx0 - 0.04, 0.1, d0 + 1.2)], 0.012, steel, root)
    box('salon_front_glass', (0.03, 3.2, 1.0), (bx1 + 0.01, 0, d0 + 1.45), glass, root, bevel=0.0, rot=(0, -0.45, 0))
    for yy in (-1.6, -0.55, 0.55, 1.6):
        tube('salon_mullion', [(bx1 + 0.06, yy, d0 + 0.95), (bx1 - 0.05, yy, d0 + 1.95)], 0.02, steel, root)
    # side-deck handrails along the salon
    for s in (1, -1):
        tube('grabrail', [(bx0 + 0.3, s * (sal_w + 0.05), d0 + 1.9), (bx1 - 0.3, s * (sal_w + 0.05), d0 + 1.9)], 0.02, steel, root)
    # ---- flybridge: deck coaming, helm, settee, raked windscreen, hardtop on pillars
    fx0, fx1 = -3.5, 2.3
    fw = 1.75
    box('fly_deck', (fx1 - fx0, fw * 2 + 0.3, 0.14), ((fx0 + fx1) / 2, 0, fly_z), white, root, bevel=0.06)
    box('fly_floor', (fx1 - fx0 - 0.2, fw * 2 - 0.1, 0.02), ((fx0 + fx1) / 2, 0, fly_z + 0.08), teak, root, bevel=0.0)
    for s in (1, -1):
        box('fly_coaming', (fx1 - fx0, 0.1, 0.85), ((fx0 + fx1) / 2, s * (fw + 0.05), fly_z + 0.5), white, root, bevel=0.04)
    box('fly_coaming', (0.1, fw * 2 + 0.2, 0.85), (fx0, 0, fly_z + 0.5), white, root, bevel=0.04)
    box('fly_helm', (1.3, 1.9, 0.9), (1.55, 0, fly_z + 0.52), white, root, bevel=0.07)
    box('fly_dash', (0.6, 1.8, 0.08), (1.35, 0, fly_z + 1.01), black, root, bevel=0.02, rot=(0, -0.3, 0))
    for yy in (-0.55, 0.0, 0.55):
        box('fly_mfd', (0.02, 0.42, 0.3), (1.52, yy, fly_z + 1.15), mat('screen', srgb(0x0a2030), 0, 0.2, emit=srgb(0x2aa6ff)), root, bevel=0.0, rot=(0, -0.6, 0))
    cyl('fly_wheel', 0.2, 0.03, (1.1, 0.0, fly_z + 1.17), mat('wheel', srgb(0x1a1a1a), 0.3, 0.45), root, rot=(0, 1.15, 0), seg=26)
    for s in (1, -1):
        cyl('throttle_head', 0.05, 0.14, (1.35, s * 0.92, fly_z + 1.0), black, root, seg=10)
    box('fly_settee', (0.8, 2.4, 0.45), (-1.0, 0, fly_z + 0.3), vinyl, root, bevel=0.05)
    box('fly_settee_back', (0.14, 2.4, 0.5), (-1.45, 0, fly_z + 0.7), vinyl, root, bevel=0.05)
    for yy in (0.55, -0.55):
        cyl('fly_chair_post', 0.05, 0.38, (0.7, yy, fly_z + 0.27), steel, root, seg=10)
        box('fly_chair', (0.5, 0.48, 0.12), (0.7, yy, fly_z + 0.52), vinyl_dk, root, bevel=0.05)
        box('fly_chair_back', (0.1, 0.48, 0.5), (0.5, yy, fly_z + 0.82), vinyl_dk, root, bevel=0.05)
    # windscreen: raked, three panels, stainless frame
    for yy in (-1.65, -0.55, 0.55, 1.65):
        tube('fly_ws_post', [(2.05, yy, fly_z + 1.0), (1.8, yy * 0.98, fly_z + 2.05)], 0.02, steel, root)
    for yy in (-1.1, 0.0, 1.1):
        box('fly_ws_glass', (0.02, 1.05, 0.95), (1.93, yy, fly_z + 1.55), glass, root, bevel=0.0, rot=(0, 0.23, 0))
    # hardtop on six pillars, with aft overhang and rod storage rails
    ht_x0, ht_x1 = -3.9, 2.2
    for s in (1, -1):
        for x_ in (ht_x0 + 0.35, -1.0, ht_x1 - 0.35):
            tube('hardtop_pillar', [(x_, s * (fw + 0.1), fly_z + 0.9), (x_, s * (fw + 0.1), hard_z)], 0.04, white, root)
    box('hardtop', (ht_x1 - ht_x0, fw * 2 + 0.7, 0.18), ((ht_x0 + ht_x1) / 2, 0, hard_z + 0.09), white, root, bevel=0.09)
    box('hardtop_roof_edge', (ht_x1 - ht_x0 - 0.1, fw * 2 + 0.75, 0.04), ((ht_x0 + ht_x1) / 2, 0, hard_z - 0.01), steel, root, bevel=0.01)
    for k in range(8):
        xx = ht_x0 + 0.6 + k * 0.75
        box('hardtop_light', (0.18, 0.04, 0.04), (xx, 0.0, hard_z - 0.04), mat('hardtop_led', srgb(0xfff6e0), 0, 0.3, emit=srgb(0xfff0d0)), root, bevel=0.0)
    # ---- tuna tower: four raking legs, two ladders of rungs, upper station with rail, spreader lights, radome
    tz0 = hard_z + 0.18
    tz1 = tz0 + 3.4
    tx0, tx1 = -2.7, -0.1
    for (xa, ya, xb, yb) in ((tx0, 1.3, tx0 + 0.3, 0.65), (tx0, -1.3, tx0 + 0.3, -0.65), (tx1, 1.3, tx1 - 0.2, 0.65), (tx1, -1.3, tx1 - 0.2, -0.65)):
        tube('tower_leg', [(xa, ya, tz0), (xb, yb, tz1)], 0.065, steel, root)
    for k in range(1, 4):
        f = k / 4
        for xs_ in (tx0 + 0.3 * f, tx1 - 0.2 * f):
            yy = 1.3 - 0.65 * f
            tube('tower_brace', [(xs_, yy, tz0 + 3.4 * f), (xs_, -yy, tz0 + 3.4 * f)], 0.04, steel, root)
        for yy_s in (1, -1):
            tube('tower_cross', [(tx0 + 0.3 * (f - 0.25), yy_s * (1.3 - 0.65 * (f - 0.25)), tz0 + 3.4 * (f - 0.25)), (tx1 - 0.2 * f, yy_s * (1.3 - 0.65 * f), tz0 + 3.4 * f)], 0.025, steel, root)
    box('tower_deck', (tx1 - tx0 + 0.3, 1.9, 0.08), ((tx0 + tx1) / 2 + 0.05, 0, tz1 + 0.04), teak_dk, root, bevel=0.02)
    rail = [(tx0 - 0.05, -0.95, tz1 + 0.05), (tx0 - 0.05, -0.95, tz1 + 1.0), (tx1 + 0.05, -0.95, tz1 + 1.0), (tx1 + 0.05, 0.95, tz1 + 1.0), (tx0 - 0.05, 0.95, tz1 + 1.0), (tx0 - 0.05, 0.95, tz1 + 0.05)]
    tube('tower_rail', rail, 0.025, steel, root)
    for p in ((tx0 - 0.05, -0.95), (tx1 + 0.05, -0.95), (tx1 + 0.05, 0.95), (tx0 - 0.05, 0.95)):
        tube('tower_stanchion', [(p[0], p[1], tz1 + 0.05), (p[0], p[1], tz1 + 1.0)], 0.02, steel, root)
    box('tower_helm', (0.5, 0.9, 0.7), (tx1 - 0.15, 0, tz1 + 0.43), white, root, bevel=0.05)
    box('tower_dash', (0.25, 0.8, 0.05), (tx1 - 0.3, 0, tz1 + 0.8), black, root, bevel=0.01, rot=(0, -0.3, 0))
    box('tower_seat', (0.4, 0.42, 0.1), (tx0 + 0.6, 0, tz1 + 0.36), vinyl_dk, root, bevel=0.04)
    for s in (1, -1):
        cyl('spreader_light', 0.08, 0.14, (tx1 + 0.08, s * 0.8, tz1 + 1.12), black, root, rot=(0, math.pi / 2, 0), seg=14)
        cyl('spreader_lens', 0.07, 0.01, (tx1 + 0.16, s * 0.8, tz1 + 1.12), mat('spreader_glow', srgb(0xfff4d8), 0, 0.3, emit=srgb(0xfff0c8)), root, rot=(0, math.pi / 2, 0), seg=14)
    sphere('radome', 0.42, (-0.6, 0.0, hard_z + 0.55), white, root, scale=(1, 1, 0.82))
    cyl('radome_base', 0.4, 0.14, (-0.6, 0.0, hard_z + 0.27), white, root, seg=22)
    for k, (xa, ya, hh) in enumerate(((-1.7, 0.9, 1.4), (-1.9, -0.9, 1.9), (-3.4, 0.0, 1.2))):
        tube('antenna', [(xa, ya, hard_z + 0.18), (xa, ya, hard_z + 0.18 + hh)], 0.012, steel, root)
    # ---- outriggers (long tapered poles) from the hardtop sides
    tips = []
    for s in (1, -1):
        base = (0.2, s * 1.75, hard_z + 0.3)
        tip = (-4.5, s * 8.0, hard_z + 0.3 + 5.6)
        tube('outrigger', [base, ((base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2), tip], 0.035, steel, root)
        tube('outrigger_stay', [(0.2, s * 1.2, hard_z + 1.4), (0.2, s * 1.75, hard_z + 0.3)], 0.02, steel, root)
        tube('outrigger_line', [tip, (-L / 2 + 0.5, s * 1.3, 1.9)], 0.004, mat('line', srgb(0xeeeeee), 0, 0.5), root)
        box('outrigger_base', (0.18, 0.18, 0.12), base, steel, root, bevel=0.03)
        tips.append(tip)
    print('YACHT_TIPS', tips)
    # ---- foredeck: sun pad, windlass, anchor and roller, bow rail, hawse pipes, cleats
    xf0, xf1 = 4.0, 8.4
    fdz = dz(6.0)
    bm = bmesh.new()
    rows = []
    for k in range(11):
        x = xf0 + (xf1 - xf0) * k / 10
        w = side(x) * 0.62
        z = dz(x) + 0.0
        rows.append((x, w, z))
    sp = [(bm.verts.new((x, w, z + 0.34)), bm.verts.new((x, -w, z + 0.34))) for (x, w, z) in rows]
    for k in range(10):
        bm.faces.new((sp[k][0], sp[k + 1][0], sp[k + 1][1], sp[k][1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    sun = mesh_obj('sunpad', bm, vinyl, root)
    sm_ = sun.modifiers.new('sol', 'SOLIDIFY'); sm_.thickness = 0.1; sm_.offset = -1
    box('sunpad_base', (xf1 - xf0 - 0.4, side(6.2) * 1.15, 0.3), ((xf0 + xf1) / 2 - 0.1, 0, dz(6.2) + 0.15), white, root, bevel=0.06)
    box('windlass', (0.55, 0.45, 0.24), (xf1 + 0.45, 0, dz(xf1 + 0.45) + 0.12), mat('windlass', srgb(0x4a5156), 0.6, 0.4), root, bevel=0.04)
    cyl('windlass_drum', 0.1, 0.4, (xf1 + 0.45, 0, dz(xf1 + 0.45) + 0.3), steel, root, rot=(math.pi / 2, 0, 0), seg=16)
    cyl('anchor_roller', 0.09, 0.4, (L / 2 - 0.1, 0, dz(L / 2 - 0.2) + 0.22), steel, root, rot=(math.pi / 2, 0, 0), seg=14)
    box('anchor_shank', (0.8, 0.07, 0.07), (L / 2 - 0.45, 0, dz(L / 2 - 0.5) + 0.3), steel, root, bevel=0.02)
    for s in (1, -1):
        box('anchor_fluke', (0.18, 0.28, 0.04), (L / 2 - 0.12, s * 0.2, dz(L / 2 - 0.2) + 0.12), steel, root, bevel=0.01, rot=(s * 0.5, 0, 0))
        cyl('hawse', 0.05, 0.05, (6.6, s * side(6.6) * 0.99, hp(6.6)[3] - 0.25), steel, root, rot=(math.pi / 2, 0, 0), seg=12)
    bow_rail(spec, root, steel, 0.62, 0.88)
    for x_ in (4.4, 6.8):
        for s in (1, -1):
            b, k_, ch, sh = hp(x_)
            box('cleat', (0.3, 0.06, 0.05), (x_, s * (b * (1 + spec['flare']) - 0.08), sh + 0.02), steel, root, bevel=0.015)
    life_ring(root, (bx0 + 0.2, sal_w + 0.12, d0 + 1.3), (math.pi / 2, 0, 0))
    return spec
