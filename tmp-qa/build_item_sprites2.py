# Indoor item sprite pipeline — full reproducible build for Blender 5.2 EEVEE.
# Renders top-down-ish transparent PNGs to tmp-qa/items/ and exports GLBs to
# src/assets/3d-map/ (originals already backed up in tmp-qa/items/glb-originals).
import bpy, bmesh, math, os, random, builtins
import mathutils

SRC = '/Users/paulgilchrist/Source/dnd-campaign-suite/src/assets/3d-map'
SPRITES = '/Users/paulgilchrist/Source/dnd-campaign-suite/tmp-qa/items'
os.makedirs(SPRITES, exist_ok=True)

scene = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
for bl in (bpy.data.meshes, bpy.data.materials, bpy.data.images,
           bpy.data.cameras, bpy.data.lights):
    for b2 in list(bl):
        if b2.users == 0:
            bl.remove(b2)

scene.render.engine = 'BLENDER_EEVEE'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

cam_data = bpy.data.cameras.new('SpriteCam'); cam_data.type = 'ORTHO'
cam = bpy.data.objects.new('SpriteCam', cam_data)
scene.collection.objects.link(cam); scene.camera = cam

def sun(name, euler, energy, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, 'SUN'); ld.energy = energy; ld.color = color
    lo = bpy.data.objects.new(name, ld); lo.rotation_euler = euler
    scene.collection.objects.link(lo)

sun('Key', (math.radians(15), 0, math.radians(30)), 3.0)
sun('Fill', (math.radians(-40), 0, math.radians(-140)), 1.2, (0.9, 0.95, 1.0))
sun('Rim', (math.radians(65), 0, math.radians(160)), 1.5, (1.0, 0.95, 0.85))

# ---------------- materials ----------------
def pmat(name, color, rough=0.6, metal=0.0, emission=None, estr=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = estr
    return m

def noise_ramp_mat(name, c1, c2, scale=9.0, rough=0.55, streak=None, seams=None, seam_dark=0.35):
    """streak=(x,y,z) mapping scale for grain stretch; seams=plank width -> dark lines."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = rough
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tc = nt.nodes.new('ShaderNodeTexCoord')
    if seams:
        mapw = nt.nodes.new('ShaderNodeMapping')
        mapw.inputs['Scale'].default_value = (1.0, 1.0 / seams, 1.0)
        nt.links.new(tc.outputs['Object'], mapw.inputs['Vector'])
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(mapw.outputs['Vector'], sep.inputs['Vector'])
        frac = nt.nodes.new('ShaderNodeMath'); frac.operation = 'FRACT'
        nt.links.new(sep.outputs['Y'], frac.inputs[0])
        s1 = nt.nodes.new('ShaderNodeMath'); s1.operation = 'LESS_THAN'
        s1.inputs[1].default_value = 0.045
        nt.links.new(frac.outputs[0], s1.inputs[0])
        s2 = nt.nodes.new('ShaderNodeMath'); s2.operation = 'GREATER_THAN'
        s2.inputs[1].default_value = 0.955
        nt.links.new(frac.outputs[0], s2.inputs[0])
        sad = nt.nodes.new('ShaderNodeMath'); sad.operation = 'ADD'
        nt.links.new(s1.outputs[0], sad.inputs[0])
        nt.links.new(s2.outputs[0], sad.inputs[1])
    if streak:
        mapg = nt.nodes.new('ShaderNodeMapping')
        mapg.inputs['Scale'].default_value = streak
        nt.links.new(tc.outputs['Object'], mapg.inputs['Vector'])
        grain = nt.nodes.new('ShaderNodeTexNoise')
        grain.inputs['Scale'].default_value = scale
        grain.inputs['Detail'].default_value = 6.0
        nt.links.new(mapg.outputs['Vector'], grain.inputs['Vector'])
    else:
        grain = nt.nodes.new('ShaderNodeTexNoise')
        grain.inputs['Scale'].default_value = scale
        grain.inputs['Detail'].default_value = 9.0
        nt.links.new(tc.outputs['Object'], grain.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[0].color = (*c1, 1)
    ramp.color_ramp.elements[1].position = 0.70
    ramp.color_ramp.elements[1].color = (*c2, 1)
    nt.links.new(grain.outputs['Fac'], ramp.inputs['Fac'])
    if seams:
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
        mix.inputs['B'].default_value = (c1[0] * seam_dark, c1[1] * seam_dark, c1[2] * seam_dark, 1)
        nt.links.new(sad.outputs[0], mix.inputs['Factor'])
        nt.links.new(ramp.outputs['Color'], mix.inputs['A'])
        nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    else:
        nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    return m

MAT = {
    'wood_dark':  noise_ramp_mat('WoodDark',  (0.16, 0.085, 0.040), (0.34, 0.195, 0.095), scale=26, streak=(1, 5, 5), seams=0.22),
    'wood_mid':   noise_ramp_mat('WoodMid',   (0.28, 0.155, 0.075), (0.52, 0.32, 0.16), scale=26, streak=(1, 5, 5), seams=0.22),
    'wood_light': noise_ramp_mat('WoodLight', (0.45, 0.30, 0.165), (0.68, 0.50, 0.30), scale=22, streak=(1, 5, 5), seams=0.18),
    'bark':       noise_ramp_mat('Bark', (0.13, 0.08, 0.05), (0.28, 0.18, 0.10), scale=40, streak=(5, 5, 1), rough=0.85),
    'stone':      noise_ramp_mat('Stone', (0.25, 0.235, 0.215), (0.50, 0.475, 0.43), scale=6, rough=0.85),
    'stone_light':noise_ramp_mat('StoneLight', (0.38, 0.355, 0.315), (0.63, 0.595, 0.53), scale=8, rough=0.8),
    'rock_moss':  noise_ramp_mat('RockMoss', (0.17, 0.19, 0.12), (0.42, 0.42, 0.34), scale=9, rough=0.9),
    'iron':  pmat('Iron', (0.09, 0.09, 0.11), rough=0.35, metal=1.0),
    'steel': pmat('Steel', (0.35, 0.36, 0.38), rough=0.30, metal=1.0),
    'brass': pmat('Brass', (0.62, 0.44, 0.12), rough=0.30, metal=1.0),
    'gold':  pmat('Gold', (0.85, 0.62, 0.18), rough=0.25, metal=1.0),
    'cloth_red': pmat('ClothRed', (0.42, 0.06, 0.06), rough=0.9),
    'cloth_crimson': pmat('ClothCrimson', (0.30, 0.03, 0.08), rough=0.92),
    'linen':  pmat('Linen', (0.87, 0.85, 0.80), rough=0.95),
    'blanket':pmat('Blanket', (0.55, 0.16, 0.12), rough=0.95),
    'leather':pmat('Leather', (0.30, 0.17, 0.09), rough=0.7),
    'leaf':   pmat('Leaf', (0.10, 0.28, 0.08), rough=0.8),
    'leaf_light': pmat('LeafLight', (0.16, 0.38, 0.10), rough=0.8),
    'bone':   pmat('Bone', (0.75, 0.71, 0.60), rough=0.6),
    'water':  pmat('Water', (0.10, 0.35, 0.45), rough=0.05),
    # named lowercase: Map3D swaps the 'flame' material's texture by name
    'flame':  pmat('flame', (1.0, 0.35, 0.05), rough=0.5, emission=(1.0, 0.4, 0.05), estr=1.8),
    'web':    pmat('Web', (0.85, 0.85, 0.88), rough=0.6),
    'rune':   pmat('Rune', (0.9, 0.8, 0.4), rough=0.4, emission=(0.9, 0.7, 0.25), estr=1.2),
}
w = MAT['water'].node_tree.nodes.get('Principled BSDF')
if 'Transmission Weight' in w.inputs:
    w.inputs['Transmission Weight'].default_value = 0.6

# ---------------- geometry helpers ----------------
def box(name, sx, sy, sz, loc, mat, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    ob = bpy.context.active_object; ob.name = name
    ob.scale = (sx, sy, sz)
    ob.data.materials.append(mat)
    if bevel > 0:
        md = ob.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 2
    return ob

def cyl(name, r, depth, loc, mat, verts=32, rot=(0, 0, 0), r2=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        end_fill_type='NGON', location=loc, rotation=rot)
    ob = bpy.context.active_object; ob.name = name
    if r2 is not None:
        zs = [v.co.z for v in ob.data.vertices]
        zmax = max(zs)
        for v in ob.data.vertices:
            if abs(v.co.z - zmax) < 1e-6:
                v.co.x *= r2 / r; v.co.y *= r2 / r
        ob.data.update()
    ob.data.materials.append(mat)
    if verts >= 24:
        for p in ob.data.polygons:
            p.use_smooth = abs(abs(p.normal.z) - 1.0) > 0.01
    return ob

def sphere(name, r, loc, mat, seg=24, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(4, seg // 2), radius=r, location=loc)
    ob = bpy.context.active_object; ob.name = name; ob.scale = scale
    ob.data.materials.append(mat)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def torus(name, R, r, loc, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc,
                                     major_segments=48, minor_segments=12)
    ob = bpy.context.active_object; ob.name = name; ob.scale = scale
    ob.data.materials.append(mat)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def icosphere(name, r, loc, mat, subdiv=2, scale=(1, 1, 1), displace=0.0, seed=0):
    rnd = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    ob = bpy.context.active_object; ob.name = name; ob.scale = scale
    ob.data.materials.append(mat)
    if displace > 0:
        for v in ob.data.vertices:
            v.co += v.normal * rnd.uniform(-displace, displace)
    for p in ob.data.polygons: p.use_smooth = subdiv >= 3
    return ob

def archX(name, x0, x1, yc, ry, y_from, y_to, zb, mat, band=None, segs=16, lift=0.006):
    """Prism along X with circular arch profile in YZ (chest lid)."""
    if band:
        xc, wdt = band
        x0, x1 = xc - wdt / 2, xc + wdt / 2
        ry += lift
    bm = bmesh.new()
    ys = [y_from + (y_to - y_from) * i / segs for i in range(segs + 1)]
    def ztop(y):
        return zb + math.sqrt(max(ry * ry - (y - yc) ** 2, 0.0)) if abs(y - yc) <= ry else zb
    vA0 = [bm.verts.new((x0, y, zb)) for y in ys]
    vB0 = [bm.verts.new((x0, y, ztop(y))) for y in ys]
    vA1 = [bm.verts.new((x1, y, zb)) for y in ys]
    vB1 = [bm.verts.new((x1, y, ztop(y))) for y in ys]
    for i in range(len(ys) - 1):
        bm.faces.new((vB0[i], vB0[i + 1], vB1[i + 1], vB1[i]))
        bm.faces.new((vA0[i], vA1[i], vA1[i + 1], vA0[i + 1]))
    bm.faces.new(tuple(reversed(vB0)) + tuple(vA0))
    bm.faces.new(tuple(vB1) + tuple(reversed(vA1)))
    me = bpy.data.meshes.new(name); bm.normal_update(); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); ob.data.materials.append(mat)
    scene.collection.objects.link(ob)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

# ---------------- model scope + render/export ----------------
TILT = {'door': 42, 'secretDoor': 42, 'arrowSlitWall': 40, 'torch': 48,
        'bookshelf': 48, 'statue': 35, 'pillar': 28, 'web': 52}
# Sprites normally view the model from -Y. Wall props follow the legacy glTF
# convention of facing +X (that's the axis map3dScene offsets/rotates them
# against), so shoot those from +X to keep the sprite face-on.
AZIM = {'door': 90, 'secretDoor': 90, 'arrowSlitWall': 90}
MARGIN = {'torch': 1.3, 'web': 1.15, 'skeleton': 1.1, 'chest': 1.2, 'barrel': 1.1}
state = {'name': None}

def begin(name):
    for ob in list(bpy.data.objects):
        if ob.type == 'MESH':
            bpy.data.objects.remove(ob, do_unlink=True)
    state['name'] = name

def bbox():
    mins = [1e9] * 3; maxs = [-1e9] * 3
    scene.collection.objects.update()
    for ob in bpy.data.objects:
        if ob.type != 'MESH':
            continue
        for corner in ob.bound_box:
            wo = ob.matrix_world @ mathutils.Vector(corner)
            for i in range(3):
                mins[i] = min(mins[i], wo[i]); maxs[i] = max(maxs[i], wo[i])
    return mins, maxs

def shoot(wide=False):
    mins, maxs = bbox()
    dx = maxs[0] - mins[0]; dy = maxs[1] - mins[1]; dz = maxs[2] - mins[2]
    cx = (mins[0] + maxs[0]) / 2; cy = (mins[1] + maxs[1]) / 2; cz = (mins[2] + maxs[2]) / 2
    margin = MARGIN.get(state['name'], 1.12)
    if wide:
        span = max(dx * margin, (dy + dz * 0.4) * 2 * margin)
    else:
        span = max(dx, dy, dz * 0.6, 0.3) * margin
    d = 8
    tilt = math.radians(TILT.get(state['name'], 18))
    azim = math.radians(AZIM.get(state['name'], 0))
    # orbit direction: azim 0 views from -Y; azim 90 views from +X
    ox = d * math.sin(tilt) * math.sin(azim)
    oy = -d * math.sin(tilt) * math.cos(azim)
    loc = mathutils.Vector((cx + ox, cy + oy, mins[2] + d * math.cos(tilt)))
    cam.location = loc
    direction = mathutils.Vector((cx, cy, cz)) - loc
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = span
    if wide:
        scene.render.resolution_x = 512; scene.render.resolution_y = 256
    else:
        scene.render.resolution_x = 288; scene.render.resolution_y = 288
    scene.render.filepath = os.path.join(SPRITES, state['name'] + '.png')
    bpy.ops.render.render(write_still=True)

def export_glb():
    bpy.ops.object.select_all(action='DESELECT')
    n = 0
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            ob.select_set(True); n += 1
    assert n > 0, 'nothing to export for ' + state['name']
    out = os.path.join(SRC, state['name'] + '.glb')
    bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_format='GLB',
                              export_apply=True, export_yup=True)
    print('%s: %d meshes -> %d bytes' % (state['name'], n, os.path.getsize(out)))

# --- glTF only carries image textures, so procedural wood/stone shaders must
# --- be baked to base-color PNGs before export (else meshes fall back to the
# --- glTF default grey). Group by material, join, UV-unwrap, Cycles-bake the
# --- diffuse COLOR pass, rewire the material slot to the baked image.
PROC_MAT_NAMES = {'WoodDark', 'WoodMid', 'WoodLight', 'Bark', 'Stone', 'StoneLight', 'RockMoss'}
TEXDIR = os.path.join(SPRITES, 'tex')
os.makedirs(TEXDIR, exist_ok=True)

def bake_procedural():
    import collections
    groups = collections.defaultdict(list)
    for ob in bpy.data.objects:
        if ob.type == 'MESH' and ob.data.materials:
            m = ob.data.materials[0]
            if m and m.name in PROC_MAT_NAMES:
                groups[m.name].append(ob)
    if not groups:
        return
    prev_engine = scene.render.engine
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    scene.cycles.device = 'CPU'
    try:
        for matname, objs in groups.items():
            src = bpy.data.materials[matname]
            use = src.copy(); use.name = matname + '_baked'
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[-1]
            if len(objs) > 1:
                bpy.ops.object.join()
            ob = bpy.context.view_layer.objects.active
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.02)
            bpy.ops.object.mode_set(mode='OBJECT')
            img = bpy.data.images.new('bake_%s_%s' % (state['name'], matname), 256, 256, alpha=False)
            node = use.node_tree.nodes.new('ShaderNodeTexImage')
            node.image = img
            use.node_tree.nodes.active = node
            ob.data.materials[0] = use
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=8)
            # wire the baked result into the shader so the glTF exporter picks
            # it up as baseColorTexture (the bake target alone is invisible to it)
            bsdf = next(n for n in use.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            for l in list(use.node_tree.links):
                if l.to_node == bsdf and l.to_socket.name == 'Base Color':
                    use.node_tree.links.remove(l)
            use.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
            img.filepath_raw = os.path.join(TEXDIR, '%s_%s.png' % (state['name'], matname))
            img.file_format = 'PNG'
            img.save()
            print('baked', state['name'], matname)
    finally:
        scene.render.engine = prev_engine

def finish(wide=False):
    shoot(wide=wide)
    bake_procedural()
    export_glb()


# ================= BUILD EVERYTHING =================

M = MAT

BUILDERS = {}

def build_barrel():
    begin('barrel')
    cyl('b_bot', 0.34, 0.14, (0, 0, 0.07), M['wood_mid'], r2=0.37)
    cyl('b_mid', 0.37, 0.42, (0, 0, 0.35), M['wood_mid'])
    cyl('b_top', 0.37, 0.14, (0, 0, 0.63), M['wood_mid'], r2=0.34)
    cyl('b_lid', 0.335, 0.03, (0, 0, 0.715), M['wood_dark'])
    for z in (0.10, 0.38, 0.64):
        torus('b_hoop', 0.372, 0.020, (0, 0, z), M['iron'], scale=(1, 1, 1.6))
    finish(wide=False)
BUILDERS['barrel'] = build_barrel

def build_crate():
    begin('crate')
    box('c_floor', 0.88, 0.88, 0.06, (0, 0, 0.03), M['wood_mid'])
    for sx, sy, x, y in ((0.88, 0.08, 0, 0.42), (0.88, 0.08, 0, -0.42), (0.08, 0.88, 0.42, 0), (0.08, 0.88, -0.42, 0)):
        box('c_wall', sx, sy, 0.7, (x, y, 0.41), M['wood_light'])
    for x in (0.44, -0.44):
        for y in (0.44, -0.44):
            box('c_batten', 0.09, 0.09, 0.78, (x, y, 0.39), M['wood_dark'])
    for y, tilt in ((0.47, 0.6), (-0.47, -0.6)):
        box('c_diag', 0.95, 0.04, 0.12, (0, y, 0.42), M['wood_dark'], rot=(tilt, 0, 0))
    finish(wide=False)
BUILDERS['crate'] = build_crate

def build_chest():
    begin('chest')
    box('ch_body', 0.52, 0.8, 0.34, (0, 0, 0.17), M['wood_mid'], bevel=0.015)
    lid = torus('ch_lid', 0.26, 0.26, (0, 0, 0.34), M['wood_light'])  # placeholder swap below
    bpy.data.objects.remove(lid, do_unlink=True)
    # barrel lid along Y using archX rotated: build in X then rotate object 90 deg
    al = archX('ch_lid', -0.41, 0.41, 0.0, 0.26, -0.26, 0.26, 0.34, M['wood_light'])
    al.rotation_euler = (0, 0, math.radians(90))
    for yc in (-0.24, 0.24):
        band = archX('ch_band', 0, 0, 0.0, 0.26, -0.265, 0.265, 0.335, M['iron'], band=(yc, 0.055))
        band.rotation_euler = (0, 0, math.radians(90))
    box('ch_band_f1', 0.30, 0.025, 0.26, (0, -0.415, 0.22), M['iron'])
    box('ch_lock', 0.12, 0.03, 0.16, (0, -0.43, 0.33), M['brass'])
    box('ch_h1', 0.08, 0.03, 0.06, (-0.12, 0.415, 0.42), M['brass'])
    box('ch_h2', 0.08, 0.03, 0.06, (0.12, 0.415, 0.42), M['brass'])
    finish(wide=False)
BUILDERS['chest'] = build_chest

def build_chair():
    begin('chair')
    box('cr_seat', 0.46, 0.46, 0.06, (0, 0, 0.44), M['wood_mid'], bevel=0.01)
    box('cr_back', 0.46, 0.06, 0.52, (0, 0.21, 0.73), M['wood_dark'], bevel=0.01)
    box('cr_backslat', 0.30, 0.03, 0.30, (0, 0.185, 0.68), M['wood_mid'])
    for x in (0.19, -0.19):
        for y in (0.19, -0.19):
            box('cr_leg', 0.06, 0.06, 0.44, (x, y, 0.22), M['wood_dark'])
    for x in (0.19, -0.19):
        box('cr_str_y', 0.05, 0.42, 0.05, (x, 0, 0.16), M['wood_dark'])
    for y in (0.19, -0.19):
        box('cr_str_x', 0.42, 0.05, 0.05, (0, y, 0.16), M['wood_dark'])
    finish(wide=False)
BUILDERS['chair'] = build_chair

def build_table():
    begin('table')
    box('t_top', 1.85, 0.78, 0.08, (0, 0, 0.72), M['wood_mid'], bevel=0.012)
    box('t_apron_l', 1.6, 0.06, 0.12, (0, 0.33, 0.60), M['wood_dark'])
    box('t_apron_r', 1.6, 0.06, 0.12, (0, -0.33, 0.60), M['wood_dark'])
    box('t_apron_f', 0.06, 0.72, 0.12, (0.80, 0, 0.60), M['wood_dark'])
    box('t_apron_b', 0.06, 0.72, 0.12, (-0.80, 0, 0.60), M['wood_dark'])
    for x in (0.80, -0.80):
        for y in (0.31, -0.31):
            cyl('t_leg_u', 0.055, 0.34, (x, y, 0.37), M['wood_dark'], r2=0.045)
            cyl('t_leg_l', 0.045, 0.20, (x, y, 0.10), M['wood_dark'], r2=0.06)
    box('t_brace', 1.5, 0.06, 0.06, (0, 0, 0.30), M['wood_dark'])
    finish(wide=True)
BUILDERS['table'] = build_table

def build_bed():
    begin('bed')
    box('bd_frame', 1.9, 0.86, 0.12, (0, 0, 0.24), M['wood_dark'])
    box('bd_mattress', 1.8, 0.78, 0.14, (0, 0, 0.37), M['linen'], bevel=0.04)
    box('bd_head', 0.10, 0.92, 0.62, (-0.94, 0, 0.49), M['wood_dark'], bevel=0.015)
    box('bd_foot', 0.08, 0.92, 0.34, (0.95, 0, 0.35), M['wood_dark'], bevel=0.015)
    for x in (-0.94, 0.92):
        for y in (0.42, -0.42):
            cyl('bd_post', 0.05, 0.92, (x, y, 0.46), M['wood_mid'], verts=16)
            sphere('bd_finial', 0.065, (x, y, 0.95), M['wood_mid'])
    box('bd_blanket', 1.1, 0.82, 0.07, (0.34, 0, 0.455), M['blanket'], bevel=0.03)
    box('bd_blanketfold', 0.12, 0.82, 0.09, (-0.22, 0, 0.46), M['cloth_red'], bevel=0.03)
    box('bd_pillow', 0.26, 0.34, 0.10, (-0.72, 0.2, 0.47), M['linen'], bevel=0.05)
    box('bd_pillow2', 0.26, 0.34, 0.10, (-0.72, -0.2, 0.47), M['linen'], bevel=0.05)
    finish(wide=True)
BUILDERS['bed'] = build_bed

def build_bookshelf():
    begin('bookshelf')
    box('bs_back', 1.9, 0.05, 1.75, (0, 0.30, 0.875), M['wood_dark'])
    for x in (-0.95, 0.95):
        box('bs_side', 0.06, 0.56, 1.75, (x, 0.03, 0.875), M['wood_mid'])
    for z in (0.06, 0.50, 0.94, 1.38, 1.72):
        box('bs_shelf', 1.9, 0.56, 0.05, (0, 0.03, z), M['wood_mid'])
    box('bs_crown', 2.0, 0.62, 0.08, (0, 0.03, 1.79), M['wood_dark'], bevel=0.01)
    box('bs_base', 1.9, 0.58, 0.06, (0, 0.03, 0.03), M['wood_dark'])
    rnd = random.Random(7)
    mats_book = [M['cloth_red'], M['leather'], M['cloth_crimson'], M['iron'], M['leaf'], M['brass']]
    for shelf_z in (0.085, 0.525, 0.965, 1.405):
        x = -0.86
        while x < 0.78:
            h = rnd.uniform(0.30, 0.40); wd = rnd.uniform(0.055, 0.11)
            b = box('bs_book', wd, 0.36, h, (x + wd / 2, -0.04, shelf_z + h / 2), rnd.choice(mats_book))
            if rnd.random() < 0.10:
                b.rotation_euler = (0, math.radians(rnd.uniform(8, 15)), 0)
            x += wd + rnd.uniform(0.004, 0.015)
    finish(wide=True)
BUILDERS['bookshelf'] = build_bookshelf

def build_altar():
    begin('altar')
    box('al_step1', 1.9, 1.0, 0.12, (0, 0, 0.06), M['stone'], bevel=0.01)
    box('al_step2', 1.6, 0.8, 0.14, (0, 0, 0.19), M['stone_light'], bevel=0.01)
    box('al_top', 1.45, 0.66, 0.12, (0, 0, 0.32), M['stone_light'], bevel=0.012)
    for x in (-0.5, 0.5):
        box('al_sup', 0.22, 0.42, 0.22, (x, 0, 0.19), M['stone'])
    box('al_carve', 0.5, 0.03, 0.16, (0, -0.335, 0.30), M['gold'])
    box('al_drape', 0.7, 0.06, 0.34, (0, -0.35, 0.15), M['cloth_crimson'], rot=(math.radians(4), 0, 0))
    for x in (-0.55, 0.55):
        cyl('al_candle', 0.035, 0.18, (x, 0, 0.47), M['linen'], verts=12)
        fl = cyl('al_flame', 0.022, 0.07, (x, 0, 0.60), M['flame'], verts=12, r2=0.004)
        fl.name = 'flame'
    cyl('al_cup_b', 0.05, 0.03, (0, 0.1, 0.44), M['gold'], verts=16)
    cyl('al_cup_s', 0.018, 0.10, (0, 0.1, 0.50), M['gold'], verts=12)
    cyl('al_cup_t', 0.07, 0.06, (0, 0.1, 0.58), M['gold'], verts=16, r2=0.05)
    finish(wide=True)
BUILDERS['altar'] = build_altar

def build_firepit():
    begin('firepit')
    for i in range(10):
        a = 2 * math.pi * i / 10
        icosphere('fp_stone', 0.10, (0.38 * math.cos(a), 0.38 * math.sin(a), 0.06), M['stone'],
                  subdiv=2, scale=(1, 0.8, 0.7), displace=0.02, seed=i)
    cyl('fp_ash', 0.34, 0.03, (0, 0, 0.02), M['iron'], verts=24)
    cyl('fp_log1', 0.05, 0.5, (0, 0, 0.07), M['bark'], verts=10, rot=(0, math.radians(90), math.radians(20)))
    cyl('fp_log2', 0.05, 0.5, (0, 0, 0.10), M['bark'], verts=10, rot=(0, math.radians(90), math.radians(110)))
    cyl('fp_log3', 0.045, 0.4, (0, 0, 0.14), M['bark'], verts=10, rot=(math.radians(90), 0, math.radians(60)))
    f1 = cyl('fp_f1', 0.10, 0.26, (0, 0, 0.26), M['flame'], verts=12, r2=0.01); f1.name = 'flame'
    f2 = cyl('fp_f2', 0.06, 0.16, (0.10, 0.05, 0.20), M['flame'], verts=10, r2=0.008); f2.name = 'flame'
    f3 = cyl('fp_f3', 0.05, 0.13, (-0.09, -0.06, 0.19), M['flame'], verts=10, r2=0.006); f3.name = 'flame'
    finish(wide=False)
BUILDERS['firepit'] = build_firepit

def build_fountain():
    begin('fountain')
    cyl('fo_base', 0.44, 0.10, (0, 0, 0.05), M['stone_light'], verts=40)
    cyl('fo_basin_o', 0.44, 0.16, (0, 0, 0.17), M['stone'], verts=40, r2=0.40)
    cyl('fo_water', 0.375, 0.10, (0, 0, 0.215), M['water'], verts=36)
    torus('fo_lip', 0.425, 0.03, (0, 0, 0.25), M['stone_light'])
    cyl('fo_col', 0.07, 0.36, (0, 0, 0.38), M['stone_light'], verts=20, r2=0.09)
    cyl('fo_bowl', 0.16, 0.06, (0, 0, 0.58), M['stone_light'], verts=24, r2=0.11)
    cyl('fo_top_w', 0.12, 0.03, (0, 0, 0.60), M['water'], verts=20)
    sphere('fo_finial', 0.05, (0, 0, 0.65), M['brass'])
    for a in range(4):
        ang = math.pi / 2 * a + math.pi / 4
        cyl('fo_jet', 0.012, 0.16, (0.10 * math.cos(ang), 0.10 * math.sin(ang), 0.52), M['water'],
            verts=8, rot=(math.radians(24) * math.sin(ang), math.radians(24) * math.cos(ang), 0), r2=0.004)
    finish(wide=False)
BUILDERS['fountain'] = build_fountain

def build_pillar():
    begin('pillar')
    box('pi_plinth', 0.62, 0.62, 0.10, (0, 0, 0.05), M['stone'], bevel=0.01)
    box('pi_base', 0.5, 0.5, 0.10, (0, 0, 0.15), M['stone_light'], bevel=0.01)
    cyl('pi_shaft', 0.21, 1.30, (0, 0, 0.85), M['stone_light'], verts=28)
    for i in range(8):
        a = 2 * math.pi * i / 8
        cyl('pi_flute', 0.028, 1.24, (0.20 * math.cos(a), 0.20 * math.sin(a), 0.85), M['stone'], verts=8)
    box('pi_cap', 0.52, 0.52, 0.10, (0, 0, 1.55), M['stone_light'], bevel=0.01)
    box('pi_abacus', 0.6, 0.6, 0.08, (0, 0, 1.64), M['stone'], bevel=0.01)
    finish(wide=False)
BUILDERS['pillar'] = build_pillar

def build_statue():
    begin('statue')
    box('s_plinth', 0.56, 0.56, 0.30, (0, 0, 0.15), M['stone'], bevel=0.01)
    box('s_base2', 0.46, 0.46, 0.08, (0, 0, 0.34), M['stone_light'], bevel=0.01)
    cyl('s_robe', 0.17, 0.55, (0, 0, 0.65), M['stone_light'], verts=20, r2=0.10)
    sphere('s_torso', 0.11, (0, 0, 1.02), M['stone_light'], scale=(1, 0.8, 1.1))
    sphere('s_head', 0.075, (0, 0, 1.18), M['stone_light'], scale=(1, 1.1, 1.15))
    cyl('s_arm_l', 0.035, 0.30, (-0.13, 0, 0.95), M['stone_light'], verts=10, rot=(0, math.radians(20), 0))
    cyl('s_arm_r', 0.035, 0.34, (0.15, 0, 1.05), M['stone_light'], verts=10, rot=(0, math.radians(-25), 0))
    box('s_blade', 0.03, 0.07, 0.5, (0.24, 0, 1.38), M['steel'], bevel=0.005)
    box('s_guard', 0.05, 0.14, 0.03, (0.24, 0, 1.14), M['brass'])
    box('s_grip', 0.025, 0.025, 0.10, (0.24, 0, 1.09), M['leather'])
    box('s_plaque', 0.3, 0.02, 0.12, (0, -0.283, 0.15), M['brass'])
    finish(wide=False)
BUILDERS['statue'] = build_statue

def build_stairs():
    begin('stairs')
    box('st_s1', 0.86, 0.30, 0.60, (0, -0.30, 0.30), M['stone_light'], bevel=0.008)
    box('st_s2', 0.86, 0.30, 0.40, (0, 0.0, 0.20), M['stone'], bevel=0.008)
    box('st_s3', 0.86, 0.30, 0.20, (0, 0.30, 0.10), M['stone_light'], bevel=0.008)
    box('st_ck_l', 0.05, 0.92, 0.66, (0.44, 0, 0.31), M['stone'])
    box('st_ck_r', 0.05, 0.92, 0.66, (-0.44, 0, 0.31), M['stone'])
    finish(wide=False)
BUILDERS['stairs'] = build_stairs

def build_door():
    begin('door')
    # Legacy glTF convention (see glb-originals/door.glb): leaf thin in X facing
    # +X, spanning Y — map3dScene's -rotation.y + open quarter-turn then swings it
    # correctly against the wall. Frame material named 'wallmatch' so Map3D swaps
    # in the wall texture for the casing.
    wallmatch = bpy.data.materials.get('wallmatch') or pmat('wallmatch', (0.45, 0.43, 0.40), rough=0.85)
    box('d_lintel', 0.14, 1.0, 0.3, (0, 0, 1.85), wallmatch)
    for y in (0.47, -0.47):
        box('d_jamb', 0.14, 0.08, 1.7, (0, y, 0.85), wallmatch)
    for y in (0.215, -0.215):
        box('d_leaf', 0.07, 0.42, 1.66, (0, y, 0.83), M['wood_mid'], bevel=0.008)
    for yy in (0.83 + 0.62, 0.83 - 0.62):
        box('d_hinge', 0.10, 0.36, 0.055, (0, 0, yy), M['iron'])
    torus('d_ring', 0.06, 0.013, (0.055, 0.10, 0.95), M['iron'], scale=(0.3, 1, 1))
    finish(wide=False)
BUILDERS['door'] = build_door

def build_secretDoor():
    begin('secretDoor')
    box('sd_wall', 0.16, 0.98, 1.6, (0, 0, 0.8), M['stone'])
    box('sd_seam_l', 0.02, 0.02, 1.3, (0.085, -0.30, 0.72), M['wood_dark'])
    box('sd_seam_r', 0.02, 0.02, 1.3, (0.085, 0.30, 0.72), M['wood_dark'])
    box('sd_seam_t', 0.02, 0.62, 0.02, (0.085, 0, 1.37), M['wood_dark'])
    torus('sd_ring', 0.05, 0.010, (0.10, 0.18, 0.75), M['iron'], scale=(0.35, 1, 1))
    box('sd_rune', 0.015, 0.10, 0.16, (0.09, 0, 1.1), M['rune'])
    finish(wide=False)
BUILDERS['secretDoor'] = build_secretDoor

def build_arrowSlitWall():
    begin('arrowSlitWall')
    # Legacy: thin X slab spanning Y; slit on the +X face.
    box('aw_wall', 0.22, 0.95, 1.5, (0, 0, 0.75), M['stone'])
    for y in (-0.32, 0, 0.32):
        box('aw_cren', 0.22, 0.26, 0.18, (0, y, 1.59), M['stone'])
    box('aw_slit', 0.03, 0.06, 0.55, (0.11, 0, 0.85), M['iron'])
    box('aw_slitx', 0.03, 0.30, 0.06, (0.11, 0, 0.70), M['iron'])
    finish(wide=False)
BUILDERS['arrowSlitWall'] = build_arrowSlitWall

def build_boulder():
    begin('boulder')
    icosphere('bo_main', 0.40, (0, 0, 0.30), M['rock_moss'], subdiv=2, scale=(1, 0.92, 0.72), displace=0.07, seed=3)
    icosphere('bo_chip', 0.16, (0.34, -0.28, 0.10), M['stone'], subdiv=1, scale=(1, 1, 0.7), displace=0.03, seed=8)
    icosphere('bo_chip2', 0.11, (-0.36, 0.26, 0.07), M['stone'], subdiv=1, scale=(1, 1, 0.65), displace=0.02, seed=11)
    finish(wide=False)
BUILDERS['boulder'] = build_boulder

def build_bush():
    begin('bush')
    rnd = random.Random(5)
    for i in range(6):
        a = 2 * math.pi * i / 6
        sphere('bu_ball', rnd.uniform(0.16, 0.22), (0.20 * math.cos(a), 0.20 * math.sin(a), rnd.uniform(0.16, 0.24)),
               M['leaf'] if i % 2 else M['leaf_light'], seg=12, scale=(1, 1, 0.85))
    sphere('bu_core', 0.26, (0, 0, 0.20), M['leaf'], seg=14, scale=(1, 1, 0.8))
    for i in range(5):
        a = rnd.uniform(0, 6.28); rr = rnd.uniform(0.15, 0.3)
        sphere('bu_berry', 0.025, (rr * math.cos(a), rr * math.sin(a), rnd.uniform(0.22, 0.36)), M['cloth_red'], seg=8)
    finish(wide=False)
BUILDERS['bush'] = build_bush

def build_tree():
    begin('tree')
    cyl('tr_trunk', 0.10, 0.55, (0, 0, 0.27), M['bark'], verts=12, r2=0.14)
    cyl('tr_flare', 0.16, 0.10, (0, 0, 0.03), M['bark'], verts=12, r2=0.10)
    sphere('tr_c1', 0.34, (0, 0, 0.78), M['leaf'], seg=12, scale=(1, 1, 0.75))
    sphere('tr_c2', 0.26, (0.18, 0.10, 0.95), M['leaf_light'], seg=10, scale=(1, 1, 0.8))
    sphere('tr_c3', 0.22, (-0.16, -0.08, 0.98), M['leaf'], seg=10, scale=(1, 1, 0.8))
    sphere('tr_c4', 0.17, (0.02, -0.16, 1.08), M['leaf_light'], seg=10)
    finish(wide=False)
BUILDERS['tree'] = build_tree

def build_torch():
    begin('torch')
    # Wall sconce, backplate toward -X: map3dScene offsets it -X*cos(rot) at
    # rot 0, so it hugs the west wall and the flame leans +X into the room.
    box('to_plate', 0.04, 0.20, 0.34, (-0.07, 0, 0), M['iron'])
    cyl('to_arm', 0.03, 0.30, (0.04, 0, 0.06), M['iron'], verts=10, rot=(0, math.radians(-65), 0))
    cyl('to_cup', 0.075, 0.11, (0.17, 0, 0.18), M['iron'], verts=14, r2=0.05)
    cyl('to_char', 0.045, 0.09, (0.17, 0, 0.27), M['leather'], verts=10)
    fl1 = cyl('to_flame', 0.062, 0.24, (0.17, 0, 0.43), M['flame'], verts=12, r2=0.008); fl1.name = 'flame'
    finish(wide=False)
BUILDERS['torch'] = build_torch

def build_trap():
    begin('trap')
    for sx, sy, x, y in ((0.9, 0.12, 0, 0.39), (0.9, 0.12, 0, -0.39), (0.12, 0.78, 0.39, 0), (0.12, 0.78, -0.39, 0)):
        box('tr_frame', sx, sy, 0.12, (x, y, 0.06), M['stone'])
    box('tr_pitfloor', 0.72, 0.66, 0.04, (0, 0, -0.10), M['wood_dark'])
    for i in range(4):
        for j in range(3):
            cyl('tr_spike', 0.028, 0.34, (-0.27 + i * 0.18, -0.2 + j * 0.2, 0.08), M['steel'], verts=8, r2=0.001)
    finish(wide=False)
BUILDERS['trap'] = build_trap

def build_skeleton():
    begin('skeleton')
    def bone(name, p1, p2, r):
        v1, v2 = mathutils.Vector(p1), mathutils.Vector(p2)
        d = v2 - v1
        cyl(name, r, d.length, (v1 + v2) / 2, M['bone'], verts=8,
            rot=d.to_track_quat('Z', 'Y').to_euler())
    bone('sk_spine', (-0.30, 0, 0.06), (0.34, 0, 0.06), 0.035)
    for i in range(4):
        t = torus('sk_rib', 0.14 - i * 0.018, 0.020, (0.10 + i * 0.06, 0, 0.08), M['bone'], scale=(0.7, 1, 1.2))
        t.rotation_euler = (math.radians(90), math.radians(90), 0)
    sphere('sk_skull', 0.115, (0.52, 0, 0.10), M['bone'], seg=14, scale=(1.1, 1, 0.95))
    box('sk_jaw', 0.07, 0.13, 0.045, (0.61, 0, 0.055), M['bone'])
    for y in (0.05, -0.05):
        sphere('sk_eye', 0.024, (0.60, y, 0.12), M['iron'], seg=8)
    bone('sk_arm1a', (0.18, 0.06, 0.06), (0.20, 0.30, 0.06), 0.030)
    bone('sk_arm1b', (0.20, 0.30, 0.06), (0.05, 0.42, 0.05), 0.026)
    bone('sk_arm2a', (0.18, -0.06, 0.06), (0.14, -0.30, 0.06), 0.030)
    bone('sk_arm2b', (0.14, -0.30, 0.06), (0.30, -0.42, 0.05), 0.026)
    bone('sk_leg1a', (-0.30, 0.05, 0.06), (-0.60, 0.14, 0.06), 0.036)
    bone('sk_leg1b', (-0.60, 0.14, 0.06), (-0.86, 0.08, 0.05), 0.030)
    bone('sk_leg2a', (-0.30, -0.05, 0.06), (-0.62, -0.10, 0.06), 0.036)
    bone('sk_leg2b', (-0.62, -0.10, 0.06), (-0.86, -0.20, 0.05), 0.030)
    finish(wide=False)
BUILDERS['skeleton'] = build_skeleton

def build_web():
    begin('web')
    me = bpy.data.meshes.new('web_net'); bm = bmesh.new()
    anchor = mathutils.Vector((0.42, 0.42, 0.46))
    spokes = []
    n_sp = 9
    for i in range(n_sp):
        tt = i / (n_sp - 1)
        px = 0.42 - 0.84 * tt
        pz = 0.46 - 0.92 * math.sin(tt * math.pi / 2)
        py = 0.42 - 0.84 * abs(math.sin(tt * math.pi)) * 0.2
        spokes.append(mathutils.Vector((px, py, pz)))
    def ribbon(p, q, wd):
        d = q - p
        nrm = mathutils.Vector((0, 0, 1)).cross(d).normalized() * wd / 2
        a_ = bm.verts.new(p + nrm); b_ = bm.verts.new(p - nrm)
        c_ = bm.verts.new(q + nrm); e_ = bm.verts.new(q - nrm)
        bm.faces.new((a_, b_, e_, c_))
        bm.faces.new((c_, e_, a_, b_))
    ribbon(anchor, spokes[0], 0.012)
    for i in range(n_sp - 1):
        ribbon(spokes[i], spokes[i + 1], 0.010)
    for ring_t in (0.28, 0.52, 0.76, 1.0):
        pts = [anchor.lerp(s, ring_t) for s in spokes]
        sag = mathutils.Vector((0, 0, -0.06 * math.sin(ring_t * math.pi)))
        for i in range(len(pts) - 1):
            ribbon(pts[i] + sag, pts[i + 1] + sag, 0.009)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('web_net', me); ob.data.materials.append(M['web'])
    scene.collection.objects.link(ob)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.035, location=anchor)
    knot = bpy.context.active_object; knot.data.materials.append(M['web'])
    finish(wide=False)
BUILDERS['web'] = build_web


import builtins
queue = getattr(builtins, 'GLB_QUEUE', None)
names = queue if queue else list(BUILDERS.keys())
for nm in names:
    BUILDERS[nm]()
    print('done', nm)
