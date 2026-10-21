"""Canonical geometry, images, ID preservation and low-cost mesh diagnostics."""
import base64
import json
import os
import subprocess
from pathlib import Path
import numpy as np

repo = Path(__file__).resolve().parents[1]
out = Path(os.environ.get('EVIDENCE_OUT', repo.parent / 'understory-evidence'))
def parse(text):
    return json.loads(text.split('window.TDSharedData = ')[1].strip()[:-1])
data = parse((repo / 'props/shared/assets.js').read_text(encoding='utf-8'))
old = parse(subprocess.check_output(['git', 'show', 'a209b52:props/shared/assets.js'], cwd=repo).decode())
assert data['libraryVersion'] == 'shared-plants/4' and len(data['assets']) == 25
assert data['textures'] == old['textures']
for previous in old['assets']:
    current = next(a for a in data['assets'] if a['id'] == previous['id'])
    clean = json.loads(json.dumps(current))
    if current['id'] in ['sedge', 'dock']:
        clean['wind'].pop('maxCombinedDisplacementMetres')
    assert clean == previous, current['id']
rows = []
for id in ['rowan', 'juniper', 'clover', 'shelfshroom', 'mossrock', 'mushroom']:
    a = next(a for a in data['assets'] if a['id'] == id)
    p = np.array(a['positions']).reshape(-1, 3)
    n = np.array(a['normals']).reshape(-1, 3)
    uv = np.array(a['uv']).reshape(-1, 2)
    ix = np.array(a['triangles']).reshape(-1, 3)
    area = np.linalg.norm(np.cross(p[ix[:, 1]]-p[ix[:, 0]], p[ix[:, 2]]-p[ix[:, 0]]), axis=1)
    assert np.isfinite(p).all() and np.isfinite(n).all() and np.isfinite(uv).all()
    assert area.min() > 1e-9, (id, 'degenerate triangle', area.min())
    assert np.max(abs(np.linalg.norm(n, axis=1)-1)) < .002, id
    assert p[:, 1].min() == 0 and a['pivot'] == [0, 0, 0]
    assert uv.min() >= 0 and uv.max() <= 1
    if 'motionWeights' in a:
        w = np.array(a['motionWeights']).reshape(-1, 2)
        assert w.min() >= 0 and w.max() <= 1 and (w[p[:, 1] == 0] == 0).all()
    if id == 'rowan':
        assert p[np.array(a['motionWeights'])[::2] > 0, 1].min() >= 2.1
    rows.append(dict(id=id, triangles=len(ix), vertices=len(p), height=float(p[:, 1].max()),
                     materials=1, textureBytesAdded=0, moving='motionWeights' in a))
report = dict(status='Passed', baseline='a209b52', previous19AssetsPreserved=True,
              texturesExact=True, rows=rows, allTriangles=sum(len(a['triangles']) // 3 for a in data['assets']),
              weightBytesAdded=sum(len(a.get('motionWeights', []))*4 for a in data['assets'][19:]),
              textureBytes=sum(len(base64.b64decode(t['png'])) for t in data['textures']))
out.mkdir(exist_ok=True)
(out / 'source-validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
