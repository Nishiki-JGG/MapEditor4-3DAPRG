from pathlib import Path
import json,math,collections,subprocess
r=Path(__file__).resolve().parents[1]
def data(p):
 s=p;return json.loads(s[s.index('{'):s.rindex('}')+1])
b=data(subprocess.check_output(['git','show','43315a98da4a06c651ed0b17d39ab837721a2258:props/shared/cave-decor-data.js'],cwd=r).decode('utf8'));d=data((r/'props/shared/cave-decor-data.js').read_text(encoding='utf8'));a=d['assets'][13];old=b['assets'][13]
assert b['definitions']==d['definitions'] and b['textures']==d['textures'][:2] and len(d['textures'])==3
assert all(x==y for x,y in zip(b['assets'],d['assets']) if x['id'] not in ('cnd014','cnd009'))
assert old['material']=={**a['material'],'texture':'cave-decor-atlas-v1'} and old['pivot']==a['pivot']
p=[tuple(a['positions'][i:i+3]) for i in range(0,len(a['positions']),3)];n=[a['normals'][i:i+3] for i in range(0,len(a['normals']),3)];edges=collections.defaultdict(list);dots=[]
for i in range(0,len(a['triangles']),3):
 t=a['triangles'][i:i+3];v=[p[k] for k in t];x=[v[1][j]-v[0][j] for j in range(3)];y=[v[2][j]-v[0][j] for j in range(3)];c=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];area=math.sqrt(sum(z*z for z in c));assert area>1e-9
 for k in t:dots.append(sum(c[j]*n[k][j] for j in range(3))/area)
 for x,y in [(v[0],v[1]),(v[1],v[2]),(v[2],v[0])]:edges[tuple(sorted([x,y]))].append((x,y))
assert min(dots)>0,('frontface normal',min(dots))
assert all(len(x)==2 and x[0]==(x[1][1],x[1][0]) for x in edges.values()),'closed tube topology'
assert all(abs(sum(z*z for z in v)-1)<1e-5 for v in n)
for i in range(3):assert min(a['positions'][i::3])==min(old['positions'][i::3]) and max(a['positions'][i::3])==max(old['positions'][i::3])
assert all(0<=x<=1 for x in a['uv'])
print('PASS: closed volume, normals, UV atlas bounds, exact bounds/pivot/material parameters/old textures/other18')

# cnd009 is independently protected by long-root-static.py.
