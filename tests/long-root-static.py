from pathlib import Path
import json,math,collections,subprocess
r=Path(__file__).resolve().parents[1]
def data(p):
 s=p;return json.loads(s[s.index('{'):s.rindex('}')+1])
b=data(subprocess.check_output(['git','show','5651f75be2265792d81749ce1101ed57acca585a:props/shared/cave-decor-data.js'],cwd=r).decode('utf8'));d=data((r/'props/shared/cave-decor-data.js').read_text(encoding='utf8'));a=d['assets'][8];old=b['assets'][8]
assert b['definitions']==d['definitions'] and b['textures']==d['textures'] and len(d['textures'])==3
assert all(x==y for x,y in zip(b['assets'],d['assets']) if x['id']!='cnd009')
assert old['material']==a['material'] and old['pivot']==a['pivot']
p=[tuple(a['positions'][i:i+3]) for i in range(0,len(a['positions']),3)];n=[a['normals'][i:i+3] for i in range(0,len(a['normals']),3)];edges=collections.defaultdict(list);dots=[]
for i in range(0,len(a['triangles']),3):
 t=a['triangles'][i:i+3];v=[p[k] for k in t];x=[v[1][j]-v[0][j] for j in range(3)];y=[v[2][j]-v[0][j] for j in range(3)];c=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];area=math.sqrt(sum(z*z for z in c));assert area>1e-9
 for k in t:dots.append(sum(c[j]*n[k][j] for j in range(3))/area)
 for x,y in [(v[0],v[1]),(v[1],v[2]),(v[2],v[0])]:edges[tuple(sorted([x,y]))].append((x,y))
assert min(dots)>0,('frontface normal',min(dots))
assert all(len(x)==2 and x[0]==(x[1][1],x[1][0]) for x in edges.values()),'closed tube topology'
# Each disconnected closed shell must be outward-facing, not only the total volume.
adj=collections.defaultdict(set)
for key,oriented in edges.items():
 x,y=key;adj[x].add(y);adj[y].add(x)
components=[];remaining=set(p)
while remaining:
 stack=[next(iter(remaining))];group=set()
 while stack:
  q=stack.pop()
  if q in group:continue
  group.add(q);stack.extend(adj[q]-group)
 remaining-=group;components.append(group)
volumes=[]
for group in components:
 volume=0
 for i in range(0,len(a['triangles']),3):
  q=[p[j] for j in a['triangles'][i:i+3]]
  if q[0] not in group:continue
  cross=[q[1][1]*q[2][2]-q[1][2]*q[2][1],q[1][2]*q[2][0]-q[1][0]*q[2][2],q[1][0]*q[2][1]-q[1][1]*q[2][0]]
  volume+=sum(q[0][k]*cross[k] for k in range(3))/6
 assert volume>0,('inward shell',volume)
 volumes.append(volume)
assert len(volumes)==4
print('Outward shell volumes',volumes)
assert all(abs(sum(z*z for z in v)-1)<1e-5 for v in n)
for i in range(3):assert min(a['positions'][i::3])==min(old['positions'][i::3]) and max(a['positions'][i::3])==max(old['positions'][i::3])
assert all(.0117<=x<=.2383 for x in a['uv'])
assert len(a['triangles'])==558 and len(p)==155
print('PASS: closed volume, normals, UV atlas bounds, exact bounds/pivot/material parameters/old textures/other19')
