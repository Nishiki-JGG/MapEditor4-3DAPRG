# 小物改善の採用内容と公開準備

## 採用内容

柱、墓、旗、干し草、壺、袋、門楼、霊廟、塔、城壁、崩れ壁、雪の小物などの厚み・接合・接地を改善した。ランタン、採掘道具、樽、縄、舟、海辺の小物、棚状キノコの既採用修正も保持する。既存の保存形式、ID、配置、custom Prefab、通行・Colliderの契約を維持する。

宝箱は木系4種と銀・金・虹の計7種。銀は暗銀と白、金は黒と金粒子、虹は漏光とし、黒い蓋の細線を保持する。金属箱の正面・蓋・側面に、支持面を持つ凹部と面取りを追加した。重い第31試作は不採用とし、第32の軽量化した造形を採用した。第31試作のNative mesh増分4,437,372Bに対し、第32は1,597,260Bで、増分を約64%削減している。参照サンプルと同等の緻密さに到達したという評価ではない。

最後に霊廟の屋根へ石板26枚と棟3枚を追加し、崩れ壁の苔を支持石に沿った薄い付着面へ修正した。袋は厚い鉢状の口を、結び目へ戻る閉じた折り返しへ変更した。袋の面数・頂点属性bytes・全体boundsは不変。墓の茶色い土を復活させず、黒床のunlit、公的表示からゲーム固有名を除いた状態も維持する。

## 統合と履歴の扱い

公開準備はmain `441e1405f7d461ec644fa6bc7b3e3d2911aa121b`を基点とする。mainの月・水面反射、低い月の位置、回帰テスト、READMEの説明を保持した。app.jsには共通祖先からの双方の非重複変更を統合し、index.htmlは宝箱関連scriptと月反射のcache keyを両方残した。READMEの既存ゲームに関する表現はmainの一般名称を採用した。

元の採用版`2ef6930`、記録だけを追加した`cfb0f64`、後継の最終版`aadec21`はローカルで保全する。この公開準備branchへ不採用コードや中間生成物の履歴は取り込まない。元`cfb0f64`の3文書は、第31試作の棄却、当時の進捗、当時のリモート監査の記録であり、追加の製品修正ではない。採否と統合上の要点を本書へ集約し、詳細と元画像・実行ログは元の作業記録に残す。

固定サンプルは岩を再生成せず、実行時keyとソースhashだけを整合させた。森林5761配置/552fits、遺跡536配置/226fitsのsnapshot・CF・collision・profileを維持する。

## 検証と再現

採用版の基準検証はWeb全136カタログ、Native647、custom bridge154、Windows Player291項目。Unity6000.5.9f1 / URP / Windows64 Mono / D3D11の専用fixtureで検証した。Unity製品103ファイルは公開準備版と採用版で一致する。今回の統合版で月反射・昼夕夜・黒床、全136カタログと保存/旧保存/UndoRedo/Collider/正式出力、固定サンプル4ケースを確認した。Native647、Windows Player291項目も再実行して通過。custom154と黒床Unity12は製品コードおよび入力の同一性を確認して既存成功結果を再利用した。黒床exportは毎回発行されるroomId以外すべて一致。詳細は [NIGHT_RELEASE_VALIDATION.json](NIGHT_RELEASE_VALIDATION.json)。

Native個別110画像とPlayer34画像は採用版と全ピクセル一致。Editor/Playerの一覧とscene再読込も一致。Native全景は宝箱の時刻を固定しないため113画素（最大28階調）の差を残し、完全一致とは扱わない。Web/Unity双方の実画像を確認した。Player buildは7.15秒、エラー0、既存Core RP StripperTests警告7、実行時警告/エラー0。

主要な実行入口:

- `node tests/moon-reflection.cjs output/playwright/moon`
- `node tests/time-of-day.cjs output/playwright/time-of-day`
- `node tools/build-prepared-samples.cjs --check`（確認専用。引数なしは再生成するため今回使用しない）
- `node tests/prepared-pureblack-regression.cjs working`
- `node tests/sack-mouth-structure.cjs`
- Unityの`NightPropsChecks.Run`、`FibreCompatibilityChecks.Run`、`NightPlayerBuild.Run`。隔離プロジェクトと正式export/旧Readerのfixtureが必要。

過去版との比較型テストは、指定した基準commitまたは保存fixtureを別途必要とする。中間commitと生成した証拠は、この軽量公開branchには含めない。現在コードだけで実行できる検証と、過去資料を必要とする比較を区別する。

## 未検証・既知制約

- 実ゲーム統合、Player内での実マップ/旧save移行、全136種のPlayer認定、IL2CPP、Android/iOS、別GPU・別pipelineは未検証。
- 石・木・袋の硬い自己影、箱の一部の図案的反復、袋の立った口は残る。布シミュレーションや写実的な毛羽は実装していない。
- 巻き縄canonical Prefabの約3.98mmの浮きは既知。配置済みgrounded partsの検証と区別する。
- cliffの旧加工保存との互換問題がある改変は保留し、今回は採用しない。
- PC上のCamera.Render/readback計測はFPS、純GPU時間、モバイル性能の保証ではない。既存Core RP StripperTests警告は製品エラーと区別する。
