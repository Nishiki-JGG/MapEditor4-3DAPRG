> 本書の検証範囲は各契約の導入時点です。現在の採用内容・統合検証・残件は [NIGHT_RELEASE.md](NIGHT_RELEASE.md) を参照してください。

# 宝箱の任意装飾・演出 v1

`small_props.json` / 軽量版 `small_props_library.json` の任意トップレベル配列。version 1、既存 Asset クラス、assets / additionalAssets / rowboatAsset / extraNativeAssetsV1～V4 は変更しない。旧43種 Reader は新配列を無視して43本体と同じColliderを読める。

## 対象

- chestOrnamentsV1: treasurechest_silver / treasurechest_gold / treasurechest_rainbow のみ。
- chestEffectsV1: treasurechest_gold / treasurechest_rainbow のみ。
- 各 assetKey は tdj/対象ID。利用者が custom キーに変えた対象の本体・装飾・演出は標準Nativeに混入させない。

装飾は `{id,assetKey,mesh:{positions,normals,colors,glow,uv,triangles},finish}`。Unity X/Y/Z/metres、finish は各頂点の0=金属/1=エナメル。頂点共有は全属性のFloat32ビット一致だけを許し、展開後の属性と三角形順を保持。描画専用の子でCollider追加なし。

演出は `{id,assetKey,version:1,slots:[{kind,start,end,width,phase,color}]}`。金6slot、虹16slot（4粒子/8淡い漏れ光/4継ぎ目の霞）。kind0金粒子、1漏れ光、2虹粒子、3継ぎ目の霞。画像・追加点光源・無制限なspawn・CPUフレームループを使わない。Webは全演出を1つのInstancedMeshへまとめ、必要数の次の2冪だけ確保する。Unityは種類別の共有Meshを各Prefabの子にする。

`ChestPresentation` はOnEnable/配置時だけMaterialPropertyBlockを設定する。CSV instanceId をUTF16 FNV-1a の下位16bit /65536へ変換しWebと同じ位相へ。shader timeはWebのtimeU、Unityの_Time.y（テスト時のみSetTime）を使用する。子Rendererの寿命はPrefabの親に従い、Update/Coroutine/外部レジストリは追加しない。

インスタンス行列はURPの `UNITY_MATRIX_M` を使う。通常描画用のunity_ObjectToWorldを直接使うとGPUインスタンス描画で複数個が先頭の位置へ重なる不具合を実証した。UVに格納したslotから座標を組み立てるため、FX専用shaderにDisableBatching=Trueを指定してCPUの位置焼き込みも避ける。共通照明/影/プロジェクトのバッチング設定は変えない。

## 検証と限界

Web136本体/物理メタデータとNative43本体payloadは前回と一致。旧Reader19/32/33/34/36/37/43、通常/軽量版、custom金キー、save/旧形式/UndoRedo、非等方scale/yaw行列、ghost除外、生成削除15回を確認する。Unityでは同種2個・金虹混在の離れた左右両方へFXが描かれるか、黒背景のGPU画像の各投影領域を検査する。領域外だけでなく両領域それぞれに発光画素を必須とする（片側への重複を見逃さない）。

URP/D3D11 Editorの実画像が今回の検証範囲。Built-in fallbackは実画像未確認、Player/Android/iOSとGPU時間・総メモリ・厳密なNative draw callも未計測。反射は軽量な近似で環境マップではない。地面や周囲を物理光源で照らさず、bloomも必須にしない。Web/Unityはslot/動作/色の構造をそろえるが照明・トーンマッピング込みの画素一致を主張しない。
