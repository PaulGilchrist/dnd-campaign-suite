# Generates all indoor-map prop models as .glb files using headless Blender.
# Usage:  /Applications/Blender.app/Contents/MacOS/Blender --background --python make_assets.py
#
# AXIS CONVENTION (Z-up, authored directly — no post-rotation fix-up):
#   Blender X  ->  grid east-west  (gridX)   ->  three.js X
#   Blender Y  ->  grid north-south (gridY)  ->  three.js Z
#   Blender Z  ->  up / height                 ->  three.js Y
# The glTF exporter maps Blender Z-up to the glTF/three.js Y-up space, so a model
# authored Z-up stands upright in the viewer. Each model's default (rotation 0)
# orientation is matched to the 2D SVG symbol's default so the viewer only ever
# needs the single grid rotation `object.rotation.y = -item.rotation`.
#
# Scale: 1 Blender unit == 1 map grid cell. The viewer scales models by 40
# (1 cell -> 40 world units). Two-cell props (table/bed/bookshelf/altar) are 2
# units long along +X (east-west). Base of every model sits at Z=0, footprint
# centered on the origin.
import bpy
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.abspath(os.path.join(HERE, "..", "assets"))
os.makedirs(ASSETS_DIR, exist_ok=True)

# ---------------------------------------------------------------- materials
def mat(name, color, rough=0.7, metal=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
        if out:
            nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metal
    if emit is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emit_strength
    return m

M = {
    "wood": mat("wood", (0.45, 0.28, 0.13), 0.85),
    "wood_dark": mat("wood_dark", (0.30, 0.18, 0.09), 0.85),
    "stone": mat("stone", (0.46, 0.45, 0.44), 0.95),
    "stone_dark": mat("stone_dark", (0.32, 0.31, 0.33), 0.95),
    "metal": mat("metal", (0.55, 0.55, 0.58), 0.35, 0.8),
    "metal_dark": mat("metal_dark", (0.35, 0.35, 0.37), 0.4, 0.8),
    "fabric": mat("fabric", (0.62, 0.62, 0.66), 0.9),
    "fabric_red": mat("fabric_red", (0.55, 0.18, 0.16), 0.9),
    "flame": mat("flame", (1.0, 0.45, 0.08), 0.5, emit=(1.0, 0.5, 0.1), emit_strength=3.0),
    "bone": mat("bone", (0.85, 0.82, 0.72), 0.6),
    "marble": mat("marble", (0.86, 0.86, 0.89), 0.3),
    "foliage": mat("foliage", (0.20, 0.45, 0.15), 0.9),
    "bark": mat("bark", (0.35, 0.25, 0.15), 0.95),
    "rock": mat("rock", (0.42, 0.41, 0.42), 0.95),
    "web": mat("web", (0.9, 0.9, 0.9), 0.6),
    "water": mat("water", (0.2, 0.5, 0.75), 0.1),
    "book_r": mat("book_r", (0.6, 0.15, 0.15), 0.8),
    "book_b": mat("book_b", (0.15, 0.25, 0.55), 0.8),
    "book_g": mat("book_g", (0.2, 0.5, 0.2), 0.8),
    "book_y": mat("book_y", (0.75, 0.6, 0.15), 0.8),
    # Door lintel, tuned to the viewer's wall material (COLORS.wall = 0x696969,
    # roughness 0.92) so the header above a door is indistinguishable from the wall.
    "wallmatch": mat("wallmatch", (0x69 / 255, 0x69 / 255, 0x69 / 255), 0.92, 0.0),
}

# Apply flame texture to the flame material
_flame_mat = M["flame"]
_flame_mat.use_nodes = True
_nt = _flame_mat.node_tree
# Remove existing nodes and rebuild with texture
for _n in _nt.nodes: _nt.nodes.remove(_n)
tex_img = _nt.nodes.new("ShaderNodeTexImage")
tex_img.image = bpy.data.images.load(os.path.join(ASSETS_DIR, "flame_tex.png"))
tex_img.location = (-400, 0)
bsdf = _nt.nodes.new("ShaderNodeBsdfPrincipled")
bsdf.location = (0, 0)
bsdf.inputs["Base Color"].default_value = (0.6, 0.2, 0.05, 1)  # dark orange base
bsdf.inputs["Emission Color"].default_value = (1.0, 0.5, 0.1, 1)
bsdf.inputs["Emission Strength"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.5
bsdf.inputs["Metallic"].default_value = 0.0
out = _nt.nodes.new("ShaderNodeOutputMaterial")
out.location = (300, 0)
_nt.links.new(tex_img.outputs["Color"], bsdf.inputs["Emission Color"])
_nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

# ---------------------------------------------------------------- helpers
def select_only(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o

def _finish(o, material, smooth=False):
    if material is not None:
        o.data.materials.append(material)
    select_only(o)
    if smooth:
        bpy.ops.object.shade_smooth()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o

def cube(size, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.scale = (size[0], size[1], size[2])
    o.rotation_euler = rot
    return _finish(o, material)

def cyl(r, depth, loc, material, verts=24, rot=(0, 0, 0)):
    # depth runs along local Z (up) by default; rotate to lay it down.
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.rotation_euler = rot
    return _finish(o, material, smooth=True)

def sph(r, loc, material, seg=24, ring=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=r, location=loc)
    o = bpy.context.active_object
    return _finish(o, material, smooth=True)

def ico(r, loc, material, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.active_object
    return _finish(o, material, smooth=True)

def torus(R, r, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc)
    o = bpy.context.active_object
    o.rotation_euler = rot
    return _finish(o, material, smooth=True)

def cone(r1, r2, depth, loc, material, verts=24, rot=(0, 0, 0)):
    # tip points up (+Z) by default.
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.rotation_euler = rot
    return _finish(o, material, smooth=True)

def recenter(o):
    """Center the footprint on the origin (X, Y) and put the base at Z=0."""
    xs = [v.co.x for v in o.data.vertices]
    ys = [v.co.y for v in o.data.vertices]
    zs = [v.co.z for v in o.data.vertices]
    dx = (min(xs) + max(xs)) / 2.0
    dy = (min(ys) + max(ys)) / 2.0
    dz = min(zs)
    for v in o.data.vertices:
        v.co.x -= dx
        v.co.y -= dy
        v.co.z -= dz
    o.location = (0, 0, 0)

def flip180(parts):
    """Rotate a list of built objects 180 deg about the up (Z) axis through the
    origin. Because the primitives have their transform applied (world-space
    verts), negating X and Y is a pure 180 deg turn: it flips front<->back AND
    left<->right without mirroring (winding is preserved)."""
    for p in parts:
        for v in p.data.vertices:
            v.co.x = -v.co.x
            v.co.y = -v.co.y
    return parts

def clear_scene():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for b in list(bpy.data.meshes):
        if b.users == 0:
            bpy.data.meshes.remove(b)

def export_glb(o, filepath):
    select_only(o)
    try:
        bpy.ops.export_gltf2.gltf(filepath=filepath, use_selection=True, export_format="GLB")
    except AttributeError:
        bpy.ops.export_scene.gltf(filepath=filepath, use_selection=True, export_format="GLB")

# ---------------------------------------------------------------- builders
# Each returns a list of objects. Height is along Z. Default (rotation 0)
# orientation is matched to the 2D SVG symbol (see file header).
def b_barrel():
    o = [cyl(0.42, 0.8, (0, 0, 0.4), M["wood"])]
    for z in (0.18, 0.4, 0.62):
        o.append(torus(0.42, 0.03, (0, 0, z), M["metal_dark"]))
    return o

def b_chest():
    o = [cube((0.8, 0.5, 0.27), (0, 0, 0.135), M["wood"])]
    o.append(cube((0.8, 0.5, 0.18), (0, 0, 0.36), M["wood_dark"]))
    o.append(cube((0.12, 0.1, 0.14), (0, 0.24, 0.28), M["metal"]))
    return o

def b_crate():
    o = [cube((0.8, 0.8, 0.8), (0, 0, 0.4), M["wood"])]
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(cube((0.1, 0.1, 0.84), (sx * 0.4, sy * 0.4, 0.4), M["wood_dark"]))
    o.append(cube((0.9, 0.9, 0.1), (0, 0, 0.8), M["wood_dark"]))
    o.append(cube((0.9, 0.9, 0.1), (0, 0, 0.0), M["wood_dark"]))
    return o

def b_table():  # 2-cell along +X (east-west)
    o = [cube((1.9, 0.8, 0.08), (0, 0, 0.75), M["wood"])]
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(cube((0.08, 0.08, 0.72), (sx * 0.85, sy * 0.32, 0.36), M["wood_dark"]))
    return o

def b_chair():  # 2D SVG rot=0: backrest north, seat faces south. glTF inverts Y,
    # so flip180 the built parts to match (backrest -> three.js -Z = north).
    o = [cube((0.5, 0.5, 0.06), (0, 0, 0.45), M["wood"])]
    o.append(cube((0.5, 0.06, 0.5), (0, -0.22, 0.7), M["wood"]))
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(cube((0.05, 0.05, 0.45), (sx * 0.2, sy * 0.2, 0.225), M["wood_dark"]))
    return flip180(o)

def b_bed():  # 2-cell along +X (east-west), head / pillow on -X (west)
    o = [cube((1.9, 0.9, 0.15), (0, 0, 0.075), M["wood"])]
    o.append(cube((1.8, 0.8, 0.18), (0.05, 0, 0.26), M["fabric"]))
    o.append(cube((0.4, 0.7, 0.12), (-0.7, 0, 0.42), M["fabric_red"]))
    o.append(cube((0.1, 0.9, 0.9), (-0.95, 0, 0.45), M["wood_dark"]))
    return o

def b_bookshelf():  # 2-cell along +X (east-west), 0.5 cell deep. 2D SVG rot=0:
    # back panel north, books' spines face south. glTF inverts Y, so flip180 the
    # built parts to match. The bookshelf back sits at the local 0.25-cell edge;
    # the viewer offsets it flush to the wall it faces (see index.html).
    # Axes: X=width(east-west), Y=depth(front-back), Z=height(shelves).
    o = [cube((0.08, 0.5, 1.8), (-0.95, 0, 0.9), M["wood"])]
    o.append(cube((0.08, 0.5, 1.8), (0.95, 0, 0.9), M["wood"]))
    o.append(cube((1.9, 0.5, 0.08), (0, 0, 1.76), M["wood"]))
    o.append(cube((1.9, 0.5, 0.08), (0, 0, 0.12), M["wood"]))
    o.append(cube((1.84, 0.04, 1.6), (0, -0.22, 0.95), M["wood_dark"]))
    bookmats = [M["book_r"], M["book_b"], M["book_g"], M["book_y"]]
    for si, sz in enumerate((0.5, 0.95, 1.4)):
        o.append(cube((1.82, 0.05, 0.46), (0, 0.02, sz), M["wood"]))
        # cap the max book height to each shelf's compartment so no book pokes
        # above the shelf board (top shelf has the least room, up to frame top).
        max_h = 0.40 if si < 2 else 0.31
        # pack many thin books tightly across the shelf; vary spine width,
        # height, and depth so the row reads as real books, not blocks.
        x = -0.86
        k = 0
        while x < 0.82:
            a = (k * 7 + si * 3) % 10
            b = (k * 13 + si * 5) % 10
            width = 0.06 + (a / 10) * 0.08
            height = max_h * (0.6 + (b / 10) * 0.4)
            depth = 0.26 + (a / 10) * 0.10
            # shift down and forward by a quarter of the book's length so the
            # rows sit lower on each board and lean toward the front.
            o.append(cube((width, depth, height),
                          (x + width / 2, -0.09 + height / 4, sz + 0.03 + height / 4),
                          bookmats[(k + si) % 4]))
            x += width + 0.004
            k += 1
    return flip180(o)

def b_altar():  # 2-cell along +X (east-west)
    o = [cube((1.6, 0.8, 0.5), (0, 0, 0.25), M["stone"])]
    o.append(cube((1.9, 1.0, 0.12), (0, 0, 0.56), M["stone_dark"]))
    return o

def b_pillar():
    o = [cube((0.6, 0.6, 0.15), (0, 0, 0.075), M["stone"])]
    o.append(cyl(0.22, 1.5, (0, 0, 0.9), M["stone"]))
    o.append(cube((0.6, 0.6, 0.15), (0, 0, 1.7), M["stone"]))
    return o

def b_stairs():  # tread along +X (east-west); steps rise toward +Y, so descent is toward -Y (south in three.js)
    o = []
    for i in range(4):
        y = -0.3375 + i * 0.225
        h = 0.15 * (i + 1)
        o.append(cube((0.9, 0.225, h), (0, y, h / 2), M["stone"]))
    return o

def b_door():  # runs north-south: leaf long axis along +Y, thin along X. 8' leaf
    # (room for dragonborn/goliath) + a square 2' stone lintel above so the doorway
    # reads as a full 10' wall. The lintel is square and centered on the cell, so it
    # is invariant to the 90-deg increments the door rotates through when opened.
    o = [cube((0.1, 0.86, 1.6), (0, 0, 0.8), M["wood"])]                  # leaf (0-8ft)
    o.append(cube((0.14, 0.08, 1.6), (0, -0.46, 0.8), M["wood_dark"]))    # side rail
    o.append(cube((0.14, 0.08, 1.6), (0, 0.46, 0.8), M["wood_dark"]))     # side rail
    o.append(cube((1.0, 1.0, 0.4), (0, 0, 1.8), M["wallmatch"]))          # square lintel (8-10ft)
    o.append(cyl(0.025, 0.04, (0.07, 0.2, 0.6), M["metal"], rot=(0, math.pi / 2, 0)))  # knob
    return o

def b_secretdoor():  # runs north-south, stone. 8' leaf + square 2' lintel = full 10' wall
    o = [cube((0.1, 0.88, 1.6), (0, 0, 0.8), M["stone_dark"])]            # leaf (0-8ft)
    o.append(cube((0.12, 0.1, 1.6), (0, -0.45, 0.8), M["stone"]))         # side seam
    o.append(cube((0.12, 0.1, 1.6), (0, 0.45, 0.8), M["stone"]))          # side seam
    return o

def b_firepit():
    o = [cyl(0.3, 0.06, (0, 0, 0.03), M["stone_dark"])]
    for i in range(8):
        a = i / 8 * 2 * math.pi
        o.append(cube((0.16, 0.14, 0.16), (math.cos(a) * 0.35, math.sin(a) * 0.35, 0.08), M["stone"]))
    o.append(cone(0.18, 0.05, 0.26, (0, 0, 0.16), M["flame"]))
    return o

def b_torch():  # wall sconce, ~0.25 cell tall. Base (mount plate bottom) at Z=0,
    # mount on the -X (west) wall, flame faces +X (east). The viewer lifts it to
    # eye height (~5ft) and pushes it flush to the wall it faces.
    o = [cube((0.05, 0.13, 0.13), (-0.2, 0, 0.065), M["metal"])]           # mount plate on wall
    o.append(cube((0.2, 0.05, 0.05), (-0.09, 0, 0.065), M["metal"]))       # bracket arm
    o.append(cube((0.12, 0.03, 0.03), (-0.09, 0, 0.015), M["metal_dark"])) # brace
    o.append(cyl(0.055, 0.08, (-0.01, 0, 0.11), M["metal"]))               # sconce cup
    o.append(cone(0.06, 0.025, 0.12, (-0.01, 0, 0.19), M["flame"]))        # flame
    return o

def b_trap():
    o = [cube((0.9, 0.05, 0.9), (0, 0, 0.03), M["metal"])]
    for x in (-0.3, 0, 0.3):
        for y in (-0.3, 0, 0.3):
            o.append(cone(0.03, 0.0, 0.18, (x, y, 0.13), M["metal_dark"]))
    return o

def b_fountain():
    o = [cyl(0.45, 0.16, (0, 0, 0.08), M["stone"])]
    o.append(cyl(0.46, 0.05, (0, 0, 0.18), M["stone_dark"]))
    o.append(cyl(0.38, 0.03, (0, 0, 0.2), M["water"]))
    o.append(cyl(0.08, 0.4, (0, 0, 0.4), M["stone"]))
    o.append(cone(0.26, 0.1, 0.18, (0, 0, 0.66), M["stone"]))
    return o

def b_skeleton():
    o = [cube((0.25, 0.15, 0.15), (0, 0, 0.5), M["bone"])]
    o.append(cyl(0.03, 0.5, (0, 0, 0.75), M["bone"]))
    for z in (0.6, 0.72, 0.84):
        o.append(torus(0.15, 0.02, (0, 0, z), M["bone"]))
    o.append(sph(0.12, (0, 0, 1.1), M["bone"]))
    for s in (-1, 1):
        o.append(cyl(0.025, 0.4, (s * 0.2, 0, 0.72), M["bone"]))
        o.append(cyl(0.03, 0.5, (s * 0.08, 0, 0.25), M["bone"]))
    return o

def b_statue():
    o = [cube((0.5, 0.5, 0.5), (0, 0, 0.25), M["stone_dark"])]
    o.append(cone(0.22, 0.15, 0.7, (0, 0, 0.85), M["marble"]))
    o.append(sph(0.1, (0, 0, 1.35), M["marble"]))
    return o

def b_tree():
    o = [cone(0.16, 0.1, 0.6, (0, 0, 0.3), M["bark"])]
    for (fx, fy, r) in [(0, 0, 0.35), (0.2, 0.1, 0.25), (-0.18, -0.12, 0.24)]:
        o.append(ico(r, (fx, fy, 0.8), M["foliage"]))
    return o

def b_boulder():
    o = [ico(0.4, (0, 0, 0.35), M["rock"])]
    obj = o[0]
    tex = bpy.data.textures.get("rock_disp")
    if tex is None:
        tex = bpy.data.textures.new("rock_disp", "CLOUDS")
    tex.noise_scale = 0.5
    mod = obj.modifiers.new("disp", "DISPLACE")
    mod.texture = tex
    mod.strength = 0.16
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier="disp")
    return o

def b_bush():
    o = []
    for (bx, by, r) in [(0, 0, 0.3), (0.2, 0.1, 0.2), (-0.2, -0.05, 0.2), (0.05, -0.15, 0.18)]:
        o.append(ico(r, (bx, by, 0.25), M["foliage"]))
    return o

def b_web():
    o = []
    for i in range(8):
        a = i / 8 * 2 * math.pi
        sp = cube((0.45, 0.012, 0.012), (math.cos(a) * 0.225, math.sin(a) * 0.225, 0.4), M["web"], rot=(0, 0, a))
        o.append(sp)
    o.append(torus(0.3, 0.008, (0, 0, 0.4), M["web"]))
    o.append(torus(0.18, 0.008, (0, 0, 0.4), M["web"]))
    return o

def b_arrowslitwall():  # wall segment running north-south (+Y), slit near the top
    o = [cube((0.24, 0.9, 0.4), (0, 0, 0.2), M["stone"])]
    o.append(cube((0.24, 0.9, 0.4), (0, 0, 0.8), M["stone"]))
    o.append(cube((0.26, 0.3, 0.12), (0, 0, 0.5), M["stone_dark"]))
    return o

BUILDERS = {
    "barrel": b_barrel,
    "chest": b_chest,
    "crate": b_crate,
    "table": b_table,
    "chair": b_chair,
    "bed": b_bed,
    "bookshelf": b_bookshelf,
    "altar": b_altar,
    "pillar": b_pillar,
    "stairs": b_stairs,
    "door": b_door,
    "secretDoor": b_secretdoor,
    "firepit": b_firepit,
    "torch": b_torch,
    "trap": b_trap,
    "fountain": b_fountain,
    "skeleton": b_skeleton,
    "statue": b_statue,
    "tree": b_tree,
    "boulder": b_boulder,
    "bush": b_bush,
    "web": b_web,
    "arrowSlitWall": b_arrowslitwall,
}

def main():
    made = []
    for name, fn in BUILDERS.items():
        clear_scene()
        parts = fn()
        bpy.ops.object.select_all(action="DESELECT")
        for p in parts:
            p.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
        joined = bpy.context.active_object
        # Models are authored Z-up already — just normalize the footprint.
        recenter(joined)
        out = os.path.join(ASSETS_DIR, name + ".glb")
        export_glb(joined, out)
        made.append((name, os.path.getsize(out)))
        print("exported", name, os.path.getsize(out), "bytes")
    print("DONE", len(made), "assets")

if __name__ == "__main__":
    main()
