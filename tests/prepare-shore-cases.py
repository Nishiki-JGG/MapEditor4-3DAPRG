from pathlib import Path
import json,copy,subprocess,sys
e=Path(sys.argv[1]);repo=Path(__file__).resolve().parents[1]
rel='unity/Assets/MapSharedProps/Editor/GroundedPropsV1.cs'
old=subprocess.check_output(['git','show','ba3c929:'+rel],cwd=repo).decode('utf8').replace('public static class GroundedPropsV1','public static class FrozenShoreReader95')
(e/'Assets/Editor/FrozenShoreReader95.cs').write_text(old,encoding='utf8')
data=json.loads((e/'Input96-after/grounded_props.json').read_text())
for kind in ['absent','badUV','badPNG']:
 d=copy.deepcopy(data)
 if kind=='absent':
  for a in d['assets']:
   a.pop('surface',None)
   for p in a['parts']:p.pop('uv',None)
 elif kind=='badUV':d['assets'][0]['parts'][0]['uv']=[2]
 else:d['assets'][0]['surface']['png']='AAAA'
 folder=e/('Input96-'+kind);folder.mkdir(exist_ok=True)
 (folder/'grounded_props.json').write_text(json.dumps(d,separators=(',',':')),encoding='utf8')
 (folder/'props.csv').write_bytes((e/'Input96-after/props.csv').read_bytes())
