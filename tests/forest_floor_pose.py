"""Offline worst-case deformation check using the shader's maximum shared offset."""
import json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root.parent/'forest-floor-polish-evidence'
s=(root/'props/shared/assets.js').read_text(encoding='utf-8');data=json.loads(s[s.index(' = ')+3:].rstrip(';\n'));rows=[]
def sub(a,b):return [a[i]-b[i] for i in range(3)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm(a):return math.sqrt(sum(v*v for v in a))
for a in data['assets']:
 if a['id'] not in ['fern','bramble','ivy']:continue
 P=[a['positions'][i:i+3] for i in range(0,len(a['positions']),3)];w=a['motionWeights'][::2];limit=a['wind'].get('maxCombinedDisplacementMetres',a['wind']['maxDisplacementMetres']+a['contact']['maxDisplacementMetres']);minCos=1;maxStretch=1;minLength=1
 for direction in range(8):
  ang=direction*math.pi/4;Q=[[v[0]+math.cos(ang)*limit*w[i],v[1],v[2]+math.sin(ang)*limit*w[i]] for i,v in enumerate(P)]
  for j in range(0,len(a['triangles']),3):
   ix=a['triangles'][j:j+3];p=[P[k] for k in ix];q=[Q[k] for k in ix];n=cross(sub(p[1],p[0]),sub(p[2],p[0]));m=cross(sub(q[1],q[0]),sub(q[2],q[0]));cos=sum(v*t for v,t in zip(n,m))/(norm(n)*norm(m));minCos=min(minCos,cos)
   for e in range(3):
    ratio=norm(sub(q[e],q[(e+1)%3]))/norm(sub(p[e],p[(e+1)%3]));maxStretch=max(maxStretch,ratio);minLength=min(minLength,ratio)
 assert minCos>0 and maxStretch<1.5 and minLength>.5,(a['id'],minCos,maxStretch,minLength)
 rows.append(dict(id=a['id'],minimumFaceCosine=minCos,maximumEdgeLengthRatio=maxStretch,minimumEdgeLengthRatio=minLength,offsetMetres=limit))
report=dict(status='Passed',note='Conservative full envelope at strength 1, eight horizontal directions; per-vertex shared wind/contact weights, fixed anchors, full displacement envelope.',rows=rows)
(out/'floor-worst-pose.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('Passed',len(rows),'models; largest edge ratio',max(v['maximumEdgeLengthRatio'] for v in rows),'smallest',min(v['minimumEdgeLengthRatio'] for v in rows))
