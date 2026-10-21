"""Check existing asset preservation, patch geometry and fixed ground anchors."""
import json,os
from pathlib import Path
import numpy as np
repo=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('EVIDENCE_OUT',repo.parent/'meadow-evidence'))
def read(p):return json.loads(p.read_text(encoding='utf-8').split('window.TDSharedData = ')[1].strip()[:-1])
data=read(repo/'props/shared/assets.js');old=read(out/'baseline/props/shared/assets.js')
assert data['libraryVersion']=='shared-plants/5' and len(data['assets'])==30
assert data['textures']==old['textures']
assert data['assets'][:25]==old['assets']
rows=[]
for a in data['assets'][25:]:
 p=np.array(a['positions']).reshape(-1,3);n=np.array(a['normals']).reshape(-1,3);uv=np.array(a['uv']).reshape(-1,2);w=np.array(a['motionWeights']).reshape(-1,2);t=np.array(a['triangles']).reshape(-1,3)
 assert np.isfinite(p).all() and np.isfinite(n).all() and np.isfinite(w).all()
 assert (np.abs(np.linalg.norm(n,axis=1)-1)<1e-5).all()
 assert p[:,1].min()==0 and (w>=0).all() and (w<=1).all() and (w[p[:,1]<.01]==0).all()
 assert (uv>=0).all() and (uv<=1).all() and len(t)<600
 areas=np.linalg.norm(np.cross(p[t[:,1]]-p[t[:,0]],p[t[:,2]]-p[t[:,0]]),axis=1)/2
 assert areas.min()>1e-10
 assert a['material']['alphaCutoff']==0 and a['material']['doubleSided'] and a['material']['texture']=='woodland-plants-atlas-v1'
 rows.append(dict(id=a['id'],triangles=len(t),heightMetres=float(p[:,1].max()),minimumTriangleArea=float(areas.min()),fixedRootVertices=int((w[:,0]==0).sum()),weightBytes=int(w.size*4)))
report=dict(status='Passed',oldAssetsUnchanged=25,oldTexturesUnchanged=5,rows=rows,newTriangles=sum(r['triangles'] for r in rows),newTextureBytes=0)
(out/'meadow-source-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
