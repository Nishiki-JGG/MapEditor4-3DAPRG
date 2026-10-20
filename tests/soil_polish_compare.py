"""Compare actual browser/Unity albedo captures, excluding the viewport edge."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(sys.argv[1])
rows = []
for distance in (3, 7, 17):
    for surface in ('soil', 'blend'):
        def read(engine):
            return np.asarray(Image.open(root / f'{engine}-{surface}-{distance}m-unlit.png').convert('RGB'), dtype=float)[40:760, 40:1240]
        browser, unity = read('browser'), read('unity')
        mae = float(np.abs(browser - unity).mean())
        corr = float(np.corrcoef(browser.ravel(), unity.ravel())[0, 1])
        rows.append(dict(distance=distance, surface=surface, mae255=mae, correlation=corr,
                         status='Passed' if mae < 2 and corr > .995 else 'Failed'))
report = dict(status='Passed' if all(r['status'] == 'Passed' for r in rows) else 'Failed',
              meaning='Unlit material agreement only; lit BRDF differences and smartphone performance are not tested.', comparisons=rows)
(root / 'soil-cross-engine.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
sys.exit(0 if report['status'] == 'Passed' else 1)
