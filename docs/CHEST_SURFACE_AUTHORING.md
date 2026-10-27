# 宝箱の共有表面マップ

対象は既存7 IDの宝箱だけ。形状・既存UV・当たり判定・配置・保存キーは変えず、材質用座標をshaderで作る。`chestSurfacesV1`はNativeの任意のトップレベル項目であり、既存43メッシュのDTOやキャッシュキーには含めない。従来Readerは無視して従来材質で生成する。custom assetKeyへの標準材質の割り当ては禁止。

独自画素のレシピは`tools/chest-surface-pixels.js`。`node tools/build-chest-surface.cjs`でローカル専用ブラウザから`props/chest-surface-data.js`を再生成する。参考画像のピクセルを読み込む処理はない。PNGと数値の再現SHAは第26まとまりの検証JSONに記録する。実行時は事前生成PNGを非同期decodeし、準備中はタイル平均色と平らな法線を使う。ピクセル生成やPNGエンコードをアプリ起動時に行わない。

512×512を256pxの4区画（木、傷んだ木、磨いた金属、独自の浅い彫り）に分け、各8pxの余白を設ける。色はsRGB。もう1枚は線形のRGBAでnormal X / normal Y / roughness / occlusion。WebはPNGとmip、Native StandaloneはBC7、Android/iPhoneはASTC 6×6を設定する。実機の圧縮結果・性能は未検証。NativeのTextureImporterはNormalMap型にせず、独自チャンネルを保つDefault型にする。

既存ATLAS2の木UVはVが逆順。Nativeのcards2で既に行うV反転も含めてshader内で補正する。PNGの上下・法線の符号・sRGB変換はそれぞれ独立した契約であり、一つを反転して別の問題を隠さない。遠距離では法線・粗さ・色をタイル平均へ寄せ、別区画のmip混入や細線のちらつきを抑える。Nativeの4平均値は通常のVectorプロパティとして材質ファイルへ保存する。

木の4種はWebのMeshStandard／NativeのURP PBR。銀金虹は既存の専用ChestMetalの反射表現を保ってroughnessをハイライトと環境帯へ反映するため、HDR環境の完全な金属BRDFを追加したとは扱わない。黒い蓋の細線、宝石、発光部分、別rendererの白装飾とFXは表面マップの対象外。全体照明・全体シャドウは変更しない。

検証は`tests/chest-surface-contract.cjs`、`tests/chest-surface-browser.cjs`、Unityの`ChestSurfaceChecks`と`ChestSurfaceMemoryChecks`。全カタログ・旧保存・UndoRedo・formal export・custom Prefab bridge・固定サンプルも既存の検査を実行する。追加材質の通過を美観の合格と同義にしない。近距離・俯瞰・暗所・複数配置の実画像を残し、反復や過剰な凹凸を比較する。

第27版は木の周期sinを連続した板方向の場へ置き換え、木面の頂点焼き込み色を除去する。金属側面の彫りはy .09〜.40、|z| .28以内のパネルへ局所UVを作り、NativeはZ向きを補正する。細かい法線と側面の大きな色模様は距離フィルタを分ける。`ChestSideUvChecks`とWebのsurface browser検査は製品座標関数をGPUから4区画読み出す。Nativeの比較画像は両側3回warm-upと固定FX時刻で撮る。
