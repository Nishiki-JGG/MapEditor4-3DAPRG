from pathlib import Path
import json,base64,hashlib,os
import numpy as np
from PIL import Image
r=Path(__file__).resolve().parents[2];out=Path(os.environ['CHEST_AUTHOR_OUT']);out.mkdir(parents=True,exist_ok=True)
source=Path(os.environ['CHEST_GOLD_ATLAS_INPUT'])
old=np.array(Image.open(source/'packed.png'));packed=old.copy();roles=np.array(Image.open(source/'part-masks.png'))
v,u=np.mgrid[:184,:504].astype(float);u/=503;v/=183;x=u*1.1-.55
plain=np.all(roles[324:508,4:508,:3]==[159,132,66],axis=2)
# Actual hoop geometry: centre -0.40m, width .043m. Exclude raised ornaments/studs.
band=plain&(abs(x+.40)<.0215);plate=plain&(x>-.3785)&(x<-.235)
def noise(x,y,seed):
 ix=np.floor(x);iy=np.floor(y);a=x-ix;c=y-iy;a=a*a*(3-2*a);c=c*c*(3-2*c)
 def h(q,w):
  z=np.sin(q*127.1+w*311.7+seed*19.3)*43758.5453
  return z-np.floor(z)
 return (h(ix,iy)*(1-a)+h(ix+1,iy)*a)*(1-c)+(h(ix,iy+1)*(1-a)+h(ix+1,iy+1)*a)*c
def feather(mask):
 d=np.where(mask,8.,0.)
 for _ in range(8):
  q=np.pad(d,1);d=np.minimum(d,np.minimum.reduce([q[:-2,1:-1],q[2:,1:-1],q[1:-1,:-2],q[1:-1,2:]])+1)
 t=np.clip((d-1)/4,0,1);return t*t*(3-2*t)
section=packed[324:508,4:508];details={}
for name,mask,width,start,seed in [('band',band,.043,-.4215,305),('plate',plate,.1435,-.3785,509)]:
 local=(x-start)/width;fade=feather(mask);cloud=noise(local*1.8+.27,v*3.3,seed)
 # Band is worked along its curved length; neighbouring plate has a calmer broad haze.
 grain=noise(local*(5 if name=='band' else 4),v*(4 if name=='band' else 18),seed+7)
 height=(cloud-.5)*(.00018 if name=='band' else .00035)+(grain-.5)*(.00005 if name=='band' else .00011)
 dy,dx=np.gradient(height);tilt=np.stack((-dx*503/1.1,-dy*183/.88),2)*fade[:,:,None];tilt=np.clip(tilt,-.03,.03)
 normal=np.rint((.5+tilt*.5)*255).astype(np.uint8)
 section[:,:,:2]=np.where(mask[:,:,None],normal,section[:,:,:2])
 rough=old[324:508,4:508,2]/255+(cloud-.5)*(.32 if name=='band' else .18)*fade+(grain-.5)*.025*fade
 section[:,:,2]=np.where(mask,np.rint(np.clip(rough,.12,.85)*255).astype(np.uint8),section[:,:,2])
 details[name]={'pixels':int(mask.sum()),'maxTilt':float(abs(tilt).max()),'physicalXRange':[start,start+width]}
Image.fromarray(packed).save(out/'packed.png');mask=np.zeros((512,512,3),np.uint8);mask[324:508,4:508,0]=band*255;mask[324:508,4:508,1]=plate*255;Image.fromarray(mask).save(out/'scope-mask.png')
descriptor=json.loads((r/'props/chest-gold-data.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'));original_colour=descriptor['colour']['png'];descriptor['packed']['png']=base64.b64encode((out/'packed.png').read_bytes()).decode();descriptor['means'][19]=float(packed[324:508,4:508,2].mean()/255)
(out/'chest-gold-data.js').write_bytes(('window.TDChestGoldData='+json.dumps(descriptor,separators=(',',':'))+';\n').encode())
allowed=np.zeros((512,512),bool);allowed[324:508,4:508]=band|plate;changed=np.any(old!=packed,2);assert not np.any(changed&~allowed)
(out/'scope.json').write_text(json.dumps({'recipe':'legacy gold lid finish','colourSHA256':hashlib.sha256(base64.b64decode(original_colour)).hexdigest(),'colourUnchanged':True,'frontUnchanged':True,'nativeTested':False,'changedPackedPixels':int(changed.sum()),'pngBytes':(out/'packed.png').stat().st_size,'parts':details},indent=2),encoding='utf-8')
