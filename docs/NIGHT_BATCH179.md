# 古いクモの巣の公開版179

独立評価91点（26/17/19/20/9）、固有P1/P2なしの候補 `cf308c4ec7972fef5007c9234663eabcbe0c9712` を公開対象とする。基点は `e8e187419593383e3b69567ef1ad0db8fc5a2c92`。既存の製品を保全した追加で、固定岩の再生成0、固定サンプルのkey・profile・bundleは不変。

## 内容とUnity更新

坑道小物に「古いクモの巣」を追加。自作の512² alpha clipテクスチャと80三角形の両面湾曲面で支持糸、密な捕獲部、たるみ、破れを表現。追加灯・常時発光・既定Colliderはない。Q/Eとサイズを調整し、床+1.65mの中心から壁・梁へ手動で接点を合わせる。

Unityでは同梱の `MineCobwebV1.cs` とmetaを追加し、`SmallPropsV1.cs` を更新する。新しいエディタからJSON/CSVをexportし、新規出力先へ正式importしてPrefabを生成する。古いPrefabのままでは新しい巣は追加されない。標準URP/Litを使うため新規shaderは不要。影は受けるが糸の全面カード影は投射しない。古いImporterは未知の任意ブロックを無視するため既存種は保持するが、新しい巣の取り込みには更新が必要。

## 検証の範囲と留保

177で正式73Prefab（53小物+洞窟装飾20）、旧52小物のMesh/実Collider、不正optionalの旧種fallback、保存後instantiateとScene再読込を実検証。178は同一geometry/importerの最終テクスチャに更新し、decode・正式取り込み・保存再instantiateと実坑道画像・重なり・表裏・斜角・9/225共有を再確認した。177の検証を最終テクスチャまで全再実行したという意味ではない。

近景の角張った網目・太い外側支持糸、手動接点、真横で薄くなる点は残る。3フレームの小移動確認を全環境のちらつき保証としない。Unity225配置中129可視、Mesh/材質/texture各1共有、texture約2.80MB。CPUは画像読戻し込みの診断値であり、GPU・スマホ・Player性能は未測定。旧Readerバイナリとゲーム完全セッションは未実行。

Webの通常配置・Ctrl+wheel・Q/E・保存/export、レールドラッグの接続・一筆Undo・取消・タッチ/複数ボタン/WASD入力境界、既存照明予算、file起動、固定サンプル整合を検証した。公開後も配信hashと実配信ページで同じ関連操作を確認する。詳細は `NIGHT_BATCH178.md` と `tests/evidence/mine-cobweb178.json`。画像・巨大export・ビルド物は同梱せずローカル保全。GUI・入力・フォーカス操作、Player、AV変更、画像uploadは行わない。
