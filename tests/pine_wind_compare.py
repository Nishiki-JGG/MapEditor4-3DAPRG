import json,sys
from pathlib import Path
import numpy as np
from PIL import Image
out=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[2]/'pine-wind-evidence')
browser=json.loads((out/'browser-wind.json').read_text(encoding='utf-8'));unity=json.loads((out/'unity-wind.json').read_text(encoding='utf-8'));lib=json.loads((out/'shared_props.json').read_text(encoding='utf-8'));pine=next(a for a in lib['assets']if a['id']=='pine')
P=np.asarray(pine['positions']).reshape(-1,3);uv=np.asarray(pine['uv']).reshape(-1,2);trunk=uv[:,1]<=.5
checks=[]
def check(name,ok,detail=None):
 checks.append({'name':name,'status':'Passed'if ok else'Failed','detail':detail});assert ok,(name,detail)
check('Unity acceptance',unity['status']=='Passed',len(unity['checks']))
for b,u in zip(browser['cases'],unity['probes']):
 a=np.asarray(b['values']).reshape(-1,4)[:,:3];d=np.asarray(u['values']).reshape(-1,4)[:,:3];error=float(np.max(np.abs(a-d)));check('Cross GPU positions t='+str(b['time']),error<.00002,{'maxMetres':error})
 q=P*np.array([b['sx'],b['sy'],b['sx']]);co,si=np.cos(-b['rot']),np.sin(-b['rot']);expected=q.copy();expected[:,0]=co*q[:,0]+si*q[:,2]+2;expected[:,2]=-si*q[:,0]+co*q[:,2]+3
 check('Trunk remains fixed t='+str(b['time']),np.max(np.abs(a[trunk]-expected[trunk]))<.000002)
 check('All vertex heights fixed t='+str(b['time']),np.max(np.abs(a[:,1]-expected[:,1]))<.000002)
 if b['sy']==1:check('1.8m human clearance t='+str(b['time']),a[~trunk,1].min()>2.14999,float(a[~trunk,1].min()))
def img(name):return np.asarray(Image.open(out/name).convert('RGB'))
imageRows=[]
for engine in ['browser','unity']:
 static=img(engine+'-static.png');off=img(engine+'-off.png');check(engine+' no-wind equals static pixel for pixel',np.array_equal(static,off))
 for phase in ['phase-0','phase-1','phase-2','phase-3']:
  on=img(engine+'-'+phase+'.png');check(engine+' lower trunk/ground/human stays fixed '+phase,np.array_equal(off[-180:],on[-180:]))
 check(engine+' visible crown motion',np.any(off!=img(engine+'-phase-1.png')))
 shadow0=img(engine+'-shadow-0.0.png');shadow1=img(engine+'-shadow-1.5.png');roi=np.any(shadow0[350:560,680:950]!=shadow1[350:560,680:950],axis=2);check(engine+' ground shadow follows wind',np.count_nonzero(roi)>0,{'changedShadowRoiPixels':int(np.count_nonzero(roi))})
for phase in ['off','phase-0','phase-1','phase-2','phase-3']:
 a=img('browser-'+phase+'.png').astype(float);b=img('unity-'+phase+'.png').astype(float);mae=float(np.abs(a-b).mean());imageRows.append({'phase':phase,'mae255':mae});check('Reference image match '+phase,mae<2,mae)
report={'status':'Passed','checks':checks,'referenceImages':imageRows,'analyticBound':'normalized direction, strength<=1, smoothstep<=1, abs(.65sin+.35sin)<=1 -> horizontal displacement<=.12m; displacement.y=0 at every time','mobilePerformance':'NotRun'}
(out/'comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('Passed',len(checks),'checks')
