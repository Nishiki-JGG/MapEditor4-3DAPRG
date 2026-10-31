"""Authored low-poly hanging root; reuse the existing cave atlas unchanged."""
from pathlib import Path
import json,math,copy,subprocess,argparse
r=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
p=args.output;out=p.parent;out.mkdir(parents=True,exist_ok=True)
s=(r/'props/shared/cave-decor-data.js').read_text(encoding='utf-8');d=json.loads(s[s.index('{'):s.rindex('}')+1])
base=subprocess.check_output(['git','show','5651f75be2265792d81749ce1101ed57acca585a:props/shared/cave-decor-data.js'],cwd=r).decode('utf-8')

bd=json.loads(base[base.index('{'):base.rindex('}')+1]);old=next(a for a in bd['assets'] if a['id']=='cnd009');a=next(a for a in d['assets'] if a['id']=='cnd009');a.update(copy.deepcopy(old))
pos=[];ns=[];uv=[];col=[];tri=[]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def add(a,b):return [x+y for x,y in zip(a,b)]
def mul(a,v):return [x*v for x in a]
def norm(a):return mul(a,1/math.sqrt(sum(x*x for x in a)))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def tube(points,radii,n,offset):
 base=len(pos)//3;lengths=[0]
 for i in range(1,len(points)):lengths.append(lengths[-1]+math.dist(points[i-1],points[i]))
 for i,(c,rad) in enumerate(zip(points,radii)):
  tangent=norm(sub(points[min(i+1,len(points)-1)],points[max(0,i-1)]));u=norm(cross(tangent,[0,0,1]));v=cross(tangent,u)
  slope=(radii[min(i+1,len(points)-1)]-radii[max(0,i-1)])/(lengths[min(i+1,len(points)-1)]-lengths[max(0,i-1)])
  for j in range(n+1):
   th=2*math.pi*(j%n)/n+offset;radial=add(mul(u,math.cos(th)),mul(v,math.sin(th)));q=add(c,mul(radial,rad));pos.extend(q);ns.extend(norm(sub(radial,mul(tangent,slope))))
   uv.extend([.0117188+.2265624*j/n,.014+.220*lengths[i]/lengths[-1]]);col.extend([1,1,1])
 for i in range(len(points)-1):
  for j in range(n):
   a0=base+i*(n+1)+j;b0=a0+n+1
   tri.extend([a0,a0+1,b0,a0+1,b0+1,b0])
 # Closed ends, hard normal only at the buried attachment and tiny tapered tip.
 for i,sgn in [(0,-1),(len(points)-1,1)]:
  b=len(pos)//3;tangent=norm(sub(points[min(i+1,len(points)-1)],points[max(0,i-1)]));pos.extend(points[i]);ns.extend(mul(tangent,sgn));uv.extend([.125,.125]);col.extend([1]*3)
  for j in range(n):
   k=base+i*(n+1)+j;pos.extend(pos[k*3:k*3+3]);ns.extend(mul(tangent,sgn));uv.extend([.125+.04*math.cos(j*2*math.pi/n),.125+.04*math.sin(j*2*math.pi/n)]);col.extend([1]*3)
  for j in range(n):
   t=[b,b+1+j,b+1+(j+1)%n];tri.extend(t if sgn>0 else [t[0],t[2],t[1]])
# An asymmetric long root with a winding primary axis and subordinate descending branches.
# Roots emerge through a fissure; this is a compact artistic subset, not a botanical species claim.
tube([[.01,0,-.10],[-.04,-.26,-.13],[-.075,-.55,-.07],[.005,-.88,.04],[.08,-1.23,.13],[.055,-1.60,.12],[-.02,-1.96,.05],[-.035,-2.30,.035]],[.075,.066,.052,.043,.032,.023,.012,.0025],5,.27)
tube([[-.075,-.55,-.07],[-.20,-.78,-.005],[-.31,-1.05,.10],[-.35,-1.34,.15],[-.31,-1.64,.13],[-.28,-1.88,.09]],[.038,.032,.025,.018,.009,.002],4,.48)
tube([[.065,-1.13,.105],[.18,-1.34,.035],[.26,-1.58,-.045],[.28,-1.83,-.095],[.25,-2.05,-.10]],[.029,.026,.019,.010,.0018],4,.16)
tube([[-.30,-1.05,.095],[-.20,-1.29,.20],[-.15,-1.49,.26]],[.012,.006,.0015],3,.6)
lo=[min(pos[i::3]) for i in range(3)];hi=[max(pos[i::3]) for i in range(3)]
oldlo=[min(old['positions'][i::3]) for i in range(3)];oldhi=[max(old['positions'][i::3]) for i in range(3)];scale=[(oldhi[i]-oldlo[i])/(hi[i]-lo[i]) for i in range(3)]
for j in range(len(pos)//3):
 for i in range(3):pos[j*3+i]=oldlo[i]+(pos[j*3+i]-lo[i])*scale[i]
 ns[j*3:j*3+3]=norm([ns[j*3+i]/scale[i] for i in range(3)])
for k,v in [('positions',pos),('normals',ns),('uv',uv),('colors',col)]:a[k]=[round(x,7) for x in v]
a['triangles']=tri
assert a['material']==old['material'] and a['pivot']==old['pivot']
assert all(x==y for x,y in zip(d['assets'],bd['assets']) if x['id']!='cnd009') and d['textures']==bd['textures']
p.write_text(s[:s.index('{')]+json.dumps(d,ensure_ascii=False,separators=(',',':'))+s[s.rindex('}')+1:],encoding='utf-8',newline='\n')
report={'triBefore':len(old['triangles'])//3,'triAfter':len(tri)//3,'vertices':len(pos)//3,'bounds':[oldlo,oldhi],'texturesUnchanged':True,'other19Unchanged':True,'source':'https://caves.org/virtualcave/roots/','referenceImagesCopied':False}
(out/'geometry.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
