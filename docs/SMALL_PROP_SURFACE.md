> 本書の検証範囲は各契約の導入時点です。現在の採用内容・統合検証・残件は [NIGHT_RELEASE.md](NIGHT_RELEASE.md) を参照してください。

# 小物v1の任意石肌画像

小物の必須ID・保存・配置・衝突・旧形式を変えず、墓2種だけの微細な石粒に使う。不透明材質1個・描画1パスを保ち、既存のShaderや全体照明を変更しない。

`small_props.json` の対象資産に任意の `surface` を付ける。現実装の対象は `gravestone` と `crossgrave`、IDは `grave-stone-grain-v1` のみ。項目は `id,width,height,png,colorSpace,filter,mipmaps,wrap`。PNGは同一の128×128・sRGB・全画素alpha255、Trilinear・ミップあり・Repeat。2資産で同じ画像を参照し、Unityは画像を1枚だけキャッシュする。IDが同じで画像が違う定義は拒否する。

UVは物体のメートル座標を0.32m周期の面ごとの平面に投影する。写真ピクセルの転用はない。Web CanvasTextureとUnity PNGの画像原点差はUnityでVを `1-v` に変換し、頂点ごとに検証する。粒画像の平均線形輝度で頂点色を補正し、材質を付けたためだけに全体が暗くならないようにする。

任意項目なしの旧出力はこれまで通り読む。Unity JsonUtilityが未指定の任意オブジェクトを空で復元する場合も、全項目が空の場合だけ未指定へ正規化する。必須フォーマットversion1、19コア・13追加ID、carved材質名は変更しない。以前のImporterは未知の任意項目を無視して頂点色で読み込めることを検証済み。

完全版と軽量版の両方で任意項目を保持する。小物ライブラリへ分離して戻しても画像・UV・メッシュは損失なし。独自の外部Prefabキーは上書きしない。
