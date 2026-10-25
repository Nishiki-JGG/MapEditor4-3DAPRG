# 凸ダンの壁掛け松明

「置く」→「建物・道具」→「壁掛け松明（凸ダン）」で配置します。既存の松明 `torch` とランタン `lantern` は変更していません。元ゲームの `RoomTorch` を別ID `wall_torch`／資産キー `tdj/wall_torch` として追加しました。

## 表示と配置

元の `Torch.asset`（96頂点・44三角形）と `Flame.asset`（24頂点・8三角形）から頂点・法線を抽出し、UnityのZを反転してThree.jsへ渡しています。炎の中心は元rootからY=0.26mです。原本のrootは柄の中央なので、通常の配置では地面から1.45mに支点を置きます。既存の向き・倍率の操作を使い、壁に合うように向けてください。壁の検出や自動吸着は今回の対象外です。

炎の伸縮、火の粉、煙、暖色の点光源を組み合わせています。火の粉8個/秒、煙3個/秒を基準にし、元の寿命・大きさ・色・放出形状を参照しています。原材質のEmissionキーワードは無効なので、保存されたEmission値だけを根拠に発光を追加していません。

Webの粒子乱数・連続ノイズ・透明粒子の縁はWeb向けの再現で、UnityのParticleSystemと完全に同じ時系列ではありません。原本のNoiseとPerlinNoiseをバイナリ互換で実行するものではありません。形状と支点は原本から取り出し、Unityへ戻す場合には元の完成済みVFXそのものを使います。

## 保存とUnityへの復元

通常の「保存」「開く」、削除、Undo/Redoに対応します。種類は保存済みの名前で対応させ、新IDを末尾へ追加しています。固定サンプルは既存の完成済み資産を読み、表示専用スクリプト追加で岩の再生成を起こさないようにしています。生成キーの地形側の版情報は維持しています。

「Unity用に書き出す」と、通常の `props.csv` に加えて `room_torches.json` が出ます。配置ID・位置・向き・倍率・原PrefabのGUIDとハッシュ・VFXの固定IDを記録します。見た目の乱数はseed=0、部屋ID＋`#`＋個体IDをキーとし、保存・再読込で位相を保ちます。これはマップ生成やゲームルールの乱数を変更しません。

Unity側には本リポジトリの `unity/Assets/MapSharedProps` と、元ゲームにある次の原本と依存資産が必要です。

- `Assets/TotsuDanShell/Prototype/Resources/DiscoveryPresentation/RoomTorch.prefab`
- `Art/DungeonPresentation/Torch.asset`、`Flame.asset`、`Blackened iron.mat`、`Torch glow.mat`
- `Resources/DiscoveryPresentation/TorchSpark.mat`、`TorchSmoke.mat`
- `Runtime/DiscoveryRoomTorchPresentation.cs`、各原本の `.meta`、対応するURP

元PrefabのGUIDは `076bf4c551dc4254e85f0316aba457c6`、VFX IDは `vfx.environment.torch.fire` です。元ゲーム内では既に揃っている資産です。取り込みは従来の `MapSharedPropsBuilder.Build` に接続してあり、壁掛け松明だけを確認する場合はメニュー「Tools → Map Shared Props → 凸ダンの壁掛け松明を取り込む」も使えます。元Prefabが欠ける場合や抽出時と版が違う場合は、代わりの炎を生成せずエラーにします。

部屋Prefabを保存して再読込した際も `RoomTorchInstance` が元の `Initialize(int,string)` を呼び直します。原本は非アクティブなテンプレートのため、配置後に有効化します。自動再生する粒子は完全停止してからseedを設定し、必要な粒子を再生します。元Prefab・元スクリプトの編集は不要です。

## 配置数と負荷

Webは既存の6灯を共有し、灯具の切替をフェードさせます。表示中心から18〜32mで煙と火の粉を滑らかに減らし、遠方では粒子を更新しません。モデルと炎本体は残るため、距離で突然消える構成ではありません。炎はインスタンシング、火の粉と煙はそれぞれまとめて描画します。

Unity側は取り込んだ部屋グループごとに最大6灯・影付き最大2灯です。カメラの近くを優先し、同じ18〜32mで粒子を減らします。複数の部屋グループ全体をまとめるゲーム共通のライト予算には今回接続していません。

今回の測定はWindowsのChromeと隔離Unity Editor、1280×720、RTX 4070 SUPER環境です。1/10/50本を測定し、Webの50本時のVFX更新中央値は約0.2msでした。Editorの描画CPU時間はPlayerのFPSやGPU時間と区別して報告します。スマートフォン、Playerビルド、ゲーム全体での負荷は未検証です。

## 検証の再現

- `node tests/wall-torch-browser.cjs`：UI配置、原本形状、保存再読込、削除、Undo/Redo、距離フェード、Unity書出し、位置・角度・倍率、1/10/50本の測定。
- `node tests/wall-torch-regression.cjs`：64m/48mの固定サンプルを岩の再生成禁止で読み込み、TAB4回後も地形・小物・保存内容が同じこと。
- `node tests/wall-torch-visual.cjs`：元Prefabと同じ寸法・カメラの比較用Web描画。
- `python tools/export-wall-torch.py <元ゲームのAssets/TotsuDanShell/Prototype>`：モデル抽出と元資産のSHA-256記録。
- `python tools/preflight-wall-torch.py <Unity Editor/Data>`：Unityなしの対象C#コンパイル。
- `tests/setup-wall-torch-unity.py`、`tests/unity/RoomTorchChecks.cs`：必要な原本だけの隔離環境、Prefab取り込みと保存再読込、PlayMode初期化、1/10/50本、元Prefabとの比較。
- `python tools/check-wall-torch-log.py <証拠フォルダ>`：起動全体のseed Assert・コンパイルエラー・予期しない例外を検査。既存のEditor SearchDatabase例外は元stackを保存して区別します。

証拠はローカルの `output/playwright/wall-torch/` に保存します。Unityは元ゲームの `tools/dev-metrics/unity_once.py` を必ず通して起動し、ユーザーの試遊や他担当の環境を止めないでください。
