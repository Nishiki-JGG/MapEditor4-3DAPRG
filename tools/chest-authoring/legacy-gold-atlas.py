"""Legacy gold fallback atlas authoring: rasterize actual parts into a bounded 512 atlas, then author linked maps.
No reference-image pixels, lighting bake, sample generation, or product writes.
"""
import json, math, base64, io, os, gzip
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter

INPUTS=Path(__file__).with_name('inputs')
OUT=Path(os.environ['CHEST_AUTHOR_OUT'])
OUT.mkdir(parents=True,exist_ok=True)
D=json.loads(gzip.decompress((INPUTS/'legacy-gold-mesh.json.gz').read_bytes()))
body=next(x for x in D['extraNativeAssetsV4'] if x['id']=='treasurechest_gold')
orn=next(x for x in D['chestOrnamentsV1'] if x['id']=='treasurechest_gold')
modes=next(x['modes'] for x in D['chestSurfacesV1']['ornamentsV1'] if x['id']=='treasurechest_gold')
# Top-left pixel origin, 4px gutters; front/back, left/right, full curved lid.
RECTS=[(0,0,256,192),(256,0,256,192),(0,192,256,128),(256,192,256,128),(0,320,512,192)]
PAD=4
roles=np.full((512,512),-1,np.int16);depth=np.full((512,512),-1e6,np.float32)

def project(p,face):
 x,y,z=p.T
 if face==0:return np.stack(((x+.55)/1.1,y/.433),1),z
 if face==1:return np.stack(((-x+.55)/1.1,y/.433),1),-z
 if face==2:return np.stack(((z+.36)/.72,y/.80),1),-x
 if face==3:return np.stack(((-z+.36)/.72,y/.80),1),x
 return np.stack(((x+.55)/1.1,np.arctan2(y-.435,-z)/math.pi),1),np.sqrt(((y-.435)/.274)**2+(z/.337)**2)

for mesh,mode in [(body,None),(orn['mesh'],np.array(modes))]:
 p=np.array(mesh['positions']).reshape(-1,3);p[:,2]*=-1
 n=np.array(mesh['normals']).reshape(-1,3);n[:,2]*=-1
 uv=np.array(mesh['uv']).reshape(-1,2);glow=np.array(mesh['glow'])
 for tri in np.array(mesh['triangles']).reshape(-1,3):
  pts=p[tri];mid=pts.mean(0);normal=n[tri].mean(0)
  if np.max(glow[tri])>.001:continue
  face=(2 if mid[0]<0 else 3) if abs(mid[0])>.48 and abs(normal[0])>.65 else 4 if mid[1]>.433 else 0 if mid[2]>=0 else 1
  if face<4 and abs(normal[2] if face<2 else normal[0])<.08:continue
  q,dep=project(pts,face);rx,ry,rw,rh=RECTS[face];q=q*np.array([rw-2*PAD-1,rh-2*PAD-1])+np.array([rx+PAD,ry+PAD])
  ax,ay=q[0];bx,by=q[1];cx,cy=q[2];den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
  if abs(den)<1e-8:continue
  x0=max(rx+PAD,int(np.floor(q[:,0].min())));x1=min(rx+rw-PAD-1,int(np.ceil(q[:,0].max())))
  y0=max(ry+PAD,int(np.floor(q[:,1].min())));y1=min(ry+rh-PAD-1,int(np.ceil(q[:,1].max())))
  if x0>x1 or y0>y1:continue
  yy,xx=np.mgrid[y0:y1+1,x0:x1+1];w0=((by-cy)*(xx-cx)+(cx-bx)*(yy-cy))/den;w1=((cy-ay)*(xx-cx)+(ax-cx)*(yy-cy))/den;w2=1-w0-w1
  z=w0*dep[0]+w1*dep[1]+w2*dep[2];valid=(w0>=-.001)&(w1>=-.001)&(w2>=-.001)&(z>depth[y0:y1+1,x0:x1+1])
  if mode is not None:
   m=int(round(float(mode[tri].mean())));role={0:3,1:1,2:2,3:6 if face>=2 else 3}.get(m,1)
   if np.mean(np.array(orn['finish'])[tri])>.5:role=5
  else:
   role=0
   if np.any(uv[tri,0]<-3):role=5
   elif face<2 and abs(mid[2])>.328:role=4
   elif face in (2,3) and abs(mid[0])>.52:role=4
   elif face==4 and np.mean(dep)>1.045:role=4
   if face==0 and abs(mid[0])<.006 and abs(mid[1]-.321)<.014 and mid[2]>.3867:role=7
  depth[y0:y1+1,x0:x1+1][valid]=z[valid];roles[y0:y1+1,x0:x1+1][valid]=role

def noise(x,y,seed):
 ix=np.floor(x);iy=np.floor(y);u=x-ix;v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v)
 def h(a,b):
  z=np.sin(a*127.1+b*311.7+seed*19.3)*43758.5453
  return z-np.floor(z)
 return (h(ix,iy)*(1-u)+h(ix+1,iy)*u)*(1-v)+(h(ix,iy+1)*(1-u)+h(ix+1,iy+1)*u)*v

def distance(mask,limit=12):
 d=np.where(mask,0.,float(limit));
 for _ in range(limit):
  a=np.pad(d,1,constant_values=limit)
  d=np.minimum(d,np.minimum.reduce([a[:-2,1:-1],a[2:,1:-1],a[1:-1,:-2],a[1:-1,2:]])+1)
 return d

colour=np.ones((512,512,4),np.uint8)*255;packed=colour.copy();packed[:,:,:2]=128;means=[]
for face,(rx,ry,rw,rh) in enumerate(RECTS):
 h,w=rh-2*PAD,rw-2*PAD;v,u=np.mgrid[0:h,0:w].astype(float);u/=w-1;v/=h-1
 rr=roles[ry+PAD:ry+rh-PAD,rx+PAD:rx+rw-PAD];rr=np.maximum(rr,0)
 plate=rr==0;cast=rr==1;edge=rr==2;recess=(rr==3)|(rr==6);band=rr==4;black=rr==5;keyhole=rr==7
 cloud=noise(u*3.1+.37,v*2.3,face+11);broad=noise(u*1.7,v*1.9+.3,face+71);worked=noise(u*18,v*13,face+31)
 raised=cast|edge|band|black;contact=np.exp(-distance(raised)/2.4)*plate
 boundary=np.zeros_like(rr,dtype=bool);boundary[:,1:]|=rr[:,1:]!=rr[:,:-1];boundary[1:,:]|=rr[1:,:]!=rr[:-1,:]
 boundary_distance=distance(boundary)
 # Contact/cavity and exposed wear follow actual rasterized part boundaries.
 patch=np.clip((noise(u*6.2,v*4.3,face+93)-.36)*2.0,0,1)
 wear=np.exp(-boundary_distance/1.4)*patch*(cast|edge|band)
 cavity=contact*.18+recess*.18+cast*np.exp(-boundary_distance/2.0)*(1-patch)*.055
 # Full intrinsic gold colour, authored per physical part instead of multiplying
 # almost-white noise over the entire vertex palette. All values are sRGB.
 palettes=np.array([[214,172,91],[201,155,73],[244,214,145],[100,76,38],[230,188,104],[24,28,34],[151,112,53],[104,75,32]],float)/255
 base=palettes[rr]
 tone=.80+.28*cloud+.06*(broad-.5)
 tone+=wear*.08-cavity*.45
 rgb=base*tone[:,:,None]
 # Broad tarnish has a subtle warm/cool hue shift; it is not baked illumination.
 oxide=(1-cloud)*(.035+.045*cast)+contact*.025
 rgb[...,0]+=oxide*.18;rgb[...,1]-=oxide*.16;rgb[...,2]-=oxide*.30
 rgb+=((worked-.5)*cast*.045)[:,:,None]
 rough=.34+.29*cloud+contact*.10
 rough=np.where(cast,.55+.18*cloud,rough);rough=np.where(edge,.25+.13*cloud,rough);rough=np.where(band,.26+.17*cloud,rough);rough=np.where(recess,.70+.13*cloud,rough);rough-=wear*.11
 # Shallow manufacturing texture. Normal detail never supplies the large colour layout.
 grain=noise(u*(4 if band.any() else 11),v*29,face+121)
 height=(.00013+.00034*cast)*worked+.00007*grain
 # Sparse strokes follow the face's band direction and remain inside that part mask.
 scratch=np.zeros((h,w))
 for k in range(12):
  sx=.08+.84*((k*.61803398875+face*.17)%1);sy=.10+.80*((k*.41421356+face*.23)%1);length=.035+.025*((k*.37)%1)
  dist=np.abs(u-sx);along=np.clip(1-np.abs(v-sy)/length,0,1)
  scratch=np.maximum(scratch,np.exp(-(dist/.0025)**2)*along*band*patch)
 rgb-=scratch[:,:,None]*.025;rough+=scratch*.055;height-=scratch*.00008
 dy,dx=np.gradient(height);mx=1.1 if face in (0,1,4) else .72;my=.433 if face<2 else .8 if face<4 else .88
 nx=-dx*w/mx;ny=-dy*h/my;nx[boundary_distance<2]=0;ny[boundary_distance<2]=0;length=np.sqrt(nx*nx+ny*ny+1)
 c=np.concatenate((np.rint(np.clip(rgb,0,1)*255).astype(np.uint8),np.full((h,w,1),255,np.uint8)),2)
 p=np.stack((np.rint((nx/length*.5+.5)*255),np.rint((ny/length*.5+.5)*255),np.rint(np.clip(rough,0,1)*255),np.full((h,w),255)),2).astype(np.uint8)
 c=np.array(Image.fromarray(c).filter(ImageFilter.GaussianBlur(.9)))
 colour[ry:ry+rh,rx:rx+rw]=np.pad(c,((PAD,PAD),(PAD,PAD),(0,0)),mode='edge');packed[ry:ry+rh,rx:rx+rw]=np.pad(p,((PAD,PAD),(PAD,PAD),(0,0)),mode='edge')
 lin=np.where(c[:,:,:3]/255<=.04045,c[:,:,:3]/255/12.92,((c[:,:,:3]/255+.055)/1.055)**2.4);means.append([*lin.mean((0,1)).tolist(),float(p[:,:,2].mean()/255)])

# V5 isolates colour/function corrections: retain the entire V4 normal/roughness map.
prior={'means':json.loads((INPUTS/'legacy-gold-means.json').read_text())}
packed=np.array(Image.open(INPUTS/'legacy-gold-packed.png'))
for i in range(5):means[i][3]=prior['means'][i][3]
images={}
for name,pixels in [('colour',colour),('packed',packed)]:
 image=Image.fromarray(pixels);image.save(OUT/(name+'.png'));buf=io.BytesIO();image.save(buf,format='PNG');images[name]=base64.b64encode(buf.getvalue()).decode()
palette=np.array([[159,132,66],[189,144,59],[246,218,144],[86,64,34],[218,180,87],[20,25,34],[151,112,53],[104,75,32]],np.uint8)
Image.fromarray(palette[np.maximum(roles,0)]).save(OUT/'part-masks.png')
recipe={'preserveKeyhole':True,'absoluteColour':True,'size':512,'rectangles':RECTS,'padding':PAD,'means':means,**images,'source':'actual gold Native geometry and ornament surface roles; no lighting bake'}
(OUT/'atlas.json').write_text(json.dumps(recipe));(OUT/'atlas.js').write_text('window.ChestGoldAuthoredAtlas='+json.dumps(recipe)+';')
print(json.dumps({'out':str(OUT),'pngBytes':{n:(OUT/(n+'.png')).stat().st_size for n in images},'nonGreyColourPixels':int(np.any(colour[:,:,0:1]!=colour[:,:,1:3],2).sum()),'roles':dict(zip(*[x.tolist() for x in np.unique(roles,return_counts=True)]))}))
