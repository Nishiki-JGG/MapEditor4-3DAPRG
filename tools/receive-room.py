"""部屋の原稿とZIPを照合し、共通資産を共有したままUnity入力を展開する。"""
import argparse
import json
from pathlib import Path
import shutil
import tempfile
import zipfile
from map_assets import require, sha, safe_entry, checked_zip, check_export, resolve_shared, install_shared

def content(document):
    return {k:v for k,v in document.items() if k not in ('revision','lastExportHash')}

def receive(folder, output=None, shared_dir=None):
    folder=Path(folder).resolve(strict=True)
    require(folder.is_dir(), '部屋フォルダを指定してください。')
    maps=list(folder.glob('*.json'))
    archives=[p for p in folder.glob('*.zip') if not p.name.startswith('tdj-shared-')]
    require(len(maps)==1 and len(archives)==1, '1部屋のフォルダには原稿JSONを1個、Unity用ZIPを1個置いてください。')
    require(maps[0].stat().st_size<128*1024*1024,'原稿が上限128MBを超えています。')
    source=json.loads(maps[0].read_text(encoding='utf-8-sig'))
    require(source.get('format')=='map-editor-proto' and source.get('version')==2,'未対応の原稿形式です。')
    data=checked_zip(archives[0]);manifest=check_export(data)
    ref,assets=resolve_shared(data,folder,shared_dir)
    embedded=json.loads(data['map.json'])
    require(content(source)==content(embedded),'原稿JSONとUnity用ZIPの編集内容が異なります。部屋セットを書き出し直してください。')
    meta=json.loads(data['meta.json']);room_id=source.get('roomId')
    require(bool(room_id) and room_id==manifest.get('roomId')==meta.get('roomId'),'部屋IDが一致しません。')
    require(meta.get('format')=='tdj-map-export' and meta.get('schemaVersion')==3,'未対応の部屋メタデータです。')
    validation=json.loads(data['validation.json'])
    require(isinstance(validation.get('errors'),list),'検証結果がありません。')
    require(not validation['errors'],f"エディタ検証にエラーが{len(validation['errors'])}件あります。原稿を修正してください。")
    ports=meta.get('ports',[])
    require(bool(ports),'出入口がありません。ランダムダンジョン用の出入口を設定してください。')
    ids=[p.get('id') for p in ports]
    require(all(ids) and len(set(ids))==len(ids),'出入口IDが空または重複しています。')
    report={'status':'source_ready','roomId':room_id,'contentHash':manifest['contentHash'],
            'sourceFolder':str(folder),'portIds':ids,'warnings':validation.get('warnings',[]),
            'sharedHash':ref['bundleHash'] if ref else None,
            'next':'地形・素材・小物のUnity取り込み、部屋定義の登録と実プレイ確認が必要です。'}
    if output is not None:
        target=Path(output).absolute()
        require(not target.exists(),'出力先は既存のフォルダを指定できません。')
        require(target.parent.is_dir(),'出力先の親フォルダがありません。')
        temp=Path(tempfile.mkdtemp(prefix='.room-intake-',dir=target.parent))
        try:
            for name,b in data.items():
                dest=temp/'export'/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b)
            (temp/'source.json').write_text(json.dumps(source,ensure_ascii=False),encoding='utf-8')
            if ref:
                report['sharedDirectory']=str(install_shared(target.parent,ref,assets))
            (temp/'intake.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
            temp.rename(target)
        finally:
            if temp.exists():shutil.rmtree(temp)
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('folder');p.add_argument('--output');p.add_argument('--shared',help='共通ZIPの保管フォルダ。通常は部屋または親フォルダから自動検出')
    a=p.parse_args()
    try:print(json.dumps(receive(a.folder,a.output,a.shared),ensure_ascii=False,indent=2))
    except (ValueError,OSError,KeyError,TypeError,zipfile.BadZipFile,RuntimeError) as e:p.exit(2,f'受付できません: {e}\n')
