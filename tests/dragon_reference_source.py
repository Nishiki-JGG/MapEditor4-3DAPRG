"""Selective dragon-tree mesh, atlas packing and anchor checks."""
import base64,io,json,math
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];out=root.parent/'dragon-reference-evidence'
def load(p):
 s=(p/'props/shared/assets.js').read_text(encoding='utf-8');return json.loads(s[s.index(' = ')+3:].rstrip(';\n'))
old=load(out/'baseline');new=load(root);checks=[]
def check(ok,name):
 checks.append(dict(name=name,status='Passed' if ok else 'Failed'));assert ok,name
check(len(new['assets'])==49 and len(new['textures'])==7,'49 assets / 7 images')
for a in old['assets']:
 if a['id']!='dragontree':check(a==next(v for v in new['assets'] if v['id']==a['id']),'Protected '+a['id'])
for t in old['textures']:
 if t['id']!='tree-canopies-v1':check(t==next(v for v in new['textures'] if v['id']==t['id']),'Protected texture '+t['id'])
a=next(a for a in new['assets'] if a['id']=='dragontree');before=next(a for a in old['assets'] if a['id']=='dragontree');source=json.loads((out/'dragon-source.json').read_text())
check(a['material']==before['material'] and a['pivot']==before['pivot'] and a['wind']==before['wind'],'Material, pivot and wind contract')
P=a['positions'];N=a['normals'];W=a['motionWeights'];n=len(P)//3
check(len(N)==len(P)==len(a['colors']) and len(a['uv'])==len(W)==n*2,'Attribute sizes')
check(all(math.isfinite(v) for key in ['positions','normals','colors','uv','motionWeights'] for v in a[key]),'Finite attributes')
check(all(0<=w<=1 for w in a['uv']+W),'UV / weight range')
check(all(abs(sum(v*v for v in N[i:i+3])-1)<.000004 for i in range(0,len(N),3)),'Unit normals')
check(all(abs(min(P[k::3])-min(before['positions'][k::3]))<.000001 and abs(max(P[k::3])-max(before['positions'][k::3]))<.000001 for k in range(3)),'Existing 6 x 5.8 x 6 metre extents')
for part in source['parts']:
 if part['role'] in ['trunk','root']:check(all(W[i*2]==W[i*2+1]==0 for i in part['indices']),'Fixed '+part['role'])
for clump in source['clumps']:check(max(W[i*2] for i in clump['indices'])-min(W[i*2] for i in clump['indices'])<.000001,'Rigid terminal foliage patch')
check(a['contact']['minY']>=2.15,'Standard 2.15 m branch clearance')
for i in range(0,len(a['triangles']),3):
 ix=a['triangles'][i:i+3];check(all(0<=k<n for k in ix),'Valid indices '+str(i))
 p=[P[k*3:k*3+3] for k in ix];u=[p[1][j]-p[0][j] for j in range(3)];v=[p[2][j]-p[0][j] for j in range(3)];c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
 check(sum(x*x for x in c)>1e-15 and sum(c[j]*sum(N[k*3+j] for k in ix) for j in range(3))>=-.000001,'Outward nondegenerate triangle '+str(i))
images=[]
for d in [old,new]:
 t=next(t for t in d['textures'] if t['id']=='tree-canopies-v1');images.append(Image.open(io.BytesIO(base64.b64decode(t['png']))).convert('RGBA'))
check(images[0].size==images[1].size==(1024,512),'Atlas dimensions')
outside=inside=0
for y in range(512):
 for x in range(1024):
  if images[0].getpixel((x,y))!=images[1].getpixel((x,y)):
   if 512<=x<768 and 384<=y<512:inside+=1
   else:outside+=1
check(outside==0 and inside>0,'Only dragon atlas rectangle changes')
report=dict(status='Passed',count=len(checks),checks=checks,triangles=[len(before['triangles'])//3,len(a['triangles'])//3],vertices=[len(before['positions'])//3,n],clearance=a['contact']['minY'],branches=len(source['branches']),foliagePatches=len(source['clumps']),atlasChangedPixels=inside,outsideCellChangedPixels=outside,atlasPNGBytes=[len(base64.b64decode(next(t for t in d['textures'] if t['id']=='tree-canopies-v1')['png'])) for d in [old,new]])
(out/'dragon-source-validation.json').write_text(json.dumps(report,indent=2));print({k:v for k,v in report.items() if k!='checks'})
