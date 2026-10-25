"""Unityを起動せず、対象のC#と隔離検証Runnerを同梱Roslynでcompileする。"""
import argparse
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('unity_data', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
u = args.unity_data
out = root / 'output/playwright/wall-torch'
out.mkdir(parents=True, exist_ok=True)
refs = list((u / 'NetStandard/ref/2.1.0').glob('*.dll')) + list((u / 'NetStandard/compat/2.1.0/shims/netfx').glob('*.dll')) + list((u / 'Managed/UnityEngine').glob('*.dll'))
sources = list((root / 'unity/Assets/MapSharedProps').rglob('*.cs')) + [root / 'tests/unity/RoomTorchChecks.cs',root / 'tests/unity/FireQualityChecks.cs']
options = ['-nologo', '-utf8output', '-nostdlib+', '-target:library', '-define:UNITY_EDITOR,UNITY_6000_0_OR_NEWER,UNITY_2021_3_OR_NEWER', '-out:' + str(out / 'TorchPreflight.dll')]
options += ['-r:' + str(p) for p in refs] + [str(p) for p in sources]
rsp = out / 'preflight.rsp'
rsp.write_text('\n'.join('"' + a + '"' for a in options), encoding='utf8')
csc = next((u / 'DotNetSdk/sdk').glob('*/Roslyn/bincore/csc.dll'))
result = subprocess.run([str(u / 'DotNetSdk/dotnet.exe'), str(csc), '-noconfig', '@' + str(rsp)], capture_output=True, text=True, encoding='utf8', errors='replace')
(out / 'preflight.log').write_text(result.stdout + result.stderr, encoding='utf8')
errors = [l for l in (result.stdout + result.stderr).splitlines() if 'error ' in l]
print('exit:', result.returncode, 'errors:', len(errors))
print('\n'.join(errors[:15]))
raise SystemExit(result.returncode)
