# 長い絡み根の曲率と分岐（cnd009）

公開5651f75の棒状の根を、不均等に曲がる主根と下向きへ細くなる枝根へ改修。短い根の単純拡大ではなく長さ2.3mに対する分岐を構成した。236の側根の水平フックは237で既存節点だけを再配分。独立評価92点（形状27/材質17/構造19/Web正式Unity20/軽量9）、確認範囲に固有P1/P2なし。

ID、pivot、取付方式、寸法、配置・保存・Collider契約、既存3textureと他19種は不変。shader/Importer/他製品コードは変更なし。倒木226～235は不採用で復元し、今回に含まない。

## 調査と制作

[NSS Roots / Dave Bunnell](https://caves.org/virtualcave/roots/)を参照し、裂け目から伸びる主根と細根の関係を反映。特定樹種の精密再現ではない。写真転載なし。既存自作atlasを長軸に沿うUVへ使い、色・照度・発光は変更しない。

閉じた管4本を内部で重ねる構造で、融合した単一manifoldではない。静的検査は各閉殻の外向き体積、辺対応、非退化面、面と頂点法線、単位法線、atlas範囲、配置寸法を検査。自己交差全般の保証ではない。

```sh
python tools/build-long-root.py --output output/long-root-reproduction/cave-decor-data.js
python tests/long-root-static.py
node tests/long-root.cjs
```

原稿は比較寸法を公開5651f75から読み、ほかの現在資産を維持して別出力先へ再現する。

## 負荷と検証

- 58→186tri、126→155頂点。洞窟20種各1個の合計1584→1712tri。
- 頂点44B・16bit index概算5892→7936B（+2044B）。texture/material/描画対象数増分0。
- Unity9/225個は全可視、mesh/material/texture各1参照共有。225個で13050→41850tri。短いCPU Camera.Render診断は性能保証ではない。GPU/スマホ/Player未計測。
- Web20種混在保存再読込、実Map/Set Collider比較、旧ID、9/225 InstancedMesh、GLエラー0、正式exportを検証。
- Unity6000.5.9f1/URP17.5/Linear/Forward+。237で正式20種前後生成、Prefab/Scene再読込、mesh/normal/UV/color/transform/material参照/keyword、既存visual-only Colliderを検証。全カタログ再生成ではない。旧Readerバイナリ未実行。既存schema内の変更。
- 7方向・照明診断と、同一の製品坑道Sceneで前後3画角。常設灯の位置/色/照度/range/材質値を同一Scene内で検査し維持。

236近景は壁遮蔽で美観判定から除外。237は天井実高約2.5005mに対しorigin2.51mへ手動埋込み、通路内撮影。近景/反対側の上中下視線12本を実坑道と支柱meshで検査し遮蔽0。通常俯瞰FOV45、近景のみ診断FOV85であり区別する。236/237は標準batchmode終了exit0。217/218終了時c0000005は原因未確定として残し、今回成功で解消扱いしない。

## 限界と反映

近景の低ポリ断面/節点、既存atlasの木材的な粒、暗所で細根が消えること、真横の重なり、手動取付は残る。

更新Webから再exportし、現在の正式Importerで別出力先へ取り込む。既存Prefab/Sceneは自動更新されない。Importer変更なし。ガラス206、原ゲーム、固定岩、他担当水面等は未変更。

公開ページの追加読込/hashは既存証明書エラーで保留。警告無視/再試行/別経路回避なし。Git/Actionsと配信内容の実確認を区別する。
