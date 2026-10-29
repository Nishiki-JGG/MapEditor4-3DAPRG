from pathlib import Path
import json,subprocess,shutil,os
r=Path(__file__).resolve().parents[1];p=Path(os.environ['OBSIDIAN_REVIEW_PROJECT'])
for name in ['SmallPropsV1.cs','ObsidianV1.cs']:shutil.copy2(r/'unity/Assets/MapSharedProps/Editor'/name,p/'Assets/MapSharedProps/Editor'/name)
for name in ['Glass114Checks.cs','Glass114Review.cs']:shutil.copy2(r/'tests/unity'/name,p/'Assets/Editor'/name)
legacy=subprocess.check_output(['git','show','cb2859d:unity/Assets/MapSharedProps/Editor/SmallPropsV1.cs'],cwd=r).decode('utf-8')
names=['Asset','CircleProxy','PointLightSpec','Tint','Atlas','Surface','Data']
aliases='\n'.join('using '+n+' = MapSharedProps.EditorTools.SmallPropsV1.'+n+';' for n in names)+'\n'
# Retain the previous reader/build control flow; shared DTO aliases avoid duplicating all dependent chest builders.
lines=[line for line in legacy.splitlines() if not any('public class '+n+' ' in line or 'public class '+n+':' in line for n in names)]
legacy=aliases+'\n'.join(lines).replace('public static class SmallPropsV1','public static class LegacySmallProps114')
(p/'Assets/Editor/LegacySmallProps114.cs').write_text(legacy,encoding='utf-8')
original=json.loads((p/'Input114-after/small_props.json').read_text())
for tag in ['missing','version','nonfinite','oversized','library']:
 d=json.loads(json.dumps(original));folder=p/('Input114-'+tag);folder.mkdir(exist_ok=True)
 shutil.copy2(p/'Input114-after/props.csv',folder/'props.csv')
 if tag=='missing':d.pop('obsidianV1')
 if tag=='version':d['obsidianV1']['version']=999
 if tag=='nonfinite':d['obsidianV1']['asset']['positions'][0]=1e50
 if tag=='oversized':d['obsidianV1']['asset']['positions']*=2
 if tag=='library':
  lib={k:v for k,v in d.items() if k not in ['instances','grounded']};(folder/'small_props_library.json').write_text(json.dumps(lib))
  d={k:d[k] for k in ['version','units','axes','instances','grounded']};d['library']='small_props_library.json'
 (folder/'small_props.json').write_text(json.dumps(d))
print('Reader fixtures prepared; run Glass114Checks.Run in the dedicated background Editor')
