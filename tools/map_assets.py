"""共通資産ZIPの検証・軽量化。形状や画質の削減は行わない。"""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile
import zipfile

SHARED = {'shared_props.json', 'shared_ground.json', 'pine_wind.json', 'small_props_library.json'}
LIMIT = 512 * 1024 * 1024

def require(ok, message):
    if not ok:
        raise ValueError(message)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def encode(data):
    return json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')

def safe_entry(name):
    p = PurePosixPath(name)
    reserved = {'CON', 'PRN', 'AUX', 'NUL'} | {f'{s}{n}' for s in ('COM', 'LPT') for n in range(1, 10)}
    return (not p.is_absolute() and all(part not in ('', '.', '..') and
            not any(ord(c) < 32 or c in '\\:*?"<>|' for c in part) and
            not part.endswith((' ', '.')) and part.split('.')[0].upper() not in reserved for part in name.split('/')))

def checked_zip(path):
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        require(len(infos) <= 4096 and sum(i.file_size for i in infos) <= LIMIT, 'ZIPが受付上限を超えています。')
        names = [i.filename for i in infos]
        require(len({n.casefold() for n in names}) == len(names), 'ZIPのファイル名が重複しています。')
        require(all(safe_entry(n) for n in names), 'ZIP内のパスが不正です。')
        require(all((i.external_attr >> 16) & 0o170000 != 0o120000 for i in infos), 'ZIP内のリンクは受付できません。')
        return {n: z.read(n) for n in names}

def verify_listing(data, listing):
    require(isinstance(listing, list), 'ファイル一覧がありません。')
    names = [i['name'] for i in listing]
    require(len(set(names)) == len(names) and set(names) == set(data), 'ファイル一覧が一致しません。')
    for item in listing:
        b = data[item['name']]
        require(len(b) == item['bytes'] and sha(b) == item['sha256'], '内容が変更されています: '+item['name'])

def check_export(data):
    require({'manifest.json', 'map.json', 'meta.json', 'validation.json'} <= data.keys(), '必須ファイル不足')
    m = json.loads(data['manifest.json'])
    require(m.get('format') == 'tdj-map-export-manifest' and m.get('schemaVersion') in (3, 4), '未対応の書き出し形式')
    verify_listing({n:b for n,b in data.items() if n != 'manifest.json'}, m['files'])
    digest = '\n'.join([m['exporterVersion']] + [f"{f['name']} {f['sha256']}" for f in m['files']])
    require(sha(digest.encode()) == m['contentHash'], '書き出し全体のハッシュ不一致')
    if m['schemaVersion'] == 4:
        require('shared_assets.json' in data, '軽量版の共通参照がありません。')
    return m

def descriptor(shared):
    files = [{'name': n, 'bytes': len(shared[n]), 'sha256': sha(shared[n])} for n in sorted(shared)]
    digest = '\n'.join(['tdj-shared-assets/1']+[f"{f['name']} {f['sha256']}" for f in files])
    return {'format':'tdj-shared-assets', 'schemaVersion':1, 'bundleHash':sha(digest.encode()), 'files':files}

def check_reference(ref):
    require(ref.get('format') == 'tdj-shared-assets' and ref.get('schemaVersion') == 1, '未対応の共通資産参照')
    require(isinstance(ref.get('bundleHash'), str) and re.fullmatch('[0-9a-f]{64}', ref['bundleHash']), '共通資産IDが不正')
    files = ref.get('files')
    require(isinstance(files,list) and bool(files), '共通ファイル一覧がありません。')
    names = [f['name'] for f in files]
    require(len(set(names)) == len(names) and names == sorted(names) and set(names) <= SHARED, '共通ファイル名が不正')
    digest = '\n'.join(['tdj-shared-assets/1']+[f"{f['name']} {f['sha256']}" for f in files])
    require(sha(digest.encode()) == ref['bundleHash'], '共通資産IDが一致しません。')
    return ref

def resolve_shared(data, folder, shared_dir=None):
    if 'shared_assets.json' not in data:
        return None, {}
    ref = check_reference(json.loads(data['shared_assets.json']))
    require(not (set(data) & {f['name'] for f in ref['files']}), '共通資産のローカル重複は受付できません。')
    filename = 'tdj-shared-'+ref['bundleHash']+'.zip'
    folders = [Path(shared_dir)] if shared_dir else [Path(folder), Path(folder).parent]
    source = next((p/filename for p in folders if (p/filename).is_file()), None)
    require(source is not None, '必要な共通資産がありません: '+filename+'（共通資産を保存し、部屋フォルダまたは親フォルダへ置いてください）')
    assets = checked_zip(source)
    require('shared_assets.json' in assets and json.loads(assets.pop('shared_assets.json')) == ref, '共通資産の版が違います。')
    verify_listing(assets, ref['files'])
    return ref, assets

def install_shared(parent, ref, assets):
    """部屋間で同じ共有展開先を再使用。既存内容の改変は拒否する。"""
    base = Path(parent)/'_shared'
    base.mkdir(exist_ok=True)
    require(not base.is_symlink(), '共通保存先のリンクは使用できません。')
    target = base/ref['bundleHash']
    if target.exists():
        require(target.is_dir() and not target.is_symlink(), '共通保存先が不正')
        require(all(p.is_file() and not p.is_symlink() for p in target.iterdir()), '共通保存先に不正な項目')
        existing = {p.name:p.read_bytes() for p in target.iterdir()}
        require(json.loads(existing.pop('shared_assets.json')) == ref, '既存共通資産の版違い')
        verify_listing(existing, ref['files'])
        return target
    temp = Path(tempfile.mkdtemp(prefix='.shared-', dir=base))
    try:
        for n,b in assets.items(): (temp/n).write_bytes(b)
        (temp/'shared_assets.json').write_bytes(encode(ref))
        temp.rename(target)
    finally:
        if temp.exists(): shutil.rmtree(temp)
    return target

def lightweight(data):
    old = check_export(data)
    require(old['schemaVersion'] == 3, '変換対象は旧自己完結ZIPです。軽量版を再変換する必要はありません。')
    shared = {n:b for n,b in data.items() if n in SHARED}
    local = {n:b for n,b in data.items() if n not in SHARED and n != 'manifest.json'}
    if 'small_props.json' in local:
        d = json.loads(local['small_props.json'])
        lib = {k:v for k,v in d.items() if k not in ('instances','grounded')}
        shared['small_props_library.json'] = encode(lib)
        local['small_props.json'] = encode({k:d[k] for k in ('version','units','axes','instances','grounded')} | {'library':'small_props_library.json'})
    require(bool(shared), '分離対象の共通資産がありません。')
    ref = descriptor(shared)
    local['shared_assets.json'] = encode(ref)
    listing = [{'name':n, 'bytes':len(b), 'sha256':sha(b)} for n,b in local.items()]
    digest = '\n'.join([old['exporterVersion']]+[f"{f['name']} {f['sha256']}" for f in listing])
    local['manifest.json'] = encode(old | {'schemaVersion':4,'files':listing,'contentHash':sha(digest.encode())})
    shared['shared_assets.json'] = encode(ref)
    return local, shared, ref

def write_zip(path, data):
    with zipfile.ZipFile(path, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for n,b in data.items(): z.writestr(n,b)

def reconstruct(local, shared):
    """損失なしを確認するため、旧形式の論理データを復元する。"""
    result = {n:b for n,b in local.items() if n not in ('manifest.json','shared_assets.json')}
    result.update({n:b for n,b in shared.items() if n not in ('shared_assets.json','small_props_library.json')})
    if 'small_props_library.json' in shared:
        d = json.loads(result['small_props.json']);lib = json.loads(shared['small_props_library.json'])
        result['small_props.json'] = encode(lib | {'instances':d['instances'],'grounded':d['grounded']})
    return result
