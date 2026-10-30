# 180: 接地済み貝殻・ヒトデの個体色を保存

基準は `b7242ef6479b85413a540b3a37a8679a539f6926`。公開前の独立レビュー候補であり、push・公開は実施していない。

## 再現と原因

正式 `GroundedPropsV1.Build` の個体色は MaterialPropertyBlock だけにあり、共有材質は白だった。異なる色3個体を生成すると正しいが、Prefab保存→破棄→再instantiateで個体色を失う。Scene保存・再読込でも回復しない。白になるのは個体色係数であり、元のメッシュ色や貝殻テクスチャ自体は残る。

現行基準で3ケースすべて再現した。実効Linear色の最大誤差は0.64509672。正常なoptional texture、optional surfaceなしの従来データ、破損PNGのfallbackを対象にした。元の色、青緑の色、白(1,1,1)を同時に検査した。V1の必須tintは変更しておらず、tint欠落を新たに許容したわけではない。

## 最小修正

既存の個体別結合Meshの頂点色へtintを一度だけ乗算し、非永続のPropertyBlockを除いた。元から個体別Meshだったため、Mesh数やRenderer数は増えず、3個体は3Mesh・1共有Materialを維持する。形状、法線、UV、三角形、配置変換、接地、非衝突を変更しない。宝箱、レール、坑道小物、shader、照明budget、Web/schemaには変更なし。

初期案の単純な乗算では保存できても保存前より明るくなったため棄却した。旧 `MaterialPropertyBlock.SetColor` はLinearプロジェクトでsRGB値をLinearへ変換する。最終案は同じ変換を行い、既存の見た目を保つ。根拠は[Unity SetColor公式仕様](https://docs.unity3d.com/ScriptReference/MaterialPropertyBlock.SetColor.html)と同条件の実画素比較。共有材質を白に保ち、PropertyBlockを復元しないため二重乗算しない。

## 検証

Unity 6000.5.9f1 / URP 17.5、Linear、既存PC RendererのForward+、専用Editorの背景offscreen描画のみ。

- `Evidence180-before3/checks.json`: 保存色回帰は失敗、再現検査として成功。3ケースとも保存前のみ正しい。
- `Evidence180-after2/checks.json`: 3ケースとも生成直後、Prefab再生成、Scene再読込の誤差0。既存形状・法線・UV・配置一致、Colliderなし、共有材質、二重乗算なし。
- `Evidence180-reload/checks.json`: Editorを完全に終了し、別起動で保存済みPrefabとSceneを読んでも誤差0、共有材質1。ここでは新規生成や形状比較を再実行しない（元の汎用Rowの未設定false項目は未測定）。
- 主光、点光、spot、全消灯 × texture/legacy/fallbackの12組で、旧保存前→修正保存前・Prefab・Sceneの各RGB最大画素差はすべて0。照明や陰影の変更で色差を隠していない。
- shaderのcompile errorなし。全73種の再生成は今回実行せず、製品差分をGroundedPropsV1だけに限定して他経路を保全。

証拠JSONは `tests/evidence/grounded-tint180.json`。画像は専用検証プロジェクトの `Evidence180-before3/` と `Evidence180-after2/` に保全し、upload・repoへの大画像追加はしない。

## 再現手順と更新

隔離した既存URP検証プロジェクトへ製品sourceと `tests/unity/Grounded180Checks.cs`、描画helper `tests/unity/Shared117Review.cs` を配置する。既存の貝殻1個体の正式出力 `Input119/grounded_props.json` を使用する（元fixtureのhashは証拠JSON）。既存 `Assets/Settings/PC_RPAsset.asset` を使う。入力はテストが3色と3surface条件へ派生させる。

基準版sourceで `Grounded180Checks.RunBaseline`、修正版sourceへ交換後 `RunFixed`、Editorを終了して別起動で `RunReload`。いずれも背景Editorの `-batchmode -force-d3d11 -executeMethod` を使い、Playerは作らない。出力が既にある時は上書きせず停止する。再実行する場合はテストの専用出力名を別名にして既存証拠を保全する。

導入側は更新したImporterで元の正式exportを新しい出力先へ再importする。既存の色を失ったPrefabに入力tintは残っていないため、この変更だけで既存Sceneを自動修復しない。元exportを使って再生成して差し替える。プロジェクトの色空間変更後も再importが必要。ゲーム本体Sceneは変更していない。

旧119検証のPropertyBlock値/未乗算頂点色の一致は当時の表現方式を検査したもの。今回の保存方式にはそのまま適用せず、180でshaderへ届く実効色と保存後の画素を検査した。

## 未検証・制約

Gamma分岐はsource確認のみ。Forward/頂点追加光、Player、mobile/GPU、実ゲーム全セッションは今回未実行。照明式変更はない。評価画像は色永続化の固定条件であり実マップの新しい美術評価とは扱わない。既存未追跡物と他担当成果は保持。公開前の独立レビューが残る。
