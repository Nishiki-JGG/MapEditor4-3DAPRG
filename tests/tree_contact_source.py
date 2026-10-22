import json,math,sys,zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1] if len(sys.argv)>1 else ROOT.parent/'tree-contact-evidence')
def load(p):
 s=p.read_text(encoding='utf-8');return json.loads(s.split('window.TDSharedData = ')[1].strip().removesuffix(';'))
new=load(ROOT/'props/shared/assets.js');old=load(OUT/'baseline/props/shared/assets.js')
source=json.loads((OUT/'root-source.json').read_text(encoding='utf-8'));previous=json.loads((OUT/'baseline-source.json').read_text(encoding='utf-8'));checks=[];rows=[]
def check(ok,name):
 checks.append(name);assert ok,name
check(len(source)==24 and len(new['assets'])==49,'24 targets / 49 shared models')
check(new['textures']==old['textures'],'All seven atlas images and sampler settings unchanged')
for a in new['assets']:
 b=next(b for b in old['assets'] if b['id']==a['id'])
 if not a.get('rootSurface'):check(a==b,'Protected model '+a['id']);continue
 s=next(s for s in source if s['id']==a['id']);prior=next(s for s in previous if s['id']==a['id']);P=a['positions'];N=a['normals'];I=a['triangles'];n=len(P)//3
 check(all(math.isfinite(x)for k in ['positions','normals','colors','uv','motionWeights','rootWeights','rootWood']for x in a[k]),'Finite '+a['id'])
 check(len(N)==len(P)==len(a['colors']) and len(a['uv'])==n*2 and len(a['motionWeights'])==n*2 and len(a['rootWeights'])==len(a['rootWood'])==n,'Attribute lengths '+a['id'])
 check(all(0<=x<=1 for k in ['uv','motionWeights','rootWeights','rootWood']for x in a[k]),'UV / mask range '+a['id'])
 check(all(abs(sum(x*x for x in N[k:k+3])-1)<4e-6 for k in range(0,len(N),3)),'Unit normals '+a['id'])
 check(all(0<=i<n for i in I) and len(I)%3==0,'Indices '+a['id'])
 mutable={'positions','normals','colors','uv','triangles','motionWeights','glow','rootWeights'}
 check(all(a.get(k)==b.get(k)for k in b if k not in mutable),'ID / pivot / placement / material / wind / touch '+a['id'])
 bounds=lambda p:[min(p[j::3])for j in range(3)]+[max(p[j::3])for j in range(3)]
 ba,bb=bounds(P),bounds(b['positions']);check(all(abs(ba[j]-bb[j])<1e-6 for j in [0,2,3,4,5]),'Footprint and crown height unchanged '+a['id'])
 check(-.201<=ba[1]-bb[1]<=1e-6,'Only local sole extends below ground, at most 20 cm '+a['id'])
 ap=[p for p in s['parts']if p['role']not in ['root','trunk']];bp=[p for p in prior['parts']if p['role']not in ['root','trunk']];check(len(ap)==len(bp),'Parts '+a['id'])
 for p,q in zip(ap,bp):
  ia=I[p['first']:p['first']+p['count']];ib=b['triangles'][q['first']:q['first']+q['count']];ok=len(ia)==len(ib)
  for key in ['positions','normals','colors','uv','motionWeights']:
   stride=2 if key in ['uv','motionWeights']else 3
   ok&=all(a[key][i*stride:i*stride+stride]==b[key][j*stride:j*stride+stride]for i,j in zip(ia,ib))
  check(ok,'Unchanged crown / branch '+a['id']+' '+p['role'])
  check(all(a['rootWood'][i]==(1 if p['role']=='branch' else 0)for i in ia),'Wood mask excludes leaves '+a['id'])
 for p in s['parts']:
  if p['role']in ['trunk','root']:
   ix=I[p['first']:p['first']+p['count']];check(all(a['motionWeights'][i*2]==a['motionWeights'][i*2+1]==0 and a['rootWood'][i]==1 for i in ix),'Fixed wood '+a['id']+' '+p['role'])
 bad=deg=0
 for k in range(0,len(I),3):
  ix=I[k:k+3];q=[P[i*3:i*3+3]for i in ix];u=[q[1][j]-q[0][j]for j in range(3)];v=[q[2][j]-q[0][j]for j in range(3)];c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];nn=[sum(N[i*3+j]for i in ix)for j in range(3)];bad+=sum(x*y for x,y in zip(c,nn))< -1e-6;deg+=sum(x*x for x in c)<1e-15
 check(bad==deg==0,'Winding / nondegenerate '+a['id']+f' bad={bad} deg={deg}')
 rows.append(dict(id=a['id'],beforeTriangles=len(b['triangles'])//3,triangles=len(I)//3,beforeVertices=len(b['positions'])//3,vertices=n,soleDepthMetres=round(bb[1]-ba[1],6),materials=1))
report=dict(status='Passed',checks=len(checks),models=rows,beforeTriangles=sum(r['beforeTriangles']for r in rows),triangles=sum(r['triangles']for r in rows),beforeBytes=(OUT/'baseline/props/shared/assets.js').stat().st_size,dataBytes=(ROOT/'props/shared/assets.js').stat().st_size,gzipBytes=len(zlib.compress((ROOT/'props/shared/assets.js').read_bytes())),imageBytesAdded=0,materialsAdded=0,passesAdded=0)
(OUT/'source-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
