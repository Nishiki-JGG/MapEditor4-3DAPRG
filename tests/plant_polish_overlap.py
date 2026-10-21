"""CPU top projection: nearest alpha, no mipmaps/depth. Not GPU timing."""
import base64,io,json,subprocess
from pathlib import Path
import numpy as np
from PIL import Image
repo=Path(__file__).resolve().parents[1];out=repo.parent/'plant-polish-evidence'
parse=lambda b:json.loads(b.decode('utf-8').split('window.TDSharedData = ')[1].strip()[:-1])
old=parse(subprocess.check_output(['git','show','d289a6b:props/shared/assets.js'],cwd=repo));new=parse((repo/'props/shared/assets.js').read_bytes())
def measure(data,a,low,size,step):
    p=np.array(a['positions']).reshape(-1,3)[:,[0,2]];uv=np.array(a['uv']).reshape(-1,2);count=np.zeros((size[1],size[0]),dtype=np.uint16)
    tex=np.array(Image.open(io.BytesIO(base64.b64decode(next(t for t in data['textures'] if t['id']==a['material']['texture'])['png']))).convert('RGBA'))
    for tri in np.array(a['triangles']).reshape(-1,3):
        q=p[tri];lo=np.maximum(0,np.floor((q.min(axis=0)-low)/step).astype(int));hi=np.minimum(size-1,np.ceil((q.max(axis=0)-low)/step).astype(int))
        if (hi<lo).any():continue
        x,z=np.meshgrid(low[0]+(np.arange(lo[0],hi[0]+1)+.5)*step,low[1]+(np.arange(lo[1],hi[1]+1)+.5)*step)
        den=(q[1,1]-q[2,1])*(q[0,0]-q[2,0])+(q[2,0]-q[1,0])*(q[0,1]-q[2,1])
        if abs(den)<1e-12:continue
        u=((q[1,1]-q[2,1])*(x-q[2,0])+(q[2,0]-q[1,0])*(z-q[2,1]))/den;v=((q[2,1]-q[0,1])*(x-q[2,0])+(q[0,0]-q[2,0])*(z-q[2,1]))/den;w=1-u-v
        valid=(u>=0)&(v>=0)&(w>=0)
        if a['material']['alphaCutoff']:
            sample=u[...,None]*uv[tri[0]]+v[...,None]*uv[tri[1]]+w[...,None]*uv[tri[2]]
            tx=np.clip((sample[...,0]*tex.shape[1]).astype(int),0,tex.shape[1]-1);ty=np.clip(((1-sample[...,1])*tex.shape[0]).astype(int),0,tex.shape[0]-1)
            valid &= tex[ty,tx,3]/255>=a['material']['alphaCutoff']
        count[lo[1]:hi[1]+1,lo[0]:hi[0]+1]+=valid
    visible=count[count>0]
    return dict(meanLayers=float(visible.mean()),p95Layers=float(np.percentile(visible,95)),maxLayers=int(visible.max()),footprintM2=float(visible.size*step*step),summedLayerAreaM2=float(count.sum()*step*step))
rows=[]
for id in ['grass','reed','flowers','willow','bramble','ivy','sedge','foxglove','dock']:
    a=next(a for a in old['assets'] if a['id']==id);b=next(a for a in new['assets'] if a['id']==id);p=np.concatenate([np.array(a['positions']).reshape(-1,3),np.array(b['positions']).reshape(-1,3)])[:,[0,2]]
    low=p.min(axis=0)-.03;high=p.max(axis=0)+.03;step=max(float((high-low).max())/320,.004);size=np.ceil((high-low)/step).astype(int)
    rows.append(dict(id=id,before=measure(old,a,low,size,step),after=measure(new,b,low,size,step)))
report=dict(method=__doc__,rows=rows)
(out/'polish-overlap.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
