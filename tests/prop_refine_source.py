import json,os,base64
from pathlib import Path
import numpy as np
repo=Path(__file__).resolve().parents[1];out=Path(os.environ.get('EVIDENCE_OUT',repo.parent/'prop-refine-evidence'))
def read(p):return json.loads(p.read_text(encoding='utf-8').split('window.TDSharedData = ')[1].strip()[:-1])
d=read(repo/'props/shared/assets.js');old=read(out/'baseline/props/shared/assets.js');review=json.loads((out/'before-review.json').read_text(encoding='utf-8'));ids=['log','stump','rootfan','driftwood','woodfence']
assert d['libraryVersion']=='shared-plants/6' and len(d['assets'])==32 and len(d['textures'])==6
assert d['textures'][:5]==old['textures']
for a in old['assets']:
 if a['id'] not in ids:assert next(x for x in d['assets'] if x['id']==a['id'])==a,a['id']
after_review=json.loads((out/'after-review.json').read_text(encoding='utf-8'))
rows=[]
for id in ids:
 a=next(a for a in d['assets'] if a['id']==id);before=next(b for b in review['meta'] if b['id']==id);p=np.array(a['positions']).reshape(-1,3);p[:,2]*=-1;n=np.array(a['normals']).reshape(-1,3);uv=np.array(a['uv']);t=np.array(a['triangles']).reshape(-1,3)
 assert np.isfinite(p).all() and np.isfinite(n).all() and (np.abs(np.linalg.norm(n,axis=1)-1)<1e-5).all()
 assert np.max(abs(p.min(axis=0)-before['lo']))<1e-6 and np.max(abs(p.max(axis=0)-before['hi']))<1e-6
 areas=np.linalg.norm(np.cross(p[t[:,1]]-p[t[:,0]],p[t[:,2]]-p[t[:,0]]),axis=1)/2;assert areas.min()>1e-10
 assert (uv>=0).all() and (uv<=1).all() and len(t)<=before['triangles'] and a['pivot']==[0,0,0]
 assert not a.get('motionWeights') and not a.get('wind') and not a.get('contact') and a['material']['alphaCutoff']==0 and not a['material']['doubleSided']
 after_config=next(x for x in after_review['meta'] if x['id']==id)['config']
 for key in ['name','r','offs','min','sc','slope','vis','anyGround','tags','height','touch','tree','canopy','sway']:assert before['config'].get(key)==after_config.get(key),(id,key)
 # A shared ring must not restart its longitudinal texture coordinate.
 surface={}
 pairs=np.array(a['uv']).reshape(-1,2)
 for point,coord in zip(p,pairs):
  bark=coord[0]<(.86 if id in ['driftwood','woodfence'] else .5)
  if not bark:continue
  key=tuple(np.round(point,5))+(round(float(coord[0]),5),)
  surface.setdefault(key,[]).append(float(coord[1]))
 for values in surface.values():assert max(values)-min(values)<1e-5,(id,'longitudinal UV seam')
 rows.append(dict(id=id,before=before['triangles'],after=len(t),delta=len(t)-before['triangles'],boundsErrorMetres=float(max(np.max(abs(p.min(axis=0)-before['lo'])),np.max(abs(p.max(axis=0)-before['hi']))))))
tex=d['textures'][-1];assert tex['width']==tex['height']==256 and tex['mipmaps'] and tex['filter']=='trilinear'
r=dict(status='Passed',unchangedAssets=27,oldTexturesUnchanged=5,rows=rows,triangleDelta=sum(x['delta'] for x in rows),newPNGBytes=len(base64.b64decode(tex['png'])),newTextureDimensions=[256,256]);(out/'refine-source-validation.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print(json.dumps(r,indent=2))
