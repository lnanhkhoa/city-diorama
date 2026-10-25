"""Decimate a Rodin GLB and re-bake its PBR textures from the original onto a fresh UV layout.

Usage: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/rodin/decimate.py -- \\
         src.glb dst.glb [TARGET_TRIS=20000] [TEX_SIZE=2048] [VOXEL_SIZE=0.004]

Plain decimation fails on Rodin meshes: modelled detail such as window mullions collapses into
sawteeth and the UV atlas smears. So: voxel-remesh first (VOXEL_SIZE in model units; Rodin models
are ~1-2 tall) to melt that detail into a clean shell, decimate the shell, unwrap it, and bake
albedo, metallic, roughness and normal from the original back onto it. VOXEL_SIZE limits quality
more than TARGET_TRIS does: on Bitexco 0.014 lost the helipad, 0.004-0.005 matched the original
within ~30 dB PSNR at the closest view, and 20k vs 40k triangles scored the same. 0 skips the remesh.
"""
import bpy, math, sys

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
target = int(argv[2]) if len(argv) > 2 else 20000
size = int(argv[3]) if len(argv) > 3 else 2048
voxel = float(argv[4]) if len(argv) > 4 else 0.004


def active(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
hi = next(o for o in bpy.context.scene.objects if o.type == 'MESH')

# Low-poly shell.
lo = hi.copy(); lo.data = hi.data.copy(); lo.name = "model"; hi.name = "hi"
bpy.context.scene.collection.objects.link(lo)
active(lo)
src_tris = sum(len(p.vertices) - 2 for p in lo.data.polygons)
if voxel:
    r = lo.modifiers.new("vox", 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = voxel; r.adaptivity = 0
    bpy.ops.object.modifier_apply(modifier="vox")
cur = sum(len(p.vertices) - 2 for p in lo.data.polygons)
d = lo.modifiers.new("dec", 'DECIMATE'); d.ratio = min(1.0, target / cur); d.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier="dec")
# Rodin's imported custom split normals don't survive decimation: drop them and smooth by angle.
if lo.data.has_custom_normals: bpy.ops.mesh.customdata_custom_splitnormals_clear()
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
lo.data.validate(clean_customdata=False)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.dissolve_degenerate(threshold=1e-6); bpy.ops.mesh.delete_loose()
while len(lo.data.uv_layers): lo.data.uv_layers.remove(lo.data.uv_layers[0])
lo.data.uv_layers.new(name="UVMap")
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002)
bpy.ops.uv.pack_islands(margin=0.002, rotate=True)
bpy.ops.object.mode_set(mode='OBJECT')
print("LOWPOLY", src_tris, "->", len(lo.data.polygons))

# Target material: one image per channel, wired to the BSDF only after baking (avoids self-reads).
imgs = {}
for k in ('basecolor', 'metallic', 'roughness', 'normal'):
    img = bpy.data.images.new(k, size, size, alpha=False)
    img.colorspace_settings.name = 'sRGB' if k == 'basecolor' else 'Non-Color'
    imgs[k] = img
mat = bpy.data.materials.new("baked"); mat.use_nodes = True
lo.data.materials.clear(); lo.data.materials.append(mat)
nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
tex = {}
for k, img in imgs.items():
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = img; tex[k] = n

hnt = hi.data.materials[0].node_tree
hb = next(n for n in hnt.nodes if n.type == 'BSDF_PRINCIPLED')
hout = next(n for n in hnt.nodes if n.type == 'OUTPUT_MATERIAL')
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 4
bk = sc.render.bake
bk.use_selected_to_active = True; bk.use_cage = False; bk.cage_extrusion = 0.03; bk.max_ray_distance = 0.06; bk.margin = 8


def bake(k, kind):
    nt.nodes.active = tex[k]
    bpy.ops.object.select_all(action='DESELECT'); hi.select_set(True); lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.bake(type=kind)
    print("BAKED", k)


# Colour channels: route the original's input (texture or constant) straight out as emission.
orig = hout.inputs['Surface'].links[0].from_socket
for k, sock in (('basecolor', 'Base Color'), ('metallic', 'Metallic'), ('roughness', 'Roughness')):
    e = hnt.nodes.new('ShaderNodeEmission'); s = hb.inputs[sock]
    if s.is_linked:
        hnt.links.new(s.links[0].from_socket, e.inputs['Color'])
    else:
        v = s.default_value
        e.inputs['Color'].default_value = (*v[:3], 1) if hasattr(v, '__len__') else (v, v, v, 1)
    hnt.links.new(e.outputs[0], hout.inputs['Surface'])
    bake(k, 'EMIT')
    hnt.links.new(orig, hout.inputs['Surface']); hnt.nodes.remove(e)
bake('normal', 'NORMAL')

nt.links.new(tex['basecolor'].outputs[0], bsdf.inputs['Base Color'])
nt.links.new(tex['metallic'].outputs[0], bsdf.inputs['Metallic'])
nt.links.new(tex['roughness'].outputs[0], bsdf.inputs['Roughness'])
nm = nt.nodes.new('ShaderNodeNormalMap'); nm.uv_map = "UVMap"
nt.links.new(tex['normal'].outputs[0], nm.inputs['Color']); nt.links.new(nm.outputs[0], bsdf.inputs['Normal'])

bpy.data.objects.remove(hi)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=90)
