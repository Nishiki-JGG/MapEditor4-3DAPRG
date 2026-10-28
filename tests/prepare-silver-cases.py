from pathlib import Path
import json,copy,shutil,sys
e=Path(sys.argv[1]);d=json.loads((e/'Input95/small_props.json').read_text())
for kind in ['absent','bad']:
 x=copy.deepcopy(d)
 if kind=='absent':del x['chestSurfacesV1']['silverSparklesV1']
 else:x['chestSurfacesV1']['silverSparklesV1']['slots']*=5
 dest=e/('Input95-'+kind);dest.mkdir(exist_ok=True)
 (dest/'small_props.json').write_text(json.dumps(x,separators=(',',':')),encoding='utf8')
 shutil.copyfile(e/'Input95/props.csv',dest/'props.csv')
