"""葉塊と樹皮の改善で配置、木質部、揺れ、atlasの非対象領域を壊さないことを確認。"""
from pathlib import Path
import base64,hashlib,io,json,math,sys,zlib
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[1];OUT=Path(sys.argv[1] if len(sys.argv)>1 else ROOT.parent/'tree-surface-evidence')
def load(p):
 s=(p/'props/shared/assets.js').read_text(encoding='utf-8');return json.loads(s.split('window.TDSharedData = ')[1].strip().removesuffix(';'))
old=load(OUT/'baseline');new=load(ROOT);sources=json.loads((OUT/'root-source.json').read_text(encoding='utf-8'));crown={'oak','nara','zelkova'};bark={'nara','olive','elftree','worldtree','oak','deadtree','twisttree','willow'};checks=[];rows=[]
def check(v,n):
 checks.append(n);assert v,n
check(len(new['assets'])==50 and len(new['textures'])==7,'50 models/seven images')
stride={'positions':3,'normals':3,'colors':3,'uv':2,'motionWeights':2,'rootWeights':1,'rootWood':1}
def expanded(a,p,key):
 n=stride[key];return [v for i in a['triangles'][p['first']:p['first']+p['count']] for v in a[key][i*n:i*n+n]]
def area(a,parts):
 total=0
 for p in parts:
  if p['role']!='foliage':continue
  ids=a['triangles'][p['first']:p['first']+p['count']]
  for k in range(0,len(ids),3):
   v=[a['positions'][i*3:i*3+3] for i in ids[k:k+3]];total+=abs((v[1][0]-v[0][0])*(v[2][2]-v[0][2])-(v[1][2]-v[0][2])*(v[2][0]-v[0][0]))*.5
 return total
for a in new['assets']:
 b=next(v for v in old['assets'] if v['id']==a['id']);id=a['id']
 if id not in crown|bark:check(a==b,'Protected model '+id);continue
 for k in b:
  if k not in stride and k!='triangles':check(a[k]==b[k],'Metadata '+id+' '+k)
 s=next(s for s in sources if s['id']==id);n=len(a['positions'])//3
 check(len(a['triangles'])==len(b['triangles']),'Same polygon count '+id)
 check(n==len(b['positions'])//3,'Same vertex count '+id)
 check(all(math.isfinite(v) for key in stride for v in a[key]),'Finite '+id)
 check(all(len(a[k])==n*z for k,z in stride.items()),'Attributes '+id)
 check(all(0<=v<=1 for k in ['uv','colors','motionWeights','rootWeights'] for v in a[k]),'Attribute ranges '+id)
 check(all(abs(sum(v*v for v in a['normals'][i:i+3])-1)<4e-6 for i in range(0,n*3,3)),'Unit normals '+id)
 bounds=lambda p:([min(p[k::3]) for k in range(3)],[max(p[k::3]) for k in range(3)])
 check(bounds(a['positions'])==bounds(b['positions']),'Exact installed bounds '+id)
 changed=0
 for part in s['parts']:
  sameGeometry=id not in crown or part['role']!='foliage'
  for key in ['motionWeights','rootWeights','rootWood']+(['positions','normals','uv'] if sameGeometry else []):check(expanded(a,part,key)==expanded(b,part,key),'Preserved '+id+' '+part['role']+' '+key)
  if id not in bark and part['role']!='foliage':check(expanded(a,part,'colors')==expanded(b,part,'colors'),'Protected wood color '+id)
  if part['role']=='detail':check(expanded(a,part,'colors')==expanded(b,part,'colors'),'Protected fruit/emissive detail color '+id)
  if part['role']=='foliage':
   if id in crown:
    changed+=expanded(a,part,'positions')!=expanded(b,part,'positions')
    check(min(expanded(a,part,'positions')[1::3])>=2.10,'Human clearance '+id)
   else:check(all(expanded(a,part,k)==expanded(b,part,k) for k in stride),'Protected foliage '+id)
 bad=deg=0
 for k in range(0,len(a['triangles']),3):
  ix=a['triangles'][k:k+3];v=[a['positions'][i*3:i*3+3] for i in ix];x=[v[1][j]-v[0][j] for j in range(3)];y=[v[2][j]-v[0][j] for j in range(3)];c=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];normal=[sum(a['normals'][i*3+j] for i in ix) for j in range(3)];bad+=sum(x*y for x,y in zip(c,normal))< -1e-6;deg+=sum(x*x for x in c)<1e-15
 check(bad==deg==0,'Winding/nondegenerate '+id+f' bad={bad} deg={deg}')
 if id in crown:check(changed>3,'Multiple distinct deformed clumps '+id)
 rows.append(dict(id=id,triangles=len(a['triangles'])//3,vertices=n,materials=1,changedClumps=changed,projectedLeafAreaBefore=area(b,s['parts']),projectedLeafArea=area(a,s['parts'])))
for t in new['textures']:
 b=next(v for v in old['textures'] if v['id']==t['id'])
 if t['id']!='tree-canopies-v1':check(t==b,'Protected image '+t['id']);continue
 check(all(t[k]==b[k] for k in t if k!='png'),'Atlas resolution/filter/color space unchanged')
 im=Image.open(io.BytesIO(base64.b64decode(t['png']))).convert('RGBA');prev=Image.open(io.BytesIO(base64.b64decode(b['png']))).convert('RGBA')
 check(im.getchannel('A').tobytes()==prev.getchannel('A').tobytes(),'All atlas alpha coverage exact')
 diff=ImageChops.difference(im,prev);diff.paste((0,0,0,0),(768,0,896,128));check(diff.getbbox(alpha_only=False) is None,'Only 128x128 furrowed RGB changed')
 atlas=dict(width=t['width'],height=t['height'],beforePNGBytes=len(base64.b64decode(b['png'])),pngBytes=len(base64.b64decode(t['png'])),rgbaMipBytes=round(1024*512*4*4/3))
for rel in ['app.js','water.js','props/shared/pine-wind.js','props/shared/root-surface.js','tools/plants/bush.js']:
 check((ROOT/rel).read_text(encoding='utf-8')==(OUT/'baseline'/rel).read_text(encoding='utf-8'),'Protected code '+rel)
check((ROOT/'index.html').read_text(encoding='utf-8')==(OUT/'baseline/index.html').read_text(encoding='utf-8').replace('assets.js?v=root-reference1','assets.js?v=tree-surface1'),'Only asset cache revision in main HTML')
check((ROOT/'tests/root_reference_view.html').read_text(encoding='utf-8')==(OUT/'baseline/tests/root_reference_view.html').read_text(encoding='utf-8').replace('index.html?v=root-reference1','index.html?v=tree-surface1'),'Only iframe cache revision in existing live view')
report=dict(status='Passed',checks=len(checks),models=rows,atlas=atlas,triangles=sum(x['triangles'] for x in rows),assetsSHA256=hashlib.sha256((ROOT/'props/shared/assets.js').read_bytes()).hexdigest(),dataBytes=(ROOT/'props/shared/assets.js').stat().st_size,zlibBytes=len(zlib.compress((ROOT/'props/shared/assets.js').read_bytes())))
(OUT/'surface-source-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
