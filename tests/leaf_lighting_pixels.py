"""同一条件の比較画像で樹皮の不変性を確認し、葉の明暗差を記録する。"""
import argparse,json
from collections import Counter
from pathlib import Path
from PIL import Image,ImageFilter
import numpy as np

parser=argparse.ArgumentParser();parser.add_argument('evidence');parser.add_argument('--publish',action='store_true');args=parser.parse_args()
e=Path(args.evidence);repo=Path(__file__).resolve().parents[1];rows=[]
for id in ['oak','nara','zelkova']:
 for view in ['top','walk','low','reverse']:
  prefix=f'{id}-{view}'
  mask=np.asarray(Image.open(e/f'{prefix}-mask.png').convert('RGB')).astype(float)
  leaves=(mask.min(2)>200)&(mask.max(2)-mask.min(2)<3)
  red=(mask[:,:,0]>100)&(mask[:,:,0]>1.8*mask[:,:,1])&(mask[:,:,0]>2*mask[:,:,2])
  colour=Counter(map(tuple,mask[red].astype('uint8'))).most_common(1)[0][0]
  wood=(mask==colour).all(2);wood=np.asarray(Image.fromarray(wood.astype('uint8')*255).filter(ImageFilter.MinFilter(3)))>0
  before=np.asarray(Image.open(e/f'{prefix}-before.png').convert('RGB'));after=np.asarray(Image.open(e/f'{prefix}-fixed.png').convert('RGB'))
  delta=np.abs(before.astype(int)-after.astype(int));assert wood.sum()>0,prefix+' wood mask' # 真上では樹冠が木質部を隠すため、観測画素数も記録する。
  assert delta[wood].max()==0,prefix+' bark changed'
  values={}
  for name,pixels in [('before',before),('fixed',after)]:
   luma=pixels.astype(float)/255@np.array([.2126,.7152,.0722]);values[name]={'meanLuma':float(luma[leaves].mean()),'darkFractionBelow012':float((luma[leaves]<.12).mean())}
  rows.append({'id':id,'view':view,'leafPixels':int(leaves.sum()),'woodPixels':int(wood.sum()),'woodMaximumByteDifference':int(delta[wood].max()),'luma':values})
  if args.publish:
   dst=repo/'tests/leaf-lighting';dst.mkdir(exist_ok=True)
   for mode in ['before','fixed']:Image.open(e/f'{prefix}-{mode}.png').convert('RGB').save(dst/f'{prefix}-{mode}.jpg',quality=89,optimize=True)
report={'status':'Passed','woodCases':len(rows),'rows':rows};(e/'leaf-pixels.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report))
