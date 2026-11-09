# Renders all exported boats side by side (Workbench) for a quick visual check.
import bpy, os, sys, math
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models', 'boats')
dst = sys.argv[sys.argv.index('--') + 1]
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
y = 0
for name in ['jon', 'bass', 'skiff', 'center', 'sport', 'trawler', 'seiner']:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, name + '.glb'))
    for o in set(bpy.data.objects) - before:
        if o.parent is None: o.location.y += y
    y += {'jon': 4, 'bass': 5, 'skiff': 5, 'center': 7, 'sport': 10, 'trawler': 12, 'seiner': 0}[name]
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL'
sc.display.shading.show_cavity = True
sc.render.resolution_x, sc.render.resolution_y = 1600, 800
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
cam.location = (38, 22, 16)
cam.rotation_euler = (math.radians(68), 0, math.radians(118))
cam.data.lens = 28
sc.camera = cam
sc.render.filepath = dst
bpy.ops.render.render(write_still=True)
print('RENDERED')
