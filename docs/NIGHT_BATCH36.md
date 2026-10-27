# 第36回: 干し草の繊維方向をUVだけで整える

基準は公開済み `361375ee5721122dc16315b507ac4d874e60be3a`。宝箱・霊廟・崩れ壁・袋の採用状態を保持して、次の小物を実画像で再評価した。

## 判断と限定変更

ランタン、壊れた壺、巻き縄、干し草の現行Native画像を確認した。巻き縄のcanonical余白は約4mmであり、旧保存の明示高さとの関係もあるため、この回では変更しない。干し草は藁模様が周囲全体へ引き伸ばされ、横向きの大きな斑模様に見える点を優先した。

既存straw atlasを周囲4区画へ割り当てる。各三角形内でU座標を同じ区画へ収め、区画境界で隣のatlas領域を横切らないようにした。変更は胴・頭のU座標だけ。上下面・縛り縄・裾の葉先、V座標、全頂点位置・法線・色・index・metadataを保全した。560三角形、80,640Bの頂点属性、共有画像・材質・全体boundsも不変。

近景では横に伸びた模様が減り、頂点へ集まる繊維束として読みやすくなった。俯瞰でも束の方向が揃う。これは既存模様の再配置であり、実体の細い藁を追加したものではない。輪郭の角張り、硬い自己影、4区画の反復は残る。見た目を理由に照明や法線を変更していない。

Web比較は `batch36-before` / `batch36-trial` の各8画像。1000×800、時刻0、同じday照明・カメラ。`haystack-close.png` と `haystack-overhead.png` を主比較とし、試作原稿も保存した。画像・実行ログは追跡外の `output/playwright/night-props/` に保全する。

## 検証

- `haystack-uv-scope.py`：実ブラウザの全136カタログと正式出力を比較。他135種、全位置/法線/色/index/metadata、shared atlas、他のNative payloadが完全一致。干し草のUだけが変わり、既存straw領域内に収まる。
- 33種99配置の旧保存・往復・削除UndoRedo・通行/Collider・正式出力を通過。43描画、278,439三角形を維持。速度向上を主張する測定ではない。
- 固定サンプルはkey更新のみ。森林5761配置/552fits、遺跡536配置/226fitsの全snapshot/CF/collision/profileを保持。bundle/cache/TABの4ケースで岩再生成0。
- Native647項目、干し草を含む変更前/変更後Windows Player各291項目を通過。実画像も確認し採用。対象外Native108画像、Player31画像が完全一致。Editor/Player一覧とscene再読込も各版で一致。
- 別起動のNative集計は14,883,280B/14,785,840Bと異なったため、その差をメモリ削減と解釈しない。同一プロセスで両版を描画準備した比較は17,653,612B/74mesh/22materialで完全一致。全43Colliderのデータと参照、他42描画mesh参照も一致。
- custom bridgeと黒床は今回のUV以外のコード・入力契約が不変で、先の成功証拠を維持。新たな全ゲーム互換の認定ではない。
- 最終集約は `batch36-verification.json`、2026-10-27 21:35:50 UTC。Windows64 Mono/D3D11、Playerの警告/エラー0。buildの既存Core RP StripperTests警告7は残る。

再集約は `python tests/haystack-evidence.py`。保存済みのbefore/after export・画像・各reportが必要で、撮影を再実行する入口ではない。実ゲーム・全136種Player・モバイル/IL2CPP・他GPU/pipelineは未検証のまま。
