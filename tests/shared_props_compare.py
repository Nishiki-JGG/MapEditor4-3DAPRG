"""Compare actual diagnostic renders. No lighting inference from a lit image alone.
python tests/shared_props_compare.py <evidence directory>
"""
from pathlib import Path
import json, sys
import numpy as np
from PIL import Image

root=Path(sys.argv[1])
def load(name):
    a=np.asarray(Image.open(root/name).convert('RGB'),dtype=np.float64)
    assert a.shape==(640,1024,3),(name,a.shape)
    return a
checks=[]
def check(name,ok,detail):
    checks.append({'name':name,'status':'Passed' if ok else 'Failed','detail':detail})
bg=np.array([184,196,204]); ground=np.array([146,156,156])
b,u=load('browser-orientation.png'),load('unity-urp-orientation.png')
expected=[(432,240,[255,0,0]),(592,240,[0,255,0]),(432,400,[0,0,255]),(592,400,[255,255,0]),(375,200,[255,255,255])]
corners=[]
for x,y,rgb in expected:
    corners.append({'pixel':[x,y],'expected':rgb,'browser':b[y,x].tolist(),'unity':u[y,x].tolist()})
check('Asymmetric PNG orientation and L marker',all(max(abs(b[y,x]-rgb))<2 and max(abs(u[y,x]-rgb))<2 for x,y,rgb in expected),corners)
b,u=load('browser-unlit.png'),load('unity-urp-unlit.png')
bm=np.max(abs(b-bg),axis=2)>8;um=np.max(abs(u-bg),axis=2)>8
iou=(bm&um).sum()/max(1,(bm|um).sum());core=(bm&um);core[:,560:]=False
for _ in range(2):core=core&np.roll(core,1,0)&np.roll(core,-1,0)&np.roll(core,1,1)&np.roll(core,-1,1)
diff=abs(b[core]-u[core]);corr=float(np.corrcoef(b[core].flatten(),u[core].flatten())[0,1]);mae=float(diff.mean());p99=float(np.percentile(diff,99))
check('Unlit silhouettes overlap',iou>.99,{'IoU':float(iou)})
check('Rock UV/image mapping without lights or vertex colour',corr>.99 and mae<2,{'interiorPixels':int(core.sum()),'RGB_MAE_255':mae,'RGB_P99_255':p99,'correlation':corr})
contacts=[]
ground_pixels=[]
for engine in ['browser','unity-urp']:
    for asset in ['rock','fern']:
        a=load(engine+'-ground-'+asset+'.png');mask=np.max(abs(a-bg),axis=2)>8;mask[480:]=False
        bottom=int(np.where(mask)[0].max());gap=480-bottom-1
        contacts.append({'engine':engine,'asset':asset,'groundRow':480,'lowestVisibleRow':bottom,'gapPixels':gap})
        ground_pixels.append({'engine':engine,'asset':asset,'pixel':[10,495],'RGB':a[495,10].tolist(),'aboveRow479':a[479,10].tolist(),'upperEdgeRow480':a[480,10].tolist()})
check('Visible contact at actual y=0',all(0<=r['gapPixels']<=1 for r in contacts),contacts)
check('Actual ground reference is visibly rendered at row 480',all(max(abs(np.array(r['RGB'])-bg))>8 and max(abs(np.array(r['aboveRow479'])-bg))<3 and max(abs(np.array(r['upperEdgeRow480'])-np.array(r['RGB'])))<3 for r in ground_pixels),ground_pixels)
plant=[]
for engine in ['browser','unity-urp']:
    for mode in ['plant-7m','plant-17m','plant-17m-shift']:
        a=load(engine+'-'+mode+'.png');mask=(a[:,:,1]>a[:,:,0]*1.12)&(a[:,:,1]>a[:,:,2]*1.08)
        ys,xs=np.where(mask);plant.append({'engine':engine,'mode':mode,'greenPixels':int(mask.sum()),'bbox':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())]})
report={'checks':checks,'plant':plant,'model':'Lambert diffuse only','lightingExcludedFromUVTest':True,'referenceControls':{'PNG':'asymmetric 64x64','unlit':'texture only, no normals/vertex colours/lights','MSAA':False,'contactPlaneY':0,'plantCamera':{'verticalFOV':38,'pitchRadians':.9,'distancesMetres':[7,17],'lateralShiftMetres':.01},'raster':[1024,640]},'mobilePerformance':'NotRun','attachmentUpload':'Blocked HTTP 403; no retries'}
(root/'visual-comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
raise SystemExit(0 if all(c['status']=='Passed' for c in checks) else 1)
