# 短い垂れ根の立体と分岐（cnd008）

4角断面と直線的な枝で平たい木片に見えた既存根を、湾曲する主根・左右非対称の枝根・細根1本へ改修。既存節点の再配分で側根の肘状の折れを弱めた。ID、pivot、寸法、取付高さ、配置・保存形式、無衝突仕様は維持。ほか19種・既存atlas2枚・材質設定・shader・Importerは完全不変。

## 根拠と制作

National Speleological Society の [Roots / Dave Bunnell](https://caves.org/virtualcave/roots/) と NPS の [Nāhuku再開記録](https://www.nps.gov/havo/learn/news/lava-tube-reopens-2021.htm) を参照。天井から下へ伸びる根と太い根から細根への関係を設計の参考とした。特定樹種の再現ではない。外部写真の転載・テクスチャ転用なし。既存の樹皮atlasを長手方向に連続したUVへ割り当て、固定ハイライトや発光は加えていない。

制作原稿は `tools/build-hanging-root.py`。元の配置契約を公開eb2fd824から読み、他の現行資産を保持して明示した別出力先に再現する。

```sh
python tools/build-hanging-root.py --output output/root-reproduction/cave-decor-data.js
python tests/hanging-root-static.py
node tests/hanging-root.cjs
```

各管は閉じた断面だが分岐の接合は内部交差であり、一本の溶接済みmanifoldではない。新しい枝根の大量追加ではなく既存の主従を維持。天井へ手動で根元を埋めて使う。

## 軽量性と互換

- 58→168三角形、126→144頂点。洞窟20種合計1271→1381三角形。
- 頂点属性＋16bit index概算5892→7344B。texture増加0、材質増加0、描画対象数増加0。
- 正式Unity9/225個は全可視、mesh/material/texture各1参照を共有。225個の三角形は13050→37800。CPU Camera.Renderの短時間診断は性能保証に使わない。GPU・スマホ・Playerは未測定。
- Webは実Map/Setを正規化したCollider比較、20種混在保存再読込、共有archive/export、配置高さUIを検証。棚キノコを含む他19種のデータ完全一致。
- schema・material・assetKeyを変えない。旧Readerバイナリは未実行。既存shared-registryの許容数内のmeshであり、新しい任意material契約は追加していない。

## Unity検証と未解決事項

専用Unity6000.5.9f1/URP17.5/Linear/Forward+で正式20種の前後生成、Prefab・Scene再読込、transform/mesh/normal/UV/color/material共有とkeyword、既存visual-only Colliderを確認。216はexit0。最終形状217および同形状218では全検査完了後の終了時にc0000005が発生した。終了を1秒遅らせても解消しなかったため、検査成功と正常終了を混同しない。Windowsイベントログの追加読取はUnauthorizedAccessで停止し、原因確定には使っていない。

219では同じ製品の保存済み正式Prefabを読み込み、実坑道の同一Sceneで根だけを交換。標準 `-batchmode -quit -executeMethod Root219Field.Run` で正常終了exit0。これはfield描画の正常終了であり、218の異常終了記録を取り消さない。全工程をこの1回で実行したという主張もしない。

216は灯具画像差があり全面同条件の根拠から除外。217/218の近景は梁遮蔽により除外。元坑道meshのray計算でcameraからframe z8.14/8.36への交差を特定。219では根取付点の実天井高2.5005mに対しorigin2.51m、カメラ(12.6,1.7,8.5)から根の中央・上・下への遮蔽物交差0。通常距離は既存cutaway、近景は通路内から表示。坑道灯具の数・位置・色・強度・range・材質値は同一Sceneで保持している。

`tests/unity/Root218Checks.cs` は正式20種/保存/共有、`Root219Field.cs` は保存済みPrefabのfield追試。専用環境の `Input217.json`、`Input123Mine`、既存Shared117Review/ColliderSnapshot109、生成Prefab参照を使う再現原稿。219の出力scopeラベルの「正式再読込219」は誤記で、正しくは218。元実行証跡を維持し訂正を別記した。

材質の均質さ、近景の低ポリ断面、暗所で小さく見えること、真横で枝が重なる角度、手動取付は限界。実ゲーム完全セッション、全カタログ再生成、GPU安定性の保証はしない。

## 反映手順

更新したWebからexportし、既存の公開Importerで別出力先へ再importして新Prefabを確認する。既存Prefab/Sceneが自動更新されるわけではない。今回はImporter変更なし。ガラス206、原ゲーム、固定岩、水面等の他担当領域は変更していない。

独立最終評価は92/100（形状27・材質17・構造配置19・Web/正式Unity20・軽量9）、確認範囲で固有P1/P2なし。全20種UI回帰も完了。sample/sample2の実行時キーは公開215と一致し、準備済みbundle bytes不変・固定岩再生成0。
