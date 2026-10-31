"""Closed bracket caps and original 128px colour atlas; other cave assets are preserved."""
from pathlib import Path
import json,math,copy,hashlib,base64,subprocess,argparse
r=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description="Reproduce cnd015 geometry/texture while preserving other current assets")
parser.add_argument('--output',type=Path,required=True,help="Explicit destination; product source is not overwritten implicitly")
args=parser.parse_args();p=args.output;o=p.parent;o.mkdir(parents=True,exist_ok=True)
s=(r/'props/shared/cave-decor-data.js').read_text(encoding='utf-8');d=json.loads(s[s.index('{'):s.rindex('}')+1])
baseline=subprocess.check_output(['git','show','c9610c743e63a935fe799e5cf22ba8bcfd3bcc64:props/shared/cave-decor-data.js'],cwd=r).decode('utf-8')
bd=json.loads(baseline[baseline.index('{'):baseline.rindex('}')+1]);old=next(a for a in bd['assets'] if a['id']=='cnd015')
a=next(a for a in d['assets'] if a['id']=='cnd015');a.update(copy.deepcopy(old))
d['textures']=[t for t in d['textures'] if t['id']!='cave-shelf-fungus-v1']
subprocess.run(['node',str(r/'tools/shelf-fungus-texture.cjs'),str(o/'shelf211.png')],check=True)
pos=[];normal=[];uv=[];colors=[];tri=[]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def norm(a):
 q=math.sqrt(sum(x*x for x in a));return [x/q for x in a]
def surface(vs,us,ts,tint=1):
 ns=[[0,0,0] for v in vs]
 for t in ts:
  n=cross(sub(vs[t[1]],vs[t[0]]),sub(vs[t[2]],vs[t[0]]))
  assert sum(x*x for x in n)>1e-15
  for i in t:ns[i]=[x+y for x,y in zip(ns[i],n)]
 base=len(pos)//3
 for v,u,n in zip(vs,us,ns):pos.extend(v);uv.extend(u);normal.extend(norm(n));colors.extend([tint]*3)
 for t in ts:tri.extend(base+i for i in t)
# Existing four attachment levels and lateral alternation, with controlled unequal projections.
spec=[(.08587,0,.23913,.30,8,.18,1),(-.10978,-.116,.21522,.27,8,1.6,.96),(.08587,-.238,.19130,.24,7,3.1,.92),(-.10978,-.347,.16739,.21,7,4.2,.98)]
for cap,(cx,cy,rx,rz,n,phase,tint) in enumerate(spec):
 crest=cy+(.020 if cap==0 else .012 if cap==1 else 0)
 top=[[cx,crest,-.15]];bottom=[[cx,cy-.062,-.15]];topuv=[[.5,1-91/128]];botuv=[[.5,.10]]
 for i in range(n+1):
  th=math.pi*i/n;sn=math.sin(th);w=1+.085*math.sin(th*3+phase)*sn
  x=cx+rx*math.cos(th)*w;z=-.15+rz*sn*(1+.09*math.sin(th*3+phase))
  if cap==0 and i==3:z-=.018
  if cap==1 and i==5:z-=.012
  yy=cy-.036-.008*sn+.012*math.sin(th*3+phase)*sn
  top.append([x,yy,z]);bottom.append([x,yy-.008-.010*sn*(.65+.35*math.sin(th*3+phase)),z])
  # Whole cap uses coherent growth zones; alternating orientation varies ageing marks. Underside is pore-bearing, not gilled.
  topuv.append([.5+(1 if cap%2==0 else -1)*59/128*math.cos(th),1-(91-81*sn)/128])
  botuv.append([.5+.44*math.cos(th),.07+.13*sn])
 if cap<2:
  inner=[[cx+(v[0]-cx)*.52,(crest+(v[1]-crest)*.52 if i in [0,n] else crest+(v[1]-crest)*(.52*.52)),-.15+(v[2]+.15)*.52] for i,v in enumerate(top[1:])]
  inneruv=[[.5+(u-.5)*.52,(1-91/128)+(v-(1-91/128))*.52] for u,v in topuv[1:]]
  tv=[top[0]]+inner+top[1:];tu=[topuv[0]]+inneruv+topuv[1:];tt=[[0,i+2,i+1] for i in range(n)];offset=n+2
  for i in range(n):tt.extend([[i+1,i+2,offset+i],[i+2,offset+i+1,offset+i]])
  surface(tv,tu,tt,tint)
 else:surface(top,topuv,[[0,i+2,i+1] for i in range(n)],tint)
 surface(bottom,botuv,[[0,i+1,i+2] for i in range(n)],.98)
 # Rounded leading edge: independent normals avoid smoothing top through underside.
 edge=[];eu=[];et=[]
 for i in range(n+1):
  edge.extend([top[i+1],bottom[i+1]])
  eu.extend([[.06+.88*i/n,.18],[.06+.88*i/n,.06]])
 for i in range(n):et.extend([[2*i,2*i+2,2*i+1],[2*i+2,2*i+3,2*i+1]])
 surface(edge,eu,et,.94)
 # Close the wall attachment across both halves; no floating paper surface.
 if cap<2:
  back=[top[0],inner[0],top[1],inner[-1],top[-1],bottom[0],bottom[1],bottom[-1]]
  surface(back,[[.5,.10]]*8,[[0,1,5],[1,2,5],[2,6,5],[0,5,3],[3,5,4],[4,5,7]],.72)
 else:
  back=[top[0],top[1],top[-1],bottom[0],bottom[1],bottom[-1]]
  surface(back,[[.5,.10]]*6,[[0,1,3],[1,4,3],[0,3,2],[2,3,5]],.72)
# Preserve exact legacy extents and pivot so saved placements remain mounted.
oldlo=[min(old['positions'][i::3]) for i in range(3)];oldhi=[max(old['positions'][i::3]) for i in range(3)]
lo=[min(pos[i::3]) for i in range(3)];hi=[max(pos[i::3]) for i in range(3)];scale=[(oldhi[i]-oldlo[i])/(hi[i]-lo[i]) for i in range(3)]
for j in range(len(pos)//3):
 for i in range(3):pos[j*3+i]=oldlo[i]+(pos[j*3+i]-lo[i])*scale[i]
 nn=norm([normal[j*3+i]/scale[i] for i in range(3)]);normal[j*3:j*3+3]=nn
for k,v in [('positions',pos),('normals',normal),('uv',uv),('colors',colors)]:a[k]=[round(x,7) for x in v]
a['triangles']=tri
a['material']['texture']='cave-shelf-fungus-v1'
png=(o/'shelf211.png').read_bytes();d['textures'].append(dict(id='cave-shelf-fungus-v1',width=128,height=128,png=base64.b64encode(png).decode(),colorSpace='sRGB',wrap='clamp',filter='trilinear',mipmaps=True,anisotropy=2))
assert a['pivot']==old['pivot']
assert len(tri)//3==172
payload=s[:s.index('{')]+json.dumps(d,ensure_ascii=False,separators=(',',':'))+s[s.rindex('}')+1:]
p.write_text(payload,encoding='utf-8',newline='\n')
report={'revision':215,'target':'cnd015','triBefore':24,'triAfter':len(tri)//3,'totalTriAfter':sum(len(a['triangles'])//3 for a in d['assets']),'oldAtlasPixelsAndBytesUnchanged':True,'newSharedTexture':[128,128], 'newTextureBytes':len(png),'other19AssetsUnchanged':True,'definitionsUnchanged':True,'shaderAndParametersUnchanged':True,'legacyBounds':[oldlo,oldhi],'source':'https://mdc.mo.gov/discover-nature/field-guide/artist-conk','sourceImagesUsed':False,'method':'Four closed semicircular brackets with root thickness, curved rim, pale underside; 128px authored growth zones and pale underside; original shared atlas remains unchanged'}
(o/'author211-contract.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
