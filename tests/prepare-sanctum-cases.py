from pathlib import Path
import json,copy,shutil,sys
e=Path(sys.argv[1]).resolve()
data=json.loads((e/'Input94/small_props.json').read_text())
for kind in ['absent','version','index','nonfinite']:
 d=copy.deepcopy(data)
 if kind=='absent':del d['chestSurfacesV1']['sanctumV1']
 elif kind=='version':d['chestSurfacesV1']['sanctumV1']['version']=99
 elif kind=='index':d['chestSurfacesV1']['sanctumV1']['groups'][0]['triangles'][0]=999999
 else:d['chestSurfacesV1']['sanctumV1']['groups'][0]['positions'][0]=float('nan')
 dest=e/('Input94Cases-'+kind);dest.mkdir(exist_ok=True);(dest/'small_props.json').write_text(json.dumps(d,separators=(',',':')),encoding='utf8');shutil.copyfile(e/'Input94/props.csv',dest/'props.csv')
