import json,math,sys,base64,io,zlib
from pathlib import Path
from collections import Counter
from PIL import Image,ImageChops,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1] if len(sys.argv)>1 else ROOT.parent/'root-bark-evidence')
def load(p):
 s=p.read_text(encoding='utf-8');return json.loads(s[s.index('window.TDSharedData = ')+22:].strip().removesuffix(';'))
new=load(ROOT/'props/shared/assets.js');old=load(OUT/'baseline/props/shared/assets.js')
source=json.loads((OUT/'root-source.json').read_text(encoding='utf-8'));ids={s['id']for s in source};checks=[];rows=[]
def check(ok,name):
 checks.append(name);assert ok,name
check(len(ids)==24 and len(new['assets'])==49,'24 tree/shrub targets,49 shared assets')
for a in new['assets']:
 b=next(b for b in old['assets'] if b['id']==a['id'])
 if a['id'] not in ids:check(a==b,'Protected '+a['id']);continue
 s=next(s for s in source if s['id']==a['id']);P=a['positions'];N=a['normals'];I=a['triangles'];n=len(P)//3
 check(all(math.isfinite(x)for k in ['positions','normals','colors','uv','motionWeights','rootWeights']for x in a[k]),'Finite '+a['id'])
 check(len(N)==len(P)==len(a['colors']) and len(a['uv'])==n*2 and len(a['motionWeights'])==n*2 and len(a['rootWeights'])==n,'Attribute lengths '+a['id'])
 check(all(0<=x<=1 for k in ['uv','motionWeights','rootWeights']for x in a[k]),'UV/weight ranges '+a['id'])
 check(all(abs(sum(x*x for x in N[k:k+3])-1)<4e-6 for k in range(0,len(N),3)),'Normalized normals '+a['id'])
 check(all(0<=i<n for i in I) and len(I)%3==0,'Indices '+a['id'])
 check(all(a.get(k)==b.get(k)for k in b if k not in ['positions','normals','colors','uv','triangles','motionWeights','glow']),'ID/pivot/material/placement/wind/contact metadata '+a['id'])
 bounds=lambda p:[min(p[j::3])for j in range(3)]+[max(p[j::3])for j in range(3)]
 check(max(abs(x-y)for x,y in zip(bounds(P),bounds(b['positions'])))<1e-6,'Existing installed bounds '+a['id'])
 cells=json.loads((OUT/'bark-cells.json').read_text(encoding='utf-8'));overlaps=[]
 for part in s['parts']:
  ix=I[part['first']:part['first']+part['count']]
  if part['role']in ['foliage','detail']:
   for i in ix:
    x=a['uv'][i*2]*1024;y=(1-a['uv'][i*2+1])*512
    overlaps.extend(name for name,(l,t,w,h)in cells.items()if l<=x<l+w and t<=y<t+h)
  if part['role']in ['root','trunk']:check(all(a['motionWeights'][i*2]==a['motionWeights'][i*2+1]==0 for i in ix),'Fixed '+part['role']+' '+a['id'])
 check(not overlaps,'No leaf/detail UV inside bark cells '+a['id'])
 oldparts=[p for p in s['beforeParts']if p['role']not in ['root','trunk']];newparts=[p for p in s['parts']if p['role']not in ['root','trunk']]
 check(len(oldparts)==len(newparts),'Part correspondence '+a['id'])
 for before,after in zip(oldparts,newparts):
  ia=b['triangles'][before['first']:before['first']+before['count']];ib=I[after['first']:after['first']+after['count']]
  keys=['positions','motionWeights']if before['role']=='branch'else ['positions','normals','colors','uv','motionWeights']
  ok=len(ia)==len(ib)
  for k in keys:
   stride=2 if k in ['uv','motionWeights']else 3
   ok&=all(b[k][i*stride:i*stride+stride]==a[k][j*stride:j*stride+stride]for i,j in zip(ia,ib))
  check(ok,'Preserved '+before['role']+' '+a['id'])
 bad=deg=0
 for k in range(0,len(I),3):
  ix=I[k:k+3];q=[P[i*3:i*3+3]for i in ix];u=[q[1][j]-q[0][j]for j in range(3)];v=[q[2][j]-q[0][j]for j in range(3)];c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];nn=[sum(N[i*3+j]for i in ix)for j in range(3)]
  bad+=sum(x*y for x,y in zip(c,nn))< -1e-6;deg+=sum(x*x for x in c)<1e-15
 check(bad==deg==0,'Winding/nondegenerate '+a['id']+f' reversed={bad} degenerate={deg}')
 rows.append(dict(id=a['id'],name=a['displayName'],beforeTriangles=len(b['triangles'])//3,triangles=len(I)//3,beforeVertices=len(b['positions'])//3,vertices=n,materials=1,bark=s['cell'],root=s['profile']))
oldtx={t['id']:t for t in old['textures']}
for t in new['textures']:
 if t['id']!='tree-canopies-v1':check(t==oldtx[t['id']],'Protected texture '+t['id']);continue
 check(all(t[k]==oldtx[t['id']][k]for k in t if k!='png'),'Atlas resolution/settings')
 a=Image.open(io.BytesIO(base64.b64decode(t['png']))).convert('RGBA');b=Image.open(io.BytesIO(base64.b64decode(oldtx[t['id']]['png']))).convert('RGBA');mask=Image.new('L',a.size,255);d=ImageDraw.Draw(mask)
 for x,y,w,h in json.loads((OUT/'bark-cells.json').read_text()).values():d.rectangle((x,y,x+w-1,y+h-1),fill=0)
 check(Image.composite(ImageChops.difference(a,b),Image.new('RGBA',a.size),mask).getbbox(alpha_only=False)is None,'All canopy/flower/frond atlas pixels protected')
 atlas=dict(width=t['width'],height=t['height'],beforePNGBytes=len(base64.b64decode(oldtx[t['id']]['png'])),pngBytes=len(base64.b64decode(t['png'])),rgbaMipBytes=round(t['width']*t['height']*4*4/3))
report=dict(status='Passed',checks=len(checks),models=rows,atlas=atlas,beforeTriangles=sum(r['beforeTriangles']for r in rows),triangles=sum(r['triangles']for r in rows),dataBytes=(ROOT/'props/shared/assets.js').stat().st_size,gzipBytes=len(zlib.compress((ROOT/'props/shared/assets.js').read_bytes())))
(OUT/'roots-source-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
