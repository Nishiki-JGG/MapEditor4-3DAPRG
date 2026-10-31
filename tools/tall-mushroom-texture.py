"""Original 128px mushroom atlas: broad irregular pigment, radial gills, stipe fibres."""
from pathlib import Path
from PIL import Image
import math,sys
out=Path(sys.argv[1]);out.parent.mkdir(parents=True,exist_ok=True)
im=Image.new('RGBA',(128,128),(164,141,108,255))
def clamp(x):return max(0,min(255,round(x)))
def rnd(x,y):
 n=(x*374761393+y*668265263+93563)&0xffffffff;n=((n^(n>>13))*1274126177)&0xffffffff;return ((n^(n>>16))&65535)/65535
def noise(x,y,s):
 x/=s;y/=s;ix=math.floor(x);iy=math.floor(y);u=x-ix;v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v)
 return ((rnd(ix,iy)*(1-u)+rnd(ix+1,iy)*u)*(1-v)+(rnd(ix,iy+1)*(1-u)+rnd(ix+1,iy+1)*u)*v)*2-1
for y in range(128):
 for x in range(128):
  if math.hypot(x-44,y-44)<=42:
   dx=(x-44)/40;dy=(y-44)/40;r=math.hypot(dx,dy);t=math.atan2(dy,dx)
   cloud=noise(x,y,18)*15+noise(x+73,y-25,6)*8
   grain=noise(x,y,1.6)*2.5
   edge=max(0,min(1,(r-.82+noise(x,y,10)*.055)/.15))*12
   fibers=math.cos(29*t+.8*math.sin(r*7))*max(0,min(1,(r-.68)*4))*1.5
   v=cloud+grain+edge+fibers
   c=(162+v,119+v*.93,77+v*.76)
  elif math.hypot(x-97,y-97)<=30:
   dx=(x-97)/28;dy=(y-97)/28;r=math.hypot(dx,dy);t=math.atan2(dy,dx)
   phase=t*29+.2*math.sin(t*7)+.09*math.sin(r*8+t*3)
   ridge=max(0,math.cos(phase))**6
   short=max(0,math.cos(phase*2+.3))**10*max(0,min(1,(r-.56)*3))
   g=-59*ridge-17*short+2*noise(x,y,4);center=-14*math.exp(-r*r/.018)
   c=(207+g+center,184+g+center,145+g*.9+center)
  elif y>93 and x<60:
   t=(y-96)/29;f=5*math.sin(x*1.3+.4*math.sin(y*.2))+2.5*math.sin(x*2.9+y*.05)+noise(x,y,4)*3
   soil=max(0,min(1,(t-.66)/.34))*21
   c=(192+f-soil,168+f-soil,129+f-soil*.8)
  else:c=(172,144,105)
  im.putpixel((x,y),tuple(clamp(v) for v in c)+(255,))
im.save(out,optimize=True);print(out.name,out.stat().st_size)
