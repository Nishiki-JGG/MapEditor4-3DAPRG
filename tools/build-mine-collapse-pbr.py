"""Reproducible Rock050 derivative. Requires Python, NumPy and Pillow; no network."""
from pathlib import Path
import argparse, base64, gzip, hashlib, json
import numpy as np
from PIL import Image

ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
expected={'Color':'6d0e6458909008a46efe1b2dffe92bfde48880c8f7003aa2174e1153478ab2a1','NormalGL':'d2e47f8a790d8185cee45ff888e59c730cf001c37908ca6f15585fe8d5ac20e9','Roughness':'5b8fecae5a08356a3aaf2b404ea6506e56e6ed5f84aedcdc903a33eaaae72988','AmbientOcclusion':'9343cd1507b1d7a930b81ac3570237de7d287c0979beb1c72eb86bfe73edc25d'}
raw={}
for name,digest in expected.items():
 p=args.source/f'Rock050_1K-JPG_{name}.jpg';assert hashlib.sha256(p.read_bytes()).hexdigest()==digest,name
 raw[name]=np.asarray(Image.open(p).convert('RGB'),dtype=np.float32)/255
raw['Color']=np.where(raw['Color']<=.04045,raw['Color']/12.92,((raw['Color']+.055)/1.055)**2.4)
raw['NormalGL']=raw['NormalGL']*2-1
def mip(a,n):return np.stack([np.asarray(Image.fromarray(a[:,:,c]).resize((n,n),Image.Resampling.BOX)) for c in range(3)],axis=-1)
def sample(a,u,v):
 n=a.shape[0];x=(u%1)*n-.5;y=((1-v)%1)*n-.5;ix=np.floor(x).astype(int);iy=np.floor(y).astype(int);fx=(x-ix)[...,None];fy=(y-iy)[...,None]
 return (a[iy%n,ix%n]*(1-fx)+a[iy%n,(ix+1)%n]*fx)*(1-fy)+(a[(iy+1)%n,ix%n]*(1-fx)+a[(iy+1)%n,(ix+1)%n]*fx)*fy
maps={k:np.zeros((256,512,4),dtype=np.uint8) for k in ['colour','normal','packed']}
yy,xx=np.mgrid[0:256,0:256];u=(xx+.5)/256;v=(yy+.5)/256
for fresh in [False,True]:
 x=((u-.05)/.9-.5)*2.5;y=((v-.05)/.9*1.2-.6) if fresh else (v-.04)/.92*1.85
 if fresh:x=np.where(x<=.12,.12+(x-.12)/1.25,.12+(x-.12)/np.sqrt(1+.15**2))
 a={k:sample(mip(b,256),x/2.4+.5,y/2.4+.1) for k,b in raw.items()}
 c=a['Color'];n=a['NormalGL'];ao=a['AmbientOcclusion'][:,:,0];rough=a['Roughness'][:,:,0]
 if fresh:
  # Broken mineral surface: remove lichen chroma, soften weathered dark fissures,
  # retain source grain rather than inventing repeated chips or baked highlights.
  grey=np.sum(c*np.array([.2126,.7152,.0722]),axis=-1,keepdims=True)
  broad=sample(mip(raw['Color'],32),x/2.4+.5,y/2.4+.1)
  bg=np.sum(broad*np.array([.2126,.7152,.0722]),axis=-1,keepdims=True)
  c=(grey*.78+c*.22)*.76+bg*.24;c*=1.06
  n[:,:,:2]*=.70;ao=.65+.35*ao;rough=.15+.85*rough
 else:rough=.10+.90*rough
 c=np.where(c<=.0031308,c*12.92,1.055*np.maximum(c,0)**(1/2.4)-.055)
 n/=np.maximum(np.linalg.norm(n,axis=-1,keepdims=True),1e-6)
 s=slice(256 if fresh else 0,512 if fresh else 256)
 maps['colour'][:,s,:3]=np.rint(np.clip(c,0,1)*255).astype('uint8');maps['colour'][:,s,3]=255
 maps['normal'][:,s,:3]=np.rint(np.clip(n*.5+.5,0,1)*255).astype('uint8');maps['normal'][:,s,3]=255
 maps['packed'][:,s,1]=np.rint(np.clip(ao,0,1)*255).astype('uint8');maps['packed'][:,s,3]=np.rint(np.clip(1-rough,0,1)*255).astype('uint8')
raw_bytes=b''.join(maps[k].tobytes() for k in ['colour','normal','packed']);payload=gzip.compress(raw_bytes,compresslevel=9,mtime=0)
args.output.mkdir(parents=True,exist_ok=True)
descriptor={'version':1,'width':512,'height':256,'bytes':len(raw_bytes),'gzip':base64.b64encode(payload).decode()}
(args.output/'mine-collapse-pbr.js').write_text('// Derived from ambientCG Rock050, CC0-1.0. See docs/mine-collapse/ROCK050.md.\nwindow.TDMineCollapsePBR='+json.dumps(descriptor,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
for k,data in maps.items():Image.fromarray(data).save(args.output/(k+'.png'))
print(json.dumps({'rawBytes':len(raw_bytes),'compressedBytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}))
