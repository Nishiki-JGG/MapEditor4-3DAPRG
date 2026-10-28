from pathlib import Path
import sys,json,shutil
e=Path(sys.argv[1]).resolve();assert (e/'Assets/Editor').is_dir()
d=json.loads((e/'Input97-after/small_props.json').read_text())
for key in ['assets','additionalAssets']:
 for a in d[key]:
  if a['id'] in ['gravestone','crossgrave']:a.pop('surface',None)
p=e/'Input97-absent';p.mkdir(exist_ok=True);(p/'small_props.json').write_text(json.dumps(d,separators=(',',':')),encoding='utf8');shutil.copyfile(e/'Input97-after/props.csv',p/'props.csv')
shutil.copyfile(Path(__file__).parent/'unity/Grave97Checks.cs',e/'Assets/Editor/Grave97Checks.cs')
