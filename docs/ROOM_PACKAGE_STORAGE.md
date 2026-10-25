# 部屋データと共通資産の保存

2026-10-25更新：普段の保存は[素材単位の自動同期](ASSET_REGISTRY.md)を使用してください。以下の共通ZIP手順は従来形式・移送用として残しています。

マップの見た目・形状・画像品質を維持し、共通モデルの重複と無圧縮ZIPを解消します。

## 制作者の操作

1. 「部屋セットを保存」で、原稿JSONと軽量Unity用ZIPのセットを保存します。
2. 初回、またはエディタの素材が更新されたときに「共通資産を保存」を押します。
3. 共通資産ZIPは各部屋フォルダの親に置きます。同じファイル名なら1つだけ保管します。

```text
Maps/
  tdj-shared-<64桁の版ID>.zip
  草原001/
    草原001.json
    草原001_export_unity.zip
  草原002/
    草原002.json
    草原002_export_unity.zip
```

共通版IDは内容のSHA-256から決まります。小物を移動しただけで共通版は変わりません。モデル・画像・共通設定が変わると別の版になります。旧部屋が参照する版も残してください。部屋セット内の「保存について.txt」に必要な共通ZIP名が記載されます。別のPCへ渡すときも、その共通ZIPを添えます。

従来の「Unity用書き出し」ボタンも軽量版を保存します。内部の制作・検査向け `buildExport()` は既存利用との互換のため旧自己完結形式を返し、利用者向けの保存入口はすべて `buildExport({sharedAssets:true})` を使います。

## 旧マップを軽量化する

Python標準ライブラリだけで変換できます。元ファイルを上書きしません。

```powershell
python tools/compact_rooms.py "C:/Maps/旧マップ" "C:/Maps/軽量版"
```

`*_export_unity.zip` を持つ部屋を変換します。同名原稿があれば内容を照合してコピーし、無ければZIP内の原稿を使います。旧形式の全manifestを検証した後、共通資産を分離し、DEFLATEで圧縮します。全固有ファイルとモデル・画像を復元照合し、原稿・配置は同じままです。部屋の検証エラーや出入口不足は保持し、容量変換をプレイ合格とは扱いません。

実測（2026-10-25、ユーザーの4部屋、ZIPの合計・十進MB）:

| 部屋 | 旧ZIP | 軽量ZIP |
|---|---:|---:|
| 草原001 | 35.90 | 1.98 |
| 草原002 | 54.62 | 6.29 |
| 草原003 | 53.95 | 6.11 |
| 草原004 | 35.83 | 2.40 |

共通ZIPは4部屋合わせて6.20MBが1つ。合計180.30MBから22.99MBへ、約87.2%削減。外側の編集用JSON、ゲームのbuild容量や実行時メモリはこの比較に含みません。

## 受付とUnity

```powershell
python tools/receive-room.py "C:/Maps/草原001" --output "C:/Import/草原001"
```

共通ZIPは部屋フォルダまたは親から探します。別の場所なら `--shared "C:/Libraries"` を指定します。全ファイルSHA・原稿一致・出入口・検証結果を確認し、新規出力だけへ公開します。共通ファイルは `C:/Import/_shared/<版ID>/` へ一度だけ展開します。2部屋目以降は同じ版を再使用します。

Unityの共有小物Builderは、旧形式では部屋内、新形式では親または祖父親の `_shared/<版ID>` を参照します。欠落・別版・改変・ローカル同名競合を明示エラーにし、別モデルで代用しません。

取り込み後の共通Mesh・画像は `Assets/MapSharedAssetCache` に内容と取り込み設定から決めたIDで保存します。複数部屋で同じ資産を参照し、部屋固有のMaterial・接地画像・配置データは各部屋に保持します。全キャッシュの手動削除は、その資産を参照するPrefabを確認してから行ってください。

この対応は容量と参照の改善です。ゲーム本体の水・橋・全小物・通常探索の一括取り込みを完成させるものではありません。

## 形式

- 部屋manifestはschemaVersion 4、metaは既存schemaVersion 3のまま。旧manifest 3も受付可能です。
- 共通の `shared_assets.json` はschemaVersion 1。ファイル名順の `name sha256` と先頭 `tdj-shared-assets/1` を改行連結しSHA-256を取った値がbundleHashです。
- `shared_props.json`、`shared_ground.json`、`pine_wind.json` は共通側。編集可能なasset_catalogと地形・配置は部屋側。
- 小物のatlas/assetsは `small_props_library.json`、色・地形に合わせた調整は部屋側の `small_props.json` に残します。
- ZIPは可逆DEFLATE。ブラウザの実装は[Compression Streamsの標準](https://compression.spec.whatwg.org/)を利用します。画質削減・頂点削減は行いません。
