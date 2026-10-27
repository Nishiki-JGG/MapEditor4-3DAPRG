"""宝箱の保存済み材質比較と回帰証拠を集約する。撮影・生成はしない。"""
from pathlib import Path
from datetime import datetime,timezone
import json,os,hashlib,subprocess,base64,io
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1];base=root/'output/playwright/night-props'
release=base/os.environ.get('CHEST_EVIDENCE_RELEASE','batch38-adopted');old=base/'batch36-release'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def pixels(p):return np.asarray(Image.open(p).convert('RGB'),dtype=np.int16)
def exact(a,b):return np.array_equal(pixels(a),pixels(b))
def delta(a,b):
 d=np.abs(pixels(a)-pixels(b));return {'changedPixels':int((d.sum(axis=2)>3).sum()),'meanChannelDifference':float(d.mean())}
def atlas(s):return json.loads(s.split('window.TDChestSurfaceData=',1)[1].strip().rstrip(';'))
oldAtlas=atlas(subprocess.check_output(['git','show','e5d9f0ef5ffa1bfc470d6afcc3eb73a492c53ca1:props/chest-surface-data.js'],cwd=root).decode())
newAtlas=atlas((root/'props/chest-surface-data.js').read_text())
for name in ['colour','packed']:
 a=np.asarray(Image.open(io.BytesIO(base64.b64decode(oldAtlas[name]['png']))))
 b=np.asarray(Image.open(io.BytesIO(base64.b64decode(newAtlas[name]['png']))))
 assert np.array_equal(a[:256],b[:256]),'Wood pixels changed'
scope=read(base/'batch38-regression/surface-contract.json')
assert scope['pass'] and scope['originalGeometryUVAndMetadataExact']==136 and scope['unaffectedMaterialsExact']==129
assert scope['legacyNativeAssetsExact']==43 and scope['geometryByteDelta']==0
assert read(base/'batch38-regression/contract.json')['pass']
assert read(base/'batch38-regression/compact-proof.json')['reconstructedFiles']==27
prepared=read(base/'batch38-regression/prepared-parity.json');assert prepared['pass']
assert all(x['entirePayloadIdentical'] and not x['keyUpdated'] for x in prepared['tests'])
for x in read(base/'batch38-prepared/comparison.json')['working'].values():
 if isinstance(x,dict) and 'rockFitCalls' in x:assert x['rockFitCalls']==0 and x['tab']['rockRegeneration']==0
native=read(release/'native/report.json');assert native['pass'] and len(native['checks'])==651
cost=read(release/'native/surface-cost.json');oldcost=read(old/'native/surface-cost.json')
for k in ['uniqueTextures','colourBytes','packedBytes','colourFormat','packedFormat']:assert cost[k]==oldcost[k],k
assert cost['colourMeanError']<.004 and cost['packedMeanError']<.004
channels=read(release/'native/metal-channel-report.json');assert channels['pass']
assert all(x['changedPixels']>50 for x in channels['differences'])
# Same geometry and descriptors; later shader-only fixes do not change this paired import proof.
memory=read(base/'batch38-release/memory/report.json');assert memory['pass']
for a,b in [('beforeUniqueMeshBytes','afterUniqueMeshBytes'),('beforeUniqueMeshes','afterUniqueMeshes'),('beforeMaterials','afterMaterials')]:assert memory[a]==memory[b]
assert len(memory['rows'])==43 and all(x['collisionDataExact'] and x['sameCollisionReference'] and x['sameRenderReference'] for x in memory['rows'])
compat=read(base/'batch38-release/compatibility/compatibility.json');assert compat['pass'] and len(compat['checks'])==154
native_same=[]
for p in (release/'native').glob('*.png'):
 if p.name in ['all-fixtures.png','presentation-upper-lineup.png'] or p.name.startswith(('treasurechest','surface-gold','metal-channel')):continue
 q=old/'native'/p.name;assert q.exists() and exact(p,q),p.name;native_same.append(p.name)
assert len(native_same)>=50
for n in ['treasurechest_gold-two-offset-effects-only.png','treasurechest_rainbow-two-offset-effects-only.png']:
 assert exact(release/'native'/n,old/'native'/n);native_same.append(n)
build=read(release/'after-player/build-report.json');player=read(release/'after-player/run1/player-report.json')
assert build['pass'] and build['errors']==0
assert player['pass'] and len(player['checks'])==291 and not player['warnings'] and not player['errors']
for n in ['player-lineup.png','player-scene-reload.png']:assert exact(release/'after-player/editor-reference-lineup.png',release/'after-player/run1'/n)
player_same=[]
for p in (release/'after-player/run1').glob('*.png'):
 if p.name.startswith('treasurechest') and not p.name.endswith('-fx-deleted.png'):continue
 if p.name.startswith(('player-lineup','player-scene','player-chests')):continue
 assert exact(p,old/'after-player/run1'/p.name),p.name;player_same.append(p.name)
assert len(player_same)>=6
browser=read(base/'batch38-final-browser/report.json');assert browser['pass']
web=[]
for folder in ['batch38-focus4','batch38-alt-light2']:
 d=base/folder;r=read(d/'report.json');assert r['pass'];assert len(r['results']['before']['views'])==15
 for a,b in zip(r['results']['before']['views'],r['results']['after']['views']):
  assert a['camera']==b['camera'] and a['lights']==b['lights']
 modes={n:delta(d/'after-gold-near.png',d/('after-gold-'+n+'.png')) for n in ['flat-normal','uniform-rough','rough-low','rough-high']}
 assert all(x['changedPixels']>50 for x in modes.values())
 web.append({'folder':folder,'viewsPerStage':15,'cameraAndLightsExact':True,'channels':modes})
sourceFiles=['props/chest-surface.js','props/chest-surface-data.js','tools/chest-surface-pixels.js','unity/Assets/MapSharedProps/Runtime/ChestSurface.hlsl','unity/Assets/MapSharedProps/Runtime/ChestMetal.shader']
report={'pass':True,'verifiedUtc':datetime.now(timezone.utc).isoformat(),'base':'e5d9f0ef5ffa1bfc470d6afcc3eb73a492c53ca1','nativeChecks':651,'playerChecks':291,'compatibilityChecks':154,'geometryExact':136,'otherMaterialsExact':129,'nativeOtherImagesExact':len(native_same),'playerOtherImagesExact':len(player_same),'editorPlayerReloadExact':True,'all43MeshAndColliderReferencesExact':True,'pairedMeshBytes':memory['afterUniqueMeshBytes'],'pairedMeshes':memory['afterUniqueMeshes'],'pairedMaterials':memory['afterMaterials'],'textures':{k:cost[k] for k in ['colourFormat','packedFormat','colourBytes','packedBytes','uniqueTextures','colourMeanError','packedMeanError']},'webPixelMipBytes':scope['webUncompressedPixelAndMipBudgetBytes'],'nativeChannels':channels['differences'],'web':web,'fixedSamplePayloadAndKeyExact':True,'rockRegeneration':0,'buildWarnings':build['warnings'],'sourceSha256':{n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in sourceFiles},'limits':['正面の彫りと素材差はまだ弱く、参考同等の完成品質ではない。','金属反射は既存の簡易環境表現を残す。物理環境マップではない。','Windows Mono/D3D11/URP の専用 fixture。実ゲーム・IL2CPP・モバイル・Built-in/HDRP は未検証。','描画回数・面数・マップメモリを比較。GPUフレーム時間は測定していない。']}
(base/'batch38-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
