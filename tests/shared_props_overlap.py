"""Estimate fern alpha-surviving overlap BEFORE depth rejection; not GPU/mobile timing.
python tests/shared_props_overlap.py <evidence directory>
Requires Pillow only for decoding the embedded PNG. No mesh or image is edited.
"""
from pathlib import Path
import base64, io, json, math, sys
from PIL import Image

out = Path(sys.argv[1])
data = json.loads((out / 'export/shared_props.json').read_text(encoding='utf-8'))
a = next(a for a in data['assets'] if a['id'] == 'fern')
t = next(t for t in data['textures'] if t['id'] == a['material']['texture'])
image = Image.open(io.BytesIO(base64.b64decode(t['png']))).convert('RGBA')
P, UV, I = a['positions'], a['uv'], a['triangles']
def norm(v):
    d = math.sqrt(sum(x*x for x in v)); return [x/d for x in v]
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
results=[]
for name, eye in [('front',[0,2.5,-6]),('back',[0,2.5,6]),('top',[0,6,-.01])]:
    w,h=256,160; fw=norm([-eye[0],.35-eye[1],-eye[2]]); right=norm(cross([0,1,0],fw)); up=cross(fw,right)
    verts=[]
    for k in range(0,len(P),3):
        p=P[k:k+3]; verts.append((w/2+dot(p,right)/6.4*w,h/2-dot([p[0],p[1]-.35,p[2]],up)/4*h))
    counts=[0]*(w*h); covered=0; candidates=0
    for k in range(0,len(I),3):
        ids=I[k:k+3]; v=[verts[i] for i in ids]; (x0,y0),(x1,y1),(x2,y2)=v
        den=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
        if abs(den)<1e-9: continue
        for y in range(max(0,int(min(p[1] for p in v))),min(h,int(max(p[1] for p in v))+1)):
            for x in range(max(0,int(min(p[0] for p in v))),min(w,int(max(p[0] for p in v))+1)):
                b0=((y1-y2)*(x+.5-x2)+(x2-x1)*(y+.5-y2))/den
                b1=((y2-y0)*(x+.5-x2)+(x0-x2)*(y+.5-y2))/den; b2=1-b0-b1
                if min(b0,b1,b2)<-1e-7: continue
                candidates+=1
                u=sum(b*UV[i*2] for b,i in zip((b0,b1,b2),ids)); vv=sum(b*UV[i*2+1] for b,i in zip((b0,b1,b2),ids))
                alpha=image.getpixel((max(0,min(image.width-1,int(u*image.width))),max(0,min(image.height-1,int((1-vv)*image.height)))))[3]/255
                if alpha>=a['material']['alphaCutoff']: counts[y*w+x]+=1;covered+=1
    visible=sum(c>0 for c in counts)
    results.append({'view':name,'raster':[w,h],'visiblePixels':visible,'alphaSurvivingFragments':covered,'meanLayersBeforeDepth':round(covered/max(visible,1),3),'maxLayersBeforeDepth':max(counts),'cutoutRejectedFraction':round(1-covered/max(candidates,1),3)})
report={'method':'orthographic software raster, nearest alpha sample; estimate before depth rejection, no mobile/GPU timings','fronds':11,'transparentBlending':False,'baselineGeometryAndAlphaUnchanged':True,'views':results}
(out/'overlap.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
