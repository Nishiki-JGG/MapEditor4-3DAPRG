# 共有岩の表面調整（2026-10-21）

共有岩の暗く太い曲線状の模様を抑え、細い割れ目・鉱物粒・冷色寄りの灰色へ調整した。元の微細模様を再利用し、頂点に焼かれた接地の陰影は残した。

- 岩の位置・法線・頂点色・UV・三角形・材質値・120三角形は不変。ほかの5種類の共有自然物とその画像も不変。
- 画像は同じ256² PNG、bilinear、repeat、mipmapなし。GPU画像予算は256KiBのまま。PNGは57,871→81,987 bytes。
- メッシュとインポート契約は不変なので既存のモデル版・ID・libraryVersionを維持し、画像の `appearanceVersion:2` とmanifestのSHAで外観変更を識別する。
- ブラウザとUnityは `shared_props.json` の同じPNGを読む。UnityのBuilder・Shaderを変える必要はない。Unityでの再描画は今回実施していない。
- 元の自作画像は `tools/nature/rock-surface-source.png` に固定。再生成は `python tools/nature/refresh_rock_surface.py`。元の購入資産は使用・編集していない。

実エディタと共有モデルの同一カメラで前後比較し、黒い模様の主張が減ったことを確認。保存・当たり判定・配置・地形は対象外。過去の素材検証結果を今回のUnity実行結果とは扱わない。
