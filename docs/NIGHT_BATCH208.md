# 支保枠196・洞窟局所光202の統合候補208

最新main `c62f48d41a42c08b719591c4fb45b9072991e555` に、独立合格済み支保枠196と洞窟小物局所光202を統合したローカル候補。公開前のUnity統合検証待ちであり、pushしていない。

## 並行更新と対象範囲

SmallPropsV1のlibrary読込1箇所が競合した。mainのSharedAssetFiles.ReadとGetOrCreateMeshによる共有読込・mesh再利用を維持し、timberのData/library代入/Optional/Buildの4追加だけを重ねた。独立読取監査で、その4追加を除けばmainと全文一致。MapSharedPropsBuilderの局所光条件はcnd001〜020、既存atlas、既存shaderに限定。ガラス206は別作業ツリーに保持し、本候補に混入していない。既存ID、他担当水面・氷、原ゲームは変更していない。

## 今回実行済み

- 現在配信中mainの71ファイルhash一致。公開ページのレールドラッグ、曲線、端点、保存復元、一筆Undo、取消をheadlessで確認。
- 統合候補で支保枠364tri、レール材質共有、追加texture 0、9/225配置のdrawCalls 5・GLエラー0。GPU/スマホの性能保証ではない。
- Q/E、Ctrl+wheel、プレビューと確定、地下配置、旧保存ID、scale/rotation各条件の2柱Colliderを確認。
- レール通常経路とtouch曲線・複数ボタン・WASD境界回帰pass。
- 16種類28配置の正式保存・読込・export。実Collider内容一致、車体2payload不変。小物と坑道を含む共有灯6、影灯2。小物除去後は常設2、全除去後0。画面の禁止固有語0。
- 固定サンプル2種のキーだけを再梱包。展開データはkey以外完全一致、元ファイル保持。正式bundle読込・walk再利用・岩再生成0。キャッシュURL/release/hash同期。

## Unityの適用範囲と未完

196の正式55Prefab/25配置、202の正式20対象と54照明条件はそれぞれ当時の証拠として保持する。206はガラス修正版での別構成なので本候補の検証に流用しない。mainの新しい共有読込・mesh生成cacheとtimberを組み合わせた正式importはまだ未実行。

公開前に専用Editorを非表示で1回だけ起動し、統合sourceのcompile、正式import、timberとレールの材質共有、実Collider、cndのkeyword、Prefab/Scene再読込と既存cache参照を確認する必要がある。全75種や大規模負荷の再測定は不要。追加起動は未承認のため行っていない。ガラス近景や旧版A/Bの不足を合格扱いにしない。

通信アクセスは正式手順で回復。トロッコ193のPages成功を確認した。196/202のこの統合候補は未公開。利用者向け更新は公開後にImporterを更新し、元exportを別出力先へ再importする。既存Prefab/Sceneは自動更新されない。

実行ログ・実画像はローカル保全、集約結果は `tests/evidence/publication208.json`。GUI/入力/フォーカス操作、Player、AV変更、画像upload、forcepushは実施していない。
