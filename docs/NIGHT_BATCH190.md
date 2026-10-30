# クモの巣の支持糸と捕獲部（190）

基点は `61e352869bfb9c384ba446987382d36d68014e0a`。他担当の保存・共有メッシュ・完成地形の更新を先に統合した。公開済み178の太い支持糸と整列した網目を対象に、支持糸を細くし、結節間隔と高さ、たるみを不均一化した。密な捕獲部二群は残す。細糸の全面増量、発光、形状変更は行わない。

[Burke Museum の網形解説](https://www.burkemuseum.org/collections-and-research/biology/arachnology-and-entomology/spider-myths/myth-orb-round-spider-webs-normal)を構造参考とした。円網ではなく古い乱網の様式表現で、生物学的な種の再現ではない。写真・外部テクスチャの転載なし。188は大きな多角形セルが漁網に見え独立89点で棄却。189は糸が一点へ集中しWeb段階で棄却。両者は公開しない。

## 検証

- 同条件WebとUnityの通常距離、近景、暗所、反対光、裏面、斜角、重なり、3フレームの視点移動。Unityの旧松明にも時刻固定処理を入れたが、中央松明の白芯の表示差は残った。全照明・全画面の完全一致とはせず、同条件スタジオと坑道の巣部分で評価した。元ゲームのシーンや環境は変更しない。
- Web正式save/reload・export。全小物exportからクモの巣textureだけを除いたSHAが前後一致。geometry/normal/UV/頂点色/ID/Collider/材質・cutoffは不変。
- Unity6000.5.9f1/URP17.5、専用背景Editorで現行正式Importerから対象1種を生成。Prefab保存・破棄・再instantiate、Scene保存・再読込、シェーダーコンパイル。全カタログ再生成とはしない。
- 80tri、512角RGBA1枚、非発光・既定非衝突。9/225配置でmesh/material/texture各1、追加Light0、mesh11,184B、texture参照2,797,193Bで前後不変。225中129可視。Web追加draw1・参照texture数不変。CPUはRenderTexture読戻し込みの参考値で、実製品性能・GPU・スマホ・Playerは未測定。
- optional欠落/破損PNG/任意Collider/旧ソースReaderは177/178の証拠を再利用。該当Importer・schema・meshは変更していない。旧バイナリの実行ではない。

## 再現と利用

`node tests/cobweb-organic.cjs`。`REPO`、`MINE_COBWEB_OUTPUT`、`MINE_COBWEB_INPUT`で出力先を指定する。`COBWEB_BASELINE`で比較元の生成スクリプトを指定でき、その場合大きな正式payloadは保存しない。既存のCDP専用headless経路のみを使用する。

専用Unity検証環境のInput190へ正式出力を置き、`Cobweb190Checks.Run`を背景Editorで実行。既存の177正式Prefabを前比較に使い、Input123Mineの実坑道、既存壁掛け灯、カメラ条件を再利用する。fixture依存はテストソースに明記。証拠数値と画像hashは `tests/evidence/cobweb-organic190.json`、実画像はローカル `Evidence190/{before,after}` と `output/cobweb190/candidate` に保持する。画像は公開treeへ同梱しない。

Unityに反映する場合は更新されたWebから再exportし、既存の正式Importerで別出力へ再importして確認後にPrefabを置換する。Importerや色空間の手動変更は不要。保存済み旧Prefabのテクスチャは自動更新しない。壁・梁への接点は手動で合わせる。真横の薄さと近景の様式化された曲線網目は残る。

独立レビューは92点（27/17/19/20/9）、該当P1/P2なし。限定改善として採用。近景の角張った線・右外側の長い直線は残す。GUI/入力/フォーカス、Player/build、AV変更、画像upload、固定岩再生成は行っていない。
