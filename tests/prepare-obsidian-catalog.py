from pathlib import Path
import os,subprocess,shutil
r=Path(__file__).resolve().parents[1];p=Path(os.environ['OBSIDIAN_REVIEW_PROJECT'])
old=subprocess.check_output(['git','show','5ba56ea:unity/Assets/MapSharedProps/Editor/ObsidianV1.cs'],cwd=r).decode('utf-8')
old=old[:old.index(' // URP/Lit')].replace('public static class ObsidianV1','public static class ObsidianBefore115')+'}\n}\n'
(p/'Assets/Editor/ObsidianBefore115.cs').write_text(old,encoding='utf-8')
shutil.copy2(r/'unity/Assets/MapSharedProps/Editor/ObsidianV1.cs',p/'Assets/MapSharedProps/Editor/ObsidianV1.cs')
shutil.copy2(r/'tests/unity/Glass115Checks.cs',p/'Assets/Editor/Glass115Checks.cs')
print('Run Glass115Checks.Run in the existing dedicated background Editor after the Web catalog test')
