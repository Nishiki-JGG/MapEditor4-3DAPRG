# 掘削痕の岩壁 — レビュー候補127（未公開）

## 目的と調査

既存の坑道壁へ手動で重ねて配置する、手掘り跡を持つ独立小物。既存壁の自動置換、地形の穴開け、固定岩サンプル再生成は行わない。

- [National Trust: Dolaucothiの歴史](https://www.nationaltrust.org.uk/visit/wales/dolaucothi/history-of-dolaucothi)：ピック・ハンマーによる掘削と現存する工具痕。掲載写真の実画素で、自然な割れ面に短い方向性のある痕が不均一に集まる構造を確認した。写真は参考のみで製品には収録していない。
- [NPS: Staple Bend Tunnel](https://www.nps.gov/places/staple-bend-tunnel.htm)：長い手穿孔に火薬を詰める工程。これを直接のピック痕と混同せず、今回の面に丸い発破孔は追加しない。

## 仕様

- ID `mine_cut_rock` / assetKey `tdj/mine_cut_rock`。坑道小物カテゴリ、手動配置限定。
- 約1.82m幅・1.90m高、背面Z=-0.06mから前面最大Z=0.268m。Web前面+Z、Unity出力では-Z。閉じた裏面・側面を持つ372三角形、1116頂点。
- Colliderは幅1.82m・高さ1.92m・奥行0.36m、中心Web `(0,.96,.12)`／Unity `(0,.96,-.12)`。薄い壁側の占有に限定する。配置者が既存壁に合わせて回転・位置を調整する仕様で、自動壁合わせはない。
- 外周を薄くし、内部の割れ面に深さを残す。96個の短い工具痕は4つの作業方向群で長さ・太さ・位置を変え、自然な割れを重ねた。均一な全域縞や固定方向のハイライトは使用しない。
- 自作512×256のcolour / packed / normal。Web共有3テクスチャ・1材質、Unity標準URP/Lit。金属度0。colourのみsRGB、データマップはlinear。
- packedはR=metallic(0)、G=AO、A=smoothness。WebではR=AO/G=roughness/B=metallicに変換した同一データテクスチャをroughnessとAOで共有する。UnityはGのOcclusionとAのSmoothnessを使用。UVのY反転に合わせnormalのGを一度反転し、最終三角化からtangent再計算。
- tintは共有材質と永続テクスチャで保持し、保存されない個体MaterialPropertyBlockへ依存しない。
- 任意 `mineCutRockV1` を追加。欠落・不正時は警告して当該小物だけ省き、既存48種を維持。正規catalogの半径・高さ変更、非衝突も受け入れる。

## 制作レビュー

初稿856三角形は傷付き板に見えたため不採用。次の全面flat normal案は三角形分割が目立ち不採用。372三角形へ削減し、大きな割れ面の形状と滑らかな法線／面法線の混合、外周の薄化を採用した候補を残す。工具痕の色を一律に黒く描く方式も減らし、凹凸と局所AOで読ませる。

**自己評価89/100、未合格・未公開。独立レビュー待ち。** 点数を91へ合わせない。

|項目|点数|根拠と減点|
|---|---:|---|
|見た目|25/30|工具痕と岩の起伏は近景で読める。通常距離では岩面の変化は分かるが、独立した貼り付け片に見える外周がまだ残る。|
|材質|17/20|自作色・normal・roughness・AOが正式Unityでも動作。暗所では痕の判別が弱く、面積の広い部分の岩質変化が控えめ。|
|構造・配置|18/20|閉じた厚み・裏面・足元、地下床での配置と回転、中央通路の余白を確認。異なる既存壁へ自然につなぐには手動調整が必要。|
|Web・正式Unity|20/20|正式49Prefab、不正任意データfallback、旧48実mesh/Collider保持、保存破棄後再instantiate、Web保存と旧種類一覧を確認。|
|軽さ|9/10|372三角形、225配置でmesh1/material1/texture3。GPU時間・モバイルは未計測なので性能保証にはしない。|

次の改善候補は、材質数値の細かな反復ではなく、壁との境界をさらに自然にする不整形な割れ面と足元の構成。既存地形の自動再生成へ広げない。

## 検証条件

- Web：通常loader、近景／通常距離／裏／異方向光／暗所、閉じたmanifold、全法線の単位長、Collider包含（float許容1μm）、共有材質、保存再読込の成功戻り値・配置・実Map内容比較、旧種類一覧からレール／トロッコを復元、地下床とscale／回転の実入力経路。
- Unity 6000.5.9f1 / URP17.5、専用背景Editorのみ。正式importerでvalid・missing・badVersion・badIndex・badPng・nonfinite・nonSolid・compact・customCircle・customHeightの10ケース。旧48種のmesh hashと実Collider型／geometry／transformを比較。
- 保存→破棄→Prefab再instantiateでmesh・材質・姿勢・空MPBを比較。材質はstandard Lit、UV・tangent・normal／packed keywordを検査。
- 実ゲーム洞窟の隔離インメモリ生成：seed71421、648cell、既存松明21。既存松明から約2.9mと約5.2mの連続壁で通常距離／近景／側面を記録。元ゲームシーンは保存変更していない。
- 別の製品坑道検証：既存トンネル生成／正式Prefabを使用。幅2.4m、高さ2.8m、地表3.5m、既存灯2。中央のレール・トロッコと岩壁Colliderが干渉しない。これは検証用作成マップであり、既存ゲームシーンとは区別する。
- 9／225配置で全数視錐台内。mesh約167KB、texture約4.09MB（Unity Profilerの保持メモリ値でありVRAM専用値ではない）。CPU Camera.Render送信時間は参考のみ。詳細値はQA JSONに保存。
- 固定サンプル2件：既存キー／bundle内容保持、既存bundle読込、walkReused=true、fitCalls=0。生成は行わない。

## 再現

Webは `node tests/mine-cut-rock.cjs` と `node tests/mine-cut-rock-placement.cjs`。`MINE_ROCK_OUTPUT` でローカル証跡先を指定できる。任意の `MINE_ROCK_BASE_FIXTURE` に既存48種のsmall_props.jsonを指定するとレール・トロッコのbyte相当データ一致も検査し、`MINE_ROCK_INPUT` 指定時のみ新任意拡張を追加したNative入力を保存する。

Unity検証は `tests/unity/Rock127Checks.cs` と既存 `Shared117Review`／`ColliderSnapshot109` を専用Editor検証プロジェクトへ配置する。`Input127` にエクスポート入力、旧48種の比較用Prefabを `Assets/Imported125-valid` に用意して `Rock127Checks.Run` をbatchmodeで実行する。Playerは作らない。実ゲーム専用の隔離生成ハーネスは非公開のローカル証跡として保全する。

旧Readerの実バイナリ、Player、スマホ、GPU計測、ゲーム全セッションは未実行。旧Readerは未知の任意フィールドを無視する既存ソース経路を確認した範囲。自動壁接続や地形改造の機能はない。画像はローカルのみ、アップロードしていない。
