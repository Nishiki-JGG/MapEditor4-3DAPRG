"""Refresh the existing shared grass/soil tiles; no downloaded image inputs.

Grass reuses tools/nature/grass-source.js (the approved self-authored source).
The output keeps the shared material v3 contract and IDs. Run from any folder.
"""
import argparse, base64, hashlib, io, json, re
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

def noise(rng, size, cells):
    a=rng.random((cells,cells))
    p=np.arange(size)*cells/size; i=p.astype(int); f=p-i; f=f*f*(3-2*f)
    return ((a[i[:,None]%cells,i[None,:]%cells]*(1-f[None,:])+a[i[:,None]%cells,(i[None,:]+1)%cells]*f[None,:])*(1-f[:,None])+
            (a[(i[:,None]+1)%cells,i[None,:]%cells]*(1-f[None,:])+a[(i[:,None]+1)%cells,(i[None,:]+1)%cells]*f[None,:])*f[:,None])-.5

def object_from_js(path):
    return json.loads(re.search(r'=\s*(\{.*\})\s*;',path.read_text(encoding='utf-8'),re.S).group(1))

def periodic_polygon(draw, points, fill, size):
    # Only edge-crossing copies are drawn, avoiding seams without 9x all work.
    xs=[p[0] for p in points]; ys=[p[1] for p in points]
    dxs=[0]+([size] if min(xs)<0 else [])+([-size] if max(xs)>=size else [])
    dys=[0]+([size] if min(ys)<0 else [])+([-size] if max(ys)>=size else [])
    for dx in dxs:
        for dy in dys: draw.polygon([(x+dx,y+dy) for x,y in points],fill=fill)

def jpeg(image, quality):
    b=io.BytesIO(); image.save(b,format='JPEG',quality=quality,subsampling=0,optimize=True)
    return b.getvalue()

def grass(root):
    data=object_from_js(root/'terrain/grass.js')
    source=object_from_js(root/'tools/nature/grass-source.js')
    original=Image.open(io.BytesIO(base64.b64decode(source['png']))).convert('RGB')
    size=1024; rng=np.random.default_rng(20261021)
    base=np.asarray(original.resize((size,size),Image.Resampling.BICUBIC),dtype=float)
    # Keep the source's broad living/dry colour shapes, with less blurred contrast.
    mean=base.mean(axis=(0,1)); base=mean+(base-mean)*.68
    base=base*np.array([1.025,1.015,1.015])
    canvas=Image.fromarray(np.uint8(np.clip(base,0,255)))
    d=ImageDraw.Draw(canvas,'RGBA')
    centers=rng.uniform(0,size,(1050,2)); phases=rng.uniform(0,2*np.pi,1050)
    for n,(cx,cy) in enumerate(centers):
        # Neighbouring blades share a loose direction; individual clumps overlap.
        for k in range(int(rng.integers(13,26))):
            x=(cx+rng.normal(0,12))%size; y=(cy+rng.normal(0,12))%size
            angle=phases[n]+rng.normal(0,.75); length=rng.uniform(5,18); width=rng.uniform(.7,2.0)
            ux,uy=np.cos(angle),np.sin(angle); bend=rng.normal(0,length*.18)
            points=[(x-uy*width*.5,y+ux*width*.5),
                    (x+ux*length*.45-uy*(width*.65+bend),y+uy*length*.45+ux*(width*.65+bend)),
                    (x+ux*length,y+uy*length),
                    (x+ux*length*.45-uy*bend,y+uy*length*.45+ux*bend)]
            r=rng.random()
            color=(148,155,70,115) if r<.15 else (117,142,53,105) if r<.54 else (34,64,22,90)
            periodic_polygon(d,points,color,size)
    image=canvas.resize((512,512),Image.Resampling.LANCZOS)
    result=jpeg(image,93)
    data.update(width=512,height=512,imageBase64=base64.b64encode(result).decode(),mime='image/jpeg',
                recipe='Approved procedural source reused; directional overlapping grass clumps; seed 20261021; tools/nature/refresh_ground_textures.py',
                appearanceRevision=2)
    return data,result

def soil(root):
    data=object_from_js(root/'terrain/dirt.js'); size=1024; rng=np.random.default_rng(20261022)
    broad=noise(rng,size,9)*5+noise(rng,size,22)*6
    grain=noise(rng,size,110)*14+noise(rng,size,225)*8
    fine=(rng.random((size,size))-.5)*6
    rgb=np.array([133.,103.,71.])+((broad+grain+fine)[...,None]*np.array([1.,.88,.69]))
    image=Image.fromarray(np.uint8(np.clip(rgb,0,255))); d=ImageDraw.Draw(image,'RGBA')
    # Small irregular mineral/earth aggregates; no large repeated landmark stones.
    for k in range(6800):
        x,y=rng.uniform(0,size,2); radius=rng.uniform(.7,3.8); ry=radius*rng.uniform(.5,1.1)
        phase=rng.uniform(0,6.283185307); angles=np.linspace(0,2*np.pi,6,endpoint=False)+phase
        radii=rng.uniform(.7,1.15,6)
        points=[(x+np.cos(a)*radius*r,y+np.sin(a)*ry*r) for a,r in zip(angles,radii)]
        v=rng.random()
        color=(183,166,132,130) if v<.29 else (91,68,45,125) if v<.65 else (155,119,81,140)
        periodic_polygon(d,points,color,size)
    # Preserve the existing 256px Unity soil contract and its GPU-memory budget.
    image=image.resize((256,256),Image.Resampling.LANCZOS); result=jpeg(image,93)
    data.update(width=256,height=256,imageBase64=base64.b64encode(result).decode(),
                provenance='Self-authored periodic soil and mineral grain recipe; no external images; tools/nature/refresh_ground_textures.py',
                appearanceRevision=2)
    return data,result

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);ap.add_argument('--preview',type=Path)
    args=ap.parse_args();root=args.repo
    stats=[]
    for name,(data,image) in [('grass',grass(root)),('dirt',soil(root))]:
        prefix='window.TDGroundData' if name=='grass' else 'TDGroundData.dirt'
        target=root/'terrain'/f'{name}.js'
        target.write_text('// Shared ground texture; see docs/GROUND_TEXTURE_REFRESH.md.\n'+prefix+' = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
        if args.preview:
            args.preview.mkdir(parents=True,exist_ok=True);(args.preview/f'after-{name}.jpg').write_bytes(image)
        stats.append(dict(name=name,width=data['width'],height=data['height'],jpegBytes=len(image),sha256=hashlib.sha256(image).hexdigest(),tileMetres=data['tileMetres']))
    print(json.dumps(stats,indent=2))

if __name__=='__main__':main()
