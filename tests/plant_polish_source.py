"""Check the fixed art budget and boundaries against the published baseline."""
import base64
import io
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image

repo=Path(__file__).resolve().parents[1]
out=repo.parent/'plant-polish-evidence'
parse=lambda b:json.loads(b.decode('utf-8').split('window.TDSharedData = ')[1].strip()[:-1])
old=parse(subprocess.check_output(['git','show','d289a6b:props/shared/assets.js'],cwd=repo))
new=parse((repo/'props/shared/assets.js').read_bytes())
assert old.keys()==new.keys() and old['libraryVersion']==new['libraryVersion']=='shared-plants/2'
assert [a['id'] for a in old['assets']]==[a['id'] for a in new['assets']]
assert [t['id'] for t in old['textures']]==[t['id'] for t in new['textures']]
rows=[]
for before,a in zip(old['assets'],new['assets']):
    p=np.array(a['positions']).reshape(-1,3);n=np.array(a['normals']).reshape(-1,3);uv=np.array(a['uv']).reshape(-1,2);ix=np.array(a['triangles']).reshape(-1,3)
    assert np.isfinite(p).all() and np.isfinite(n).all() and np.isfinite(uv).all()
    assert np.max(abs(np.linalg.norm(n,axis=1)-1))<1e-5
    if next(t for t in new['textures'] if t['id']==a['material']['texture'])['wrap']=='clamp':
        assert np.min(uv)>=0 and np.max(uv)<=1,a['id']
    assert abs(np.min(p[:,1]))<1e-6,a['id']
    assert np.min(np.linalg.norm(np.cross(p[ix[:,1]]-p[ix[:,0]],p[ix[:,2]]-p[ix[:,0]]),axis=1))>1e-9
    assert len(a['triangles'])==len(before['triangles'])
    assert a['material']==before['material'] and a['assetKey']==before['assetKey'] and a['version']==before['version']
    if a['id'] in ['rock','fern','pine','log','stump','rootfan','birch','willow','scotspine','hazel','horsetail']:
        assert a==before,a['id']+' must be preserved'
    if a['id'] in ['grass','reed','flowers']:
        for key in ['minY','maxDisplacementMetres','uvMin']:assert a['wind'][key]==before['wind'][key]
        assert abs(a['wind']['maxY']-np.max(p[:,1]))<1e-6
    rows.append(dict(id=a['id'],changed=a!=before,trianglesBefore=len(before['triangles'])//3,trianglesAfter=len(ix),materials=1,heightBefore=max(before['positions'][1::3]),heightAfter=float(np.max(p[:,1]))))
textures=[]
for b,t in zip(old['textures'],new['textures']):
    if t['id']!='woodland-plants-atlas-v1':assert b==t
    assert {k:v for k,v in t.items() if k!='png'}=={k:v for k,v in b.items() if k!='png'}
    raw=base64.b64decode(t['png']);im=Image.open(io.BytesIO(raw));assert im.size==(t['width'],t['height'])
    if t['id']=='woodland-plants-atlas-v1':
        previous=np.array(Image.open(io.BytesIO(base64.b64decode(b['png']))));current=np.array(im)
        assert np.array_equal(previous[:256,:256],current[:256,:256]) and np.array_equal(previous[256:],current[256:])
    textures.append(dict(id=t['id'],pngBefore=len(base64.b64decode(b['png'])),pngAfter=len(raw),width=t['width'],height=t['height']))
for s in json.loads((out/'new-source.json').read_text(encoding='utf-8')):
    if s.get('tree'):assert s['clearanceMin']>=2.1
report=dict(status='Passed',baseline='d289a6b',rows=rows,textures=textures,totalTrianglesBefore=sum(len(a['triangles'])//3 for a in old['assets']),totalTrianglesAfter=sum(len(a['triangles'])//3 for a in new['assets']),allTriangleCountsPreserved=True)
(out/'polish-source.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
