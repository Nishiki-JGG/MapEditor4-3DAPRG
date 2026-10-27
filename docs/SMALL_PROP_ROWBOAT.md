> 本書の検証範囲は各契約の導入時点です。現在の採用内容・統合検証・残件は [NIGHT_RELEASE.md](NIGHT_RELEASE.md) を参照してください。

# small_props v1：小舟の任意Nativeメッシュ

既存の必須19種と `additionalAssets` 13種は変更しない。小舟の既定キー `tdj/rowboat` にだけ、任意のトップレベル `rowboatAsset` を追加する。既存Assetと同じ座標・頂点・法線・色・UV・三角形・材質・衝突フィールドを使用する。形式versionは1のまま。

`additionalAssets` への単純追加は旧ImporterのID検査を破る。新しい必須形式への移行を避けるため、小舟だけの未知フィールドとして分離した。旧Importerはこのフィールドを無視し、従来32種をそのまま読む。小舟そのものを旧ImporterがNative表示するという互換ではない。旧Importerの小舟は従来どおり外部Prefab解決の対象である。

新Importerは `rowboatAsset.id == "rowboat"`、`assetKey == "tdj/rowboat"`、既存の有限値・形状・材質検査を通して33番目の任意資産として併合する。フィールドなしの旧19種・旧32種も読める。小舟のassetKeyがcustom指定なら `rowboatAsset` を出力せず、利用者のPrefab指定を上書きしない。既存ID、保存、CSV列と値、配置変換、元ゲームのPrefab解決処理は変更しない。

## 未指定groundSinkの既存差

小舟は従来groundSinkが未指定で、Webの `propBaseY` は0.05mを沈める。一方、CSVは未指定を0mとしていた。CSVや保存を変更せず、新しいNative小舟だけをWebの正しい位置に置くため、既存 `instances` 要素の該当小舟へ任意 `rootPosition:[x,y,z]` を添える。座標は既存の `U.x / U.y(propBaseY) / U.z` から得る。自動配置だけでなく、手動高さ・地面高・縮尺を含む既存の位置決定に従う。

新Importerは有限な3成分として検証し、小舟にだけ適用する。他のIDへのルート上書きは拒否する。回転・縮尺は従来どおりCSVから読む。旧Importerはこの追加情報を無視する。外部custom小舟のCSV座標は変更しない。全体のgroundSink仕様をこの作業で統一していない。

## 衝突・材質・軽量版

- 半径0.55m、高さ0.62m、元の3中心 `[-0.8,0,0] / [0,0,0] / [0.8,0,0]` を既存の `circleColliders` へ写す。三角形船殻を衝突形状へ切り替えない。
- 既存cards2木材アトラス・不透明1材質・1submeshを使用。追加テクスチャや透明パスなし。
- 船殻は内面と縁の厚みを持ち、片面描画でも内側が欠けない。全体CullやShadowを変えて隠さない。
- 軽量版では既存のライブラリ分離がrowboatAssetも共通側へ運ぶ。rootPositionは配置情報としてローカルinstancesに残り、無損失で復元できる。

## 検証

`tests/night-rowboat-output.cjs` は実ブラウザの正式出力を読み、旧32種の全ペイロード一致、CSV一致、3円、既定sink、3配置のルート位置、custom小舟のNative省略を確認する。

`tests/unity/NightPropsChecks.cs` は旧19種、旧32種、新33種、旧Importer2世代の読込と旧Importerの実生成、実Prefab、片面材質、実Raycast、ルート位置、custom外部3配置、D3D11の近距離・見下ろし・全配置を検証する。旧Importer互換は隔離プロジェクト内で旧ソースのクラス名を変更した診断クラスを生成して実行する。旧ソース自体を変更して合格させていない。

小舟の後に他IDへ無制限に拡張する契約ではない。対象追加時には旧Readerの挙動、キー優先、衝突、配置、実描画を改めて検証する。
