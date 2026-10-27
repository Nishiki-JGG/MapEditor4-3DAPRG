"""干し草UV修正の既存Web/Native/Player証拠を集約する。撮影や再生成はしない。"""
from pathlib import Path
from datetime import datetime,timezone
import json
from PIL import Image,ImageChops
root=Path(__file__).resolve().parents[1];base=root/'output/playwright/night-props';release=base/'batch36-release'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def equal(a,b):
 x=Image.open(a).convert('RGBA');y=Image.open(b).convert('RGBA');return x.size==y.size and x.tobytes()==y.tobytes()
scope=read(base/'batch36-regression/haystack-scope.json');assert scope['pass']
assert read(base/'batch36-regression/prepared-parity.json')['pass']
prepared=read(base/'batch36-prepared/comparison.json')['working']
for k in ['forest','forestWarm','ruins','ruinsWarm']:
 assert prepared[k]['rockFitCalls']==0 and prepared[k]['tab']['rockRegeneration']==0
native=read(release/'native/report.json');previous=read(root/'output/playwright/publication/native/report.json')
assert native['pass'] and len(native['checks'])==647
for k in ['surfaceTextureMemoryBytes','surfaceTextureCount','assetTriangles','materialCount']:assert native[k]==previous[k],k
# Separate Editor runs can observe meshes at different upload/cache phases.
# Compare both exports after the same render warmup inside one process instead.
memory=read(base/'batch36-memory/report.json');assert memory['pass']
for before,after in [('beforeUniqueMeshBytes','afterUniqueMeshBytes'),('beforeUniqueMeshes','afterUniqueMeshes'),('beforeMaterials','afterMaterials')]:assert memory[before]==memory[after],before
assert len(memory['rows'])==43 and all(x['collisionDataExact'] and x['sameCollisionReference'] for x in memory['rows'])
assert all(x['sameRenderReference'] for x in memory['rows'] if x['id']!='haystack')
native_same=[]
for p in (release/'native').glob('*.png'):
 q=root/'output/playwright/publication/native'/p.name
 if q.exists() and p.name not in ['haystack-detail.png','haystack-top.png','all-fixtures.png']:
  assert equal(p,q),p.name;native_same.append(p.name)
assert len(native_same)>=108
assert not equal(release/'native/haystack-detail.png',root/'output/playwright/publication/native/haystack-detail.png')
for stage in ['before-player','after-player']:
 d=release/stage;build=read(d/'build-report.json');player=read(d/'run1/player-report.json')
 assert build['pass'] and build['errors']==0
 assert player['pass'] and len(player['checks'])==291 and not player['errors'] and not player['warnings']
 for n in ['player-lineup.png','player-scene-reload.png']:assert equal(d/'editor-reference-lineup.png',d/'run1'/n)
before=release/'before-player/run1';after=release/'after-player/run1';player_same=[]
for p in after.glob('*.png'):
 if p.name not in ['haystack-player-close.png','haystack-player-overhead.png','player-lineup.png','player-scene-reload.png']:
  assert equal(p,before/p.name),p.name;player_same.append(p.name)
assert len(player_same)>=31
for n in ['haystack-player-close.png','haystack-player-overhead.png']:assert not equal(after/n,before/n)
review_a=read(base/'batch36-before/review.json');review_b=read(base/'batch36-trial/review.json')
assert [x['camera'] for x in review_a['views']]==[x['camera'] for x in review_b['views']]
report={'pass':True,'verifiedUtc':datetime.now(timezone.utc).isoformat(),'base':'361375ee5721122dc16315b507ac4d874e60be3a','scope':scope,'nativeChecks':647,'playerBeforeChecks':291,'playerAfterChecks':291,'nativeOtherImagesExact':len(native_same),'playerOtherImagesExact':len(player_same),'editorPlayerReloadExact':True,'pairedMeshBytes':memory['afterUniqueMeshBytes'],'pairedMeshes':memory['afterUniqueMeshes'],'pairedMaterials':memory['afterMaterials'],'all43ColliderReferencesExact':True,'other42RenderReferencesExact':True,'nativeMemoryAndMaterialCountsExact':True,'separateRunRawMeshBytes':[previous['assetMeshMemoryBytes'],native['assetMeshMemoryBytes']],'sameWebCamera':True,'rockRegeneration':0,'limits':['繊維は既存模様の反復。実体の細い藁ではない。','地面や輪郭、硬い自己影は変更していない。','Windows Mono/D3D11の専用fixture。実ゲーム/モバイル/IL2CPPは未検証。']}
(base/'batch36-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
