# MapEditor4-3DAPRG

3D アクション RPG 用のマップエディターです。ブラウザで地形・地面・小物・橋・階段・隠し通路・ゲーム用マーカーを作り、Unity にそのまま取り込める形で書き出します。
自分専用につくっていて、他の人が使うことは想定しておりません。

![サンプル2（遺跡・隠し通路）](docs/images/sample2_overview.png)

## 使い方

1. `index.html` をブラウザ（Chrome 推奨）で開きます。インストールもサーバーも要りません。
2. 左のパネルでツールを選び、地図の上でクリック・ドラッグして編集します。`Tab` で「歩くモード」に切り替わり、キャラクターを WASD で動かせます。
3. 「保存 (JSON)」でエディター用のデータを保存し、「読み込み」で戻せます。
4. 「Unity用書き出し (zip)」で Unity 向けのデータ一式を書き出します。書き出しの前に検証が走ります。

取り消し・やり直し：`Ctrl+Z` / `Ctrl+Y`（または画面左上の ↶ ↷）。

森林・草原の地面、針葉樹と共有自然物を改善しました。画像の由来、軽さの予算、Unityでの取り込み、検証範囲は [地面と自然物の更新](docs/SOIL_POLISH.md) を参照してください。

## 主な機能

- **地形**：台地・上げる・下げる・平らに・なだらか。部屋の大きさは 24 / 32 / 48 / 64 / 96 / 128m から選べます。
- **地面**：土・石畳・砂地・荒れ地・沼地・毒沼・溶岩・雪・氷・海岸
- **岩壁**：標準・土壁・黒い岩壁・濡れた岩壁・苔むした岩壁・砂漠の岩壁・雪山の岩壁。マップ全体の既定を選べるほか、「岩壁を塗る」ツールで場所ごとに塗り分けられます。
- **構造物**：坂、階段（4 種）、橋（7 種）、滝
- **水の流れ・泡**：滝の着水点から出口への流れ、滝の無い川の流れ、泡の帯を自動で計算します。「水」の欄で、流れの矢印と泡の帯を表示できます（`water.js`）。
- **植物の揺れ**：歩くモードで、茂み・シダ・葦・花・草むらに主人公が触れると、押しのけられて傾き、離れると揺れながら元に戻ります。見た目だけで、通行判定・書き出しには関わりません（`docs/REVISION_14_NOTES.md`）。
- **主人公の見た目**：歩くモードの主人公を、ゲーム用の体（Remy、身長 1.72m）にしました。歩く・走る動きが付いています。マップの大きさを、ゲームと同じ大きさの体で確かめられます。簡易の人形にも切り替えられます。見た目だけで、通行判定・書き出しには関わりません（`hero/`）。
- **小物**：15 バイオーム分のパーツ。撒く・置く・消す・選んで消す。植物は葉の形が見える低ポリゴン、岩は割れ面のある形、壁は石積みで作っています（`docs/REVISION_9_NOTES.md`）。1 種類ずつ `props/` の別ファイルなので、個別に直したり差し替えたりできます
- **通行判定**：自動判定の表示と、手動での上書き（通行可・通行不可・隠し通路）。体の大きさなどの体格も設定できます。
- **ゲーム用マーカー**：出入口、敵・宝箱の候補、戦闘・出現の禁止範囲、開始地点
- **階層移動**：魔法陣・上り階段・下り階段（旅の扉のゲート付き）
- **雰囲気**：霧・瘴気などの空気、天候（雨・雪・砂嵐・蛍など）、太陽光のオン・オフ
- **検証**：足場・安全範囲・到達できるか・橋の幅・隠し通路の形などを、書き出しの前に検査します。

## Unity 向け書き出し（zip）

主なファイル：

| ファイル | 内容 |
|---|---|
| `heightmap_r16.raw` / `walk_floor_r16.raw` | 地形の高さ / 歩く床の高さ（16bit。Unity Terrain が受け付ける解像度 65 / 129 / 257） |
| `weights_*.png` / `mask_*.png` | Terrain Layer の重み / 塗りの元データ（ゲーム判定用） |
| `walkable.png` | 通行判定（補間しないこと） |
| `holes.png` / `secret_passages_mesh.json` | 地形の穴 / 隠し通路の床・壁・天井 |
| `cliff_style.png` | 岩壁の種類（場所ごと） |
| `water_flow.png` / `water_mask.png` | 水の流れ・流れ関数・岸からの距離 / 泡の帯（`meta.waterSim` に説明。水が無い・海・溶岩の時は出ません） |
| `shared_props.json` / `pine_wind.json` / `shared_ground.json` | 共通小物・針葉樹の風・草と土の画像と材質設定（任意の追加出力） |
| `props.csv` / `asset_catalog.json` | 小物の配置 / 資産名と当たり判定の対応表 |
| `meta.json` | 座標の決まり、マーカー、階層移動、橋・階段、水、天候など |
| `validation.json` / `manifest.json` | 検証結果 / 各ファイルの SHA-256 と contentHash |

座標の決まり：Unity の左手系、原点は地形の角、Y が上。詳しくは書き出しの `README.txt` と `meta.json` の `coordinateSystem` を見てください。

## フォルダー構成

```
index.html, app.js      エディター本体
props/                  小物（1 種類 1 ファイル）、共通の部品 common.js、葉と樹皮のテクスチャ foliage.js、岩肌のテクスチャ detail.js。直し方は props/README.md
hero/                   主人公の体（見た目だけ）。Remy のデータ remy.js と、それを作る Blender のスクリプト。直し方は hero/README.md
water.js                水の流れ・泡の計算（画面に依存しない。node でも動く）
three.min.js            three.js r160（MIT License）
samples/                書き出しのサンプル（通常サンプル 64m / 隠し通路サンプル 48m）
docs/                   修正報告（REVISION_3〜15）と画像
tests/                  受け入れテスト（Playwright、水は Chrome の CDP）と、その結果
unity/Assets/MapWater/  Unity 側の水（書き出しから水面・滝・飛沫・波紋を作る。docs/REVISION_8_NOTES.md）
```

## テスト

`tests/` のスクリプトは Playwright（Chromium）でエディターを開いて検査します。

```
PW=<playwright のパス> node tests/rev5_terrain_grid.js
```

- `rev3_acceptance.js`：ハッシュ・資産対応表・Prefab の向き・橋・安全範囲・不正値
- `rev4_acceptance.js`：橋・階段の幅、yawOffset、壊れたデータの拒否
- `rev5_terrain_grid.js`：全サイズの Terrain 解像度、隠し通路と穴の一致
- `sample2_secret.js`：隠し通路サンプルの検証

水の試験は、Playwright なしで Chrome（または Edge）を直接動かします（`tests/cdp.js`。場所は環境変数 `BROWSER` でも指定できます）。

- `node tests/hero_view.js <出力フォルダ>`：主人公の体（大きさ・向き・透かし・切り替え・書き出しが変わらないこと）と画像
- `node tests/water_unit.js`：`water.js` の単体試験
- `node tests/water_export.js <元のエディターの写し>`：水の書き出しの中身、node との再現性、既存ファイルが変わらないこと
- `node tests/water_view.js <出力フォルダ>`：画面の水の表示を画像にする
- `node tests/water_perf.js`：128m の部屋での水の計算時間
- `node tests/export_to_folder.js <出力フォルダ>`：サンプルを書き出してフォルダへ展開する（Unity の試験の入力）

## 確認の範囲

エディター側の動作と書き出しデータは、上記のテストで確認しています。Unity 上での取り込み・描画・当たり判定・移動は、まだ確認していません。ただし水だけは、試験用の Unity プロジェクトで描画を確かめました（`docs/REVISION_8_NOTES.md`）。
