# 185 掘削痕岩壁：中規模の石肌候補（未公開）

基準: 公開 `89ac659e46b8aaea230b734d995cfe9918e401ce`。対象は `mine_cut_rock` の512×256三マップだけ。製品変更はその生成処理と正式exportの待機1行。形状372tri、工具痕関数、頂点法線、UV、Collider、接地、ID、他資産の生成処理は不変。

同梱CC0 Rock050を再利用し、風化外皮に斑状の岩肌、中央の新鮮面には弱い変化を与えた。従来の細粒乱数を減らし、工具痕への追加法線を抑えた。全体の平均色はほぼ同じ。[出典・加工](mine-cut-rock/ROCK050.md)、[hash監査](validation/rock185/texture-audit.json)。

## 実画像の自己レビュー

- 洞窟の通常距離で、均一な滑らかな塊から不均一な石肌へ変化。中央の打点と剥離縁を覆っていない。
- 近景では外皮/掘削面の差が増え、反対光でも凹凸が追従。暗い洞窟は暗さを維持する。
- 同一seed71421/カメラ/既存松明の137を再演し、before6画像は元137とRGB最大差0。照明変更を改善として数えていない。afterの変化は岩壁の画素範囲内。
- 限界: 512×256由来の近景のぼけ、既存の多角形/工具痕の歯列感、周囲の別岩材との完全な連続性は未解決。側面の既存UV投影差も残る。自動壁埋込み/斜面追従は追加していない。

自己評価 **92/100 = 見た目26 + 質感18 + 構造配置19 + Web/正式Unity20 + 軽量9**。137の構造点は据置き、石肌の改善だけを質感に加点。独立評価前の候補であり公開合格を宣言しない。

## 検証

- `tests/mine-cut-rock.cjs`: 正式Web表示、全頂点有限・閉形状・外向き、床面、保存再読込、実Map/SetのCollider内容、旧type配列からの再配置をpass。
- `tests/mine-cut-rock-placement.cjs`: 単体配置、回転/縮尺、地下床、保存をpass。
- `tests/mine-cut-rock-surface.cjs`: 同ページpending→ready、UI export待機、Texture参照保持/一括更新、素材欠落/破損fallback、9/225共有をpass。表示の三マップとexportが一致。
- `tests/mine-cut-rock-export-regression.cjs`: 基準版と今回の正式exportを比較。岩壁三マップを除く全sectionを完全一致で確認。schema/旧Readerコードは不変。旧Readerバイナリの実行ではない。
- `tests/unity/Rock185Checks.cs`: 正式Optional検証→岩壁Prefab1種生成、137との全mesh属性/実Collider一致、正常なURP/Litの色空間/normal、Prefab保存再instantiateとScene再読込、9/225共有をpass。
- 今回は変更対象1種の正式生成。全74種を作り直したとは表現しない。既存74種生成は183証拠、今回は他種exportの完全一致とImporter不変更で影響を限定。
- 専用Editor内の既存洞窟生成を再利用。原本シーンの保存変更なし。137同条件のlit/dark×通常/近景/側面と、標準診断の通常/近景/反対光/背面/全消灯/点光/spotを記録。
- 前後とも372tri、Web代表3draw/17texture、9/225同一条件5draw/11texture。Unity共有1mesh/1material/3texture、9/225とも全数視錐台内。mesh166,752B、texture参照4,022,549Bで前後同じ。CPUは短いRender送信時間だけで性能保証でない。GPU/スマホ/Playerは未計測・未実行。
- export JSON673,457→984,273B（約311KB増）。新たな素材ダウンロード0、GPU枚数追加0、固定岩再生成0、既存bundle変更0。

## ローカル証拠

作業repo内: `output/rock185-before` / `rock185-after` / `rock185-contract` / `rock185-export`。
専用Editor内: `Evidence185`（正式生成・診断・共有）/ `Evidence185Cave`（137同条件実洞窟）。`lit-baseline-normal.png`→`lit-normal.png`、`lit-baseline-close.png`→`lit-close.png`、dark系列も同じ。各代表hashは監査JSON。画像はローカルのみ、アップロードしない。

洞窟harnessは既存ゲーム専用のローカル `Rock185Cave.cs` を利用。公開テストはそのクラスが同じEditor assemblyにあれば実行する。なければ洞窟検証をしたとは扱わず、標準診断/Prefab検証までとなる。

まだpush/Pages公開なし。キャッシュURL/release/固定sampleキーの公開同期は独立合格後に別工程。GUI/入力/フォーカス・Player・AV変更なし。他担当変更/未追跡物は保持。
