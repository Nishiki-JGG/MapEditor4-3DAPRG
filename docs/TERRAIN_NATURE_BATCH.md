現在の土・草共通材質とRevision13統合結果は [SOIL_POLISH.md](SOIL_POLISH.md) を参照。以下は初回試作の記録。

# 草地・針葉樹・自然物のローカル試作

この文書は前回バッチの記録。後続の草地共通材質・反復対策・由来再現・風揺れ退行の確認は [追検証](GROUND_PARITY.md) を参照。

公開・push・ゲーム本体への組み込みは行っていない。作業コピーは `MapEditor4-3DAPRG-ground-pilot`、ブランチは `pilot/terrain-nature`。基点は c9128cf と完成済み共有小物の tree `0095ced32c728ebde5d30f41e0ba61bf51962024`。元の岩・シダ作業コピーは保全している。

## 地面が粗く見える原因と今回の範囲

元の `app.js` 233–368 行の地面は画像を貼っていない。`terrainColor()` がワールド XZ 座標から色を計算する。UV、albedo / normal / bump の画像は無く、画像の解像度やフィルターを上げるだけでは直らない。

- `vn(p*11)` の格子間隔は約9.1 cm。草色への振幅が大きい。
- 花は22.2 cm格子で、直径約4.4 cmの硬い白・黄の点。微分に基づく帯域制限が無いため、小さい点が画素をまたぐ。
- 石畳の Voronoi は約67 cm、瓦礫のひびは1.25 mの格子。画像の画素とは別の、手続き模様の寸法である。
- メッシュは0.5 m間隔。64 mマップは16,641頂点・32,768三角形で、今回は増やしていない。
- 元の材質は roughness .92 / metalness 0 の Standard。DPR上限2、ACES exposure 1.3、MSAAあり。MSAAはシェーダー内部の点模様すべてを除去するものではない。

公開 Pages の index と app.js は読み取りに成功した。取得した `terrainColor()` から材質設定までのコードは試作前のローカル版と同一だった。ローカル基点は Revision 12、調査時の GitHub main は Revision 13 / `1abae2fc0d075c857cc0e8c8c969a4f6dd58b4f0`。今回の試作に主人公アニメーションの差分は混ぜていない。公開状態・Pages設定は操作していない。取得証拠は作業コピー外 `ground-texture-evidence/public-pages.json` と `public-pages-app.js.txt`。

草地の代表例だけを `forest` / `grassland` に適用した。その他の地面、水、崖、既存の小物の花は従来のまま。

- 512×512 の不透明 JPEG（quality .88、58,158 bytes）。4 mタイル、ワールドXZの平面投影。UV・ポリゴン追加なし。
- 元の自作草地を1024→512に縮小し、固定seedの低コントラストな草の細線をコードで焼いた。細線は左右上下にも描き、境界で途切れないようにした。
- trilinear mipmaps、異方性は最大2。細部は遠距離でミップにより平均化される。材質は1個のまま、normal / PBR画像は追加していない。
- 元からある大きな色むら `fbm(p*.22)` を .91〜1.09 の範囲で再利用。4 mの模様反復自体は残る。高価な複数サンプルのランダムタイル化は入れていない。
- 生のsRGB値をカスタムsamplerで読み、既存の `pow(col,2.2)` で一度だけ線形化する。Threeの自動sRGBデコードと重複させないため、このsamplerの `colorSpace` は `NoColorSpace`。Unityで再現する際もこの契約に合わせる。
- `#size=64&ground=legacy` で変更前を比較できる。デフォルトは今回の草地。マップデータの地形・塗りチャンネルは変更していない。

[Three.js公式 Texture仕様](https://threejs.org/docs/pages/Texture.html) を参照し、拡大・縮小フィルター、mipmap、異方性の設定を確認した。JPEGの圧縮容量とGPUメモリーは別。圧縮画像は約56.8 KiB。512² RGBA8の全ミップは1,398,100 bytes（約1.33 MiB）で、JPEGにしてもこの値は減らない。既存の地面ノイズ計算も残っており、高速化したとは扱わない。

## 素材の由来と公開制限

確認場所：`TotsuDanGrasslandKit/PROVENANCE.txt`。

採用した元画像は `Textures/field_grass_ground_albedo_procedural.png`（1024²、683,960 bytes）。SHA256 は `d50c38959a9bfb7da854821c791dc9f0a4b1bfa99c74f6ed9850fa3c01e178f6`。記録は「外部入力なしの手続き生成による自作」で、生成元は `tools/staging/claude-grassland-roomkit-01/source/make_textures.py`。元画像は上書きしていない。コピーした入力は `tools/nature/grass-source.js`、今回の細線生成は `tools/nature/bake.cjs`。

候補の `field_grass_ground_albedo.png`（2048²、10,421,044 bytes）と `field_worn_ground.png`（512²、682,663 bytes）は、同記録で Unity Terrain - URP Demo Scene の素材を変換したものとされ、素材単体の再配布不可と記載されている。これらの画像は採用・同梱していない。

由来は後続の再生成一致検査で確認し、所有者から改良版のGitHub反映許可を得た。自作草地の `publicReleaseApproved:true` を保存。既存のライセンス・帰属は変更していない。第三者由来の候補画像は未同梱。

## 針葉樹と自然物

| 種類 | 変更前→今回の三角形数 | 材質数 | 内容 |
|---|---:|---:|---|
| pine / 針葉樹 | 314→134 | 1 | 下4段を除去。傾いたカードも下端2.15 m以上。幹の基部を地面0にする |
| log / 倒木 | 284→284 | 1 | 樹皮を共通atlasで貼り、最下点を地面0へ約4.70 cm移動 |
| stump / 切株 | 238→238 | 1 | 樹皮を共通atlasで貼る。地面を突き抜ける根の頂点のみy=0に収める |
| rootfan / 露出根 | 新規100 | 1 | 幹や切株を含まない地表の根。装飾なのでsolid=false |
| rock / 岩 | 120→120 | 1 | 完成済みの配列・PNG・材質値をそのまま保持 |
| fern / シダ | 220→220 | 1 | 完成済みの配列・PNG・材質値をそのまま保持 |

既存カタログには倒木、切株、枯木、小石、きのこがあるため、それらと重なる新種類は増やしていない。露出根1種類だけを末尾に追加した（既存57 IDの数値順を保持、合計58）。既存ID・保存形式・CSVの列は変更していない。

針葉樹の高さは6.407894 m。上部の層と尖った頂部を残し、全体の縮小では対処していない。根元に刺さっていた低い葉を除いた。基準は既存 `state.agent` の身長1.8 m・半径0.3 mで、仮の人間寸法を新設したものではない。比較用人型は同じ1.8 m、Unityでは同寸法のカプセルも描画した。

- 標準scaleY=1で葉カードの下端2.15 m、頭上余裕は約0.35 m。透明部分も含めたカード全体で検査する保守的な寸法。
- 2.1 mを保つscaleY下限は約.97675。1.8 mを超えるだけなら約.83721。古い配置の.8倍は枝下1.72 mとなるので保証しない。散布の新規範囲を1〜1.4にした。保存済みの縮尺や手動指定は書き換えない。
- 幹の最大半径約.26 mに対し、既存の代理円形判定は半径.45 mを維持。見た目より約.19 m広い保守的な判定が残る。頭上の枝を調べる判定は既存エディターに無い。
- catalogの高さは pine 6.408、log .897、stump .706、rootfan .212 m。ユーザーのcatalogによる上書きは従来どおり優先される。
- 水平な地面0への接地を確認した。任意の斜面への全頂点の追従はしていない。大きい物は斜面・非一様縮尺で埋まりや浮きが残り得る。

共通ライブラリは `shared-nature/1`。岩・シダのデータは変更せず、pine/log/stump/rootfanの4種類を追加した。新しいatlasは512×1024、needle512²・bark256²と白領域を格納し、4種類で1枚を共有する。trilinear・mipmap・aniso2。RGBA8全ミップは2,796,204 bytes（約2.67 MiB）。他の既存小物用の1024²atlasは引き続き必要なので、ブラウザー全体のメモリー削減とは数えない。草地と新atlasの追加分は計4,194,304 bytes（4 MiB）、既存の岩・シダは計512 KiBのまま。

共有形状は両エンジンで静止モデル。今回のpineは旧ブラウザー専用の風による変形を使わない。枝の細さによる遠距離の欠け・ジャギー、ライティングの差、影の見え方は今後の実機確認項目。

## 検証・再開

証拠は作業コピー外の `ground-texture-evidence/`。ブラウザーはユーザーPC上の Chrome を使い捨てプロファイルで起動した。SwiftShaderによる画像検証であり、スマホ性能測定ではない。

- `nature-source.json`：16検査。配列・接地・非退化三角形・予算・枝下を確認。
- `nature-browser.json`：13検査。旧ID順と旧マップ、選択登録、置くツール経路、Rキー、保存読込、共通書き出し、岩シダ完全一致を確認。
- `nature-unity.json`：Unity 6000.5.9f1 / URP17.5、37検査。6種類の取り込み、形状・法線・色・UV・向き・PNG・フィルターの同一性、接地、4配置、シェーダー描画を確認。CSV丸めを含むワールド頂点誤差の最大は約0.139 mm。
- `terrain-browser.json`：7/17/35 mの変更前後を同条件で撮影。`terrain-image-metrics.json` は1 cmカメラ移動の画素差。再投影補正をしていないため、ちらつき量や性能の証明とは扱わない。35 mでは大きな画素差の割合が減った一方、近距離の細部が増えた分の画素変化は増えている。
- `preservation.json`：元の岩シダ作業コピーのstatusとstage済みpatch SHAが一致。水と対象外小物58ファイルに変更なし。元の草地SHAも一致。

比較画像：`ground-before-7m.png` / `ground-after-7m.png`、17 m・35 m版、`pine-before-after.png`、`unity-pine-1.8m-reference.png`、`nature-set-browser-final.png` / `nature-set-unity-final.png`。

再開は本コピーで `node tests/terrain_nature_source.cjs`、`node tests/terrain_nature_validation.cjs`、`node tests/terrain_nature_browser.cjs`。生成元を変えたときだけ `node tools/nature/bake.cjs` でデータを焼き直す。ブラウザー確認はPC Chromeの起動権限が必要。Unity検査コードは `tests/unity/NatureBatchChecks.cs`。ユーザーのゲームを開かず、既存 `SharedPropsUnityTest` に必要な検査コードだけコピーし、`validation-tools/unity_once.py` 経由で実行する。

`shared_ground.json` は画像と貼り方の契約を追加出力する。Unity側の今回の完成範囲は6種類の小物の共通取り込みまでで、既存ゲームの地面材質・地面全塗りチャンネルへの組み込みは未実装。Android/iOS実機、Player build、FPS、GPU時間、発熱、衝突Prefabとの本番統合は未検証。

以前のライブラリ添付はhosted tools/listでHTTP403となり、転送・添付は実行されていない。指示どおり再試行や別経路のアップロードはしていない。今回の画像はPC内のファイルとして保存している。
