# Remy（Mixamo）の体を、マップエディター用のデータ hero/remy.js にする（Blender 5.x、バックグラウンドで動かす）。
#   blender -b --factory-startup -P hero/build_remy.py -- <Remy.fbx> <歩きの FBX（walking.fbx）> <走りの FBX（running.fbx）> <出力 remy.js>
#   （歩き・走りは Mixamo の Action Adventure Pack の Remy 用）
# - 骨付き：骨（67本、名前の "mixamorig:" は外す）、頂点ごとの骨と重み（4本まで）、立ち姿（腕を約 68 度下ろし肘を少し曲げる）、歩きと走りの 1 周期ずつ。
# - 歩き・走りは、前へ進む分（腰の水平の移動の平均）を取り除いて、その場で動く形にする。進む速さ（m/秒）を clips.<名前>.speed に書く。
# - 大きさはゲーム本体と同じ：腰の骨（Hips）の高さを 0.95m にする（ゲームの PlayerRemyBody.HipsHeight）。
# - 座標は three.js（Y が上、顔は +Z）。足の裏が 0、立ち姿の腰の真下が原点。
# - テクスチャは色（Diffuse）だけ。体 1024、ほかは 512 の JPEG。髪とまつ毛は透明度（Opacity）を足した PNG。
import bpy, sys, os, json, math, base64, tempfile
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, WALK, RUN, OUT = argv[0], argv[1], argv[2], argv[3]
HIPS_HEIGHT = .95
ARM_DOWN_DEG, ELBOW_DEG = 68.0, 14.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC, use_anim=False)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
sc = bpy.context.scene
short = lambda n: n.split(':')[-1]
bones = list(arm.data.bones)   # 親が先に来る順
bidx = {b.name: i for i, b in enumerate(bones)}

# ---- Blender の世界 → three.js：p3 = k * R * (p - o)、R: (x, y, z) -> (x, z, -y)
Rm = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
def rest_pose():
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    sc.frame_set(1); bpy.context.view_layer.update()
rest_pose()
hips_rest = arm.matrix_world @ arm.data.bones['mixamorig:Hips'].head_local
lo_z = min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
k = HIPS_HEIGHT / (hips_rest.z - lo_z)
A = Matrix.Diagonal((k, k, k, 1)) @ Rm @ Matrix.Translation(-Vector((hips_rest.x, hips_rest.y, lo_z)))
Ainv = A.inverted()

def bone_worlds():
    """今の姿勢の各骨の three.js での世界行列（回転と位置だけ）"""
    out = []
    for b in bones:
        Mb = arm.matrix_world @ arm.pose.bones[b.name].matrix
        s = Mb.to_3x3().col[0].length
        out.append(A @ Mb @ Matrix.Diagonal((1 / s, 1 / s, 1 / s, 1)) @ Ainv)
    return out
def locals_of(W):
    L = []
    for i, b in enumerate(bones):
        P = W[bidx[b.parent.name]] if b.parent else Matrix.Identity(4)
        L.append(P.inverted() @ W[i])
    return L

# ---- 骨の休み姿勢（T 字）
Wrest = bone_worlds(); Lrest = locals_of(Wrest)
bone_data = [{'name': short(b.name), 'parent': bidx[b.parent.name] if b.parent else -1,
              'pos': [round(v, 5) for v in Lrest[i].to_translation()], 'quat': [round(v, 6) for v in (lambda q: (q.x, q.y, q.z, q.w))(Lrest[i].to_quaternion())]}
             for i, b in enumerate(bones)]

# ---- 立ち姿（腕を下ろす）：世界の軸で骨を回す
def rotate_world(pb, axis_world, deg):
    inv = arm.matrix_world.to_3x3().inverted(); ax = (inv @ Vector(axis_world)).normalized(); head = pb.head.copy()
    pb.matrix = Matrix.Translation(head) @ Matrix.Rotation(math.radians(deg), 4, ax) @ Matrix.Translation(-head) @ pb.matrix
    bpy.context.view_layer.update()
P = arm.pose.bones
rotate_world(P['mixamorig:LeftArm'], (0, 1, 0), ARM_DOWN_DEG); rotate_world(P['mixamorig:RightArm'], (0, 1, 0), -ARM_DOWN_DEG)
rotate_world(P['mixamorig:LeftForeArm'], (1, 0, 0), -ELBOW_DEG); rotate_world(P['mixamorig:RightForeArm'], (1, 0, 0), -ELBOW_DEG)
Lidle = locals_of(bone_worlds())
q4 = lambda q: [q.x, q.y, q.z, q.w]
idle = {'quat': [round(v, 6) for i in range(len(bones)) for v in q4(Lidle[i].to_quaternion())], 'hips': [round(v, 5) for v in Lidle[0].to_translation()]}

# ---- 歩き・走り：同じ骨組みの Mixamo のクリップを Remy の骨に付けて、1 コマずつ読む
def sample_clip(path):
    rest_pose()
    before = set(bpy.data.objects); bpy.ops.import_scene.fbx(filepath=path)
    warm = next(o for o in bpy.data.objects if o not in before and o.type == 'ARMATURE')
    act = warm.animation_data.action; act.use_fake_user = True
    for o in [o for o in bpy.data.objects if o not in before]: bpy.data.objects.remove(o, do_unlink=True)
    arm.animation_data_create(); arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and act.slots: arm.animation_data.action_slot = act.slots[0]
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1]); fps = sc.render.fps / sc.render.fps_base
    frames = list(range(f0, f1))   # f1 は f0 と同じ姿勢（1 周期ぶん進んだ所）なので除く
    sc.frame_set(f0); h0 = bone_worlds()[0].to_translation()
    sc.frame_set(f1); h1 = bone_worlds()[0].to_translation()
    travel = h1 - h0; T = (f1 - f0) / fps; quats, hips, lead = [], [], []
    for f in frames:
        sc.frame_set(f); W = bone_worlds(); L = locals_of(W); t = (f - f0) / (f1 - f0)
        lead.append(W[bidx['mixamorig:LeftToeBase']].to_translation().z - W[bidx['mixamorig:RightToeBase']].to_translation().z)   # 左のつま先が右より前（+Z）に出ている量
        p = L[0].to_translation() - Vector((travel.x * t, 0, travel.z * t))   # 前へ進む分を除く（上下の揺れは残す）
        hips += [round(v, 5) for v in p]
        quats += [round(v, 6) for i in range(len(bones)) for v in q4(L[i].to_quaternion())]
    arm.animation_data.action = None
    return {'fps': round(fps, 3), 'frames': len(frames), 'duration': round(T, 5), 'speed': round(math.hypot(travel.x, travel.z) / T, 4),
            'leftFront': round(int(np.argmax(lead)) / len(frames), 4),   # 左足が一番前に出るコマ（周期に対する割合）。歩き↔走りの切り替えで足の位相をそろえるのに使う
            'source': os.path.basename(path), 'quat': quats, 'hips': hips}
clips = {'walk': sample_clip(WALK), 'run': sample_clip(RUN)}
rest_pose()

# ---- 形（休み姿勢）と骨の重み
def tex_of(mat, socket):
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image and any(l.from_node == n and l.to_socket.name == socket for l in mat.node_tree.links): return n.image
def pixels(img, size):
    im = img.copy(); im.scale(size, size); a = np.zeros(size * size * 4, np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im); return a.reshape(size, size, 4)
TMP = tempfile.mkdtemp()
def encode(rgba, alpha):
    size = rgba.shape[0]; im = bpy.data.images.new('t', size, size, alpha=alpha); im.pixels.foreach_set(rgba.reshape(-1))
    path = os.path.join(TMP, 't.png' if alpha else 't.jpg'); im.filepath_raw = path; im.file_format = 'PNG' if alpha else 'JPEG'
    sc.render.image_settings.quality = 82; im.save(); bpy.data.images.remove(im)
    return ('data:image/png;base64,' if alpha else 'data:image/jpeg;base64,') + base64.b64encode(open(path, 'rb').read()).decode()
tex_cache = {}
def texture(mat, size):
    dif = tex_of(mat, 'Base Color'); op = tex_of(mat, 'Alpha'); key = (dif.name, op.name if op else None, size)
    if key not in tex_cache:
        rgba = pixels(dif, size); rgba[..., 3] = pixels(op, size)[..., 0] if op is not None else 1
        tex_cache[key] = encode(rgba, op is not None)
    return tex_cache[key]
b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
parts = []; total_v = total_t = 0; hi_y = -1e9
for o in meshes:
    me = o.data; me.calc_loop_triangles(); M = o.matrix_world; N = M.to_3x3().inverted().transposed()
    nrm = np.zeros((len(me.loops), 3)); me.corner_normals.foreach_get('vector', nrm.reshape(-1))
    uv = np.zeros((len(me.loops), 2)); me.uv_layers.active.data.foreach_get('uv', uv.reshape(-1))
    gname = {g.index: g.name for g in o.vertex_groups}
    vskin = []
    for v in me.vertices:
        ws = sorted(((g.weight, bidx[gname[g.group]]) for g in v.groups if gname.get(g.group) in bidx and g.weight > 0), reverse=True)[:4]
        s = sum(w for w, _ in ws) or 1; ws = [(w / s, b) for w, b in ws] + [(0, 0)] * (4 - len(ws)); vskin.append(ws)
    keymap = {}; pos = []; nor = []; uvs = []; sidx = []; swt = []; idx = []
    for t in me.loop_triangles:
        for l in t.loops:
            vi = me.loops[l].vertex_index
            key = (vi, round(uv[l][0], 5), round(uv[l][1], 5), tuple(np.round(nrm[l], 3)))
            j = keymap.get(key)
            if j is None:
                j = keymap[key] = len(pos)
                c = A @ (M @ me.vertices[vi].co); pos.append(tuple(c))
                n = (N @ Vector(nrm[l])).normalized(); nor.append((n.x, n.z, -n.y)); uvs.append(tuple(uv[l]))
                w = vskin[vi]; q = [int(round(x * 255)) for x, _ in w]; q[0] += 255 - sum(q)   # 合計 255 にそろえる
                sidx.append([b for _, b in w]); swt.append(q)
            idx.append(j)
    pos = np.array(pos, np.float32); idx = np.array(idx, np.uint16 if len(pos) < 65536 else np.uint32)
    hi_y = max(hi_y, float(pos[:, 1].max()))
    mat = o.material_slots[0].material
    parts.append({'name': o.name, 'alpha': tex_of(mat, 'Alpha') is not None, 'tex': texture(mat, 1024 if o.name == 'Body' else 512), 'idx32': idx.dtype == np.uint32,
                  'pos': b64(pos), 'nrm': b64(np.array(nor, np.float32)), 'uv': b64(np.array(uvs, np.float32)), 'idx': b64(idx),
                  'skinIndex': b64(np.array(sidx, np.uint8)), 'skinWeight': b64(np.array(swt, np.uint8))})
    total_v += len(pos); total_t += len(idx) // 3

# 立ち姿の身長（腕を下ろした姿勢で、足の裏から頭のてっぺん。休み姿勢と同じ：腕は高さに効かない）
meta = {'id': 'remy', 'name': 'Remy（サイズ確認用のキャラクター）', 'source': 'Mixamo Remy（元モデル: Remy.fbx）',
        'hipsHeight': HIPS_HEIGHT, 'height': round(hi_y, 3),
        'pose': f'立ち姿：腕を {ARM_DOWN_DEG:g} 度下ろし、肘を {ELBOW_DEG:g} 度曲げる', 'verts': total_v, 'tris': total_t, 'bonesCount': len(bones),
        'clips': {k: {'source': c['source'], 'speed': c['speed'], 'duration': c['duration'], 'leftFront': c['leftFront']} for k, c in clips.items()}}
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// 主人公の体（hero/build_remy.py で作ったデータ。手で直さないこと）\n')
    f.write('TDHero.add(' + json.dumps({**meta, 'bones': bone_data, 'idle': idle, 'clips': clips, 'parts': parts}, ensure_ascii=False, separators=(',', ':')) + ');\n')
print('HERO', json.dumps(meta, ensure_ascii=False), 'bytes', os.path.getsize(OUT))
