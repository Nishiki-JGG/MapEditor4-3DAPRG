from pathlib import Path
import os,subprocess,shutil,json,copy
r=Path(__file__).resolve().parents[1];p=Path(os.environ['GROUNDED_LIGHT_REVIEW_PROJECT']);rel='unity/Assets/MapSharedProps/Editor/GroundedPropsV1.cs'
for revision,classname in [('874ed74','GroundedBefore119'),('ba3c929','FrozenShoreReader95')]:
 s=subprocess.check_output(['git','show',revision+':'+rel],cwd=r).decode('utf-8').replace('public static class GroundedPropsV1','public static class '+classname)
 (p/'Assets/Editor'/ (classname+'.cs')).write_text(s,encoding='utf-8')
shutil.copyfile(r/rel,p/'Assets/MapSharedProps/Editor/GroundedPropsV1.cs')
shutil.copyfile(r/'unity/Assets/MapSharedProps/Runtime/SharedPropLit.shader',p/'Assets/MapSharedProps/Runtime/SharedPropLit.shader')
for name in ['Grounded119Baseline.cs','Grounded119Checks.cs','Grounded119Review.cs','Shared117Review.cs']:
 shutil.copyfile(r/'tests/unity'/name,p/'Assets/Editor'/name)
data=json.loads((p/'Input119/grounded_props.json').read_text())
for kind in ['absent','badUV','badPNG']:
 folder=p/('Input96-'+kind)
 if folder.exists():continue
 d=copy.deepcopy(data)
 if kind=='absent':
  for a in d['assets']:
   a.pop('surface',None)
   for part in a['parts']:part.pop('uv',None)
 elif kind=='badUV':d['assets'][0]['parts'][0]['uv']=[2]
 else:d['assets'][0]['surface']['png']='AAAA'
 folder.mkdir();(folder/'grounded_props.json').write_text(json.dumps(d,separators=(',',':')),encoding='utf-8');shutil.copyfile(p/'Input119/props.csv',folder/'props.csv')
print('Run Grounded119Baseline.Run then Grounded119Checks.Run in the existing dedicated background Editor; output folders must be fresh.')
