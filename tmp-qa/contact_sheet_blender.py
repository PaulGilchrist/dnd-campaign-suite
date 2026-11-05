# Render a contact sheet of tmp-qa/items/*.png onto a checkerboard.
# Run inside Blender via MCP.
import bpy, os, glob, math, mathutils

ITEMS = '/Users/paulgilchrist/Source/dnd-campaign-suite/tmp-qa/items'
OUT = os.path.join(ITEMS, 'contact-sheet.png')
files = sorted(f for f in glob.glob(os.path.join(ITEMS, '*.png'))
               if 'contact-sheet' not in f and '/test/' not in f)

scene = bpy.context.scene
# wipe everything except nothing (scene can be rebuilt after)
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
for block_list in (bpy.data.meshes, bpy.data.materials, bpy.data.images,
                   bpy.data.cameras, bpy.data.lights):
    for b in list(block_list):
        if b.users == 0:
            block_list.remove(b)

COLS, ROWS = 6, (len(files) + 5) // 6
CW, CH = 1.0, 1.0
W, H = COLS * CW, ROWS * CH

# background checker
bg_mat = bpy.data.materials.new('BG'); bg_mat.use_nodes = True
nt = bg_mat.node_tree; nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial')
em = nt.nodes.new('ShaderNodeEmission')
tc = nt.nodes.new('ShaderNodeTexCoord')
mapn = nt.nodes.new('ShaderNodeMapping'); mapn.inputs['Scale'].default_value = (W*2, H*2, 1)
brick = nt.nodes.new('ShaderNodeTexBrick')
brick.inputs['Color1'].default_value = (0.16, 0.16, 0.18, 1)
brick.inputs['Color2'].default_value = (0.24, 0.24, 0.27, 1)
brick.inputs['Mortar'].default_value = (0.1, 0.1, 0.1, 1)
brick.offset = 0.0
ramp = nt.nodes.new('ShaderNodeValToRGB')
nt.links.new(tc.outputs['Object'], mapn.inputs['Vector'])
nt.links.new(mapn.outputs['Vector'], brick.inputs['Vector'])
nt.links.new(brick.outputs['Color'], em.inputs['Color'])
nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
bpy.ops.mesh.primitive_plane_add(size=1, location=(W/2, H/2, -0.01))
bg = bpy.context.active_object; bg.scale = (W/2, H/2, 1)
bg.data.materials.append(bg_mat)

for i, f in enumerate(files):
    t = bpy.data.images.load(f)
    m = bpy.data.materials.new('sp_' + os.path.basename(f)); m.use_nodes = True
    n2 = m.node_tree; n2.nodes.clear()
    o2 = n2.nodes.new('ShaderNodeOutputMaterial')
    e2 = n2.nodes.new('ShaderNodeEmission')
    tex = n2.nodes.new('ShaderNodeTexImage'); tex.image = t
    n2.links.new(tex.outputs['Color'], e2.inputs['Color'])
    tr2 = n2.nodes.new('ShaderNodeBsdfTransparent')
    mix2 = n2.nodes.new('ShaderNodeMixShader')
    n2.links.new(tex.outputs['Alpha'], mix2.inputs['Factor'])
    n2.links.new(tr2.outputs['BSDF'], mix2.inputs[1])
    n2.links.new(e2.outputs['Emission'], mix2.inputs[2])
    n2.links.new(mix2.outputs['Shader'], o2.inputs['Surface'])
    m.blend_method = 'BLEND'
    r, c = divmod(i, COLS)
    x, y = c * CW + CW/2, (ROWS - 1 - r) * CH + CH/2
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, 0))
    p = bpy.context.active_object
    p.scale = (CW*0.94/2 * min(1, (CW*0.94)/(max(t.size[0],1)/max(t.size[1],1))),
               CH*0.86/2, 1)
    # uniform fit: compute from image aspect
    aw, ah = t.size[0] or 1, t.size[1] or 1
    s = min(CW*0.94/aw, CH*0.82/ah)
    p.scale = (aw*s/2, ah*s/2, 1)
    p.data.materials.append(m)

cam_d = bpy.data.cameras.new('sheet'); cam_d.type = 'ORTHO'
cam_d.ortho_scale = W
cam = bpy.data.objects.new('sheetcam', cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (W/2, H/2, 5)
cam.rotation_euler = (0, 0, 0)

scene.render.engine = 'BLENDER_EEVEE'
scene.render.film_transparent = False
scene.render.resolution_x = int(W * 240)
scene.render.resolution_y = int(H * 240)
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('contact sheet', W, 'x', H, len(files), 'images')
