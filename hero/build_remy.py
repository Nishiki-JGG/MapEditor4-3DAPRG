# Remy（Mixamo）の体を、マップエディター用のデータ hero/remy.js にする（Blender 5.x、バックグラウンドで動かす）。
#   blender -b --factory-startup -P hero/build_remy.py -- <Remy.fbx> <出力 remy.js>
# - 腕を下ろした立ち姿にして（T 字の腕を約 68 度下げ、肘を少し曲げる）、その形をメッシュに焼き込む（骨・動きは持たない）。
# - 大きさはゲーム本体と同じ：腰の骨（mixamorig:Hips）の高さを 0.95m にする（凸ダンの PlayerRemyBody.HipsHeight）。
# - 座標は three.js（Y が上、顔は +Z）。足の裏が 0、腰の真下が原点。
# - テクスチャは色（Diffuse）だけ。体 1024、ほかは 512 の JPEG。髪とまつ毛は透明度（Opacity）を足した PNG。
import bpy, sys, os, json, math, base64, struct, tempfile
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC, OUT = argv[0], argv[1]
HIPS_HEIGHT = .95
ARM_DOWN_DEG, ELBOW_DEG = 68.0, 14.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC, use_anim=False)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']

# ---- 立ち姿：世界の軸で骨を回す（骨の根元が回転の中心）
def rotate_world(pb, axis_world, deg):
    inv = arm.matrix_world.to_3x3().inverted()
    ax = (inv @ Vector(axis_world)).normalized()
    head = pb.head.copy()
    R = Matrix.Translation(head) @ Matrix.Rotation(math.radians(deg), 4, ax) @ Matrix.Translation(-head)
    pb.matrix = R @ pb.matrix
    bpy.context.view_layer.update()
P = arm.pose.bones
# 顔は -Y（Blender）。体の左は +X。左腕は +Y 軸まわりに +θ で下がる、右腕は −θ
rotate_world(P['mixamorig:LeftArm'], (0, 1, 0), ARM_DOWN_DEG)
rotate_world(P['mixamorig:RightArm'], (0, 1, 0), -ARM_DOWN_DEG)
# 肘：前（−Y）へ少し曲げる。下を向いた前腕は −X 軸まわり（左右とも同じ向き）
rotate_world(P['mixamorig:LeftForeArm'], (1, 0, 0), -ELBOW_DEG)
rotate_world(P['mixamorig:RightForeArm'], (1, 0, 0), -ELBOW_DEG)

# ---- 焼き込んだ形を世界座標で取り出す
dg = bpy.context.evaluated_depsgraph_get()
hips_z = (arm.matrix_world @ arm.data.bones['mixamorig:Hips'].head_local)
parts_raw = []
lo_z = 1e9
for o in meshes:
    oe = o.evaluated_get(dg); me = oe.to_mesh(); me.calc_loop_triangles()
    M = oe.matrix_world; N = M.to_3x3().inverted().transposed()
    co = np.array([tuple(M @ v.co) for v in me.vertices], np.float64)
    lo_z = min(lo_z, co[:, 2].min())
    nrm = np.zeros((len(me.loops), 3)); me.corner_normals.foreach_get('vector', nrm.reshape(-1)) if hasattr(me, 'corner_normals') else None
    uvl = me.uv_layers.active.data; uv = np.zeros((len(me.loops), 2)); uvl.foreach_get('uv', uv.reshape(-1))
    tris = [(t.loops[0], t.loops[1], t.loops[2]) for t in me.loop_triangles]
    vi = np.array([l.vertex_index for l in me.loops])
    mat = o.material_slots[0].material if o.material_slots else None
    parts_raw.append({'name': o.name, 'co': co, 'nrm': np.array([tuple((N @ Vector(n)).normalized()) for n in nrm]), 'uv': uv, 'vi': vi, 'tris': tris, 'mat': mat})
    oe.to_mesh_clear()
k = HIPS_HEIGHT / (hips_z.z - lo_z)
cx, cy = hips_z.x, hips_z.y

# ---- テクスチャ
def tex_of(mat, socket):
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image and any(l.from_node == n and l.to_socket.name == socket for l in mat.node_tree.links): return n.image
def pixels(img, size):
    im = img.copy(); im.scale(size, size); a = np.zeros(size * size * 4, np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im); return a.reshape(size, size, 4)
TMP = tempfile.mkdtemp()
def encode(rgba, alpha):
    size = rgba.shape[0]; im = bpy.data.images.new('t', size, size, alpha=alpha); im.pixels.foreach_set(rgba.reshape(-1))
    path = os.path.join(TMP, 't.png' if alpha else 't.jpg'); im.filepath_raw = path; im.file_format = 'PNG' if alpha else 'JPEG'
    bpy.context.scene.render.image_settings.quality = 82; im.save(); bpy.data.images.remove(im)
    return ('data:image/png;base64,' if alpha else 'data:image/jpeg;base64,') + base64.b64encode(open(path, 'rb').read()).decode()
tex_cache = {}
def texture(mat, size):
    dif = tex_of(mat, 'Base Color'); op = tex_of(mat, 'Alpha'); key = (dif.name, op.name if op else None, size)
    if key in tex_cache: return tex_cache[key]
    rgba = pixels(dif, size)
    if op is not None: rgba[..., 3] = pixels(op, size)[..., 0]
    else: rgba[..., 3] = 1
    tex_cache[key] = encode(rgba, op is not None); return tex_cache[key]

# ---- three.js の形へ：(x, y, z)_three = (x, z, -y)_blender。顔（−Y）が +Z になる
b64 = lambda a: base64.b64encode(a.tobytes()).decode()
parts = []; total_v = total_t = 0; hi_y = -1e9; box = [1e9, -1e9, 1e9, -1e9]
for p in parts_raw:
    keymap = {}; pos = []; nor = []; uvs = []; idx = []
    for tri in p['tris']:
        for l in tri:
            key = (int(p['vi'][l]), round(p['uv'][l][0], 5), round(p['uv'][l][1], 5), tuple(np.round(p['nrm'][l], 3)))
            j = keymap.get(key)
            if j is None:
                j = keymap[key] = len(pos); c = p['co'][p['vi'][l]]
                x, y, z = (c[0] - cx) * k, (c[2] - lo_z) * k, -(c[1] - cy) * k
                pos.append((x, y, z)); n = p['nrm'][l]; nor.append((n[0], n[2], -n[1])); uvs.append((p['uv'][l][0], p['uv'][l][1]))
            idx.append(j)
    pos = np.array(pos, np.float32); nor = np.array(nor, np.float32); uvs = np.array(uvs, np.float32)
    idx = np.array(idx, np.uint16 if len(pos) < 65536 else np.uint32)
    hi_y = max(hi_y, float(pos[:, 1].max())); box = [min(box[0], float(pos[:, 0].min())), max(box[1], float(pos[:, 0].max())), min(box[2], float(pos[:, 2].min())), max(box[3], float(pos[:, 2].max()))]
    alpha = tex_of(p['mat'], 'Alpha') is not None
    size = 1024 if p['name'] == 'Body' else 512
    parts.append({'name': p['name'], 'alpha': alpha, 'tex': texture(p['mat'], size), 'idx32': idx.dtype == np.uint32,
                  'pos': b64(pos), 'nrm': b64(nor), 'uv': b64(uvs), 'idx': b64(idx)})
    total_v += len(pos); total_t += len(idx) // 3

meta = {'id': 'remy', 'name': 'Remy（凸ダンの主人公の体）', 'source': 'Mixamo Remy（凸ダン game/client の PlayerRemy/Remy.fbx）',
        'hipsHeight': HIPS_HEIGHT, 'height': round(hi_y, 3), 'width': round(box[1] - box[0], 3), 'depth': round(box[3] - box[2], 3),
        'pose': f'腕を {ARM_DOWN_DEG:g} 度下ろし、肘を {ELBOW_DEG:g} 度曲げた立ち姿', 'verts': total_v, 'tris': total_t}
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// 主人公の体（hero/build_remy.py で作ったデータ。手で直さないこと）\n')
    f.write('TDHero.add(' + json.dumps({**meta, 'parts': parts}, ensure_ascii=False) + ');\n')
print('HERO', json.dumps(meta, ensure_ascii=False), 'bytes', os.path.getsize(OUT))
