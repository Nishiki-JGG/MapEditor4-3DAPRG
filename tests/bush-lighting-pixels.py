"""葉・木質の比較画素を集計する。画像は変更しない。"""
from PIL import Image
from pathlib import Path
import numpy as np, json, sys
p=Path(sys.argv[1] if len(sys.argv)>1 else '../bush-lighting-evidence/fixed');rows=[]
for view in ['top','oblique','walk']:
 for az in range(4):
  a=np.array(Image.open(p/f'{view}-light{az}-before.png'))[:,:,:3].astype(float)
  b=np.array(Image.open(p/f'{view}-light{az}-current.png'))[:,:,:3].astype(float)
  m=np.array(Image.open(p/f'{view}-light{az}-mask.png'))[:,:,:3].astype(float)
  leaf=(m.min(2)>200)&(m.max(2)-m.min(2)<5)
  wood=(m[:,:,0]>220)&(m[:,:,1]<150)&(m[:,:,2]<150);inside=wood.copy()
  for dz,dx in [(0,1),(0,-1),(1,0),(-1,0)]:inside &= np.roll(wood,(dz,dx),(0,1))
  row=dict(view=view,light=az,leafPixels=int(leaf.sum()),woodPixels=int(wood.sum()),woodInteriorPixels=int(inside.sum()),woodMaxDelta=float(abs(a-b)[wood].max()) if wood.any() else 0,woodInteriorMaxDelta=float(abs(a-b)[inside].max()) if inside.any() else 0,leafDarkBeforePct=round(float((a.mean(2)[leaf]<25).mean()*100),2),leafDarkFixedPct=round(float((b.mean(2)[leaf]<25).mean()*100),2),leafMeanDelta=round(float((b-a)[leaf].mean()),2))
  assert row['woodInteriorMaxDelta']==0,row
  rows.append(row)
json.dump({'pass':True,'darkThreshold':'8-bit sRGB RGB mean < 25, not a beauty threshold','woodBoundary':'one-pixel boundary excluded for mixed leaf/wood antialiasing; raw maximum also recorded','rows':rows},open(p/'pixels.json','w'),indent=2)
print('Passed:',len(rows),'views/light combinations; wood interior unchanged')
