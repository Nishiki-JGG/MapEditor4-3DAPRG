# 完全な黒の床（ローカル実装・未公開）

基準は `cd7b2ff`（松明品質・篝火追加済み）。このタスク内の独立 worktree `black-floor`、ブランチ `feat/pure-black-floor` で実装した。既存の岩盤作業ツリー、別の洞窟作業ツリー、Unity ゲームプロジェクトは変更していない。push／公開はしていない。

## 仕様と実装

- 床ツールと全塗りの一覧に「完全な黒」を追加。ID は `pureblack`、塗装チャンネルは末尾の **10**。既存 0〜9 は変更しない。ショートカットは追加しない。
- 黒い albedo ではなく、既存の不透明地形のフラグメント最終出力を黒にする。照明・影・反射・独自の床色処理・霧・トーンマッピング・色変換・ディザの**後**に塗装被覆率で適用する。Alpha／depth write／衝突／地形は変更しない。
- 既存床と同様に崖の被覆は既存の斜面判定を優先する。崖や設置岩の材質・形状は変更しない。完全被覆の床内部を純黒とし、薄い筆塗りや境界は被覆率で既存床と混ざる。
- 保存は従来の splat 配列。旧 9／10 チャンネルデータは既存の末尾拡張読込で受け入れる。新たな移行処理や自動床選択は追加していない。新保存を未対応の旧アプリで開く後方互換までは保証しない。
- 出力は既存の未使用 `mask_3.png` B に黒の塗装量、末尾 `weights_4.png` R に描画重みを追加。既存の weights／mask の ID・順序を維持。`pureBlackFloorV1` を必須機能として記録し、視覚メッシュにも黒の頂点塗装を保持する。
- Unity の既存 `MapSharedGround/Grass` に非照明の黒マスクを追加。`MapSharedGroundBuilder` は部屋の meta と mask を読み、黒を有効化する。共有資産が別フォルダでも部屋フォルダを明示して解決する。旧出力の既定値は無効。根や小物の shader は変更しない。既存同様、床の実シーンへの配置は利用側が行う。

## 実検証

記録は [pureblack/](pureblack/)。比較画像は [comparison.jpg](pureblack/comparison.jpg)。元の PNG と実 UI 保存 JSON は `output/playwright/pureblack/` に保存。

| 確認対象 | 結果 |
|---|---|
| Chrome 最終フレームバッファ | 明所／暗所／松明・篝火近く／白霧＋露出4＋ディザ／白環境反射／岩盤 variant 併用／保存後の各条件で、内部 1,600 画素すべて RGB **0,0,0**・Alpha **255**、GL エラー0 |
| 実 UI | 素材選択、通常描画中のマウス筆塗り（89頂点）、Ctrl+Z/Y、全塗り、実保存ボタンとファイル入力による再読込に合格 |
| 旧 ID | 全既存チャンネルを含む 9／10 チャンネル保存を読込。各既存値を保持し、新末尾は0 |
| 地形・歩行 | 黒への塗装後も高さ・崖スタイル・通行上書き・水位・歩行可能状態を保持。自動小物追加なし |
| 既存床 | 土・荒れ地・岩盤の同一場面 800×600 RGBA のハッシュが基準 main と完全一致 (`32b5eb625e740c1bce7ac7b288ce7d56ddea72c06ba86d5cbdae728201f8470e`) |
| 固定森林64m・遺跡48m | 基準／変更後の初回 bundle と cache、TAB 切替を実 UI で比較。すべて岩再生成0。キー・profile一致、歩行準備再利用、形状・配置・既存塗装ハッシュ一致 |
| Unity 6000.6.2f1／URP 17.6.0 | タスク専用空プロジェクトで実出力を取込。明所・暗所・点光源・霧で内部4,096画素すべて RGB **0,0,0**・Alpha **255**。未塗装側が可視、無効化で元床復帰、旧出力無効、shaderコンパイル合格 |

サンプルの完成形状は再生成していない。`tools/repack-black-floor-samples.cjs cd7b2ff` は完成済みデータへ空の末尾チャンネル、照合キー／profile、塗装署名だけを追加する。その他の形状・衝突データは deepEqual で同一確認。`node tools/build-prepared-samples.cjs --check` も合格。

`surface-paint.cjs`、`map-storage.cjs`、`room-package.cjs`、`tunnels_unit.cjs` が合格。JS 構文確認と `git diff --check` 合格。`props/`、水、海、湧水、トンネル、資産 registry の実装差分なし。

## 負荷と制限

- 新規テクスチャ **0**、新規形状 **0**、床本体の描画呼出し追加 **0**。24m の同一小物なし比較は両方5 calls／9,600 triangles／22 textures。黒の初回全塗り＋描画はこの PC で約16.6〜21.8ms（最終確認21.8ms）。既存 shader を利用し、黒選択時だけの新 variant／コンパイルはない。
- 保存／CPU配列は頂点ごとに Uint8 塗装1 byte＋有効重み Float32 4 bytes増。既存の splatC に Float32 1成分を追加し、ソース・描画用・崖 relief の各既存頂点ごとに4 bytes増える。64mの16,641頂点では塗装16,641 bytes、有効重み66,564 bytes。テクスチャ参照は追加しない（Web）。Unity出力は部屋ごとの既存 mask_3 を使用する。
- 端の MSAA、薄いブラシの混色、白い選択リング、前景の炎／小物／水／気象の重なりは黒素材そのものと別。重なった画素まで0にする機能ではない。実測はそれらが覆わない内部領域。松明・篝火は表示したまま測定した。
- Unity はマテリアルと既存の出力導線を検証した。ゲームのカメラに独自の Bloom、カラーリフト、画面合成がある場合、その後段の影響まではこの材質で打ち消さない。ゲームプロジェクト／設定は未変更。
- スマホ実機、他の Unity バージョン／レンダーパイプラインは未検証。既存岩盤の非並列コンパイル環境での初回待ち問題は今回の別素材の変更対象外。
- Unityの最初の試行はURP初期化前の空画像（Alpha0）で不合格とし、結果を採用していない。専用プロジェクトへURP設定を保存して再起動後、非黒側の描画も確認してから上記合格結果を採用した。
- Playwright CLI は npm の名前解決失敗で起動不可。既存 `tests/cdp.js` により通常 Chrome の実描画・入力を検証した。Library 転送は指示どおり試行していない。

## 再検証

```text
node tests/pureblack-browser.cjs
node tests/pureblack-input.cjs
node tests/prepared-pureblack-regression.cjs cd7b2ff working
node tools/build-prepared-samples.cjs --check
```

Unity は専用検証プロジェクトへ関連 source と `tests/unity/PureBlackFloorChecks.cs` をコピーし、`PureBlackFloorChecks.Setup` でURPを保存して終了、その後再起動で `PureBlackFloorChecks.Run -black-output <出力先> -black-export <実出力フォルダ>` を実行した。ゲームプロジェクトを検証用に使わない。
