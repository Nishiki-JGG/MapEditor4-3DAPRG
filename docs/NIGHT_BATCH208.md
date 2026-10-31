# 支保枠196・洞窟局所光202の統合208

最新main `c62f48d41a42c08b719591c4fb45b9072991e555` の共有資産読込・mesh再利用を保ち、支保枠196と洞窟小物局所光202を統合。製品検証対象は `6cf618fa7aa22a78c19a42263fbaf8b1e53d28e6`。その後は本記録と証拠だけを追加した。ガラス206は別保全し、含めていない。

## 変更

- 支保枠は364tri、レールの木材・鉄材質を共有し追加texture/lightなし。既存ID・保存・通路・2柱Colliderを維持。
- 洞窟装飾はcnd001〜020、既存atlasとshaderが一致するときだけ追加光keywordを有効化。Webの見た目を変更する修正ではない。
- SmallPropsV1の競合はtimberのData/library代入/Optional/Buildの4追加を残して解消。それを除くとmainと全文一致し、SharedAssetFiles.Read/GetOrCreateMeshを保持。独立監査で新規P1/P2なし。
- 固定サンプルはcacheキーのみ再梱包。展開データはkey以外完全一致、元ファイル保持、岩再生成0。

## Web・公開前検証

現在配信中mainの71ファイルhash一致、公開ページのレールドラッグ・曲線・端点・一筆Undo・取消・保存復元を確認。候補では支保枠のQ/E、Ctrl+wheel、プレビュー、地下配置、旧保存ID、回転/scale別Colliderを検査した。9/225配置は材質共有・drawCalls5・GLエラー0で、GPU性能保証ではない。

16種類28配置の保存・読込・正式exportと実Collider内容一致、既存車体payload2種不変。小物と坑道の共有灯6、影灯2、小物除去後は常設2、全除去後0。touch曲線・複数ボタン・WASD入力境界pass。固定サンプル2種はbundle読込・walk再利用・岩再生成0。画面の禁止固有語0。

## 統合後Unity検証

Unity6000.5.9f1/URP17.5、専用Editorの非表示直接起動。MapSharedProps46 sourceを候補とbyte一致させた。正式58Prefab/28配置/skip0、対象7種類・複製込み8実体の材質・Collider共有、cnd keywordを確認。custom支柱半径で実Colliderのcold生成/warm再利用も一致。

最初の実行はPrefab保存再instantiateまでpassし、Scene再読込後のテストが保存前の名前を検索して停止した。製品変更せず、追加承認された1回で保存PrefabのGUID/pathによる一意検索へ切替え、残るScene共有/snapshot検査を完了した。生成直後→Prefab→Sceneの画像RGB最大差はともに0。独立診断でも最初の停止は検証コードの名前検索不備と確認した。失敗記録を成功へ上書きせず残している。

局所光そのもののForward/Forward+実描画は202の54条件を根拠とし、今回の画像は主光のみ。Input203のローカルlibrary参照を使い、外部shared-recipeの全分岐まで検証したとはしない。全カタログ再生成、全PrefabのScene状態、GPU/スマホ/Player/実ゲーム全体は未検証。ガラス206やその近景不足を本検証で合格と扱わない。Unityは終了した。

## 更新手順と証拠

公開されたImporterを更新し、新しいWeb exportを別出力先へimportして生成Prefabを確認する。既存Prefab/Sceneは自動更新されない。旧Importerは新支保枠を扱えず、洞窟装飾も旧来の照明応答のままとなる。

`tests/evidence/publication208.json` はWebと当初の検証待ち状態、`publication208-unity.json` はその後に閉じたUnity検証の記録。196/202文書の公開保留は当時の履歴。実画像・実行ログはローカル保全。公開完了は最終SHA・Actions・配信hashと公開ページ操作を別途照合する。

GUI/入力/フォーカス操作、Player、AV/ExecutionPolicy変更、画像upload、forcepushは行っていない。
