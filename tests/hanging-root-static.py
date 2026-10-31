from pathlib import Path
import json,math,collections,subprocess
r=Path(__file__).resolve().parents[1]
def data(s):return json.loads(s[s.index('{'):s.rindex('}')+1])
b=data(subprocess.check_output(['git','show','eb2fd8240db59bf9ecb87ca564e0b38c2e8f0b37:props/shared/cave-decor-data.js'],cwd=r).decode('utf-8'));d=data((r/'props/shared/cave-decor-data.js').read_text(encoding='utf-8'));a=d['assets'][7];old=b['assets'][7]
assert b['definitions']==d['definitions'] and b['textures']==d['textures'][:2][:2]
assert all(x==y for x,y in zip(b['assets'],d['assets']) if x['id'] not in ('cnd008','cnd014','cnd009') # cnd014 covered by tall-mushroom-static.py
)
assert old['material']==a['material'] and old['pivot']==a['pivot']
p=[tuple(a['positions'][i:i+3]) for i in range(0,len(a['positions']),3)];n=[a['normals'][i:i+3] for i in range(0,len(a['normals']),3)];edges=collections.defaultdict(list);dots=[]
for i in range(0,len(a['triangles']),3):
 t=a['triangles'][i:i+3];v=[p[k] for k in t];x=[v[1][j]-v[0][j] for j in range(3)];y=[v[2][j]-v[0][j] for j in range(3)];c=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];area=math.sqrt(sum(z*z for z in c));assert area>1e-9
 for k in t:dots.append(sum(c[j]*n[k][j] for j in range(3))/area)
 for x,y in [(v[0],v[1]),(v[1],v[2]),(v[2],v[0])]:edges[tuple(sorted([x,y]))].append((x,y))
assert min(dots)>0,('frontface normal',min(dots))
assert all(len(x)==2 and x[0]==(x[1][1],x[1][0]) for x in edges.values()),'closed tube topology'
assert all(abs(sum(z*z for z in v)-1)<1e-5 for v in n)
for i in range(3):assert min(a['positions'][i::3])==min(old['positions'][i::3]) and max(a['positions'][i::3])==max(old['positions'][i::3])
assert all(.0117<=x<=.2383 for x in a['uv'])
print('PASS: closed volume, normals, UV atlas bounds, exact bounds/pivot/material/textures/other17')

# cnd009 is independently protected by long-root-static.py.
