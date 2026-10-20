# 針葉樹の風揺れ退行の修正

共有化で外れていた天候の風連携を、針葉樹だけに戻したローカル修正。既存の隔離作業コピーを使い、公開・push・元資産・水・Revision13の変更はしていない。

## 共通仕様 v1

- `pine`だけが対象。既存のUVで針葉領域（canonical uv.y>.5）を識別し、樹皮・幹・根元は動かさない。新しい頂点属性・ポリゴン・画像は不要。
- 高さ2.15〜6.408 mのsmoothstepで樹冠の動きを増やす。正規化した風向、強さ0〜1、最大変位.12 m、sin2本（1.7/.65と2.9/.35）、配置原点の位相係数(.17,.13)を共通化。
- 変位はワールドの水平XZだけ。Yは常に0なので、標準scaleY=1の枝下約2.15 mと人型1.8 mの余裕約.35 mは動作中も変わらない。scaleY=.8では以前と同じ1.72 mの制約が残る。
- ブラウザーは既存の`BU.uWind`と`timeU`を読み、針葉樹専用uniformへ1回渡す。既存の風・天候・水のuniformは書き換えない。正規座標はUnityの+Zで、ブラウザーZを反転する。
- Unityは`SharedPineWind`ドライバー1個が専用のグローバルvector2個を更新する。材質の`_PineBand.w=1`はpineだけ。他の材質は0で変形しない。配置座標の半幅を引き、ブラウザーと位相原点を揃える。
- forwardと影は同じ変形関数を使う。ブラウザーではpine専用Depth/Distance材質を設定し、UnityではShadowCasterも同じHLSL関数を呼ぶ。
- 風0のときは変形を通さず、元の投影経路を保つ。CPUで全頂点を毎フレーム更新・再送する処理はない。法線は元のままの近似で、強い幹の屈曲を再現する仕様ではない。

既存のasset ID、`shared_props.json`の形状・PNG・材質値、map.jsonの保存形式、CSV列は変更していない。`pine_wind.json`を追加出力する。このファイルが無い旧書き出しは、Unityでも従来の静止状態で取り込める。元のライブラリ番号・アセット番号は保持する。

Unityのweatherは書き出し時の`meta.weather.wind×amount / windDir（既にUnity座標）`から初期化する。今回の風なしマップはoff。ゲーム本体の天候システムへの接続はしていない。プレビューでは1つのactive map driverを使用する。複数のactive driverによるglobalの競合、本番ゲーム統合、カメラ端でのshader変形のculling、端末性能は未検証。

## 実検証

証拠は作業コピー隣の`pine-wind-evidence/`。ブラウザーはユーザーPC上のChrome使い捨てプロファイル（SwiftShader）、Unityは既存の隔離`SharedPropsUnityTest`、6000.5.9f1 / URP17.5。Unityは指定のunity_once.py経由で実行。

- Browser：既存天候stormで風が入り、noneで強さ0になる。専用shadow材質を確認。旧マップ、種類ID、配置・回転、保存読込13検査が成功。
- 実GPUの変位座標をfloatで読み戻し、時刻0/.5/1.5/4秒、風なし/最大風、回転・非一様縮尺を比較。ブラウザーとUnityの最大誤差は約.000006795 m（.0068 mm）。Unity14検査成功。
- 幹とY座標の固定、標準枝下、風なしの画像完全一致、動き、下部固定、影の動き、両エンジンの参照画像を比較する35検査が成功。`comparison.json`。
- 風なし画像は、両方とも同じ環境内の静止基準と画素単位で完全一致。樹冠が動く固定時刻の画像でも下部180行（幹下部・接地・基準人型）は不変。
- 標準の最下針葉YはGPU値で2.149999857 m。水平変位だけなので、どの時刻でもYは変わらない。正規化方向、strength<=1、smoothstep<=1、abs(.65sin+.35sin)<=1により水平変位の上限は.12 m。
- BrowserとUnityで、実際の樹冠の影も2時刻撮影した。右側の地面影領域に変化を確認。影画像の画素完全一致は照明・shadow filteringが異なるため主張しない。
- `preservation.json`：共有形状データと水のバイト一致、他の草木の`propShader`と既存`applyWeather`のコード一致。

比較画像は`browser-off.png`、`browser-phase-1.png`（.5秒）、`unity-off.png`、`unity-phase-1.png`、`browser-shadow-0.0.png / 1.5.png`、`unity-shadow-0.0.png / 1.5.png`。全てPC内保存で、添付転送はしていない。

形状は134三角形・402頂点、材質と画像の枚数は不変。風の演算は頂点シェーダーのsin2本などとuniform更新で、スマホFPS・GPU時間・発熱は未測定。法線の再計算やCPUのメッシュ書換えはしない。実機で軽いと測定済みの主張はしない。

## 地面の照明差の点検

今回、草地の画像と共有シェーダーは変更していない。ブラウザーはraw sRGBを読み、macro波の乗算後、terrainColorのpow(rgb,2.2)で一度線形化し、diffuseColorへ一度代入する。UnityもsRGBTexture=falseで読み、Grassのpow一度だけをSurfaceData.albedoに渡し、追加のBaseColor乗算は無い。二重デコード・重複した色乗算は見つからなかった。

前回の照明なし画像差.1969/.3644（/255）もこの判断を支持する。照明あり約15/255の差は残し、美術的に合わせるための画像の色変更や大きなshader改造は行わなかった。`ground-colour-audit.json`に経路と確認内容を保存した。

## 再開

`node tests/pine_wind_browser.cjs`、`python tests/pine_wind_compare.py ../pine-wind-evidence`。Unityには新しいSharedPineWind.cs / .hlslと更新したbuilder/shader、tests/unity/PineWindChecks.csおよび参照shader2枚をコピーし、既存の隔離環境で`PineWindChecks.Run -wind-output <証拠フォルダー絶対パス>`をunity_once.py経由で実行する。

資産由来の再生成一致記録を保持。後続の所有者のGitHub反映許可に基づき、自作草地は`publicReleaseApproved=true`へ更新した。既存ライセンスは変更していない。前回の「風揺れ退行は未解消」という記録は履歴であり、今回のローカル実装ではこの退行を修正した。本番ゲーム・モバイル端末の検証は別途必要。
