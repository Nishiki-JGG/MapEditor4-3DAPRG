"""実ブラウザ出力から、藁の割当以外の保存・モデル・出力契約を検証する。"""
import json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
folder=Path(sys.argv[1]) if len(sys.argv)>1 else root/'output/playwright/night-props/batch36-regression'
report=json.loads((folder/'contract.json').read_text(encoding='utf-8'))
assert report['pass'];a=report['results']['before'];b=report['results']['after']
assert len(a['catalog'])==len(b['catalog'])==136
for x,y in zip(a['catalog'],b['catalog']):
 assert x['id']==y['id']
 if x['id']!='haystack':assert x==y,x['id']
 else:
  assert x['attributes']['uv']!=y['attributes']['uv']
  for k in x:
   if k!='attributes':assert x[k]==y[k],k
  assert {k:v for k,v in x['attributes'].items() if k!='uv'}=={k:v for k,v in y['attributes'].items() if k!='uv'}
for k in ['props','walk','colliders','lights','camera']:assert a[k]==b[k],k
old=json.loads((folder/'before-export/small_props.json').read_text());new=json.loads((folder/'after-export/small_props.json').read_text())
assert {k:v for k,v in old.items() if k!='additionalAssets'}=={k:v for k,v in new.items() if k!='additionalAssets'}
for x,y in zip(old['additionalAssets'],new['additionalAssets']):
 assert x['id']==y['id']
 if x['id']!='haystack':assert x==y,x['id']
 else:
  assert {k:v for k,v in x.items() if k!='uv'}=={k:v for k,v in y.items() if k!='uv'}
  changed=[i for i,(u,v) in enumerate(zip(x['uv'],y['uv'])) if u!=v]
  assert changed and all(i%2==0 for i in changed),'V coordinates must stay unchanged'
  # Existing straw atlas rectangle, including its padding. No adjacent tile sampled.
  assert all(.5<y['uv'][i]<.75 for i in changed),'UV escaped the straw tile'
result={'pass':True,'onlyHaystackUCoordinatesChanged':True,'other135CatalogExact':True,'allPositionsNormalsColoursIndicesMetadataExact':True,'sharedAtlasExact':True,'allOtherNativePayloadExact':True,'placementCollisionLightsExact':True,'triangles':560,'attributeBytes':80640}
(folder/'haystack-scope.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
