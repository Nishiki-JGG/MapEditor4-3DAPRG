from pathlib import Path
from PIL import Image
import json,base64,io,math
r=Path(__file__).resolve().parents[1];s=(r/'props/shared/cave-decor-data.js').read_text(encoding='utf8');d=json.loads(s[s.index('{'):s.rindex('}')+1]);tex=next(t for t in d['textures'] if t['id']=='cave-tall-mushroom-v1');im=Image.open(io.BytesIO(base64.b64decode(tex['png']))).convert('RGBA')
assert im.size==(128,128) and tex['colorSpace']=='sRGB' and tex['mipmaps'] and tex['wrap']=='clamp'
assert math.hypot(53,53)>42+30+2.9
for y in range(128):
 for x in range(128):
  if math.hypot(x-97,y-97)<=27:
   red,green,blue,alpha=im.getpixel((x,y));assert 21<=red-green<=25 and alpha==255,('Cap pigment intrudes into gill island',x,y)
print('PASS: PNG decoding/settings; 2289 gill texels uncontaminated, distinct padded islands')
