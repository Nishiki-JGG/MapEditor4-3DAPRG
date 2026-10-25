# 岩・乾いた土片のUnity反映（2026-10-24更新）

Webの共有素材を正本として、Unityにも同じPNG、法線、頂点色、UV、形状を渡します。岩はversion 6、乾いた土片3種はversion 1です。旧版の岩version 4・5も読み込めます。

## 使い方

1. このリポジトリの最新の `unity/Assets/MapSharedProps` を、使用するUnityプロジェクトの `Assets/MapSharedProps` に更新します。既存の同名ファイルは対応する最新版に更新し、.metaを維持します。
2. 更新後のマップエディターを再読み込みし、「詳細な書き出し」→「Unityデータのみ（ZIP）」と必要な「共通素材（ZIP）」を書き出し、取り込みツールで共通素材の参照を解決します（[手順](ASSET_REGISTRY.md)）。
3. Unityの `Tools > Map Editor > Import shared nature (pilot)` で展開フォルダーを選びます。

書き出しデータだけ更新しても、古いインポーターは新しい素材を受け付けません。両方を更新してください。Unityの既存Scene・Prefabを自動上書きする処理ではありません。取り込みごとに別の生成フォルダーと配置ルートを作る既存方式です。既存の取り込み結果を入れ替える場合は、新しい配置と材質を確認してから旧ルートを除去してください。ゲーム固有の当たり判定やPrefab解決への統合とは別です。

## 今回の修正

- 新しい岩の512×512画像、乾いた土片の128×128画像にsRGB情報を明記。
- Unityの旧固定一覧を拡張し、新版の岩と土片3種、対応する2画像を受け付ける。
- 土片のカタログ解決と配置を追加。植物専用の風データ要求から除外。
- sRGB、trilinear、mipmap、anisotropy=4をUnityのTextureImporterへ渡す。既存のLambert shaderが頂点色・法線を使用。
- 不明な版、誤った画像割当、色空間情報の欠落は引き続き拒否。

## 確認結果

Unity 6000.5.9f1／URPの既存隔離プロジェクトで、実際のエディター書き出し（56資産・9画像）を取り込みました。岩1個・土片3個の配置、4種の形状・法線・頂点色・UV・三角形接続、PNGの完全一致、取り込み設定、旧版互換、shaderの描画を確認しました。20項目PASS。Unity起動は1回。Windows build・ゲーム本体Sceneへの配置は未実施。

再確認用: `node tests/unity_surface_export.cjs <出力フォルダー>` で実書き出しを作り、既存の隔離Unityに `tests/unity/SurfaceSyncChecks.cs` を置き、`MapEditor.Tests.SurfaceSyncChecks.Run` を `-surface-output <出力フォルダー> -surface-export <出力フォルダー>/export` とともに実行します。Unityはプロジェクトの一個制御手順経由で起動してください。

2026-10-24: 大岩の割れ面・欠けを持つv6を追加。旧v4/v5を読む確認も実行。詳細は [PLACED_ROCK_SURFACE.md](PLACED_ROCK_SURFACE.md)。
