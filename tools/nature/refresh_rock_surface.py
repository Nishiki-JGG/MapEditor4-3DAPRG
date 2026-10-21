"""Re-use the existing rock grain, replacing broad looping dark ridges with mineral grain.

Geometry/model versions and all other shared assets remain unchanged. The texture
appearanceVersion records image revisions without changing the mesh import contract.
"""
import argparse,base64,hashlib,io,json,re
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);ap.add_argument('--output',type=Path)
    a=ap.parse_args();p=a.repo/'props/shared/assets.js'
    data=json.loads(re.search(r'=\s*(\{.*\})\s*;',p.read_text(encoding='utf-8'),re.S).group(1))
    tx=next(t for t in data['textures'] if t['id']=='rock-basecolor-v1')
    # Use a frozen original only as a source, not the previously generated result.
    source=a.repo/'tools/nature/rock-surface-source.png'
    if not source.exists():source=a.output/'rock-before.png'
    im=Image.open(source).convert('RGB');size=im.width
    raw=np.asarray(im,dtype=float).mean(axis=2)/255
    blurred=np.asarray(im.filter(ImageFilter.GaussianBlur(2.2)),dtype=float).mean(axis=2)/255
    grain=np.clip(raw-blurred,-.025,.025)
    rng=np.random.default_rng(20261023);yy,xx=np.mgrid[:size,:size]/size
    first=np.full((size,size),10.);second=first.copy();identity=np.zeros((size,size),dtype=int)
    # Periodic, slightly displaced fracture junctions: angular instead of looping contours.
    cells=6
    for j in range(cells):
        for i in range(cells):
            px=(i+.18+rng.random()*.64)/cells;py=(j+.18+rng.random()*.64)/cells
            dx=np.abs(xx-px);dy=np.abs(yy-py);dx=np.minimum(dx,1-dx);dy=np.minimum(dy,1-dy)
            dist=dx*dx+dy*dy;closer=dist<first
            second=np.where(closer,first,np.minimum(second,dist));first=np.where(closer,dist,first)
            identity=np.where(closer,j*cells+i,identity)
    edge=np.sqrt(second)-np.sqrt(first)
    crack=np.exp(-np.square(edge/.0018))
    tones=rng.uniform(-.018,.018,cells*cells)[identity]
    fine=rng.normal(0,.010,(size,size))
    value=np.clip(.80+grain*.18+tones+fine-crack*.12,.58,.9)
    # Cooler neutral grain offsets the existing warm vertex colour; vertex AO stays intact.
    rgb=np.clip(value[...,None]*np.array([.92,.965,1.025]),0,1)
    out=Image.fromarray(np.uint8(rgb*255));stream=io.BytesIO();out.save(stream,format='PNG',optimize=True)
    b=stream.getvalue();tx['png']=base64.b64encode(b).decode();tx['appearanceVersion']=2
    tx['recipe']='Existing procedural stone micrograin reused; periodic mineral cells and narrow fractures; tools/nature/refresh_rock_surface.py'
    p.write_text('// Authoritative shared mesh and appearance data; see docs/ROCK_SURFACE_REFRESH.md.\nwindow.TDSharedData = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
    if a.output:(a.output/'rock-after.png').write_bytes(b)
    print(json.dumps({'pngBytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'meanRGB':np.asarray(out).mean(axis=(0,1)).tolist(),'triangles':120}))

if __name__=='__main__':main()
