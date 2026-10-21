"""Validate canonical meshes and estimate top-view coverage before depth rejection.

The coverage estimate uses nearest alpha sampling, no mipmaps or depth test. It is
an authoring diagnostic, not GPU timing, overdraw profiling, or a phone benchmark.
"""
import base64
import io
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image

repo = Path(__file__).resolve().parents[1]
out = repo.parent / 'plant-batch-evidence'
data = json.loads((repo / 'props/shared/assets.js').read_text(encoding='utf-8').split('window.TDSharedData = ')[1].strip()[:-1])
old = json.loads(subprocess.check_output(['git', 'show', 'f8e60d1:props/shared/assets.js'], cwd=repo).decode('utf-8').split('window.TDSharedData = ')[1].strip()[:-1])
stats = json.loads((out / 'new-source.json').read_text(encoding='utf-8'))
ids = [s['id'] for s in stats]
assert len(ids) == len(set(ids)) == 10
for a in old['assets']:
    assert a == next(b for b in data['assets'] if b['id'] == a['id'])
for t in old['textures']:
    assert t == next(b for b in data['textures'] if b['id'] == t['id'])
textures = {t['id']: np.array(Image.open(io.BytesIO(base64.b64decode(t['png']))).convert('RGBA')) for t in data['textures']}
rows, overlap = [], []
for a in data['assets']:
    if a['id'] not in ids and a['id'] != 'pine':
        continue
    p = np.array(a['positions']).reshape(-1, 3)
    n = np.array(a['normals']).reshape(-1, 3)
    uv = np.array(a['uv']).reshape(-1, 2)
    ix = np.array(a['triangles']).reshape(-1, 3)
    cross = np.cross(p[ix[:, 1]]-p[ix[:, 0]], p[ix[:, 2]]-p[ix[:, 0]])
    assert np.isfinite(p).all() and np.isfinite(n).all() and np.isfinite(uv).all()
    assert (np.linalg.norm(cross, axis=1) > 1e-9).all()
    assert (abs(np.linalg.norm(n, axis=1)-1) < 1e-5).all()
    assert uv.min() >= 0 and uv.max() <= 1
    assert abs(p[:, 1].min()) < 1e-6
    if a['id'] in ids:
        s = next(s for s in stats if s['id'] == a['id'])
        assert len(ix) <= (600 if s.get('tree') else 350)
        if s.get('tree'):
            assert s['clearanceMin'] >= 2.1
        rows.append(dict(id=a['id'], triangles=len(ix), materials=1, dimensions=(p.max(axis=0)-p.min(axis=0)).tolist(),
                         geometryBytes=p.size*4+n.size*4+len(a['colors'])*4+uv.size*4+ix.size*2,
                         branchClearance=s.get('clearanceMin'), static=True))
    low = p[:, [0, 2]].min(axis=0)-.03
    high = p[:, [0, 2]].max(axis=0)+.03
    step = max(float((high-low).max())/320, .004)
    size = np.ceil((high-low)/step).astype(int)
    count = np.zeros((size[1], size[0]), dtype=np.uint16)
    tex = textures[a['material']['texture']]
    cutoff = a['material']['alphaCutoff']
    for tri in ix:
        q = p[tri][:, [0, 2]]
        lo = np.maximum(0, np.floor((q.min(axis=0)-low)/step).astype(int))
        hi = np.minimum(size-1, np.ceil((q.max(axis=0)-low)/step).astype(int))
        if (hi < lo).any():
            continue
        x, z = np.meshgrid(low[0]+(np.arange(lo[0], hi[0]+1)+.5)*step, low[1]+(np.arange(lo[1], hi[1]+1)+.5)*step)
        den = (q[1, 1]-q[2, 1])*(q[0, 0]-q[2, 0])+(q[2, 0]-q[1, 0])*(q[0, 1]-q[2, 1])
        if abs(den) < 1e-12:
            continue
        u = ((q[1, 1]-q[2, 1])*(x-q[2, 0])+(q[2, 0]-q[1, 0])*(z-q[2, 1]))/den
        v = ((q[2, 1]-q[0, 1])*(x-q[2, 0])+(q[0, 0]-q[2, 0])*(z-q[2, 1]))/den
        w = 1-u-v
        valid = (u >= 0) & (v >= 0) & (w >= 0)
        if cutoff:
            sample = u[..., None]*uv[tri[0]]+v[..., None]*uv[tri[1]]+w[..., None]*uv[tri[2]]
            tx = np.clip((sample[..., 0]*tex.shape[1]).astype(int), 0, tex.shape[1]-1)
            ty = np.clip(((1-sample[..., 1])*tex.shape[0]).astype(int), 0, tex.shape[0]-1)
            valid &= tex[ty, tx, 3]/255 >= cutoff
        count[lo[1]:hi[1]+1, lo[0]:hi[0]+1] += valid
    visible = count[count > 0]
    overlap.append(dict(id=a['id'], meanLayersBeforeDepth=float(visible.mean()), p95LayersBeforeDepth=float(np.percentile(visible, 95)),
                        maxLayersBeforeDepth=int(visible.max()), projectedSquareMetres=float(visible.size*step*step)))
report = dict(status='Passed', types=rows, totalTriangles=sum(r['triangles'] for r in rows),
              totalGeometryBytes=sum(r['geometryBytes'] for r in rows), priorNineAssetsPreserved=True, priorFourTexturesPreserved=True)
(out / 'new-source-validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
(out / 'new-overlap.json').write_text(json.dumps(dict(method=__doc__, types=overlap), indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
print(json.dumps(overlap, indent=2))
