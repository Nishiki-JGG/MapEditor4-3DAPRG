> 本書の検証範囲は各契約の導入時点です。現在の採用内容・統合検証・残件は [NIGHT_RELEASE.md](NIGHT_RELEASE.md) を参照してください。

# 小物追加Native V3：宝箱だけの任意追加

第20段階。既存small_props.json version=1、units=metres、axes=Unity X/Y/Zを維持する。既存19必須資産、additional13、rowboatAsset、extraNativeAssetsV1(seafan)、V2(pillarcoral/scallop)を変更しない。

新しいtop-level extraNativeAssetsV3は任意配列で、許可IDは treasurechest だけ。assetKey=tdj/treasurechest、source=editor-procedural-mesh、material=cards2、radius=.64、height=.73、groundSink=0、shape=true、parts=[]。geometry配列は既存契約と同じ。位置/法線のZ反転とtriangle winding変換も既存のgeometry()を使用する。1618tri/4854verts、surface追加なし、同じatlas。

ReaderはV3のID/重複を検証し、既存資産と統合後にも重複を拒否する。任意配列を旧配列へ混ぜない。旧36ReaderはV3を無視して旧36を保ち、宝箱行は外部扱いとして残す。新Readerは37種をPrefab化。小舟・海扇・サンゴ/貝に限定したrootPosition処理を宝箱へ拡張せず、宝箱はゼロsinkと従来CSV配置経路を使う。元のID/保存キー/Prefabキーは不変。

custom key時はデフォルトNative資産を出力せず、そのキーと3配置を保存する。軽量版のlibraryファイル参照でもV3を保持する。tools/map_assets.pyの汎用field処理で往復一致するため製品Python変更なし。

検証：tests/treasurechest-contract.cjs、tests/unity/PreTreasureSmallPropsV1.cs（b09f2b3の旧Readerをclass renameのみで固定）、NightPropsChecksのV3専用検査。実Editor213項目、旧36/34/33/32/19Reader・compact・custom・root/非一様scale・lid/底面raycast通過。詳細と生結果パスはNIGHT_BATCH20.md。

これは静的配置モデルの出力契約。開閉・報酬・動的Rigidbodyの仕様を追加していない。Player/スマホ性能と既存ゲームへの本番統合は未検証。
