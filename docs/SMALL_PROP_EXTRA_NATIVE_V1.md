> 本書の検証範囲は各契約の導入時点です。現在の採用内容・統合検証・残件は [NIGHT_RELEASE.md](NIGHT_RELEASE.md) を参照してください。

# extraNativeAssetsV1: ウミウチワだけの任意Native追加

この文書はseafan専用の凍結V1契約。後続のハシラサンゴ/ホタテ2種は [独立したV2契約](SMALL_PROP_EXTRA_NATIVE_V2.md) に置き、V1の許可IDを変更しない。以下の34種という検証数は第15段階時点の記録。
`small_props.json` version 1 のトップレベル任意配列 `extraNativeAssetsV1` に、既存 `Asset` 形式で `seafan` だけを追加する。必須19種・従来の `additionalAssets` 13種・`rowboatAsset` は変更しない。旧Readerは未知のトップレベルフィールドを無視できる。旧配列へseafanを入れる方式は採用しない。

Readerの許可集合は `seafan` だけ。重複・未知ID・不正な資産キー・配列長・非有限値は既存検査に従い拒否する。custom assetKeyが `tdj/seafan` 以外の場合は配列に入れず、外部Prefab参照のままにする。従来128種をこの追加機能に移行しない。

| フィールド | seafanの契約 |
|---|---|
| id / assetKey | seafan / tdj/seafan |
| radius / height / shape | .15m / 1.1m / false（既存円柱proxyを保全） |
| groundSink | 未指定時の既存Web既定値 .05m |
| material | defaultの頂点色 + 専用AlphaTest画像 |
| surface | seafan-net-v1、256×256 RGBA PNG、sRGB、clamp、trilinear、mipmaps |
| cutoff / blend | 既存SharedPropLitのcutoff .42、透明ブレンドなし、1材質 |

網の画像はこの1種だけに使い、他種・既存atlas・共通shaderを変更しない。Web画像の `flipY=false` と上原点UV、Nativeの既存 `1-v` 変換で同じ対応になる。実GPU読み戻しで全画素α誤差0を確認した。物理proxyを網の穴ごとに分割しない。

既存CSVはgroundSink未指定を0として出す一方、Webの暗黙値は.05m。CSVや保存形式を変更せず、既存rowboatに続いてseafanのinstancesだけに任意 `rootPosition` を付け、Webの `propBaseY` と同じ原点を渡す。Readerの適用はrowboat/seafanに限定し、他種へ適用しない。

軽量版のlibrary復元では `extraNativeAssetsV1` と `rowboatAsset` を両方引き継ぐ。以前のReaderは軽量libraryからrowboatAssetをコピーしていなかったため、この局所的な復元漏れも修正した。新Readerで完全版・正式共有資産庫の軽量版とも34種69配置を実生成。旧Readerの軽量版で33種が復元できるとは主張しない。

隔離Unityで、変更していない旧Readerを別名クラスとして読み込んだ検査も実施。追加前Readerは33種を生成してseafan3配置を外部として残し、さらに古いReaderは32種を生成してrowboat/seafan計6配置を外部として残す。旧19種出力・旧32種出力は新Readerで読める。未知extra IDを拒否し、custom seafanは外部3配置のままにする検査も通過した。

専用回帰は `tests/seafan-export-contract.cjs`、Unity実検査は `tests/unity/NightPropsChecks.cs`。生成の正確な負荷・画像・制限は [NIGHT_BATCH15.md](NIGHT_BATCH15.md) を参照。
