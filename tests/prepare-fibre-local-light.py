from pathlib import Path
import os,subprocess,shutil
r=Path(__file__).resolve().parents[1];p=Path(os.environ['FIBRE_REVIEW_PROJECT'])
old=subprocess.check_output(['git','show','425de79:unity/Assets/MapSharedProps/Runtime/FibreProp.shader'],cwd=r).decode('utf-8')
(p/'Assets/Editor/FibreBefore116.shader').write_text(old.replace('Shader "MapSharedProps/FibreProp"','Shader "Review/FibreBefore116"'),encoding='utf-8')
shutil.copy2(r/'unity/Assets/MapSharedProps/Runtime/FibreProp.shader',p/'Assets/MapSharedProps/Runtime/FibreProp.shader')
for name in ['Fibre116Checks.cs','Fibre116Review.cs']:shutil.copy2(r/'tests/unity'/name,p/'Assets/Editor'/name)
print('Run Fibre116Checks.Run, then Fibre116Checks.Legacy in the existing dedicated background Editor')
