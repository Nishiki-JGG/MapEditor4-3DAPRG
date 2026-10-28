# Produce only the packed finish image. Reuse the approved64 low mesh/normal/AO unchanged.
from pathlib import Path
source=Path(__file__).with_name('relief-bake.py')
s=source.read_text(encoding='utf-8');exec(s.split('lowverts=[]')[0])
stats={}
s=s[s.index('# One intrinsic linear RGB'):s.index('mesh.calc_tangents(')]
s=s.replace('(.405,.220,.050)','(.450,.250,.052)').replace('rough=.57+.09*cloud','rough=.44+.065*cloud')
exec(s)
(out/'finish-report.json').write_text(json.dumps(dict(maps=stats,source='chest64 high-relief functions; plate colour/roughness updated; no normal/AO regeneration'),indent=2))
