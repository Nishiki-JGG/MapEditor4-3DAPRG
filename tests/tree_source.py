"""Canonical tree mesh and preservation checks; stdlib only."""
import base64,json,math,zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'tree-canopies-evidence'
def data(folder):
 s=(folder/'props/shared/assets.js').read_text(encoding='utf-8');return json.loads(s[s.index(' = ')+3:].rstrip(';\n'))
old=data(OUT/'baseline');new=data(ROOT);source=json.loads((OUT/'tree-source.json').read_text(encoding='utf-8'));legacy=json.loads((ROOT/'tools/plants/tree-legacy.json').read_text(encoding='utf-8'));targets={s['id'] for s in source};checks=[]
def check(ok,name):
 checks.append({'name':name,'status':'Passed' if ok else 'Failed'});assert ok,name
check(len(source)==24 and len(targets)==24,'24 unique target trees and woody shrubs')
check(len(new['assets'])==49 and len(new['textures'])==7,'49 shared assets and 7 textures')
for a in old['assets']:
 if a['id'] not in targets:check(a==next(v for v in new['assets'] if v['id']==a['id']),'Unrelated shared asset '+a['id'])
for t in old['textures']:check(t==next(v for v in new['textures'] if v['id']==t['id']),'Existing texture '+t['id'])
rows=[]
for spec in source:
 a=next(v for v in new['assets'] if v['id']==spec['id']);P=a['positions'];N=a['normals'];n=len(P)//3;idx=a['triangles'];W=a['motionWeights'];lo=[min(P[k::3]) for k in range(3)];hi=[max(P[k::3]) for k in range(3)]
 check(n>0 and len(N)==len(P) and len(a['colors'])==len(P) and len(a['uv'])==n*2 and len(W)==n*2,'Attribute sizes '+a['id'])
 check(all(math.isfinite(v) for key in ['positions','normals','colors','uv','motionWeights'] for v in a[key]),'Finite attributes '+a['id'])
 check(len(idx)%3==0 and all(0<=i<n for i in idx),'Indices '+a['id'])
 check(all(abs(sum(v*v for v in N[i:i+3])-1)<.000004 for i in range(0,len(N),3)),'Normalized normals '+a['id'])
 check(all(0<=v<=1 for v in a['uv']+W),'UV and mask range '+a['id'])
 check(a['pivot']==[0,0,0] and a['material']['texture']=='tree-canopies-v1','Ground pivot and shared atlas '+a['id'])
 if a['id'] in legacy:
  b=legacy[a['id']]['bounds'];expected=[b[0][0],b[0][1],-b[1][2],b[1][0],b[1][1],-b[0][2]]
  check(max(abs(v-t) for v,t in zip(lo+hi,expected))<.000001,'Legacy extents '+a['id'])
 else:check(abs(lo[1])<.000001,'New root ground height '+a['id'])
 for part in spec['parts']:
  if part['role'] in ['trunk','root']:check(all(W[i*2]==0 and W[i*2+1]==0 for i in part['indices']),'Fixed '+part['role']+' '+a['id'])
 for clump in spec['clumps']:
  if not clump.get('frond'):check(max(W[i*2] for i in clump['indices'])-min(W[i*2] for i in clump['indices'])<.000001,'Rigid leaf clump '+a['id'])
 if not spec.get('shrub'):check(spec['clearance']-(.05 if a['id'] in legacy and not legacy[a['id']]['config'].get('sharedAsset') else 0)>2.15,'Standard 2.15 m branch clearance '+a['id'])
 reversed_=degenerate=0
 for j in range(0,len(idx),3):
  vv=[P[i*3:i*3+3] for i in idx[j:j+3]];u=[vv[1][k]-vv[0][k] for k in range(3)];v=[vv[2][k]-vv[0][k] for k in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];normal=[sum(N[i*3+k] for i in idx[j:j+3]) for k in range(3)];reversed_+=sum(cross[k]*normal[k] for k in range(3))<-.000001;degenerate+=sum(x*x for x in cross)<1e-15
 check(reversed_==degenerate==0,'Winding and nondegenerate faces '+a['id'])
 rows.append(dict(id=a['id'],triangles=len(idx)//3,vertices=n,materials=1,heightMetres=hi[1],clearanceMetres=spec['clearance'],beforeTriangles=legacy.get(a['id'],{}).get('beforeTriangles'),windMaxMetres=a['wind']['maxDisplacementMetres']))
tx=next(t for t in new['textures'] if t['id']=='tree-canopies-v1');payload=base64.b64decode(tx['png']);check(len(payload)>0,'New atlas PNG')
report=dict(status='Passed',checkCount=len(checks),checks=checks,models=rows,atlas=dict(width=tx['width'],height=tx['height'],pngBytes=len(payload),rgba8MipBytes=round(tx['width']*tx['height']*4*4/3)),sharedDataBytes=(ROOT/'props/shared/assets.js').stat().st_size,sharedDataGzipBytes=len(zlib.compress((ROOT/'props/shared/assets.js').read_bytes())))
(OUT/'trees-source-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({k:report[k] for k in ['status','checkCount','atlas','sharedDataBytes','sharedDataGzipBytes']}))
