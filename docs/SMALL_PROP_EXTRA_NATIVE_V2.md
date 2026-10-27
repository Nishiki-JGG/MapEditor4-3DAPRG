> 本書の検証範囲は各契約の導入時点です。現在の採用内容・統合検証・残件は [NIGHT_RELEASE.md](NIGHT_RELEASE.md) を参照してください。

# ハシラサンゴ・ホタテだけの任意Native追加

`small_props.json` のschema/versionは従来の1のまま、トップレベルの任意配列 `extraNativeAssetsV2` を追加する。許可IDは **pillarcoral / scallop の2種だけ**。既存の `extraNativeAssetsV1` はseafanだけの凍結配列として変更しない。V2という名前はこの任意機能ブロックの世代であり、ファイル全体のversion 2への移行ではない。

V1へ2種を追記する案は、従来のV1 Readerが未知IDを拒否するため採用しなかった。旧8631239 Readerを変更せず別名で読み込んだ実試験では、未知のV2欄を無視して従来34種をRead/Buildでき、軽量libraryも34種として読める。さらに古い33種/32種Reader、旧19/32種出力も保全する。

新Readerは必須19＋既存additional13＋rowboat1＋V1 seafan1＋V2 pair2＝36種。V2内の未知ID・重複は拒否する。利用者のcustom assetKeyの場合、そのIDはV2へ入れず外部Prefabのままにする。V1/V2へ無制限に自然物を登録する仕組みにはしない。

| 項目 | pillarcoral | scallop |
|---|---|---|
| assetKey | tdj/pillarcoral | tdj/scallop |
| radius / height | .4 / 1.4m | 0 / .02m |
| groundSink | 既存暗黙値 .05m | 既存明示値 .004m |
| shape / material | false / default | false / default |
| Native衝突 | 既存宣言どおりの円柱proxy | 既存宣言どおり無し |
| surface / 追加画像 | 無し | 無し |

頂点・法線・色を既存Asset形式で出力し、既存のdefault材質を共有する。新しいshaderや材質種別を増やさない。CSV・保存・ID順序・Prefabキーは変更しない。

任意 `rootPosition` の適用対象だけを、従来rowboat/seafanからこの2種へ追加。Webの `propBaseY` を正規のUnity座標で渡す。特にpillarcoralは、既存CSVの未指定sink=0とWeb暗黙sink=.05との差を、この対象限定欄で整合する。CSV全体や他モデルの配置は正規化しない。

軽量library復元でもV1とV2を別々にコピーする。新Readerで36種78配置、旧V1 Readerで旧34種の保持、双方のcustomキーと未知V2 IDの拒否を実Unityで確認した。検証は `tests/coast-pair-joints.cjs`、`tests/coast-pair-export.cjs`、`tests/unity/NightPropsChecks.cs`。詳細は [第17記録](NIGHT_BATCH17.md)。
