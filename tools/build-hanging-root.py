"""Authored low-poly hanging root; reuse the existing cave atlas unchanged."""
from pathlib import Path
import json,math,copy,subprocess,argparse
r=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
p=args.output;out=p.parent;out.mkdir(parents=True,exist_ok=True)
s=(r/'props/shared/cave-decor-data.js').read_text(encoding='utf-8');d=json.loads(s[s.index('{'):s.rindex('}')+1])
base=subprocess.check_output(['git','show','eb2fd8240db59bf9ecb87ca564e0b38c2e8f0b37:props/shared/cave-decor-data.js'],cwd=r).decode('utf-8')

bd=json.loads(base[base.index('{'):base.rindex('}')+1]);old=next(a for a in bd['assets'] if a['id']=='cnd008');a=next(a for a in d['assets'] if a['id']=='cnd008');a.update(copy.deepcopy(old))
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
# A coarse root descending from a ceiling fissure; side roots emerge inside it and curve downward.
tube([[-.02,0,-.04],[-.037,-.19,-.048],[-.014,-.38,-.041],[.031,-.61,-.024],[.02,-.84,-.002],[-.023,-1.04,.004],[-.01,-1.25,.021]],[.055,.046,.039,.032,.024,.013,.003],5,.27)
tube([[-.018,-.32,-.041],[-.125,-.46,-.005],[-.207,-.62,.014],[-.26,-.79,.018],[-.278,-.94,.021]],[.031,.027,.019,.009,.002],4,.48)
tube([[.022,-.62,-.019],[.125,-.73,-.051],[.205,-.86,-.058],[.245,-1.00,-.037],[.25,-1.13,-.018]],[.025,.021,.014,.008,.0015],4,.16)
# One subordinate hair-root, not a dense mesh fringe.
tube([[-.125,-.46,-.005],[-.135,-.63,.003],[-.165,-.78,.008]],[.009,.004,.001],3,.6)
lo=[min(pos[i::3]) for i in range(3)];hi=[max(pos[i::3]) for i in range(3)]
oldlo=[min(old['positions'][i::3]) for i in range(3)];oldhi=[max(old['positions'][i::3]) for i in range(3)];scale=[(oldhi[i]-oldlo[i])/(hi[i]-lo[i]) for i in range(3)]
for j in range(len(pos)//3):
 for i in range(3):pos[j*3+i]=oldlo[i]+(pos[j*3+i]-lo[i])*scale[i]
 ns[j*3:j*3+3]=norm([ns[j*3+i]/scale[i] for i in range(3)])
for k,v in [('positions',pos),('normals',ns),('uv',uv),('colors',col)]:a[k]=[round(x,7) for x in v]
a['triangles']=tri
assert a['material']==old['material'] and a['pivot']==old['pivot']
assert all(x==y for x,y in zip(d['assets'],bd['assets']) if x['id']!='cnd008') and d['textures']==bd['textures']
p.write_text(s[:s.index('{')]+json.dumps(d,ensure_ascii=False,separators=(',',':'))+s[s.rindex('}')+1:],encoding='utf-8',newline='\n')
report={'triBefore':len(old['triangles'])//3,'triAfter':len(tri)//3,'vertices':len(pos)//3,'bounds':[oldlo,oldhi],'texturesUnchanged':True,'other19Unchanged':True,'source':'https://caves.org/virtualcave/roots/','referenceImagesCopied':False}
(out/'geometry.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
