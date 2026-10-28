# 宝箱の更新と Unity への導入

通常 loader と export に、四角い朽木箱、銀・虹の部品対応テクスチャ、金箱の厚い枠・連続した留め金・天頂ルビー・焼き込んだ浮彫を統合しました。金のきらめく粒子、虹の本体発光と漏光も含みます。既存の 7 種の ID、保存形式、配置座標、Collider の互換経路は維持しています。見た目の mesh は金と朽木で変更しています。

## 金の材質

Unity 6000.5.9f1 / URP 17.5 で確認しました。金属部分は標準 `Universal Render Pipeline/Lit`、Metallic **0.8**、Smoothness **0.8** です。金の基準色は sRGB (245, 215, 121) を一度だけ linear へ変換しています。板面は標準材質、浮彫は同じ標準材質に normal / AO を適用します。ルビーは独立した専用材質で、視点と光に応じた疑似内部カットを表現します。実屈折を計算する方式ではありません。

`ChestRoyalLitBuilder` が normal を linear の NormalMap として取り込みます。追加の green 反転は行いません。共有 packed map は **R=Metallic 0.8、G=AO、A=Smoothness 0.8**、linear です。マップを使う材質の `_Smoothness=1` は A を二重に減衰させないためです。元の relief の AO は R から G へ変換します。Web の finish map は linear RGB=地金色 / A=roughness という別契約であり、標準 Lit の packed map と混同しないでください。

Web と Unity の反射計算は同一ではありません。最終の金属材質の採用判断は Unity Editor の実表示を基準にしています。

## 取り込みと Reflection Probe

1. リポジトリの `unity/Assets/MapSharedProps` を URP プロジェクトへ導入し、通常のエディタ export と既存の importer 手順で小物を取り込みます。更新前の素材を参照したままにせず再 import してください。
2. 取り込み先の光源、環境光、空、Reflection Probe を確認します。金属は環境の明暗を映すため、反射源がない状態では制作画像の艶を再現できません。金の材質は発光でこれを補いません。
3. シーンに既存 Probe がある場合はその bounds / cubemap /受信範囲を確認します。必要な場合だけ Baked Reflection Probe を置き、周囲を含む bounds と capture position を設定して、そのシーンの反射をベイクします。局所的な屋内では box projection の適否も確認します。導入環境の既存設定を優先してください。
4. 金の Renderer は BlendProbes と共通 anchor を使用します。Probe の影響下にあることを確認し、通常のプレイ距離と暗所の両方で評価します。ベイクには金箱自身を混ぜず、自己映り込みを避けてください。

**Importer はシーンの光源・環境設定・Reflection Probe を追加・変更しません。** 公開される画像の Probe と照明は隔離した検証用シーンのものです。ゲーム本体シーンや環境設定の原本への正式導入・保存変更は行っていません。

## 金の自発光粒子

金の粒子を 6 粒から **18 粒**へ増やし、上方だけでなく箱の周囲にも配置しました。Unlit 加算描画で、金属本体の環境照度とは独立します。従来も照明を受ける shader ではありませんでしたが、細い星形と寿命・明滅の alpha が通常距離で輝度を弱めていました。金の粒子だけ linear RGB を 5 倍の HDR 発光へ調整し、自然な明滅・距離 fade・遮蔽・既存 tone mapping は維持しました。本体、ルビー、虹の shader 処理は変更していません。

追加ライト・追加テクスチャは 0、FX の描画は 1 のまま、三角形は 12 から 36 です。部屋の Bloom や露出は変更していません。既存草原／洞窟の同 SEED 71421、同カメラ、同照明、保存済み実地 Probe で 0 / 0.8 / 1.6 / 2.4 秒を確認しました。通常距離で独立したきらめきが読み取れ、箱の面を覆う発光塊にはしていません。

`chestEffectsV1` の金 6 粒は互換のため従来どおりです。新 Reader は optional な `chestEffectsV2`（version 2、金のみ、最大 32 粒）を優先し、現在の 18 粒を生成します。旧 Reader は未知フィールドを無視して 6 粒の経路を維持します。新 Reader も V2 欠落時には V1 へ戻ります。JSON デコード後の未知version・過大slot・非有限値などの不正V2は、ブロック全体を警告付きで除外し、正常なV1からの取り込みを継続します。必須V1やJSON自体の構文エラーを無条件に無視する処理ではありません。Web と Unity の生成／export に接続済みです。

草原の交互測定 CPU Camera.Render 中央値は前 10.79 ms／後 10.42 ms、洞窟の限定測定は前 0.77 ms／後 0.55 msでした。これは小規模な比較で高速化の証明ではありません。GPU 時間は取得できず、全ゲームの FPS や GPU 負荷を保証しません。[比較記録](../validation/chest-release/fx-review-checks.json)と同フォルダーの時刻比較画像を参照してください。

## 互換性と fallback

新規データは optional な `chestSurfacesV1` の拡張に格納されます。銀・虹は `partAtlasesV1`、朽木は `wornAtlasV1`、金の浮彫は `royalReliefV1` を使います。旧 Reader は既存 root / Collider を維持し、新材質に未対応でも破損しません。新材質の完全な表示には新 importer が必要です。

ブラウザーでは画像デコード成功後だけ新 payload を export します。待機・破損・欠落時はその材質だけ fallback へ戻します。朽木 roughness は R 参照です。金の royal 欠落についても実際の Prefab 生成を確認しています。機械向けの既存 asset key / namespace / source binding は互換性のため変更していません。

## 検証と制約

- 最終製品ソースに対して Editor 243 項目、43 Prefab と旧 Reader、7 種の保存再読込、Collider、対象外 mesh、材質チャンネルとコンパイルを確認しました。別ケースで royal 欠落から 43 Prefab を生成し、金の旧材質と Collider を確認しました。
- 既存の生成ルートによる草原・洞窟を各 1 例、隔離した背景 Editor で再現しました。双方 SEED 71421、ゲーム本来のカメラ FOV 50 / 通常距離、既存の地形・照明・postprocess を保持し、Probe OFF / 実地ベイク ON を比較しました。草原 2207 セル、洞窟 648 セルです。入口・通路を塞がず配置しました。
- これらは既存生成表示の再現であり、実行中のゲームやユーザー保存シーンを操作した検証ではありません。ゲーム本体資産はこの公開差分に含めていません。アバター・戦闘・UI を含むゲーム全体の受入確認は未実施です。
- 代表画像は `validation/chest-release` にあります。スタジオ画像は ACES と専用照明・反射を使用しています。実マップ全体の再現素材は含まれないため、導入先でも視覚確認が必要です。
- 金の参照 texture は 8 個、Editor オブジェクト測定約 7.37 MB、新規 Lit 変換 map は約 1.49 MB。圧縮 GPU payload の見積は合計約 3.33 MiB、追加約 0.67 MiB です。前者は driver の実 GPU 常駐量ではありません。5 material submesh（FX を含む）で、全描画パスの draw call 数を意味しません。複数配置で map を共有します。
- **最終変更の Player build / 実行は未検証です。** Editor 検証を Player 成功と扱いません。対象プラットフォームの実機確認は別途必要です。

## 最小の再現確認

Web: Node.js と Chromium 系ブラウザーを用意し、リポジトリ root で `CHEST_REVIEW_OUT` を空の証拠出力先に設定して `node tests/chest-release.cjs` を実行します。非表示ブラウザーで通常 7 種、保存・再読込・export、custom 除外、破損・欠落・pending→ready、R≠G の roughness、共有 texture の再配置を検証します。`report.json` の `pass` を確認してください。

Unity: 専用の URP 17.5 検証プロジェクトに最新 importer を導入し、Web の export を取り込みます。7 種を保存・再読込し、金の標準 Lit と独立 ruby、normal linear / packed R-G-A、元 Collider を確認します。任意 royal ブロックを省いた JSON からも Prefab を生成し、fallback を確認します。通常距離で Probe OFF / ON を撮影します。検証環境以外のシーン設定を上書きしないでください。背景 Editor と offscreen 描画で再現可能で、Player を生成する必要はありません。

制作原稿とマップの抽出は [authoring 手順](../tools/chest-authoring/README.md)、具体的な測定記録は [証拠の説明](../validation/chest-release/README.md)を参照してください。

追加の Editor 再現テストは `tests/unity/ChestOptionalFxFallbackChecks.cs` です。専用プロジェクトの Editor フォルダーへ配置し、`-executeMethod ChestOptionalFxFallbackChecks.Run -props-export <export-folder> -props-output <evidence-folder>` を指定します。正常V2を含む export を入力し、原本を変更せず一時入力を使います。欠落／正常／未知version／33slot／float Infinity の各ケースで43 Prefabを実生成し、6／18粒の選択、警告、Collider、標準Litを確認します。JSON数値 `1e39` が float Infinity になることもテスト自身で確認しています。JSONパーサーが読めない入力（例：double範囲外の `1e999`）はこの意味検証より前に従来どおり拒否されます。
