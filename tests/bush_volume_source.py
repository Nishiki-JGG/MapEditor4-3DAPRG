import json,math,sys,gzip
from pathlib import Path
r=Path(__file__).resolve().parents[1];out=Path(sys.argv[1] if len(sys.argv)>1 else r.parent/'bush-volume-evidence')
def load(p):return json.loads(p.read_text(encoding='utf-8').split('window.TDSharedData = ')[1].strip().removesuffix(';'))
new=load(r/'props/shared/assets.js');old=load(out/'sparse/props/shared/assets.js');checks=[]
def check(ok,name):checks.append(name);assert ok,name
check([a['id']for a in new['assets']]==[a['id']for a in old['assets']] and len(new['assets'])==50,'All shared IDs/order retained')
check(new['textures']==old['textures'],'Seven atlas bytes and samplers retained')
for a,b in zip(new['assets'],old['assets']):
 if a['id']!='bush':check(a==b,'Protected entire asset '+a['id'])
a=next(a for a in new['assets']if a['id']=='bush');b=next(a for a in old['assets']if a['id']=='bush');n=len(a['positions'])//3
for key in ['assetKey','pivot','wind','contact','groundContact','deformation']:check(a[key]==b[key],'Preserved '+key)
check(a['version']==2 and len(a['triangles'])//3<=256,'Version two curved leaf budget')
check(a['material']==dict(texture='woodland-plants-atlas-v1',baseColor=[1,1,1,1],lighting='lambert',alphaCutoff=.42,doubleSided=True),'One cutout material with matching shared atlas')
for key,size in [('positions',3),('normals',3),('colors',3),('uv',2),('motionWeights',2)]:check(len(a[key])==n*size and all(math.isfinite(x)for x in a[key]),'Finite complete '+key)
check(all(0<=x<=1 for k in ['uv','motionWeights']for x in a[k]),'UV/weight ranges')
check(all(abs(sum(x*x for x in a['normals'][i:i+3])-1)<4e-6 for i in range(0,n*3,3)),'Unit normals')
check(all(isinstance(i,int)and 0<=i<n for i in a['triangles']),'Valid indices')
check(all(a['motionWeights'][i*2]==a['motionWeights'][i*2+1]==0 for i in range(n)if a['positions'][i*3+1]<=.04),'Fixed root and base')
check(all(abs(f(a['positions'][j::3])-f(b['positions'][j::3]))<1e-6 for j in range(3)for f in [min,max]),'Exact previous placement bounds')
for name in ['app.js','props/bush.js','terrain/paving-mask.js','props/shared/root-surface.js','props/shared/pine-wind.js','unity/Assets/MapSharedProps/Runtime/SharedRootSurface.hlsl','unity/Assets/MapSharedProps/Runtime/SharedPlantContact.cs']:
 check((r/name).read_text(encoding='utf-8')==(out/'sparse'/name).read_text(encoding='utf-8'),'Protected runtime '+name)
report=dict(status='Passed',checks=len(checks),triangles=len(a['triangles'])//3,vertices=n,materials=1,newImages=0,previousTriangles=len(b['triangles'])//3,bytes=(r/'props/shared/assets.js').stat().st_size,gzipBytes=len(gzip.compress((r/'props/shared/assets.js').read_bytes())))
(out/'bush-source-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
