# 鉱石トロッコ — レビュー候補125

未公開の配置用小物。独立レビュー前に合格・公開済みとは扱わない。走行、積荷、排出アニメーションは実装しない。

## 調査と設計

- [鉄道博物館の鉱車](https://slorrm.com/QR-minecart.html/) は鋼板・リベット・四輪台枠・上ヒンジの排出扉を説明している。これらを構造参考にした。原車の寸法や運動機構の忠実な複製ではない。
- [州立公園の採掘・搬出の解説](https://parks.ca.gov/?page_id=31829) を坑道運搬用途の参考にした。資料の写真をテクスチャとして転載していない。
- 公開済みレールの創作規格、中心間隔0.84m、走行面0.14m、曲線中心半径2mを保持する。標準坑道幅2.4m・高さ2.8m内に収まる。
- 箱上端1×1.4m、箱上端高さ1.04m、板厚約0.025m。四輪の踏面半径0.18m、内側フランジ半径0.205m、軸間0.56m、踏面半幅0.058m。静止した短軸距の鉱車であり走行力学の保証ではない。
- pivotは踏面最下部。地面への単独配置ではフランジが接地するよう0.025m上げる。レール上ではレール基底＋0.14m。車体・枠・軸受・車軸・縁・扉ヒンジ・留め具・連結輪を持ち、箱の内壁と底は実形状。

## 制作と自己レビュー

初稿は反射環境がないWeb金属で黒く潰れたため不採用。トロッコ材質だけに既存共有反射を接続し、周囲のambientに従って強度を下げる。夜に自発光させない。Unityは標準URP/Litと導入先のReflection Probe/環境反射を受ける。

次稿では輪の側面まで磨かれた外観を見直し、踏面と軸端だけを磨き、側面を鈍い鋳鉄へ分けた。縁とヒンジ、鋼板、接合周辺の錆、車台の素材差を共有atlas内で表現する。面数増加なし。全体に細傷を追加する方式は採らない。

同時に配置の継ぎ目制約を修正。接続された隣のレールも含めて両軸の支持を確認する。孤立端からの脱輪配置、車止めへの重なり、近傍レールとの異なるscaleを拒否する。自動scale変更はしない。他の小物・レール配置動作は保持する。

## 正式接続とデータ契約

- stable ID `minecart`、assetKey `tdj/minecart`、カテゴリ「坑道小物」。manualOnlyで固定サンプルへ混入しない。
- Webは共有MeshStandardMaterial。512×256のcolour/packed/normalを手続き生成。colourはsRGB、dataはlinear、packedはR=metallic、A=smoothness。Web用はG=roughness/B=metallicへ変換する。
- 任意拡張 `mineCartV1`。version1、metres、Unity座標、単一asset、有限値・個数・bounds・PNG実decodeの検査。不正・欠落なら警告してトロッコだけ省略し、既存47種を保つ。
- Unityは標準URP/Lit、白の永続material、R metallic/A smoothness、normal。UVのY反転に合わせnormalのGを一度だけ反転し、接線を再計算する。MaterialPropertyBlockへの色依存なし。
- 初期Colliderは1.08×1.12×1.78mのbox、中心Y=0.535m。catalogの正規高さ変更に追従する。非衝突指定では見た目を保持してColliderのみ省略。circle指定も検証した。
- 旧Readerバイナリは未実行。既存ソースの未知optional field無視と旧47種保持を確認した範囲を超えて主張しない。

## 検証

- Web: 25項目。直線/曲線、回転/scale/高さ、継ぎ目、孤立端、車止め、傾斜、有限値、内底法線、実曲線meshへの4点レイ。最悪の踏面中心ずれ0.025008m、レール頭半幅0.025mを足しても踏面半幅0.058m内。
- 通常UI: 非表示ブラウザー内で選択・配置・プレビュー・異scale拒否・坑道床ピック・保存復元。ユーザー画面や入力は操作しない。
- Unity: 正式Importerから正常48Prefab、不正/欠落47Prefab。valid/missing/badVersion/badIndex/badPng/nonfinite/nonSolid/compact/customCircle/customHeightの10ケース。既存47種のmeshと実Colliderを比較。正常系は保存→破棄→再instantiateして色・material・mesh・poseを検査。
- 実ゲーム洞窟の既存生成経路、seed71421、648cells、既存松明21基、元の通常距離カメラで直線/曲線を表示。近景・高めの別角度も確認。原本シーン未保存。
- 製品坑道ジェネレータの14m検証マップ（幅2.4m/高さ2.8m、既存2灯）でも確認。これは実ゲームに既に存在するマップという主張ではない。近景カメラが壁外に出た初回画像は評価から除外し、壁内で再撮影した。
- 中立診断では近景/通常距離/反対側の光とカメラ。実洞窟のalternateは別角度であり反対光ではない。
- 固定サンプル2種はキー一致、bundle使用、walk再利用、岩再生成0、トロッコ/レールの自動混入0。

## 負荷と暫定採点

2,200tri、6,600頂点、1mesh/1material/3texture。9/225配置とも参照を共有。Editor計測はmesh978,384B、texture4,088,752B、CPU Camera.Render中央値0.6302/0.8153ms（225中225視錐台内）。短い描画提出時間であり、GPU時間・製品全体FPS・スマホ性能の保証ではない。追加拡張JSON約1.16MB。

自己採点は **見た目27/30、材質17/20、構造配置19/20、Web・正式Unity20/20、軽さ9/10 = 92/100**。

通常距離で空の鉱車・四輪・枠が判別でき、内壁厚みと接触が成立。減点は広い鋼板の汚れがまだ簡略で規則性を感じる点、暗い洞窟で細かなリベットが消える点、車体の角が均一で使用変形が少ない点、曲線配置の補助が静止・均一scaleを前提とする点。見た目の点数は独立レビューで確定する。現時点の検証で当該P1/P2は未発見。

Player/mobile/GPUは未検証。GUI、Player、AV設定変更、画像upload、pushは実施していない。

## 再現

`node tests/minecart.cjs` と `node tests/minecart-placement.cjs` は非表示Web検証とローカル画像を出力する。出力先は `MINE_CART_OUTPUT` で指定可能。

Unity用 `tests/unity/Cart125Checks.cs` は既存の専用検証ハーネス（Shared117Review/ColliderSnapshot109）、Input125と比較元Imported123-validを使う。Input125は通常exportのsmall_props.json/props.csv/asset_catalog.jsonで、curve1＋cart1配置が前提。前者に既存47種、任意拡張に新1種を含める。実ゲームの隔離コピーと生成コードは製品公開物に含めない。

公開準備時のキャッシュURL・release.json同期は独立採用後に別途行う。今回の候補では公開URLを変更していない。manifestの生成元hash2件だけ同期し、キー・保存済みbundle・地形内容は不変。
