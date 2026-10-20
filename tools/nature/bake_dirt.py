"""Bake a seamless, code-authored soil tile. Requires Pillow and NumPy; no input images."""
import base64
import io
import json
from pathlib import Path
import numpy as np
from PIL import Image

SIZE = 256
rng = np.random.default_rng(20261020)

def periodic_noise(cells):
    a = rng.random((cells, cells)).astype(np.float32)
    p = np.arange(SIZE) * cells / SIZE
    i = np.floor(p).astype(int)
    f = p - i
    f = f * f * (3 - 2 * f)
    x = a[i[:, None] % cells, i[None, :] % cells] * (1 - f[None, :]) + a[i[:, None] % cells, (i[None, :] + 1) % cells] * f[None, :]
    y = a[(i[:, None] + 1) % cells, i[None, :] % cells] * (1 - f[None, :]) + a[(i[:, None] + 1) % cells, (i[None, :] + 1) % cells] * f[None, :]
    return x * (1 - f[:, None]) + y * f[:, None] - .5

# 2 m tile: low-contrast 6-16 cm soil clusters, 1.5-4 cm grains, sub-texel grit.
grain = periodic_noise(72) * 15 + periodic_noise(120) * 6
clusters = periodic_noise(16) * 9 + periodic_noise(32) * 5
tone = grain + clusters + (rng.random((SIZE, SIZE)) - .5) * 5
rgb = np.clip(np.array([132., 101., 68.])[None, None, :] + tone[:, :, None] * np.array([1., .88, .68]), 0, 255).astype('uint8')
stream = io.BytesIO()
Image.fromarray(rgb).save(stream, format='JPEG', quality=90, subsampling=0, optimize=True)
data = dict(id='soil-procedural-v1', width=SIZE, height=SIZE, tileMetres=2,
            secondWeight=.35, rotationCS=[.8660254037844386, .5], secondOffset=[.19, .43],
            mime='image/jpeg', encodedColorSpace='sRGB', mipmaps=True, anisotropy=2,
            imageBase64=base64.b64encode(stream.getvalue()).decode(),
            provenance='Self-authored deterministic numeric recipe; no external images; tools/nature/bake_dirt.py',
            publicReleaseApproved=True)
root = Path(__file__).resolve().parents[2]
(root / 'terrain/dirt.js').write_text('// Code-authored soil; shared by browser and Unity export.\nTDGroundData.dirt = ' + json.dumps(data, separators=(',', ':')) + ';\n', encoding='utf-8')
print(json.dumps({'width': SIZE, 'height': SIZE, 'tileMetres': 2, 'jpegBytes': len(stream.getvalue())}))
