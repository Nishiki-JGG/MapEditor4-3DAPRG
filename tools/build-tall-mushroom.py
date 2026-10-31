"""Three authored mushrooms; existing cap/gill/stipe atlas regions only."""
from pathlib import Path
import json,math,copy,subprocess,base64,sys,argparse
r=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
p=args.output;out=p.parent;out.mkdir(parents=True,exist_ok=True)
s=(r/'props/shared/cave-decor-data.js').read_text(encoding='utf8');d=json.loads(s[s.index('{'):s.rindex('}')+1])
base=subprocess.check_output(['git','show','43315a98da4a06c651ed0b17d39ab837721a2258:props/shared/cave-decor-data.js'],cwd=r).decode('utf8')

bd=json.loads(base[base.index('{'):base.rindex('}')+1]);old=next(a for a in bd['assets'] if a['id']=='cnd014');a=next(a for a in d['assets'] if a['id']=='cnd014');a.update(copy.deepcopy(old))
pos=[];uv=[];col=[];tri=[];groups=[]
def vert(p,t,c=(1,1,1)):
 i=len(pos)//3;pos.extend(p);uv.extend(t);col.extend(c);return i
def cap(cx,cz,h,rx,rz,n,tilt,phase,tone):
 # Slightly eccentric convex canopy, broad shoulder, curled lip and closed underside.
 b=len(pos)//3;top=vert([cx+.01*rx,h,cz-.02*rz],[44/128,1-44/128],tone)
 rings=[]
 for rr,drop in [(.48,.12),(.85,.48),(1,.88),(.96,1)]:
  ids=[]
  for j in range(n):
   t=2*math.pi*j/n;w=1+.035*math.sin(3*t+phase)+.018*math.cos(2*t-phase);x=rr*rx*w*math.cos(t);z=rr*rz*w*math.sin(t);y=h-drop*rx*.56+tilt[0]*x+tilt[1]*z+.008*rr*math.sin(2*t+phase)
   tex=[(44+40*rr*math.cos(t))/128,1-(44+40*rr*math.sin(t))/128]
   ids.append(vert([cx+x,y,cz+z],tex,tone if drop<1 else (1,1,1)))
  rings.append(ids)
 for j in range(n):tri.extend([top,rings[0][(j+1)%n],rings[0][j]])
 for i in range(3):
  for j in range(n):
   k=(j+1)%n;tri.extend([rings[i][j],rings[i][k],rings[i+1][j],rings[i][k],rings[i+1][k],rings[i+1][j]])
 # Separate normals/UV at the underside rim, retaining geometric closure.
 under=[]
 for j in range(n):
  t=2*math.pi*j/n;under.append(vert(pos[rings[3][j]*3:rings[3][j]*3+3],[(97+27*math.cos(t))/128,1-(97+27*math.sin(t))/128]))
 bottom=vert([cx,h-rx*.50,cz],[97/128,1-97/128])
 for j in range(n):tri.extend([bottom,under[j],under[(j+1)%n]])
 groups.append((b,len(pos)//3,'cap'))
 return [cx,h-rx*.50+.006,cz]
def stem(base,tip,rad,phase):
 b=len(pos)//3;rs=[];n=5 if rad>.015 else 4
 for k,t in enumerate([0,.48,1]):
  c=[base[i]*(1-t)+tip[i]*t for i in range(3)];c[0]+=.018*math.sin(math.pi*t)*math.cos(phase);c[2]+=.015*math.sin(math.pi*t)*math.sin(phase)
  radk=rad*[1.1,.87,.76][k];ring=[]
  for j in range(n):
   th=2*math.pi*j/n+.3;ring.append(vert([c[0]+radk*math.cos(th),c[1],c[2]+radk*math.sin(th)],[(5+48*j/(n-1))/128,1-(124-27*t)/128]))
  rs.append(ring)
 for k in range(2):
  for j in range(n):
   q=(j+1)%n;tri.extend([rs[k][j],rs[k+1][j],rs[k][q],rs[k][q],rs[k+1][j],rs[k+1][q]])
 for k,sgn in [(0,-1),(2,1)]:
  center=vert([sum(pos[i*3+c] for i in rs[k])/n for c in range(3)],[29/128,1-110/128]);ends=[]
  for i in rs[k]:ends.append(vert(pos[i*3:i*3+3],[29/128,1-110/128]))
  for j in range(n):
   t=[center,ends[(j+1)%n],ends[j]];tri.extend(t if sgn>0 else [t[0],t[2],t[1]])
 groups.append((b,len(pos)//3,'stem'))
for args,base,rad in [((-.18,.002,.6273,.157,.179,9,(.12,.03),.3,(1,1,1)),[-.13,0,.014],.017),((.208,.116,.3745,.109,.125,7,(-.18,.07),1.4,(.95,.97,1)),[.111,0,.062],.012),((-.028,-.164,.2612,.070,.084,6,(.15,-.08),2.2,(.94,.96,.98)),[.010,0,-.143],.0085)]:
 tip=cap(*args);stem(base,tip,rad,args[7])
# Keep existing outer bounds and floor anchor exactly; no definition changes.
lo=[min(pos[i::3]) for i in range(3)];hi=[max(pos[i::3]) for i in range(3)];oldlo=[min(old['positions'][i::3]) for i in range(3)];oldhi=[max(old['positions'][i::3]) for i in range(3)];sc=[(oldhi[i]-oldlo[i])/(hi[i]-lo[i]) for i in range(3)]
for j in range(len(pos)//3):
 for i in range(3):pos[j*3+i]=oldlo[i]+(pos[j*3+i]-lo[i])*sc[i]
ns=[0.]*len(pos)
for i in range(0,len(tri),3):
 ids=tri[i:i+3];v=[pos[j*3:j*3+3] for j in ids];u=[v[1][k]-v[0][k] for k in range(3)];w=[v[2][k]-v[0][k] for k in range(3)];n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]
 for j in ids:
  for k in range(3):ns[j*3+k]+=n[k]
for j in range(len(pos)//3):
 n=ns[j*3:j*3+3];ln=math.sqrt(sum(x*x for x in n));assert ln>1e-10;ns[j*3:j*3+3]=[x/ln for x in n]
for k,v in [('positions',pos),('normals',ns),('uv',uv),('colors',col)]:a[k]=[round(x,7) for x in v]
a['triangles']=tri
subprocess.run([sys.executable,str(Path(__file__).with_name('tall-mushroom-texture.py')),str(out/'mushroom224.png')],check=True)
a['material']['texture']='cave-tall-mushroom-v1'
png=(out/'mushroom224.png').read_bytes();d['textures']=[t for t in d['textures'] if t['id']!='cave-tall-mushroom-v1'];d['textures'].append(dict(id='cave-tall-mushroom-v1',width=128,height=128,png=base64.b64encode(png).decode(),colorSpace='sRGB',wrap='clamp',filter='trilinear',mipmaps=True,anisotropy=2))
assert all(x==y for x,y in zip(d['assets'],bd['assets']) if x['id']!='cnd014') and d['textures'][:2]==bd['textures'] and d['definitions']==bd['definitions']
p.write_text(s[:s.index('{')]+json.dumps(d,ensure_ascii=False,separators=(',',':'))+s[s.rindex('}')+1:],encoding='utf8',newline='\n')
report={'triBefore':len(old['triangles'])//3,'triAfter':len(tri)//3,'vertices':len(pos)//3,'bounds':[oldlo,oldhi],'oldTexturesUnchanged':True,'newTextureBytes':len(png),'newTextureRGBA8MipEstimate':87381,'other19Unchanged':True,'groups':groups,'source':'https://www.anbg.gov.au/fungi/what-is-fungus.html','imagesCopied':False}
(out/'geometry.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report))
