"""枝骨格改修の保全契約を検査する。画像の美観判定は別途実施する。"""
import argparse, json, math, pathlib, hashlib, zlib

p = argparse.ArgumentParser()
p.add_argument('baseline')
p.add_argument('before_stats')
p.add_argument('after_stats')
p.add_argument('output')
a = p.parse_args()
repo = pathlib.Path(__file__).resolve().parents[1]
def data(path):
    return json.loads(path.read_text(encoding='utf8').split(' = ', 1)[1].rstrip(';\n'))
before_file = pathlib.Path(a.baseline) / 'props/shared/assets.js'
after_file = repo / 'props/shared/assets.js'
before, after = data(before_file), data(after_file)
old_stats = {x['id']: x for x in json.loads(pathlib.Path(a.before_stats).read_text(encoding='utf8'))}
new_stats = {x['id']: x for x in json.loads(pathlib.Path(a.after_stats).read_text(encoding='utf8'))}
old = {x['id']: x for x in before['assets']}
new = {x['id']: x for x in after['assets']}
targets = {'oak', 'nara', 'zelkova'}
checks = 0
def check(ok, message):
    global checks
    assert ok, message
    checks += 1
check(old.keys() == new.keys(), '共有50種のIDと順序')
check(before['textures'] == after['textures'], '全7画像の完全一致')
for key in before:
    if key != 'assets': check(before[key] == after[key], 'データ契約 ' + key)
rows = []
for id, asset in new.items():
    prev = old[id]
    if id not in targets:
        check(prev == asset, '対象外の完全一致 ' + id)
        continue
    s = new_stats[id]['structure']
    for key in prev:
        if key not in {'positions', 'normals', 'colors', 'uv', 'triangles', 'motionWeights', 'rootWeights', 'rootWood'}:
            check(prev[key] == asset[key], '配置・材質・変形契約 ' + id + '/' + key)
    for key, width in [('positions', 3), ('normals', 3), ('colors', 3), ('uv', 2), ('motionWeights', 2), ('rootWeights', 1), ('rootWood', 1)]:
        if key not in asset: continue
        check(all(math.isfinite(v) for v in asset[key]), '有限値 ' + id + '/' + key)
        check(len(asset[key]) == len(asset['positions']) // 3 * width, '属性長 ' + id + '/' + key)
        # RootBark authoring の三角形範囲は左右座標変換後も同じ。根幹を展開して比較する。
        def expanded(obj, stats):
            indices = [i for part in stats['parts'] if part['role'] in ('root', 'trunk') for i in obj['triangles'][part['first']:part['first'] + part['count']]]
            return [v for i in indices for v in obj[key][i*width:(i+1)*width]]
        check(expanded(prev, old_stats[id]) == expanded(asset, new_stats[id]), '根・幹の完全一致 ' + id + '/' + key)
    for k in range(3):
        check(min(prev['positions'][k::3]) == min(asset['positions'][k::3]) and max(prev['positions'][k::3]) == max(asset['positions'][k::3]), '設置外形維持 ' + id + '/' + str(k))
    check(max(asset['triangles']) < len(asset['positions']) // 3 < 65536, '索引範囲 ' + id)
    check(s['primaryBranches'] >= 8 and s['secondaryBranches'] >= 19 and s['terminalTwigs'] >= 38 and s['leafClumps'] >= 128, '枝の3階層と葉層 ' + id)
    for joint in s['joints']:
        parent, child = s['skeleton'][joint['parent']], s['skeleton'][joint['child']]
        check(parent['points'][-1] == child['points'][0] and parent['to'] == child['from'], '分岐の接続位置と変形重み ' + id)
    for joint in s['primaryJunctions']:
        check(joint['distance'] < joint['trunkRadius'], '幹内に接続 ' + id)
    minimum = min(asset['positions'][i*3+1] for i in range(len(asset['positions'])//3) if max(asset['motionWeights'][i*2:i*2+2]) > 0)
    check(minimum >= 2.1, '標準人型の枝下クリアランス ' + id)
    normals = asset['normals']
    check(max(abs(sum(v*v for v in normals[i:i+3])-1) for i in range(0, len(normals), 3)) < .00001, '単位法線 ' + id)
    def leaf_area(obj, stats):
        area = 0
        for part in stats['parts']:
            if part['role'] != 'foliage': continue
            for j in range(part['first'], part['first']+part['count'], 3):
                points = [obj['positions'][i*3:i*3+3] for i in obj['triangles'][j:j+3]]
                u = [points[1][k]-points[0][k] for k in range(3)]
                v = [points[2][k]-points[0][k] for k in range(3)]
                area += abs(u[2]*v[0]-u[0]*v[2])*.5
        return area
    rows.append({'id': id, 'beforeTriangles': len(prev['triangles'])//3, 'triangles': len(asset['triangles'])//3, 'beforeVertices': len(prev['positions'])//3, 'vertices': len(asset['positions'])//3, 'primaryBranches': s['primaryBranches'], 'secondaryBranches': s['secondaryBranches'], 'terminalTwigs': s['terminalTwigs'], 'leafClumps': s['leafClumps'], 'minimumMovingHeight': minimum, 'materialCount': 1, 'beforeLeafProjectedArea': leaf_area(prev, old_stats[id]), 'leafProjectedArea': leaf_area(asset, new_stats[id])})
before_bytes = before_file.read_bytes().replace(b'\r\n', b'\n')
after_bytes = after_file.read_bytes().replace(b'\r\n', b'\n')
result = {'status': 'Passed', 'checks': checks, 'targets': rows, 'unchangedAssets': len(new)-len(targets), 'unchangedTextures': len(after['textures']), 'beforeBytes': len(before_bytes), 'bytes': len(after_bytes), 'beforeZlibBytes': len(zlib.compress(before_bytes, 9)), 'zlibBytes': len(zlib.compress(after_bytes, 9)), 'sha256': hashlib.sha256(after_bytes).hexdigest()}
pathlib.Path(a.output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(result, ensure_ascii=False))
