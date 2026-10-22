"""資料に基づく根張り改修の共有データ契約、形状、保全範囲を検査する。"""
import base64,io,json,math,sys,zlib
from pathlib import Path
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1] if len(sys.argv)>1 else ROOT.parent/'root-reference-evidence')
def load(folder):
 s=(folder/'props/shared/assets.js').read_text(encoding='utf-8');return json.loads(s.split('window.TDSharedData = ')[1].strip().removesuffix(';'))
old=load(OUT/'baseline');new=load(ROOT);sources=json.loads((OUT/'root-source.json').read_text(encoding='utf-8'));checks=[];rows=[]
targets={'oak','nara','zelkova','olive','willow','scotspine','deadtree','twisttree'}
def check(v,n):
 checks.append(n);assert v,n
check(len(new['assets'])==50 and len(new['textures'])==7,'50 models, seven shared images')
for a in new['assets']:
 b=next(v for v in old['assets'] if v['id']==a['id'])
 if a['id'] not in targets:check(a==b,'Protected model '+a['id']);continue
 for k in b:
  if k not in {'positions','normals','colors','uv','triangles','motionWeights','glow','rootWeights','rootWood'}:check(a[k]==b[k],a['id']+' stable metadata '+k)
 n=len(a['positions'])//3;s=next(s for s in sources if s['id']==a['id'])
 check(all(math.isfinite(v) for k in ['positions','normals','colors','uv','motionWeights','rootWeights'] for v in a[k]),'Finite '+a['id'])
 check(len(a['normals'])==len(a['colors'])==n*3 and len(a['uv'])==len(a['motionWeights'])==n*2 and len(a['rootWeights'])==n,'Attribute lengths '+a['id'])
 check(all(abs(sum(v*v for v in a['normals'][k:k+3])-1)<4e-6 for k in range(0,n*3,3)),'Unit normals '+a['id'])
 check(all(0<=i<n for i in a['triangles']),'Index range '+a['id'])
 check(all(0<=v<=1 for k in ['uv','motionWeights','rootWeights'] for v in a[k]),'UV and weight range '+a['id'])
 for part in s['parts']:
  if part['role'] in ['root','trunk']:check(all(a['motionWeights'][i*2:i*2+2]==[0,0] for i in a['triangles'][part['first']:part['first']+part['count']]),'Fixed '+a['id']+' '+part['role'])
 # The primary footprint and crown height must retain existing placement dimensions.
 bounds=lambda v:([min(v[k::3]) for k in range(3)],[max(v[k::3]) for k in range(3)])
 lo,hi=bounds(a['positions']);blo,bhi=bounds(b['positions'])
 check(all(abs(hi[k]-bhi[k])<1e-5 and abs(lo[k]-blo[k])<1e-5 for k in [0,2]) and abs(hi[1]-bhi[1])<1e-5,'Footprint and height '+a['id'])
 bad=deg=0
 for k in range(0,len(a['triangles']),3):
  ix=a['triangles'][k:k+3];q=[a['positions'][i*3:i*3+3] for i in ix];u=[q[1][j]-q[0][j] for j in range(3)];v=[q[2][j]-q[0][j] for j in range(3)];c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];nn=[sum(a['normals'][i*3+j] for i in ix) for j in range(3)];bad+=sum(x*y for x,y in zip(c,nn))< -1e-6;deg+=sum(x*x for x in c)<1e-15
 check(bad==deg==0,'Winding and nondegenerate '+a['id'])
 leaf=[a['positions'][i*3+1] for p in s['parts'] if p['role']=='foliage' for i in a['triangles'][p['first']:p['first']+p['count']]]
 if a['id'] in ['oak','nara','zelkova']:check(min(leaf)>=2.10,'Standard foliage clearance '+a['id'])
 rows.append(dict(id=a['id'],beforeTriangles=len(b['triangles'])//3,triangles=len(a['triangles'])//3,beforeVertices=len(b['positions'])//3,vertices=n,profile=s['profile'],minFoliageMetres=min(leaf) if leaf else None,bounds=[lo,hi],materials=1))
for t in new['textures']:
 b=next(v for v in old['textures'] if v['id']==t['id'])
 if t['id']!='tree-canopies-v1':check(t==b,'Protected texture '+t['id']);continue
 check(all(t[k]==b[k] for k in b if k!='png'),'Atlas metadata fixed')
 im=Image.open(io.BytesIO(base64.b64decode(t['png']))).convert('RGBA');prev=Image.open(io.BytesIO(base64.b64decode(b['png']))).convert('RGBA')
 # Broadleaf occupies only the upper-left cell; no other atlas pixel may change.
 diff=ImageChops.difference(im,prev);diff.paste((0,0,0,0),(0,0,256,256));check(diff.getbbox(alpha_only=False) is None,'All non-broadleaf RGBA exact')
 cover=lambda i:sum(x>=107 for x in i.getchannel('A').crop((0,0,256,256)).tobytes())/65536
 atlas=dict(width=t['width'],height=t['height'],beforePNGBytes=len(base64.b64decode(b['png'])),pngBytes=len(base64.b64decode(t['png'])),rgbaMipBytes=round(1024*512*4*4/3),beforeBroadCoverage=cover(prev),broadCoverage=cover(im))
for rel in ['app.js','water.js','props/shared/pine-wind.js','props/shared/root-surface.js','tools/plants/bush.js']:
 check((ROOT/rel).read_text(encoding='utf-8')==(OUT/'baseline'/rel).read_text(encoding='utf-8'),'Protected code '+rel)
check((ROOT/'index.html').read_text(encoding='utf-8')==(OUT/'baseline/index.html').read_text(encoding='utf-8').replace('props/shared/assets.js?v=bush-volume1','props/shared/assets.js?v=root-reference1'),'Only shared asset cache revision in index')
report=dict(status='Passed',checks=len(checks),models=rows,atlas=atlas,beforeTriangles=sum(r['beforeTriangles'] for r in rows),triangles=sum(r['triangles'] for r in rows),dataBytes=(ROOT/'props/shared/assets.js').stat().st_size,zlibBytes=len(zlib.compress((ROOT/'props/shared/assets.js').read_bytes())))
(OUT/'reference-source-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
