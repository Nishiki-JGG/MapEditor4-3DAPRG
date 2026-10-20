"""Compare actual captures. Albedo parity is asserted; lighting differences are reported."""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image

out=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2]/'ground-parity-evidence')
rows=[]
for distance in [7,17]:
 for mode in ['unlit','lit']:
  for repeat in ['single','mixed']:
   a=np.asarray(Image.open(out/f'browser-ground-{distance}m-{mode}-{repeat}.png').convert('RGB'),dtype=float)
   b=np.asarray(Image.open(out/f'unity-ground-{distance}m-{mode}-{repeat}.png').convert('RGB'),dtype=float)
   assert a.shape==b.shape==(800,1280,3)
   delta=np.abs(a-b);mae=float(delta.mean());corr=float(np.corrcoef(a.ravel(),b.ravel())[0,1])
   row={'distanceMetres':distance,'mode':mode,'repeat':repeat,'mae255':mae,'p99':float(np.percentile(delta,99)),'correlation':corr}
   if mode=='unlit':row['status']='Passed' if mae<1 and corr>.999 else 'Failed'
   else:row['status']='Reported lighting difference'
   rows.append(row)
report={'status':'Passed' if all(r['status']!='Failed' for r in rows) else 'Failed','criteria':'Unlit: identical extent/camera, MAE <1/255 and RGB correlation >.999. Lit: measured only, no assertion of identical PBR lighting.','images':rows}
(out/'cross-engine-images.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
assert report['status']=='Passed'

# Quantify exact 4m image repetition, independently of macro colour waves.
import base64,io
d=json.loads((out/'shared_ground.json').read_text(encoding='utf-8'))
im=np.asarray(Image.open(io.BytesIO(base64.b64decode(d['imageBase64']))).convert('RGB'),dtype=float)/255
x,z=np.meshgrid(np.arange(512)/32-8,np.arange(512)/32-8);u=x/d['tileMetres'];v=z/d['tileMetres']
def sample(u,v):
 px=(u%1)*512-.5;py=((1-v)%1)*512-.5;ix=np.floor(px).astype(int);iy=np.floor(py).astype(int);fx=(px-ix)[...,None];fy=(py-iy)[...,None]
 return (im[iy%512,ix%512]*(1-fx)+im[iy%512,(ix+1)%512]*fx)*(1-fy)+(im[(iy+1)%512,ix%512]*(1-fx)+im[(iy+1)%512,(ix+1)%512]*fx)*fy
single=sample(u,v);c,s=d['rotationCS'];w=d['secondWeight'];ox,oy=d['secondOffset'];mixed=single*(1-w)+sample(u*c-v*s+ox,u*s+v*c+oy)*w
metrics=[]
for name,a in [('single',single),('mixed',mixed)]:
 l=a@np.array([.2126,.7152,.0722]);metrics.append({'mode':name,'fourMetreShiftCorrelationX':float(np.corrcoef(l[:,128:].ravel(),l[:,:-128].ravel())[0,1]),'fourMetreShiftCorrelationZ':float(np.corrcoef(l[128:].ravel(),l[:-128].ravel())[0,1]),'lumaStd':float(l.std())})
(out/'repetition-metrics.json').write_text(json.dumps({'method':'CPU raw albedo, periodic bilinear reference. 16m area, 32 samples/m, macro omitted. Image-structure correlation, not a quality/performance score.','results':metrics},indent=2),encoding='utf-8')
