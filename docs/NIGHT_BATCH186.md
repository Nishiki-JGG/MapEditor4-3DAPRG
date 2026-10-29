# 186 掘削痕岩壁の公開準備

独立評価済み185 `fca119035d8619b1fc6033273e6279cd51118a35`、92点（26/18/19/20/9）、P1/P2なし。公開基点main/作業branchはともに89ac659。通常追加コミットとして反映し、force pushはしない。

石肌三マップ改善と正式export待機のみ。平均色、372tri、工具痕/UV/Collider、保存/共有は維持。137と同条件のbefore6枚は元137とRGB差0。通常距離と近景で旧版より自然な岩肌として改善した。完全な壁一体化は保証しない。

前後ともtexture参照見積4,022,549B、9/225は全数可視、1mesh/1material/3texture。exportは約311KB増。正式Unityは変更対象1種の生成、全74再生成ではない。GPU/スマホ/Player性能は未検証。近景のぼけ・面分割・歯列感は185記録の減点を維持。

cache URL、manifestのsource hash、release hashを同期。表示専用cutRockSurface queryを固定sample keyから除外し、完成bundle/key/profileを変更しない。固定岩再生成は0。

Unity側は今回Importer/shaderに変更なし。更新したWebページで新しくexportし、既存の正式MineCutRockV1 Importerで別出力へ再importする。保存済みPrefab/Sceneは自動差替えされないため、確認後に新Prefabへ置換する。古いexportは旧三マップのまま。色空間/Normal設定を手作業で変える必要はない。

公開後の正確SHA、Actions成功、配信hash、texture ready/保存export/欠落fallbackと関連操作はローカルのoutput/rock186-publicへ記録する。画像upload、GUI/入力/フォーカス、Player、AV変更なし。
