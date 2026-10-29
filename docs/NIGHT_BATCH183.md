# 183: 積載トロッコの大粒2片と共存メモリ訂正

182候補 `e67e1085742239b749eb679fb7133714307c0671` の独立評価90点を受けた限定修正。未公開、独立再評価前。

## 形状

大粒2片の水平幅を約15〜22%抑え、上面を相似の平板から高さの違う破断肩と斜面へ変更した。最初の局所試作で一点の尖端が目立ったため、隣接する2つの頂部を高くし、広い斜面へ整理した。ほかの板状7片、細粒床、車体、材質texture、Colliderは完全一致。正式export同士の頂点区間比較で確認。破片9、2440tri、車体2200triは維持。最大高さ1.16227→1.15802mで前上限を超えない。

実画像では大粒2片が小片と異なる厚い肩を持つ。俯瞰の薄板反復を減らしたが、単純な多角形・細粒の貼模様感、暗所の読みづらさは残る。前候補に合わせて照明、材質、露出は変えていない。比較元はWeb loaded182-final、Unity Evidence182Supplement（同じ坑道Z10.5位置）。新画像はWeb loaded183-final、Unity Evidence183。通常距離と近景/反対側・直線/曲線を記録した。

## 共存メモリ（訂正）

Unity Profiler.GetRuntimeMemorySizeLong の参照textureオブジェクト測定。GPU常駐量の実測や全カタログ総量とは区別する。

|条件|異なるtexture参照|参照texture合計|
|---|---:|---:|
|空荷単品|3|4,022,545 B|
|積載単品|3|8,042,071 B|
|空荷＋積載、計9個|6|12,064,616 B|
|空荷＋積載、計225個|6|12,064,616 B|

単品入替差は4,019,526 Bだが、空荷の資産を残して積載を加える場合の参照資産増は8,042,071 B。カタログ常駐増を約4.02MBと断定した説明を訂正する。182文書にも訂正を追記した。全カタログ・ブラウザー全heapは測っていない。

6枚すべてisReadable=falseを実測した。追加のRead/Write無効化で減らせるCPUコピーはない。増分は512×512の積載atlasで車体画像も保持する構成に由来する。内容hashが違うため元512×256 textureとは同じ参照にならない。同じ配列を全個体で共有しており個体数分の増殖ではない。

重複削減の案は、車体と積荷を2submesh/材質に分け元車体と土砂の画像を参照する方法、または空荷側UVも共有512×512へ移す方法。前者はdrawと正式export契約、後者は空荷の材質UV/旧Readerに波及する。今回の限定形状修正で大きく方式変更しない指示に沿い不採用とした。解像度低下・圧縮も材質品質を再評価せず適用しない。メモリ減少は達成したと主張しない。

## 最終形状の検証

- Web正式loader/export、通常/反対光/夜、直線/曲線の接地、内壁内、最大高さ、保存/再読込/旧ID対応を再実行。別の入力テストで選択/preview/scale不一致拒否/地下実床/保存を確認。
- shape183比較は大粒2片以外のposition/normal/UV/color/glow、texture全byte、全triangleindex、Collider仕様が一致。新品や別textureを増やしていない。
- 現行正式Unityで新74Prefab再生成、旧73のmesh/normal/UV/colors/index/実Collider一致。保存→破棄→Prefab再instantiate、Scene保存→再読込。標準URP/Lit/接線/normal/非発光、直線・曲線レール上の同じ車輪接地を確認。
- 専用Editor6000.5.9f1/URP17.5/Linear/Forward+、実製品坑道Input123Mineの既存照明とcutaway。新しい描画証拠はEvidence183。正式Webの最終payloadとInput183のoptionalは同一。
- 9/225の各単品配置は共有mesh1/material1/texture3を維持。225中210可視。短いCPU投入時間は記録のみで性能保証に使わない。共存9/225のmaterial2/texture6も確認。GPUは未測定。
- 182の欠落/破損optional/compact・旧Readerの検証は契約とImporter sourceが不変のため再利用。旧Readerは旧ソース再compileで73種生成・新optional省略を実証したもので、旧バイナリ実行ではない。182のレールドラッグ・固定sample2種の再生成0も対応sourceが不変のため再利用する。

積荷上端の非精密衝突部分は最終形状で約6.3cm。旧182の約6.7cmと区別する。各岩の精密衝突、荷崩れ物理、Player、スマホ、GPU、ゲーム全セッションは未検証/対象外。原本ゲームScene・他担当source・既存未追跡物は保持、GUI/Player/AV/upload/pushを行わない。

自己評価91（見た目27/材質17/構造19/Web正式Unity20/軽量8）。独立合格ではない。材質・軽量性の点を上げず、厚い大粒2個が板片の反復を破る点だけを見た目の改善根拠とする。

## 証跡と再現

`tests/evidence/minecart-loaded183.json` に結果・画像hash。`tests/minecart-load-shape183.cjs` は182/183の正式payload比較、`tests/unity/Loaded183Checks.cs` はInput183を使用する。Input183はInput182の元73種を保ち、最終mineCartLoadV1だけ入れ替えた入力。固定の過去出力Pilot7との比較と、新しい出力名を生成する既存builderを使用。182のfallbackメソッドは残っているが183.Runから再実行していない。大入力の同一ファイルはhardlinkで共有し、書換えない。公開同期は独立レビュー後。
