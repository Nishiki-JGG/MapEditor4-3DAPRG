"""必要な原本だけを隔離検証プロジェクトへ写す。元ゲームは読み取り専用。"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('game', type=Path)
parser.add_argument('project', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
project = args.project.resolve()
project.mkdir(parents=True, exist_ok=True)
manifest = []


def copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    manifest.append({'source': str(source), 'target': str(target.relative_to(project)), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})


original = args.game / 'Assets/TotsuDanShell/Prototype'
for name in ['Art/DungeonPresentation/Torch.asset', 'Art/DungeonPresentation/Flame.asset',
             'Art/DungeonPresentation/Blackened iron.mat', 'Art/DungeonPresentation/Torch glow.mat',
             'Resources/DiscoveryPresentation/RoomTorch.prefab', 'Resources/DiscoveryPresentation/TorchSmoke.mat',
             'Resources/DiscoveryPresentation/TorchSpark.mat', 'Runtime/DiscoveryRoomTorchPresentation.cs']:
    for suffix in ['', '.meta']:
        source = original / (name + suffix)
        copy(source, project / 'Assets/TotsuDanShell/Prototype' / (name + suffix))
for source in (args.game / 'Assets/Settings').glob('*'):
    if source.is_file(): copy(source, project / 'Assets/Settings' / source.name)
for name in ['ProjectVersion.txt', 'GraphicsSettings.asset', 'QualitySettings.asset', 'ProjectSettings.asset']:
    copy(args.game / 'ProjectSettings' / name, project / 'ProjectSettings' / name)
for source in (root / 'unity/Assets/MapSharedProps').rglob('*'):
    if source.is_file(): copy(source, project / 'Assets/MapSharedProps' / source.relative_to(root / 'unity/Assets/MapSharedProps'))
copy(root / 'tests/unity/RoomTorchChecks.cs', project / 'Assets/Editor/RoomTorchChecks.cs')
copy(root / 'tests/unity/FireQualityChecks.cs', project / 'Assets/Editor/FireQualityChecks.cs')

# 使用中の版をローカルへコピーしてオフラインで再現する。Library自体は複製しない。
cached = {p.name.split('@')[0]: p for p in (args.game / 'Library/PackageCache').iterdir() if (p / 'package.json').exists()}
done = set()


def package(name):
    if name in done or name.startswith('com.unity.modules.'): return
    done.add(name)
    source = cached[name]
    metadata = json.loads((source / 'package.json').read_text(encoding='utf-8-sig'))
    target = project / 'Packages' / name
    if not target.exists(): shutil.copytree(source, target)
    for dependency in metadata.get('dependencies', {}): package(dependency)


package('com.unity.render-pipelines.universal')
(project / 'Packages/manifest.json').write_text(json.dumps({'dependencies': {
    'com.unity.render-pipelines.universal': '17.5.0', 'com.unity.modules.particlesystem': '1.0.0',
    'com.unity.modules.imageconversion': '1.0.0', 'com.unity.modules.physics': '1.0.0',
    'com.unity.modules.jsonserialize': '1.0.0', 'com.unity.modules.imgui': '1.0.0',
    'com.unity.modules.animation': '1.0.0'}}, indent=2), encoding='utf8')
(project / 'source-manifest.json').write_text(json.dumps({'sources': manifest, 'packages': sorted(done)}, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps({'project': str(project), 'sourceFiles': len(manifest), 'packages': sorted(done)}, ensure_ascii=False))
