from pathlib import Path
import json,base64,io,os
from PIL import Image
r=Path(os.environ['POT_REVIEW_PROJECT'])
a=json.loads((r/'Input99-before/small_props.json').read_text());b=json.loads((r/'Input99-after2/small_props.json').read_text())
im=[];size=[]
for d in [a,b]:
 raw=base64.b64decode(d['atlas']['png']);size.append(len(raw));im.append(Image.open(io.BytesIO(raw)).convert('RGBA'))
assert im[0].size==im[1].size==(1024,512)
changed=0
for y in range(512):
 for x in range(1024):
  if im[0].getpixel((x,y))!=im[1].getpixel((x,y)):
   assert 832<=x<960 and 256<=y<384,(x,y)
   changed+=1
for d in [a,b]:
 d['assets']=[x for x in d['assets'] if x['id'] not in ['storagepot','brokenpot']];d.pop('atlas')
assert a==b
d={'pass':True,'unrelatedPayloadExact':True,'allExistingAtlasPixelsExact':True,'onlyNewCell':[832,256,128,128],'changedPixels':changed,'atlasPngBytes':size,'extraRuntimeTextureBytes':0}
(r/'Evidence99Web/atlas-checks.json').write_text(json.dumps(d,indent=2));print(json.dumps(d))
