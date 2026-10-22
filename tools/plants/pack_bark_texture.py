"""Pack procedural bark and the broadleaf cell; preserve every other RGBA pixel."""
import base64,io,json,sys
from PIL import Image
p=json.loads(sys.stdin.buffer.read());d=p['data'];t=next(t for t in d['textures'] if t['id']=='tree-canopies-v1')
image=Image.open(io.BytesIO(base64.b64decode(t['png']))).convert('RGBA');tile=Image.open(io.BytesIO(base64.b64decode(p['png']))).convert('RGBA')
assert image.size==tile.size==(1024,512)
for x,y,w,h in p['cells'].values():image.paste(tile.crop((x,y,x+w,y+h)),(x,y))
# Only the procedural broadleaf cell changes; other cells remain exact.
if 'leafPng' in p:
 leaf=Image.open(io.BytesIO(base64.b64decode(p['leafPng']))).convert('RGBA').crop((0,0,256,256))
 image.paste(leaf,(0,0))
b=io.BytesIO();image.save(b,format='PNG',compress_level=9);t['png']=base64.b64encode(b.getvalue()).decode('ascii')
sys.stdout.buffer.write(json.dumps(d,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
