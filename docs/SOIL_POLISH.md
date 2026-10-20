# 地面と自然物の更新

Revision13 (`1abae2fc`) の主人公とアニメーションを保ち、共有自然物・草地・針葉樹の風揺れと、土の粒度改善を統合した。

## 土の見え方

旧 `terrainColor()` の土は画像ではなく、`fbm(p*1.6+5)` と `vn(p*11)` を強い明暗差で混ぜていた。主な格子間隔は約62.5 cmと9.1 cm。人物・橋の横で大きなぼけた斑点に見える原因だった。

森林・草原の土を、コードだけから作った256² JPEGへ変更した。`tools/nature/bake_dirt.py` は固定seed20261020の周期的な数値ノイズを使い、入力画像・外部素材・画像生成サービスを読まない。JPEGは9,688 bytes、1枚2 m四方（128 texels/m、約7.8 mm/texel）。6〜16 cmの控えめな集まり、1.5〜4 cmの粒、細かい砂を分けて焼く。広域の明暗はシェーダー側の長周期sin2本で最大±3.6%に抑える。

同じ画像を30度回転・UV(.19,.43)移動でも読み、主.65・補助.35で混合する。大きな特徴の強い反復を避けるため、タイル内に目立つ石や斑点は入れなかった。完全な非反復ではない。草は前回の512²・4 m・主.6/回転補助.4を保つ。近景で確認し、今回の土改善に伴う再加工はしなかった。

草と土の境界は既存の塗りデータと `smoothstep(.2,.55,paint+(b-.5)*.35)` を維持する。地形・塗りデータ・頂点数・当たり判定は書き換えない。石畳、砂、沼、雪、水際、崖、水と、対象外の小物は既存の実装を保つ。`#size=64&ground=legacy` で従来の草と土へ戻して比較できる。

## 共通の貼り方と予算

`terrain/grass.js` + `terrain/dirt.js` が `TDGroundData` を構成し、同じデータを `shared_ground.json` に出す。materialVersion=3は土を追加し、schemaVersion=1と従来の保存形式・ID・CSV列を維持する。

| 項目 | 草 | 土 |
|---|---:|---:|
| 画像 | 512² JPEG / 58,158 B | 256² JPEG / 9,688 B |
| 主・補助の倍率 | 4 m | 2 m |
| RGBA8全ミップ概算 | 1,398,100 B | 349,524 B |
| サンプル数 | 2 | 2 |

いずれもrepeat、trilinear mipmaps、異方性2。生のsRGB値をフィルター・混合し、pow(rgb,2.2)を一度だけ適用する。ブラウザのNoColorSpaceとUnityのsRGBTexture=falseを対応させ、自動デコードを重複させない。roughness .92、metalness 0。照明はThree StandardとUnity URP PBRで異なり、美術的な明るさを無理に同一化していない。

今回の土はGPU画像概算約341 KiBと2回のテクスチャ読み取り等を追加する。地形64 mは16,641頂点・32,768三角形のまま。normal画像、追加材質パス、CPU毎フレーム頂点更新はない。JPEG圧縮容量はGPU使用量とは異なる。スマホ実機のFPS、GPU時間、メモリー総量、発熱は未測定。

## Unityでの使用範囲

`unity/Assets/MapSharedProps` を検査用プロジェクトへコピーし、`MapSharedGroundBuilder.Build(sharedGroundJsonPath, editorZero)` で新しい材質を作る。editorZeroは通常Unity XZ=(マップ半幅,マップ半幅)。ブラウザp=(world.x,world.z)、Unity p=(world.x-editorZero.x,editorZero.y-world.z)。同じ画像バイト列、倍率、回転、色空間を使う。

材質の `_DirtWeight=1` は土、0は草。`_VertexDirt=1` で頂点色Rを塗りの重みとして読み、同じ境界式を使う。従来のmaterialVersion=2の草のみの出力も取り込める。新しい出力先へ生成し、既存資産を上書きしない。

完成範囲はURPの草・土・境界の共通材質と隔離比較。既存ゲームのTerrain全チャンネルへの統合やゲーム本体の変更は行っていない。地形・塗り画像の既存出力もそのまま使える。Built-inの地面描画、Android/iOS Playerは未検証。

## 自然物と風

- 岩120tri・シダ220triは完成済み共通データを保持。
- 針葉樹314→134tri、標準サイズの枝下は約2.15 m。既存の身長1.8 m・半径.3 mの検査基準で、上部の樹冠を保ちながら下枝を除いた。縮尺.8では枝下1.72 mとなる制約を残す。幹半径約.26 mに対して代理判定半径.45 mを維持。
- 倒木284tri・切株238triは共通化と接地補正。露出根100triを末尾IDとして1種類だけ追加。既存57 IDの順を保ち、合計58。
- 新しい4種類は512×1024 atlasを共有（181,159 B、RGBA8全ミップ2,796,204 B）。他の小物用の旧atlasも残る。
- 針葉樹の風を両環境で復帰。幹・根元を固定し、針葉領域だけ水平最大12 cm、sin2本で動かす。Y変位は0なので標準サイズの頭上余裕を保つ。CPU全頂点更新・ポリゴン追加はない。影にも同じ変形を適用。無風は静止基準と画像一致。

詳細は [自然物](TERRAIN_NATURE_BATCH.md)、[共有形状](SHARED_PROPS_PILOT.md)、[風](PINE_WIND_FIX.md)。これらの初期記録中の「未公開」「Revision13未統合」等は当時の状態であり、今回の統合状態は本書が正しい。

## 素材の由来

草の元は所有者のプロジェクトに保存された自作手続き画像 `field_grass_ground_albedo_procedural.png`。固定seed20260925の数値計算のみを使う `roomkit/source/make_textures.py` のコピーから再生成し、1024²の元画像とバイト完全一致・画素差0を確認した。元画像SHA256は `d50c38959a9bfb7da854821c791dc9f0a4b1bfa99c74f6ed9850fa3c01e178f6`、生成スクリプトSHA256は `5eec21ed3e4ec1b44f79caaa59c21bc67430bd3bed62c25569aff7ea4cf12f4b`。

草の派生版はLanczos512²縮小とコード生成の細線36,000本。所有者はこの改良版のGitHub反映を明示許可したため `publicReleaseApproved=true` とした。元資産は編集していない。Unity Terrainデモ由来の別候補画像とworn_groundは採用・同梱していない。既存のライセンス・帰属・配布条件は変更していない。

## 検証と再現

ユーザーPCのChrome（使い捨てプロファイル、SwiftShader）とUnity6000.5.9f1 / URP17.5.0を使用。実ゲーム・スマホ性能の測定ではない。

- 橋横の歩くモード、近景、俯瞰の同一カメラで前後を撮影。大きな土の明暗斑点が減り、細粒度になった。反復する強い特徴は目視で認めなかったが、完全な非反復・時間方向の無ちらつきを証明するものではない。
- 土と草境界を距離3/7/17 mで両方撮影。照明なし6組の平均RGB差は最大約.27/255。照明あり画像も点検し、BRDFによる明るさの差は残した。
- 共有自然物の配列・予算・枝下16検査、旧マップ/配置/回転/保存読込13検査、針葉樹のCPU/GPU・影・無風・寸法35検査を再確認。実エディター出力の土画像と保存前後の地形・塗り・IDも検査。
- Unityは元画像バイト、2 m/4 m、色空間、mipmap、URPコンパイル、旧草地出力との互換性を検査。初回の旧形式検査でJsonUtilityが欠けた入れ子を空DTOとして作る挙動を検出し、旧版では明示的にnullとして処理する修正を加えた。
- Revision13の主人公コードとアニメーション、水、対象外の小物、既存共有メッシュをGitの正規化済み内容で照合して保全。

再実行:

```text
python tools/nature/bake_dirt.py
node tests/soil_polish_browser.cjs
node tests/soil_export_validation.cjs
node tests/terrain_nature_source.cjs
node tests/terrain_nature_validation.cjs
node tests/pine_wind_browser.cjs
python tests/pine_wind_compare.py ../pine-wind-evidence
```

Unityの検査用プロジェクトへRuntime/Editorと `tests/unity/GroundParityChecks.cs` をコピーし、PC指定の実行キュー経由で `GroundParityChecks.Run -ground-output <soil-polish-evidence>` を実行。その後 `python tests/soil_polish_compare.py ../soil-polish-evidence`。画像とログは作業コピーの隣の検査フォルダーへ保存し、個人パス・一時転送情報・Unityプロジェクトのキャッシュをリポジトリに含めない。
