# トロッコ鋼板の規則模様を軽減（192）

独立評価は空荷93（27/18/19/20/9）、積載92（27/18/19/20/8）、当該P1/P2なし。近景の鋼板内外に見えた等間隔の横うねりを、異なる尺度の不均一な酸化・摩耗へ変更した。効果は鋼板の不自然な規則模様の軽減で、通常距離の差は小さい。暗所素材差や積荷の平面感は残す。

[San Luis Obispo Railroad Museumの実鉱車](https://slorrm.com/QR-minecart.html/)の鋼板・リベット・四輪台車の説明を再確認した。写真転用なし。既存の静的鉱車構造は変えず、自作colour/packed/normalの鋼板区画だけを修正。平均RGBは86.25/84.19/84.85から85.91/84.22/85.00で、単なる暗色化ではない。車輪・台枠区画は3mapとも全画素一致。積載版も同じ鋼板を再利用する。

## 検証と範囲

- 空荷2200tri・積載2440tri、形状/UV/頂点法線/頂点色/ID/Colliderメタデータ前後一致。車体、9個の積荷、車輪、軌間、接地と配置仕様は維持。
- Web正式loader、直線/曲線レール接地、通常距離/近景/反対光/夜、保存再読込、実Collider比較、積載版のない旧保存のID復元。正式export内の2optional payloadを取得し、全geometry/設定を前後比較。
- Unity6000.5.9f1/URP17.5の正式MineCartV1.Optional/Buildで空荷・積載の2対象を別出力に生成。Prefab保存・破棄・再instantiate、Scene保存・再読込、実Collider、URP/Litのnormal/metallic接続と非発光を確認。旧74種全再生成ではない。変更のないoptional欠落/不正/旧Reader経路は182/183証拠を再利用し、旧バイナリ実行とはしない。
- 同じ実坑道・通常カメラと近景、曲線、固定スタジオ反対光で比較。坑道の既存炎は白芯の時間差が残るため全画面の厳密同時刻比較とはしない。採否は固定スタジオでも確認。元ゲーム原本は未変更。
- 各単品9/225配置でmesh/material各1・texture3。空荷mesh978,384B/texture4,022,545B、積載mesh1,084,944B/texture8,042,071B。共存6texture合計12,064,616Bは前後不変。225中210可視。atlas複製費用は未解決。CPUは短い描画投入の参考値、実GPU/スマホ/Playerの性能保証ではない。

`node tests/cart-steel.cjs`。`LOADED_ROOT`・`LOADED_OUTPUT`で場所、`CART_BASELINE`で比較元生成コードを指定。出力はローカルに保存する。UnityのInput192はWeb正式exportから抜いたempty/load payloadと2配置CSVだけで、巨大なプロジェクト複製は作らない。`Cart192Checks.Run`は既存183の基準PrefabとInput123Mineの検証坑道を再利用する。数値・画像hashは `tests/evidence/cart-steel192.json`、実画像はローカル `Evidence192/{before,after}` と `output/cart192`。

更新したWebから再exportし、既存正式Importerで別出力へ再importして確認後にPrefabを置換する。Importer/shader更新は不要。古いPrefabは自動的には変わらない。GUI/Player/AV操作・画像upload・固定岩再生成は0。

鋼板mapの初回生成CPUは同じPC・headless Chromeの各1回測定で30.8→48.6ms。約17.8ms増であり高速化ではない。生成結果は共有キャッシュし、毎フレーム生成しない。GPUアップロードとスマホ性能はこの値に含めない。
