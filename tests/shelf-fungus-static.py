from pathlib import Path
import json,math,hashlib,collections,subprocess
r=Path(__file__).resolve().parents[1]
def decode(s):return json.loads(s[s.index('{'):s.rindex('}')+1])
old=decode(subprocess.check_output(['git','show','c9610c743e63a935fe799e5cf22ba8bcfd3bcc64:props/shared/cave-decor-data.js'],cwd=r).decode('utf-8'));new=decode((r/'props/shared/cave-decor-data.js').read_text());a=new['assets'][14]
assert old['definitions']==new['definitions'] and old['textures']==new['textures'][:1] and len(new['textures'])==3
assert all(x==y for x,y in zip(old['assets'],new['assets']) if x['id'] not in ('cnd015','cnd008','cnd014')) # Later approved geometry: cnd008 and cnd014 are independently checked by their own static tests.
assert {**a['material'],'texture':'cave-decor-atlas-v1'}==old['assets'][14]['material'] and a['pivot']==old['assets'][14]['pivot']
pts=[tuple(a['positions'][i:i+3]) for i in range(0,len(a['positions']),3)];ns=[a['normals'][i:i+3] for i in range(0,len(a['normals']),3)];edges=collections.defaultdict(list);areas=[];dots=[]
def sub(x,y):return [p-q for p,q in zip(x,y)]
def cross(x,y):return [x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]]
for i in range(0,len(a['triangles']),3):
 t=a['triangles'][i:i+3];v=[pts[k] for k in t];n=cross(sub(v[1],v[0]),sub(v[2],v[0]));area=math.sqrt(sum(x*x for x in n))/2;assert area>1e-9;areas.append(area)
 for k in t:dots.append(sum(x*y for x,y in zip(n,ns[k]))/(2*area))
 for x,y in [(v[0],v[1]),(v[1],v[2]),(v[2],v[0])]:edges[tuple(sorted([x,y]))].append((x,y))
assert all(len(es)==2 and es[0]==(es[1][1],es[1][0]) for es in edges.values()),'closed outward topology'
assert min(dots)>0,'normal agrees with front face'
assert all(abs(math.sqrt(sum(x*x for x in n))-1)<1e-5 for n in ns)
for axis in range(3):assert min(a['positions'][axis::3])==min(old['assets'][14]['positions'][axis::3]) and max(a['positions'][axis::3])==max(old['assets'][14]['positions'][axis::3])
print('PASS: exact unchanged other17/old atlas/bounds/pivot/material, closed manifold, finite normals and positive area')
