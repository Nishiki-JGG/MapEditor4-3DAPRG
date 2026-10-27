> 本書の検証範囲は各契約の導入時点です。現在の採用内容・統合検証・残件は [NIGHT_RELEASE.md](NIGHT_RELEASE.md) を参照してください。

# 小物追加Native V4：宝箱シリーズ6種

基準9578c46。version=1 / metres / Unity X/Y/Zを維持し、optionalなtop-level extraNativeAssetsV4を追加する。

許可IDは treasurechest_worn、treasurechest_reinforced、treasurechest_ornate、treasurechest_silver、treasurechest_gold、treasurechest_rainbow の6つだけ。未知/重複IDを拒否する。V1(seafan)・V2(サンゴ/ホタテ)・V3(treasurechest)と旧19/additional13/boatを凍結し、従来37の全資産payload/atlasは一致する。

全6種assetKey=tdj/<id>、source=editor-procedural-mesh、radius=.64、groundSink=0、shape=true、light=null、parts=[]。material=cards2は下位3、chestmetalは銀/金/虹の新3IDだけに許可。surface追加なし、UV/position/normal/color/glow/trianglesは従来geometry契約。rootPositionの許可範囲は既存boat/sea/pairのまま、宝箱は従来CSV位置とゼロsinkで配置する。

新Readerは43種を正式Prefab化する。旧37 ReaderをPreChestSeriesSmallPropsV1.csへclass renameのみで固定し、新V4を無視して従来37を保持・Build、新行を外部参照として残すことを確認する。compactライブラリでも同様。新customキー時は該当する既定Nativeだけ除外し、3CSV行を保持する。

chestmetalは専用MapSharedProps/ChestMetal shaderを使う。silver/goldは同じshader/material設定で頂点色、rainbowは別材質の_Rainbow=1。glowはTEXCOORD2に従来どおり格納。反射・虹・輝きはopaque forwardで処理し、影は新材質の標準URP Caster。共通SharedPropLitや既存matを変更しない。更新されたUnity資産一式（新shader/metaを含む）が新6種のNative表示に必要。古いReaderが新6種を描けるとは言わない。

専用検査tests/chest-series-contract.cjsは旧130種属性（木の表示名だけ例外）、旧37 payload、append順序、V1～V4範囲、各3CSV位置、明示高さ、ルビーの正の閉体積と上向き面を検証する。NightPropsChecksにはV4拒否、旧37 Reader、専用shader、底/蓋のraycast、実画素の時間変化を追加。虹だけは完全一致属性の頂点を索引化し、8268→3832頂点、2756三角形は維持。展開全属性/製品footprint一致とNative68画像バイト一致を確認した。詳細と制限はNIGHT_BATCH21.md。

静的な見た目の7段階であり、開閉・報酬ロジック・ゲーム内レア率を追加していない。検証は現在のURP Editorが中心で、Player/端末/Built-inの実描画を検証済みとはしない。
