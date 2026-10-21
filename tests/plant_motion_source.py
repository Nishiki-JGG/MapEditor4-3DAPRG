"""Check motion masks without changing the canonical geometry or textures."""
import base64
import json
import math
import os
import subprocess
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
out = Path(os.environ.get('EVIDENCE_OUT', repo.parent / 'plant-motion-evidence'))
baseline = '6fb6c0708496e7ca26231edff393a7e5619d78ee'
name = 'props/shared/assets.js'
current_bytes = (repo / name).read_bytes()
old_bytes = subprocess.check_output(['git', 'show', baseline + ':' + name], cwd=repo)

def read(raw):
    return json.loads(raw.decode('utf-8').split('window.TDSharedData = ')[1].strip()[:-1])

data, old = read(current_bytes), read(old_bytes)
ids = ['birch', 'willow', 'scotspine', 'hazel', 'bramble', 'ivy', 'sedge', 'foxglove', 'horsetail', 'dock']
assert data['schemaVersion'] == old['schemaVersion'] == 1
assert data['libraryVersion'] == 'shared-plants/3'
assert len(data['assets']) == 19
assert data['textures'] == old['textures']
rows = []
for asset in data['assets']:
    previous = next(a for a in old['assets'] if a['id'] == asset['id'])
    for key, value in previous.items():
        if asset['id'] in ids + ['fern', 'grass', 'reed', 'flowers'] and key in ['deformation', 'wind', 'motionWeights']:
            continue
        assert asset[key] == value, (asset['id'], key)
    if asset['id'] not in ids:
        if asset['id'] not in ['fern', 'grass', 'reed', 'flowers']:
            assert asset == previous
        continue
    n = len(asset['positions']) // 3
    weights = asset['motionWeights']
    assert len(weights) == n * 2 and all(math.isfinite(w) and 0 <= w <= 1 for w in weights)
    for i in range(n):
        y = asset['positions'][i * 3 + 1]
        if abs(y) < .000001 or (asset['id'] != 'ivy' and y <= .035):
            assert weights[i * 2] == weights[i * 2 + 1] == 0
    assert asset['contact']['version'] == 1
    rows.append(dict(id=asset['id'], vertices=n, triangles=len(asset['triangles']) // 3,
                     materials=1, weightBytes=n * 8,
                     fixedVertices=sum(weights[i * 2] == weights[i * 2 + 1] == 0 for i in range(n)),
                     windMetres=asset['wind']['maxDisplacementMetres'],
                     contactMetres=asset['contact']['maxDisplacementMetres']))
report = dict(status='Passed', baseline=baseline, geometryAndMaterialExact=True,
              protectedFiveAssetsExact=True, fiveTexturesExact=True, rows=rows,
              allTriangles=sum(len(a['triangles']) // 3 for a in data['assets']),
              weightsBytes=sum(r['weightBytes'] for r in rows),
              addedTouchAttributeBytesPerCopy=10 * 8000 * 3 * 4,
              assetScriptBytesBefore=len(old_bytes), assetScriptBytesAfter=len(current_bytes),
              texturePngBytes=[dict(id=t['id'], width=t['width'], height=t['height'],
                                   bytes=len(base64.b64decode(t['png']))) for t in data['textures']])
out.mkdir(exist_ok=True)
(out / 'motion-source.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
