"""Check targeted wind changes against the previous public plant motion batch."""
import json
import math
import os
import subprocess
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
out = Path(os.environ.get('EVIDENCE_OUT', repo.parent / 'plant-gale-evidence'))
def parse(raw):
    return json.loads(raw.split('window.TDSharedData = ')[1].strip()[:-1])
current = parse((repo / 'props/shared/assets.js').read_text(encoding='utf-8'))
previous = parse(subprocess.check_output(['git', 'show', '6bf963c:props/shared/assets.js'], cwd=repo).decode())
assert len(current['assets']) == 19 and current['textures'] == previous['textures']
rows = []
for a, b in zip(current['assets'], previous['assets']):
    for key in ['id', 'version', 'positions', 'normals', 'colors', 'uv', 'triangles', 'material', 'pivot']:
        assert a[key] == b[key], (a['id'], key)
    if 'contact' in b:
        assert a['contact'] == b['contact']
    if a['id'] in ['birch', 'willow', 'scotspine']:
        assert a['motionWeights'] == b['motionWeights']
    if 'motionWeights' in a:
        assert len(a['motionWeights']) == len(b['motionWeights'])
        assert all(math.isfinite(w) and 0 <= w <= 1 for w in a['motionWeights'])
        for i in range(len(a['positions']) // 3):
            if abs(a['positions'][i * 3 + 1]) < 1e-6:
                assert a['motionWeights'][i * 2] == a['motionWeights'][i * 2 + 1] == 0
    def low_leaf(asset):
        return max([asset.get('motionWeights', [0] * (len(asset['positions']) // 3 * 2))[i * 2]
                    for i in range(len(asset['positions']) // 3) if .035 < asset['positions'][i * 3 + 1] < .25] or [0])
    rows.append(dict(id=a['id'], triangles=len(a['triangles']) // 3,
                     lowLeafWeightBefore=low_leaf(b), lowLeafWeightAfter=low_leaf(a),
                     windBefore=b.get('wind'), windAfter=a.get('wind')))
assert not subprocess.check_output(['git', 'diff', '6bf963c', '--name-only', '--', 'app.js', 'water.js', 'terrain', 'hero', 'samples'], cwd=repo, text=True).strip()
report = dict(status='Passed', geometryAndTexturesExact=True, treeTrunkMasksExact=True,
              contactParametersExact=True, triangles=sum(r['triangles'] for r in rows),
              addedGeometryBytes=0, addedTextureBytes=0, rows=rows)
out.mkdir(exist_ok=True)
(out / 'gale-source.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('Passed: 19 canonical geometries and five textures preserved; contact parameters and tree anchors preserved.')
