"""形の美観とは別に、保全契約と接続の数値を確認する。"""
import argparse, json, math, pathlib, hashlib, zlib

args = argparse.ArgumentParser()
args.add_argument('baseline')
args.add_argument('before_stats')
args.add_argument('after_stats')
args.add_argument('output')
cli = args.parse_args()
repo = pathlib.Path(__file__).resolve().parents[1]
def read_data(p):
    return json.loads(p.read_text(encoding='utf8').split(' = ',1)[1].rstrip(';\n'))
before = read_data(pathlib.Path(cli.baseline)/'props/shared/assets.js')
after = read_data(repo/'props/shared/assets.js')
old = {x['id']:x for x in before['assets']}
new = {x['id']:x for x in after['assets']}
bs = {x['id']:x for x in json.loads(pathlib.Path(cli.before_stats).read_text(encoding='utf8'))}
ns = {x['id']:x for x in json.loads(pathlib.Path(cli.after_stats).read_text(encoding='utf8'))}
targets = {'oak','nara','zelkova','maple','cherry','islandash','olive','eucalyptus','birch','willow','rowan','hazel','elftree','worldtree'}
checks = 0
def check(ok, message):
    global checks
    if not ok: raise AssertionError(message)
    checks += 1
def distance_to_polyline(p, points):
    best = float('inf')
    for a,b in zip(points,points[1:]):
        d=[b[k]-a[k] for k in range(3)]
        t=max(0,min(1,sum((p[k]-a[k])*d[k] for k in range(3))/sum(v*v for v in d)))
        best=min(best,math.sqrt(sum((p[k]-a[k]-d[k]*t)**2 for k in range(3))))
    return best
check(list(old)==list(new),'既存50種の順序とID')
check(all((ns[id].get('structure') or {}).get('version')==2 for id in targets),'全14対象の新構造')
for k in before:
    if k!='assets': check(before[k]==after[k],'画像・共有契約 '+k)
rows=[]
for id,a in new.items():
    b=old[id]
    if id not in targets:
        check(a==b,'対象外の完全一致 '+id)
        continue
    for k in b:
        if k not in {'positions','normals','colors','uv','triangles','motionWeights','rootWeights','rootWood','glow'}:
            check(a[k]==b[k],'配置・材質・変形契約 '+id+'/'+k)
    for k,width in [('positions',3),('normals',3),('colors',3),('uv',2),('motionWeights',2),('rootWeights',1),('rootWood',1)]:
        check(len(a[k])==len(a['positions'])//3*width,'属性長 '+id+'/'+k)
        check(all(math.isfinite(x) for x in a[k]),'有限数 '+id+'/'+k)
        def expanded(obj,stats):
            indices=[i for p in stats['parts'] if p['role'] in ['root','trunk'] for i in obj['triangles'][p['first']:p['first']+p['count']]]
            return [v for i in indices for v in obj[k][i*width:(i+1)*width]]
        check(expanded(a,ns[id])==expanded(b,bs[id]),'根幹の完全一致 '+id+'/'+k)
    for k in range(3):
        check(abs(min(a['positions'][k::3])-min(b['positions'][k::3]))<1e-5 and abs(max(a['positions'][k::3])-max(b['positions'][k::3]))<1e-5,'設置外形 '+id+'/'+str(k))
    check(max(a['triangles'])<len(a['positions'])//3<65536,'インデックス範囲 '+id)
    check(max(abs(sum(x*x for x in a['normals'][i:i+3])-1) for i in range(0,len(a['normals']),3))<1e-5,'単位法線 '+id)
    s=ns[id]['structure']
    for j in s['joints']:
        p,c=s['skeleton'][j['parent']],s['skeleton'][j['child']]
        check(distance_to_polyline(c['points'][0],p['points'])<1e-5,'枝の接続位置 '+id)
        expected=[p['points'][j['segment']][k]+(p['points'][j['segment']+1][k]-p['points'][j['segment']][k])*j['fraction'] for k in range(3)]
        check(math.dist(c['points'][0],expected)<1e-8,'同じ断面での分岐 '+id)
        check(abs(c['from']-(p['weights'][j['segment']]+(p['weights'][j['segment']+1]-p['weights'][j['segment']])*j['fraction']))<1e-8,'同じ断面での変形重み '+id)
        check(abs(c['from']-(p['from']+(p['to']-p['from'])*j['attachment']))<1e-8,'枝の接続変形重み '+id)
    for p in s['skeleton']:
        if p['tier']=='primary': check(distance_to_polyline(p['points'][0],s['stemAxes'][p['axis']])<1e-5,'固定幹からの分岐 '+id)
    moving_min=min(a['positions'][i*3+1] for i in range(len(a['positions'])//3) if a['motionWeights'][i*2]>0)
    rows.append({'id':id,'beforeTriangles':len(b['triangles'])//3,'triangles':len(a['triangles'])//3,'beforeVertices':len(b['positions'])//3,'vertices':len(a['positions'])//3,'minimumMovingHeight':moving_min,'primary':s['primaryBranches'],'secondary':s['secondaryBranches'],'twigs':s['terminalTwigs'],'leafGroups':s['leafClumps']})
raw=(repo/'props/shared/assets.js').read_bytes()
report={'status':'Passed','checks':checks,'targets':rows,'unchangedAssets':len(new)-len(targets),'unchangedTextures':len(after['textures']),'bytes':len(raw),'zlibBytes':len(zlib.compress(raw,9)),'sha256':hashlib.sha256(raw).hexdigest()}
pathlib.Path(cli.output).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
