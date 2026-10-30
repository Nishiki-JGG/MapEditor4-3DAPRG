# 掘削痕岩壁の石肌（185）

工具痕・372三角形・UV・配置・Colliderは137/公開89ac659と同一。新しい画像を取得せず、同梱済みの `props/mine-collapse-pbr.js` が展開したRock050の三マップから生成する。

## 出典と再配布

ambientCG Rock050、CC0 1.0。原ZIP/各マップのhash・ライセンス取得記録・元派生の再現手順は [既存のRock050記録](../mine-collapse/ROCK050.md) と [provenance](../mine-collapse/rock050-provenance.json) をそのまま維持。

- 原配布: https://ambientcg.com/view?id=Rock050
- ライセンス: https://docs.ambientcg.com/license/ / https://creativecommons.org/publicdomain/zero/1.0/
- 実装: `props/mine-cut-rock.js` の `installStone`。元画像や既存collapse資産を書き換えない。

## 派生処理

既存の512×256 RGBA×3枚へ反映。collapse側の左256区画（風化外皮）と右256区画（新鮮面）を同じ位置で線形補間し、既存の剥離面/打点maskで配分する。前面1.8mを仮定2.4m素材の75%へ、縦1.92mを80%へ割り当てる。元素材の岩種・物理寸法は不明で、この尺度は制作上の仮定。

- colour: sRGBをlinearへ変換して区画平均に対する変化を使用。比率を0.55〜1.65へ制限、外皮0.85/新面0.55の強度。従来の細粒乱数を80%減らす。全体暗化せず、前後の平均RGBは約110.50/107.50/104.50→110.20/107.36/104.65。
- normal: 元の工具痕法線へ、Rock050の接線空間の傾斜を外皮0.45/新面0.22で加算して再正規化。打点の深部は追加成分を抑え、工具痕を保つ。ジオメトリ/頂点法線/UVは不変。
- packed: R金属度0・G AO・B0・A smoothnessの既存契約を維持。Rock050の平均からのsmoothness差を0.4倍、素材AOは8%のみ混ぜる。WebのMR変換、Unityの既存green反転/normal importは変更なし。

素材展開を待ち、三マップを一括置換する。正式UI exportも `prepare()` を待つ。欠落・破損時は元の手続き三マップを丸ごと保持する。プレビュー/配置の同じTextureオブジェクトを更新し、GPUテクスチャ追加は0。元データの圧縮payloadも複製しない。初回処理中の一時RGBAバッファ3枚（1,572,864B）は保持せず、毎フレームの処理を追加しない。

## 利用

通常loaderで読込み後、新規exportから既存の正式Unity Importerで再importする。保存済みPrefab/Sceneが自動更新される機能は追加していない。schema/IDに変更なし。単体モジュール利用時に共有Rock050がなければ旧外観へfallbackする。
