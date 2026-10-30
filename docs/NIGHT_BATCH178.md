# 古いクモの巣 — レビュー候補178

基点 `e8e187419593383e3b69567ef1ad0db8fc5a2c92`。未公開。自己評価91点（見た目26/30、材質17/20、構造配置19/20、Web・正式Unity20/20、軽さ9/10）。独立評価で合格と判断されるまでは公開しない。

## 形と資料

円網の放射状アイコンではなく、梁と壁隅に残った不規則な古い巣を制作した。[Burke Museumの網形の解説](https://www.burkemuseum.org/collections-and-research/biology/arachnology-and-entomology/spider-myths/myth-orb-round-spider-webs-normal)と[Australian Museumの網の解説](https://australian.museum/learn/animals/spiders/spider-webs/)、[乾いた構造物内の乱網の例](https://australian.museum/learn/animals/spiders/redback-spider/)を構造参考にした。特定種の正確な生態再現ではない。写真・配布テクスチャの転用は0。支持糸・密な捕獲部2群・たるみ・破れ・局所の埃をCanvasで自作した。

初稿177の均一な網目と閉じた外周を、178で局所密度と途切れた下縁へ改善した。細糸の群は既存の支持網へ接続し、宙に浮く断片にしない。形状は変更せず80三角形。近景の角張った網目と長い支持糸は残る減点であり、写実的な埃の質感とは言わない。

## 配置・正式経路

`mine_cobweb`／「古いクモの巣」を坑道小物へ末尾追加。幅1.6m・高さ1.2m、湾曲した薄い面で壁へ密着しすぎない構成。標準中心高は床+1.65m。Q/E・サイズ変更後のプレビューと確定値、保存高さを一致させる。壁・梁への接点は手動で合わせる。自動壁吸着や蜘蛛AIはない。

通常配置は非衝突・追加光源なし・非発光。任意の円／形状Colliderを正式Importerで確認した。表裏は逆向き法線の面を持ちCullBackで描画。透明ブレンドではなくalpha clip、深度書込あり。重なり順に依存する白い四角を防ぐ。細糸の不自然な全面影を防ぐためcastShadowは無効、周囲の影は受ける。

自作512² RGBA1枚を共有。sRGB色、roughness .91、alpha cutoff .12。Unityは標準URP/Litの不透明clip、coverage維持mip、AlphaToMaskを使用。Webは標準MeshStandardMaterialとmipを使用。異なるAA環境での完全な見た目一致は保証しない。

正式 `mineCobwebV1` をloader/export/importに接続。欠落・不正データは当該巣だけを警告して省略し旧52小物を生成する。新53小物と既存洞窟装飾20種を明示配置した入力で73Prefabを生成。既存52小物のMesh・実Colliderを前版と比較、洞窟20種の生成と既存ソース維持を確認。旧Readerの未知optional無視はソース契約確認であり、旧バイナリは起動していない。

## 実証

- Web：通常loader、近景3m／通常10m／遠景16m、反対光、裏側、低照度、消灯、斜角、重なり。実入力Ctrl+wheel／E、プレビュー→配置→保存再読込一致。Mapの中身を正規化した非衝突比較。
- Unity6000.5.9f1・URP17.5：専用背景Editorでコンパイル・正式Prefab生成、保存→破棄→再instantiate、Scene再読込。最終178は画像のみ更新のため177の73種・不正入力・Collider検証を再利用し、最終画像のdecode/importと再instantiateを実施。
- 実坑道生成入力を使い幅2.4m／高さ2.8m、既存壁掛けランタンの共有照明で通常距離・近景・逆方向・消灯・巣なしを比較。元シーンは未変更。巣の設定座標とカメラ条件は検証ソース／JSONに記録。
- 2枚重なりの3角度と通常距離のカメラ横移動3フレーム。明るい糸の画素1949→1987→1932、全体消失や四角面化は見られない。ただし細糸のサブピクセル変動は残り、長時間動画や全AA条件のちらつき保証ではない。
- Web9/225で追加draw1、共有1材質、texture数一定、追加灯0。Unity9/225でMesh/材質/texture各1、texture約2.80MB、mesh11,184B。225中129が視錐台内。CPU中央値4.34/4.01msはRenderTexture読戻し込みであり、製品フレーム時間・GPU性能保証ではない。
- 既存レールの直線／左右曲線／閉ループ／端点／一筆Undo／取消／保存、タッチプレビュー、複数ボタン、WASD境界を再検証。既存灯具混在の6灯上限／影2灯上限、削除後残留0。金銀虹や灯具の製品コードは不変更。
- 固定sample2種のkey/profile/bundle byte一致、再生成0、manifest check成功。file起動で既存同梱PBRと新しい巣の表示・exportも確認。

## 再現と証拠

`node tests/mine-cobweb.cjs`、`node tests/mine-cobweb-input.cjs`、`node tests/mine-cobweb-offline.cjs`。出力先は `MINE_COBWEB_OUTPUT`、正式出力先は `MINE_COBWEB_INPUT` で指定できる。大きなexportはCDPへ全文転送せずローカルHTTPでファイルへ書く。

Unity検査は既存検証環境の `Input177` と、洞窟装飾20種を実配置した `Input177-mixed` を使用し、`Cobweb177Checks.Run`／`Cobweb178Checks.Run` を専用Editor batchmodeで実行。既存 `Shared117Review`／`ColliderSnapshot109` と実坑道入力 `Input123Mine` を使う。全ゲーム本体の完全セッション試験ではない。

機械可読記録は `tests/evidence/mine-cobweb178.json`。代表画像はローカルの `output/cobweb178-final`、専用検証環境 `Evidence178`。前比較は `output/cobweb177`／`Evidence177`。画像はアップロードもGit同梱もしていない。

検査途中の失敗を隠さない：初回73件検査は洞窟装飾を配置しない入力で53件になったため、実配置を含む混在入力へ修正。準備引用エラー後に起動した専用Editor1件のみ停止し再実行、最終pass。既存ランタンテストの「末尾」条件は追加品で無効になったため、既存固定index163へ変更して再検証した。

Player/build、ユーザーGUI・入力・フォーカス、AV設定、画像uploadは実施していない。GPU、スマホ、旧Readerバイナリ、完全ゲームセッションは未検証。新規公開や次品制作は独立レビュー待ち。
