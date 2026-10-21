"""Pixel preservation and model-budget regression. Pillow only reads the images."""
import base64,io,json
from pathlib import Path
from PIL import Image
r=Path(__file__).resolve().parents[1];e=r.parent/'night-polish-evidence'
def read(root):
 s=(root/'props/shared/assets.js').read_text(encoding='utf-8');return json.loads(s[s.index(' = ')+3:].rstrip(';\n'))
before=read(e/'baseline');after=read(r);oldtx=next(t for t in before['textures'] if t['id']=='tree-canopies-v1');newtx=next(t for t in after['textures'] if t['id']=='tree-canopies-v1');a=Image.open(io.BytesIO(base64.b64decode(oldtx['png']))).convert('RGBA');b=Image.open(io.BytesIO(base64.b64decode(newtx['png']))).convert('RGBA')
assert a.size==b.size==(1024,512)
# The sword-leaf cell is previously unused; its one-pixel line antialiasing guard is included.
changed=alphaCrossings=maxDelta=0
for y in range(512):
 for x in range(1024):
  if 510<=x<785 and 383<=y<512:continue
  p,q=a.getpixel((x,y)),b.getpixel((x,y));delta=max(abs(v-t) for v,t in zip(p,q));maxDelta=max(maxDelta,delta);changed+=delta>0;alphaCrossings+=(p[3]>=.42*255)!=(q[3]>=.42*255)
  assert delta<=8,(x,y,p,q)
  if y<255:assert p==q,(x,y)
assert alphaCrossings==0,alphaCrossings
rows=[]
for id in ['eucalyptus','dragontree','elftree','worldtree']:
 old=next(v for v in before['assets'] if v['id']==id);new=next(v for v in after['assets'] if v['id']==id)
 for k in range(3):
  assert abs(min(old['positions'][k::3])-min(new['positions'][k::3]))<.000001,id
  assert abs(max(old['positions'][k::3])-max(new['positions'][k::3]))<.000001,id
 rows.append(dict(id=id,beforeTriangles=len(old['triangles'])//3,afterTriangles=len(new['triangles'])//3,beforeVertices=len(old['positions'])//3,afterVertices=len(new['positions'])//3))
report=dict(status='Passed',unchangedUpperFoliageCells=True,rerasterizedFringePixels=changed,maximumFringeByteDelta=maxDelta,alphaCutoffCrossings=alphaCrossings,textureBytesBefore=len(base64.b64decode(oldtx['png'])),textureBytesAfter=len(base64.b64decode(newtx['png'])),rows=rows)
(e/'polish-pixel-budget.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(report)
