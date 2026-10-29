from pathlib import Path
import os,re,subprocess,shutil
r=Path(__file__).resolve().parents[1];p=Path(os.environ['SHARED_LIGHT_REVIEW_PROJECT'])
old=subprocess.check_output(['git','show','2affe3c:unity/Assets/MapSharedProps/Runtime/SharedPropLit.shader'],cwd=r).decode('utf-8')
old=old.replace('Shader "MapSharedProps/Lit"','Shader "Review/SharedBefore117"')
old=re.sub(r'#include "(Shared[^"\n]+)"',r'#include "Assets/MapSharedProps/Runtime/\1"',old)
(p/'Assets/Editor/SharedBefore117.shader').write_text(old,encoding='utf-8')
for name in ['Runtime/SharedPropLit.shader','Editor/SmallPropsV1.cs']:shutil.copy2(r/'unity/Assets/MapSharedProps'/name,p/'Assets/MapSharedProps'/name)
for name in ['Shared117Checks.cs','Shared117Review.cs']:shutil.copy2(r/'tests/unity'/name,p/'Assets/Editor'/name)
print('Run Shared117Checks.Run in the existing dedicated background Editor')
