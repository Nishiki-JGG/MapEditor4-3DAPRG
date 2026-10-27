"""Gothic scope proof: map pixels, four wood renders, catalog and legacy payload.
Run after the actual browser captures; Pillow decodes pixels, never compares PNG encoding alone.
"""
import base64, io, json, os
from pathlib import Path
from PIL import Image, ImageChops
root=Path(__file__).resolve().parents[1]
base=root/'output/playwright/night-props'
folder=base/os.environ.get('GOTHIC_REGRESSION','batch29-regression')
before=json.loads((folder/'before-export/small_props.json').read_text(encoding='utf-8'))
after=json.loads((folder/'after-export/small_props.json').read_text(encoding='utf-8'))
checks=[]
for name in ['colour','packed']:
 images=[Image.open(io.BytesIO(base64.b64decode(x['chestSurfacesV1'][name]['png']))).convert('RGBA') for x in [before,after]]
 for tile in range(3):
  box=(tile%2*256,tile//2*256,tile%2*256+256,tile//2*256+256)
  assert images[0].crop(box).tobytes()==images[1].crop(box).tobytes(),(name,tile)
  checks.append(f'{name} tile {tile} exact')
 assert images[0].crop((256,256,512,512)).tobytes()!=images[1].crop((256,256,512,512)).tobytes()
 assert before['chestSurfacesV1']['means'][:12]==after['chestSurfacesV1']['means'][:12]
c=json.loads((folder/'contract.json').read_text(encoding='utf-8'))
metal={'treasurechest_silver','treasurechest_gold','treasurechest_rainbow'}
unchanged=0
for a,b in zip(c['results']['before']['catalog'],c['results']['after']['catalog']):
 if a['id'] not in metal:
  assert a==b,a['id'];unchanged+=1
assert unchanged==133
rows=[]
for id in ['treasurechest_worn','treasurechest','treasurechest_reinforced','treasurechest_ornate']:
 for view in ['close','top','overhead','cluster']:
  file=id+'-'+view+'.png'
  a=Image.open(base/'batch29-before'/file).convert('RGB');b=Image.open(base/'batch29-final-day'/file).convert('RGB')
  diff=ImageChops.difference(a,b);pixels=list(diff.get_flattened_data());n=sum(1 for px in pixels if px!=(0,0,0));maximum=max(max(px) for px in pixels)
  rows.append({'id':id,'view':view,'changedPixels':n,'maxChannelDelta':maximum,'exact':n==0});assert maximum<=2 and n/(a.width*a.height)<=.0001,(id,view,n,maximum)
r={'pass':True,'catalogsExactExceptThreeMaterialPrograms':unchanged,'unchangedAtlasTiles':checks,'woodRenderComparisons':rows,'renderTolerance':'At most 2/255 per channel and 0.01% pixels; not exact pixel equality. Prior version repeat also differs; see wood-baseline-repeat.json.','strictWoodRenderExact':all(r['exact'] for r in rows)}
(folder/'gothic-contract.json').write_text(json.dumps(r,indent=2),encoding='utf-8');print(json.dumps(r))
