# 壁掛けランタン：独立レビュー候補 164–168

公開済み `fdf9c7360235c022eceaeb56e1d9b6d08ee57886` を基点とした未公開候補。新 ID `mine_wall_lantern` を末尾追加し、既存の携帯形ランタン、街灯、壁掛け松明を置き換えない。

## 用途と制作

坑道の支柱または岩壁へ手動で取り付ける燃料式の壁灯。背板と二本の留め具、支持腕と斜材、フックと吊り環、真鍮の燃料槽、金属の笠、四本のガード、薄いガラス、反射板と芯炎を一体化した。自動壁面吸着は行わない。基準取付高は床から1.65m。Web の +Z が壁から手前へ向く。Q/E で壁方向へ合わせ、背板を壁面に置く。既定は非衝突なので狭い坑道の通行幅を変えない。

構造参考は Science Museum Group の [Clanny lamp](https://collection.sciencemuseumgroup.org.uk/objects/co43261/a-bonnetted-clanny-lamp-no-19-c-1882) と [Safety lamp](https://collection.sciencemuseumgroup.org.uk/objects/co43493/safety-lamp)。金属燃料槽・ガラス・保護棒・笠・吊り部を観察した。特定史料の忠実復元や安全灯としての機能保証ではない。写真は観察のみで配布物へ含めず、メッシュと256×128の colour / packed / normal / emission は自作した。

本体1172三角形、ガラス24三角形。鉄・真鍮・煤けた笠・芯炎を atlas で分ける。金属の摩耗と少量の錆は反射と低振幅の凹凸へ配分し、ガラス全面は発光させない。ガラスは単層・低不透明度・ZWriteなし。Webは二つの共有 InstancedMesh、Unityは二つの共有mesh/material。厚い屈折やパーティクル煙は追加しない。

## 光と取り込み契約

`mineLanternV1` は任意拡張。欠落・不正時は警告して省略し、既存51種の生成を継続する。通常の正式一括取り込みは小物52種＋洞窟装飾20種＝72種。旧Readerは未知の追加ブロックを無視するソース経路を確認したが、旧バイナリは未実行。

colour/emission は sRGB、normal と packed は線形。packed は R=metallic、G=occlusion、A=smoothness。Web側だけThree.jsのG=roughness/B=metallicへ変換。Unityは標準URP/Lit、UVのV反転に合わせ法線Gを変換し接線を再計算。材質と個体情報を保存するため、一時的なPropertyBlockだけには依存しない。

Unity 6000.5.9f1 / URP17.5 の標準Lit validatorはGIフラグNoneだとEMISSIONを落とすため、BakedEmissiveフラグを保存する。これは実際のライトベイク実行を意味しない。今回ベイクは実施せず、ランタンは非static。validatorの負例と実描画で発光保持を確認した。

既存の通常照明枠は合計6灯のまま。新ランタンはその中の最大2灯で、両方影付き256解像度。残りの新ランタンは発光面のみ見える。宝箱用の独立共有枠は変更しない。光源の近似位置は芯の約12cm前方。燃料槽による巨大な床影を避けながら壁・支持金具の遮蔽を保つための意図的な美術上の近似であり、厳密な面光源ではない。自己発光は環境の昼夜で減衰させず、Point Lightのみ緩やかに明滅する。

実坑道で壁と床が点光源を受けなかったため、MapTunnel.shaderにも限定修正を含む。URPのForward+追加光ループ、距離・影減衰、ShadowCasterを追加した。主光や露出は変更しない。切り抜き表示とは別に不透明な坑道壁が影を落とす。実描画はForward+、Forwardは標準ループのソース確認までで独立実行未確認。

## 実行した検証

- 164：旧51種のmeshと実Collider一致、新任意ブロック9ケース、Prefab保存→破棄→再instantiate、scene保存→再読込。初期の発光判定は保存直後だけで不十分だったため、発光の最終根拠には用いない。
- 165：非衝突・円形・形状Colliderを実Prefab生成。不正optionalから旧51種を実生成。正式72種生成。新壁灯1＋既存灯8の共通budgetを一つに統合し、保存後も参照を保持。
- 167：最終光源位置とemissionを正式取り込み。URP validatorの負例と保存・実描画、shader compile error 0。通常距離・近景・裏側・反対光・照射OFF/ON・3時刻を撮影。既存実洞窟生成seed71421、648セル、元の灯21個を含む隔離インメモリ場面でも確認。原本sceneを保存しない。
- 168：視点7段階移動、選択枠の入替え、全灯を範囲外へ移動、fixture無効化後の残留光0。新影付き灯最大2。
- Web：新IDは末尾、手動配置のみ。位置・角度・scale付き保存復元、実Map正規化Collider一致、ガラス個数一致。通常灯と宝箱同時配置、撤去後の灯・shadow解除。プレビューと確定の取付高・Q/E・Ctrl+wheelを検証。
- 既存レール：直線・左右曲線・閉ループ・既存端点・一筆Undo・取消・touch曲線・複数ボタン・WASD境界・保存読込の回帰。
- 固定サンプル2種のkey/profileとbundle byte一致、file://で既存PBRロード、prepared check。固定岩再生成0。

### 負荷の測定範囲

Unity 9個/225個（視錐台内9/121）：共有mesh2、material2、texture4、texture約1,314,722B、mesh約526,736Bで一定。新影付き灯2。短いCPU描画提出時間の中央値0.7844/1.3348ms。Webは本体＋ガラスの2draw追加、texture数一定、225個で274,110三角形を描画した条件。これらはGPU時間・全フレーム・スマホ性能の保証ではない。

大きい旧JSONを同時比較した初回Web試験はArray buffer allocation failedとなった。メモリ上限は増やさず、任意拡張だけを返す小さいハーネスへ変更して単独実行した。旧51種全体の保持はNativeの実mesh/Collider比較を根拠とする。

## 自己レビューと限界

自己採点候補 **91/100 = 見た目27 + 材質17 + 構造18 + Web/正式Unity20 + 軽さ9**。独立レビュー未実施で、公開許可を意味しない。

通常距離で吊り灯と支持構造、光の届く床・壁が読み取れる。既存の地置きランタンと役割が異なる。一方、近景では笠の分割が分かり、強い点光でガラス内の明暗が白くまとまる角度がある。煤・錆は小さいatlasのため控えめ。炎は変形しない簡易形状で照明だけ明滅。手動の壁方向・取付位置調整が必要。透明個体の完全重なりや全GPUでのsortingは保証しない。

GPU時間、Player、スマホ、実ゲーム完全セッション、旧バイナリは未確認。GUI/入力/フォーカス操作、Player生成・起動、AV変更、画像uploadは行わない。画像はローカル保全。次品制作・公開は独立レビュー後。

## 再現の入口

`node tests/mine-lantern.cjs`、`node tests/mine-lantern-input.cjs`、`node tests/mine-lantern-visual.cjs` は専用headlessブラウザーを使用。`MINE_LANTERN_OUTPUT`で出力先指定可。新extensionだけを出力するため、大量の旧JSONを転送しない。

Unityの `Lantern164Checks` / `Lantern165Checks` / `Lantern167Checks` / `Lantern168BudgetChecks` は専用テストprojectへ配置するローカルハーネス。既存Shared117ReviewとColliderSnapshot109を使用。Input164は新灯一個を正式Web exportしたフォルダー、Input165-mixedは新灯＋旧照明＋洞窟装飾を含むexport、Input123Mineは既存の坑道export、Imported150-validは比較用旧51Prefab。これらの大きい生成物・参考写真・実ゲーム依存の洞窟撮影コードはrepoへ含めない。入力がない環境で全試験を再現済みとは扱わない。
