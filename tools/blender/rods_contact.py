"""Contact sheet of the game rods: renders every public/models/rods/*.glb (side view + reel close-ups) with Blender's
workbench engine into --out DIR as <name>_full/_reel_l/_reel_r/_top.png (tools/assets/rods_sheet.py stitches them).
  blender -b --factory-startup --python tools/blender/rods_contact.py -- --out DIR [--only kit,surf]
Blender axes after import: tip along -Y, up +Z, crank on +X."""
import bpy, sys, os, math, glob, json
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[argv.index('--out') + 1]
ONLY = argv[argv.index('--only') + 1].split(',') if '--only' in argv else None
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.makedirs(OUT, exist_ok=True)
for path in sorted(glob.glob(os.path.join(ROOT, 'public', 'models', 'rods', '*.glb'))):
    name = os.path.splitext(os.path.basename(path))[0]
    if ONLY and name not in ONLY:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
    sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.82, 0.84, 0.86)
    sc.render.film_transparent = True; sc.render.image_settings.color_mode = 'RGBA'
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.clip_end = 500; sc.camera = cam
    pts = []
    for o in bpy.data.objects:
        if o.type == 'MESH' and any(m for m in o.data.materials):
            pts += [o.matrix_world @ v.co for v in o.data.vertices]
    ymin, ymax = min(p.y for p in pts), max(p.y for p in pts)
    L = ymax - ymin
    meta = None
    for o in bpy.data.objects:
        if o.type == 'ARMATURE' and 'rod' in o:
            meta = json.loads(o['rod'])
    reel_y = -(meta['reel_z']) if meta else 0.0
    def shot(fn, centre, scale, d, up, w, h):
        sc.render.resolution_x, sc.render.resolution_y = w, h
        cam.data.ortho_scale = scale
        d = Vector(d).normalized()
        cam.location = Vector(centre) + d * 50
        cam.rotation_euler = (-d).to_track_quat('-Z', up).to_euler()
        sc.render.filepath = os.path.join(OUT, f'{name}_{fn}.png')
        bpy.ops.render.render(write_still=True)
    mid = Vector((0, (ymin + ymax) / 2, 0))
    shot('full', mid, L * 1.04, (-1, 0, 0), 'Y', 1400, 340)
    rc = Vector((0, reel_y, -0.06))
    shot('reel_l', rc, 0.46, (-1, 0, 0), 'Y', 520, 340)
    shot('reel_r', rc, 0.46, (1, 0, 0), 'Y', 520, 340)
    shot('top', rc, 0.46, (0, -1, 0), 'Z', 520, 340)   # looking from the tip end toward the butt: the angler's view
    print('SHEET', name, 'len', round(L, 3))
