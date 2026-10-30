"""旧Unity用ZIPを、共通資産を1回だけ保存する軽量セットへ変換する。元ファイルは変更しない。"""
import argparse
import json
from pathlib import Path
import shutil
import tempfile
from map_assets import checked_zip, check_export, lightweight, reconstruct, require, sha, write_zip

def convert(source, output):
    source=Path(source).resolve(strict=True);output=Path(output).absolute()
    require(not output.exists() and output.parent.is_dir(), '新規出力フォルダを指定してください。')
    archives=sorted(source.glob('*_export_unity.zip'))
    require(bool(archives), 'Unity用ZIPがありません。')
    temporary=Path(tempfile.mkdtemp(prefix='.compact-rooms-',dir=output.parent))
    reports=[];shared_hashes=set()
    try:
        for archive in archives:
            raw_sha=sha(archive.read_bytes());data=checked_zip(archive);manifest=check_export(data)
            require(manifest['schemaVersion']==3,'既に軽量化された出力です。再変換は不要です。')
            base=archive.name.removesuffix('_export_unity.zip');original=source/(base+'.json')
            embedded=json.loads(data['map.json'])
            if original.exists():
                source_map=json.loads(original.read_text(encoding='utf-8-sig'))
                clean=lambda d:{k:v for k,v in d.items() if k not in ('revision','lastExportHash')}
                require(clean(source_map)==clean(embedded), '原稿とZIPの内容が異なります: '+base)
            local,shared,ref=lightweight(data)
            restored=reconstruct(local,shared)
            for n,b in data.items():
                if n=='manifest.json':continue
                require(json.loads(b)==json.loads(restored[n]) if n=='small_props.json' else b==restored[n], '変換で内容が変わりました: '+n)
            room=temporary/base;room.mkdir()
            if original.exists():shutil.copyfile(original,room/original.name)
            else:(room/(base+'.json')).write_bytes(data['map.json'])
            write_zip(room/archive.name,local)
            common=temporary/('tdj-shared-'+ref['bundleHash']+'.zip')
            if not common.exists():write_zip(common,shared)
            # Independent standard ZIP reader: CRC, decompression, entry-by-entry bytes.
            require(checked_zip(room/archive.name)==local and checked_zip(common)==shared,'圧縮後の復元不一致')
            require(sha(archive.read_bytes())==raw_sha,'入力が処理中に変更されました')
            shared_hashes.add(ref['bundleHash'])
            reports.append({'name':base,'beforeBytes':archive.stat().st_size,'roomZipBytes':(room/archive.name).stat().st_size,
                            'sharedZipBytes':common.stat().st_size,'sharedHash':ref['bundleHash'],'sourceSha256':raw_sha,'lossless':True})
        (temporary/'保存について.txt').write_text('各部屋フォルダと、親にあるtdj-shared-*.zipを一緒に保管してください。共通ZIPは同じ版につき1つです。\n部屋の検証エラーや未対応機能は変換前のまま保持しています。容量変換はゲーム登録やプレイ合格ではありません。\n',encoding='utf-8')
        summary={'rooms':reports,'sharedVersions':len(shared_hashes),'beforeZipBytes':sum(r['beforeBytes'] for r in reports),
                 'afterZipBytes':sum(p.stat().st_size for p in temporary.rglob('*.zip'))}
        (temporary/'容量比較.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
        temporary.rename(output)
        return summary
    finally:
        if temporary.exists():shutil.rmtree(temporary)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source');p.add_argument('output');a=p.parse_args()
    print(json.dumps(convert(a.source,a.output),ensure_ascii=False,indent=2))
