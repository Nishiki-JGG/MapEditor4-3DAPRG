# 182: 採掘ズリ積載トロッコ（独立レビュー候補・未公開）

基準 `93d772ca0d5884e20ae9e0667425a33ab7b41fc2`。現行カタログに同等の積載車はなく、空荷 `minecart` の車体を再利用して `minecart_loaded` を1品追加した。既存のバリエーション機構は安定IDを持つ個別カタログ項目なので、それに合わせた。空荷・レール・他の小物を置換しない。

## 調査と設計

[California State Parks のHardrock Trail](https://www.parks.ca.gov/?page_id=31829) は鉱車による鉱石運搬と廃石の排出を説明している。[Southern Lumber Rail Road Museum の鉱車資料](https://slorrm.com/QR-minecart.html/) は四輪台枠・鋼板・リベット・端扉の構造参考。写真をテクスチャへ転用していない。積荷の配置と寸法は既存エディタの車体に合わせた創作仕様。

車体・車輪・車軸は既存の生成関数をそのまま再利用する。0.84mレール中心間隔、走行面0.14m、pivotと配置補助、車体の色・法線・形状は維持。浅い細粒の層と大小9個の角張った破片を追加した。最初の181案の等間隔な角とUVの折返しを棄却し、不整形五角の破片・傾いた上面・連続UVへ変更。車体2200→積載2440三角形、増分240（10.9%）。荷の最大高さ1.16227m。車体の縁を少し越える範囲に抑え、縁より下の頂点はテーパー状の内壁内にあることを検査した。

既存土砂の自作colour/packed/normalを下段、既存車体を上段に連結した512×512の共有atlas3枚。車体の上段ピクセルは元と完全一致。別の外部画像は追加していない。材質1、描画mesh1、光源0。Unityは標準URP/Lit、colour=sRGB、packed=linear（R金属/A滑らかさ）、normal専用import。既存のcart normal変換とtangent計算を使用。材質の白乗算・非発光を維持する。

## 契約と検証

新しい独立optional `mineCartLoadV1` を追加し、従来の `mineCartV1` は変更しない。compact library参照にも対応。新項目が壊れた時は警告してその項目だけ省き、既存種を生成する。旧Readerでは積載版が省略される（空荷へ勝手に置換しない）。これは後方互換であって旧Readerへの新機能追加ではない。

- Web正式loader/選択/プレビュー/配置/export、直線・曲線接地、保存再読込、旧propTypes配列のID再対応を実行。元車体のposition/normal/color/glow、等価UV、元車体texture、Colliderの実Map内容を比較。スケール不一致では接続配置を拒否し、地下では地表でなく実床へ置く。
- 新旧トロッコの入力テスト、既存レールドラッグの左右曲線・閉ループ・取消・一筆Undo・保存・225既存線路回帰を実行。サンプル2種はbundleから読込、岩再生成を例外で禁止して呼出0。固定サンプルのファイルは変更なし。
- Unity 6000.5.9f1 / URP17.5 / Linear / 既存PC Forward+、専用Editorの背景描画。正式新74種（54小物＋洞窟装飾20）を生成、旧73種のmesh/normal/UV/colors/indexと実Colliderを比較。空荷車体と積載版の車体部分、Colliderは一致。
- Prefab保存→元破棄→再instantiate、Scene保存→再読込でmesh/material参照を保持。欠落・未知version・壊れPNG・範囲外index・NaNは新optionalだけを除外。実Prefab生成と、無効optionalを含む全旧53小物生成を確認。非衝突・円Collider・高さcustomも実生成。compact libraryのReadと積載Prefab生成も別Editor起動で確認した。
- 旧Readerは基準93d772cのsourceを実際に再コンパイルし、新payloadから旧73種を生成。旧バイナリやPlayer実行ではない。新旧73/74混在fixtureはInput177-mixedの既存素材を継承する。最終178のクモの巣texture再exportまで今回行ったとは主張しない。最終Web積載payloadとUnity入力の当該optionalは完全一致。
- 正式製品坑道Input123Mine（幅2.4m/高さ2.8m）の既存照明・cutawayで、通常俯瞰/近景/反対側を比較。最初のZ11.4位置は吊り灯が上方と重なるため診断として保存し、Z10.5の非干渉位置へ車体を移して同じ照明で撮影した。照明・露出を変更して明るくしてはいない。原本ゲームSceneは未変更。

Web証跡 `output/loaded182-final` / `loaded182-input` / `loaded182-old-input` / `loaded182-rails` / `loaded182-bundles`。Unity証跡は専用検証プロジェクトの `Evidence182` / `Evidence182Legacy` / `Evidence182Supplement`。代表画像は `Evidence182Supplement/mine-normal-minecart_loaded.png`、`mine-close-minecart_loaded.png`、`mine-reverse-minecart_loaded.png`、`Evidence182/straight-normal-minecart_loaded.png` と対応する空荷。各hashと結果は `tests/evidence/minecart-loaded182.json`。画像uploadや大画像のgit追加はしない。

## 自己評価: 91/100（独立評価前）

|項目|点|根拠と減点|
|---|---:|---|
|見た目|27/30|通常俯瞰でも空荷との差と低い積荷が読め、車体の輪郭を保つ。近景では破片の平たい多角形感が残る。|
|質感|17/20|細粒と大破片を既存土砂の岩質で揃え、金属車体と分かれる。細粒の貼模様感、暗所での岩面の読みにくさとUV面切替が残る。|
|構造・配置|19/20|四輪/軌間/接地・内壁範囲・縁を保持。固定積荷で接触は簡略化し、既存BoxColliderより上の装飾約6.7cmは精密衝突しない。|
|Web・正式Unity|20/20|正式loader/export/import、旧Reader実生成、保存/再配置、optional失敗、compact契約を実行。Player等は要求外の未検証として別記。|
|軽量性|8/10|＋240tri、各個体同一mesh/material/3texture、ライト追加なし。ただし空荷atlasの内容を積載atlasにも複製し、常駐メモリ増がある。|

Web9/225個は共にInstancedMesh1・材質1・texture3、GL error0。Unity同条件の9/225個も共有参照を維持（225中210可視）。mesh実測978,384→1,084,944B、texture合計4,022,545→8,042,071B。短いCPU描画投入中央値は空荷9=.479ms/225=.972ms、積載9=.503ms/225=.643ms。ばらつきを含み、速くなった証拠でもフレーム性能保証でもない。GPU/スマホ/Player/全ゲームセッションは未実行。

## 再現・公開前条件

Webは `node tests/minecart-loaded.cjs`、`node tests/minecart-loaded-placement.cjs`（LOADED_OUTPUT/MINE_CART_OUTPUTで別出力先を指定可）。Unityテストは既存専用環境の描画helperと正式exportを使用する。`Input182` は旧73種のInput177-mixedへ今回の正式exportのmineCartLoadV1と配置CSVだけを追加。`Loaded182Legacy` は旧sourceの状態で先に実行し、その後現sourceの `Loaded182Checks.Run`。テスト内の旧比較出力Pilot7、新生成出力Pilot10は今回環境の実測名なので別環境では対応先を明示して調整する。補足は同じInput182へのhardlink libraryを持つInput182-compactで `Loaded182Supplement.Run`。大きな入力を重複複製しない。再実行時は既存証跡を上書きしない出力名を使う。

今回の候補は未公開。既存scriptのcache URL、release.json/manifest source監査の公開同期は独立合格後の公開準備で行う。現在の固定sample key/bundleは維持して読込検証済み。新規scriptのみ内容hashを付与した。公開前に対象外diffと配信cache整合を再確認する。Unity利用時は更新Importerで新exportを新出力先へimportする。旧Prefabへ自動で積荷が加わる変更ではない。
