# 棚キノコの立体・質感改善（cnd015）

既存の四枚の薄い扇形を、取付部・厚み・淡い孔面を持つ棚キノコへ変更した。大きい二枚には丸い膨らみを付け、成長帯と縁の幅に偏りを作った。ID、四段の配置、旧外寸、pivot、設置高さ、既存の衝突仕様は維持。ほか19種と元の512px共有atlasは完全一致。

## 調査・制作

Missouri Department of Conservation の [Artist's Conk](https://mdc.mo.gov/discover-nature/field-guide/artist-conk) を形態資料に使用。木質の半円状の傘、光沢の弱い褐色上面、淡い孔面、木への直接付着を参考にした。厳密な種の再現ではない。参考写真の転載・テクスチャ利用なし。128×128の色mapは `tools/shelf-fungus-texture.cjs` による自作。固定方向のハイライト、発光、法線mapは追加していない。

制作原稿は `tools/build-shelf-fungus.py`。Python標準ライブラリとNodeのみを使用し、旧寸法は履歴c9610c7から取得する。別出力先を必須にし、現行の他資産を保持する。

```sh
python tools/build-shelf-fungus.py --output output/shelf-reproduction/cave-decor-data.js
node tests/shelf-fungus.cjs
```

## 製品への接続と容量

- 24→172三角形、190頂点。洞窟20種の合計1123→1271三角形。対象meshの属性・index概算3312→9392B。
- 色map1枚追加、PNG 26,576B。RGBA+mip概算87,381B追加。全体の常駐メモリやGPU性能の保証ではない。
- 9/225個でも同じgeometry/material/textureを共有。新旧全体atlasは共存し、元atlasを置換していない。
- Webは既存共有Lambert経路。Unityは既存 `MapSharedProps/Lit`。専用texture名でもcnd015の追加光keywordが有効になる限定条件を追加した。光源数・影方式・他材質は変更しない。
- schema/IDは不変。既存データは従来どおり受け入れる。古いImporterで新textureを読む場合、構造はregistry契約内でも追加光条件が不足するため、Importer更新が必要。旧バイナリ実行はしていない。

## 検証と限界

静的検査は閉面、各辺の逆向き対応、面積、法線、UV、寸法、他19種、旧atlasを確認。Webは正式保存・再読込と実ColliderのMap要素を前後比較し、9/225個の共有とGLエラーなしを確認。描画直後のcanvas取得を比較画像に使用。地面の下から見た画像や、描画バッファ消去後の黒画像は見た目判定から除外した。

Unityは専用6000.5.9f1/URP17.5の背景Editorで、正式洞窟20種の生成、PrefabとScene再読込、位置・回転・scale、mesh/法線/UV/色・材質keywordを比較。既存坑道と支柱への手動取付で通常距離、近景、反対側を確認。スタジオでは主光、反対光、点光のみ、全消灯を比較。暗い坑道では上面模様は弱く、縁の識別が中心になる。

`tests/unity/Shelf215Checks.cs` は実行した専用環境の再現原稿。専用プロジェクトにMapSharedProps/MapTunnelsと既存 `Shared117Review` / `ColliderSnapshot109` を用意し、`Input209.json` のbefore/afterへ正式出力フォルダを指定する。実坑道入力 `Input123Mine` と生成済み支保枠の参照は使用環境に合わせる。ユーザーの作業中Sceneを直接実行対象にしない。

213では検査完了後の終了処理でD3D12Core.dll/c0000005が発生した。製品例外や検査失敗とは確認できていないが、正常終了とは扱わず記録を保持。214で一時検証Sceneを明示的に閉じた同製品再検証はexit0。最終215も同じ後片付けで全検査成功・exit0。根本的なGPU安定性の保証とはしない。

GPU時間・スマホ・Player・ゲーム本体全セッションは未検証。CPU Camera.Render短時間測定は診断値で性能保証ではない。今回の正式Unity生成対象は洞窟20種で、全カタログの再生成ではない。手動の取付接点、近景の多角形縁、暗所の模様の弱さは残る。

## Unity更新

公開Importer一式を更新し、新しいWeb exportを別出力先へimportしてPrefabを確認する。既存Prefab/Sceneは自動更新されない。未確認のガラス206は含めない。固定岩・原ゲーム・水面・他担当の並行変更は変更しない。

独立評価は209/211の棚板感、212の反復、213の高い中間輪を指摘。215では取付中心から前縁へ連続する二次曲線の断面に整理した。形状の外寸正規化により、小さい傘を含む対象mesh座標も調整される。他19種は不変。最終215は独立92/100（見た目27・材質17・構造19・Web/Unity20・軽量9）。該当P1/P2なし。最終Web回帰も完了。通常の暗い坑道での差が小さい点には加点していない。

キャッシュURLは新しいデータhashへ更新し、既存の `data-preparation-key` 機構で衝突を持たない対象の外観変更を固定サンプルの再生成から分離した。実行時のsample/sample2キーは既存manifestと一致、完成済みbundle bytesはc9610c7と一致、固定岩再生成0。
