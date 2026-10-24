"""部屋フォルダの原稿とUnity ZIPを照合し、取り込み用入力を展開する。標準ライブラリのみ。"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import tempfile
import zipfile


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def content(document):
    return {k: v for k, v in document.items() if k not in ('revision', 'lastExportHash')}


def safe_entry(name):
    p = PurePosixPath(name)
    parts = name.split('/')
    reserved = {'CON', 'PRN', 'AUX', 'NUL'} | {f'{s}{n}' for s in ('COM', 'LPT') for n in range(1, 10)}
    return (not p.is_absolute() and all(part not in ('', '.', '..') and
            not any(ord(c) < 32 or c in '\\:*?"<>|' for c in part) and
            not part.endswith((' ', '.')) and part.split('.')[0].upper() not in reserved for part in parts))


def receive(folder, output=None):
    folder = Path(folder).resolve(strict=True)
    require(folder.is_dir(), '部屋フォルダを指定してください。')
    maps = list(folder.glob('*.json'))
    archives = list(folder.glob('*.zip'))
    require(len(maps) == 1 and len(archives) == 1, '1部屋のフォルダには原稿JSONを1個、Unity用ZIPを1個置いてください。')
    require(maps[0].stat().st_size < 128 * 1024 * 1024, '原稿が上限128MBを超えています。')
    source = json.loads(maps[0].read_text(encoding='utf-8-sig'))
    require(source.get('format') == 'map-editor-proto' and source.get('version') == 2, '未対応の原稿形式です。')
    with zipfile.ZipFile(archives[0]) as archive:
        entries = archive.infolist()
        names = [e.filename for e in entries]
        require(len(entries) <= 4096 and sum(e.file_size for e in entries) <= 512 * 1024 * 1024, 'ZIPが受付上限を超えています。')
        require(len({n.casefold() for n in names}) == len(names), 'ZIPに重複したファイル名があります。')
        require(all(safe_entry(n) for n in names), 'ZIPに不正な展開先があります。')
        require(all((e.external_attr >> 16) & 0o170000 != 0o120000 for e in entries), 'ZIP内のリンクは受付できません。')
        require({'manifest.json', 'map.json', 'meta.json', 'validation.json'}.issubset(names), 'Unity用ZIPの必須ファイルが不足しています。')
        manifest = json.loads(archive.read('manifest.json'))
        require(manifest.get('format') == 'tdj-map-export-manifest' and manifest.get('schemaVersion') == 3, '未対応の書き出し形式です。')
        listing = manifest['files']
        listed = [f['name'] for f in listing]
        require(len(set(listed)) == len(listed) and set(listed) == set(names) - {'manifest.json'}, 'ZIPの内容とmanifestの一覧が一致しません。')
        for item in listing:
            data = archive.read(item['name'])
            require(len(data) == item['bytes'] and sha(data) == item['sha256'], f"ファイルが破損または変更されています: {item['name']}")
        digest = '\n'.join([manifest['exporterVersion']] + [f"{f['name']} {f['sha256']}" for f in listing])
        require(sha(digest.encode()) == manifest['contentHash'], '書き出し全体のハッシュが一致しません。')
        embedded = json.loads(archive.read('map.json'))
        require(content(source) == content(embedded), '原稿JSONとUnity用ZIPの編集内容が異なります。部屋セットを書き出し直してください。')
        meta = json.loads(archive.read('meta.json'))
        room_id = source.get('roomId')
        require(bool(room_id) and room_id == manifest.get('roomId') == meta.get('roomId'), '部屋IDが一致しません。')
        require(meta.get('format') == 'tdj-map-export' and meta.get('schemaVersion') == 3, '未対応の部屋メタデータです。')
        validation = json.loads(archive.read('validation.json'))
        require(isinstance(validation.get('errors'), list), '検証結果がありません。')
        require(not validation['errors'], f"エディタ検証にエラーが{len(validation['errors'])}件あります。原稿を修正してください。")
        ports = meta.get('ports', [])
        require(bool(ports), '出入口がありません。ランダムダンジョン用の出入口を設定してください。')
        ids = [p.get('id') for p in ports]
        require(all(ids) and len(set(ids)) == len(ids), '出入口IDが空または重複しています。')
        report = {'status': 'source_ready', 'roomId': room_id, 'contentHash': manifest['contentHash'],
                  'sourceFolder': str(folder), 'portIds': ids, 'warnings': validation.get('warnings', []),
                  'next': '地形・素材・小物のUnity取り込み、部屋定義の登録と実プレイ確認が必要です。'}
        if output is not None:
            target = Path(output).absolute()
            require(not target.exists(), '出力先は既存のフォルダを指定できません。別名を指定してください。')
            require(target.parent.is_dir(), '出力先の親フォルダがありません。')
            # 読み取り・照合が全部成功した後だけ、新規フォルダへ公開する。
            temporary = Path(tempfile.mkdtemp(prefix='.room-intake-', dir=target.parent))
            try:
                for name in names:
                    dest = temporary / 'export' / name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(archive.read(name))
                (temporary / 'source.json').write_text(json.dumps(source, ensure_ascii=False), encoding='utf-8')
                (temporary / 'intake.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
                # Windowsのrenameは既存フォルダを置き換えない。
                temporary.rename(target)
            finally:
                if temporary.exists():
                    shutil.rmtree(temporary)
        return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', help='原稿JSONとUnity用ZIPのある部屋フォルダ')
    parser.add_argument('--output', help='照合後に展開する新規フォルダ（省略時は確認のみ）')
    args = parser.parse_args()
    try:
        print(json.dumps(receive(args.folder, args.output), ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, TypeError, zipfile.BadZipFile, RuntimeError) as error:
        parser.exit(2, f'受付できません: {error}\n')
