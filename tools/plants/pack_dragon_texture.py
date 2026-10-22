"""Replace one procedural atlas cell; keep all other decoded RGBA pixels exact."""
import base64,io,json,sys
from PIL import Image
payload=json.loads(sys.stdin.buffer.read());data=payload['data']
texture=next(t for t in data['textures'] if t['id']=='tree-canopies-v1')
image=Image.open(io.BytesIO(base64.b64decode(texture['png']))).convert('RGBA')
tile=Image.open(io.BytesIO(base64.b64decode(payload['tile']))).convert('RGBA')
assert image.size==(1024,512) and tile.size==(256,128)
image.paste(tile,(512,384));out=io.BytesIO();image.save(out,format='PNG',compress_level=9)
texture['png']=base64.b64encode(out.getvalue()).decode('ascii')
sys.stdout.buffer.write(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
