# マップエディター 修正報告（Revision 3）

対象：Astra「更新版マップエディター出力の再レビュー」（2026-10-19）の指摘 1〜5。
出力：`exporterVersion = tdj-map-editor/2026.10.19-r3`、meta / manifest の `schemaVersion = 3`、asset_catalog の `schemaVersion = 2`。

確認はすべて **エディター側**（ヘッドレス Chromium で `tests/rev3_acceptance.js` を実行し、出力を Python で別途検算）です。**Unity 上の確認は未実施**です。結果の数値は `tests/REVISION_3_EVIDENCE.json` にあります。

---

## 1. 資産対応表の往復

**修正**
- `normalizeCatalog()` を 1 か所にまとめた。正規形は `{types, floorLinks}`。旧形式（平らな `{typeId: …}`）も読める。読み込み・保存（map.json）・取り消し・`applyCatalog()`・`catalogExport()`・`linkAssetKey()` はすべてこの正規形を参照する。
- 倒木の衝突 `offsets = [-1.1, 0, 1.1]` を PROP の定義に移し、内部の特例を削除した。出力も同じ値になる。
- `height` を読み込んで使う。用途は「橋・階段の上の障害物か」の判定（障害物の [下端, 上端] と [床, 床 + agentProfile.height] の重なり）。地面の通行判定には使わない。頭上空間（天井）は**未検査**と明記した。
- 階層移動（魔法陣・上り/下り階段）の衝突 `solid`、`height`、`trigger`、`arrival`、`footprint` をカタログに出力する。`solid` と `height` は読み込みでも反映する。meta の `floorLinks[].colliders` にはワールド座標を出力する。

**確認結果**
- 3 種の assetKey を変更 → 読み込み → 書き出し → map.json で保存・再読み込み → 再書き出し：3 つとも保持。meta.floorLinks の assetKey も一致。
- oak の height 9.5、log の offsets [-1.2, 0, 1.2]、上り階段に追加した非対称 solid：再読み込み後も保持。
- 倒木：CSV の位置・向きとカタログの offsets から計算した衝突円が、内部の衝突円と 4 方向すべてで一致（誤差 0）。

## 2. 安全範囲と到達の検証

**定義**（`validation.json` と meta の `definitions` に記載）
- `bodyRadius`（agentProfile.radius）：体の半径。障害物と、橋・階段の端からこの距離を空ける。
- `safeRadius`（出入口の着地点）：円内のどこに体の中心を置いても立てる（足場・水深・傾斜・障害物・通行禁止）。さらに中心から段差上限以内で歩いて行ける。満たさない場合は**エラー**。
- `arrivalClearance`（agentProfile、既定 0.5m）：開始地点と、階層移動の到着点に必要な同じ条件の円。満たさない場合は**エラー**。
- `reserveRadius`（敵・宝箱の候補）：確保領域として同じ条件で調べる。満たさない場合は**警告**。
- `trigger`：円全体が通れる必要はない。到達できる位置から体が円に触れられればよい。出入口は「幅の半分 + 体の半径」の範囲で判定する。

**修正**
- 範囲検査 `areaIssue()`：0.25m 間隔で全点を調べ、円の中でつながっているかも確認する。
- 到達の探索：斜め移動は、両脇の格子点も通れて段差の条件を満たす場合だけ認める。目標点は、到達した隣の格子点から 0.1m 刻みの直線で通れる場合だけ到達とみなす（隣に届いただけでは合格にしない）。
- 階層移動：入口に触れられること、到着点から部屋へ出られることの両方を確認する。
- 不正値の検査 `valueIssues()`：読み込み時に拒否し、書き出し前の検証でもエラーにする。対象は NaN / Infinity、負の半径・幅、長さ 0 の橋・階段、マップ外の座標、不明な種類、体格の不正値。
- `validation.json` に `checks`（検査した項目）と `notChecked`（未対応の項目）を記録する。

**確認結果**
- 旧サンプルの位置の port_0002（着地点 Unity (5, 25)、safeRadius 1.5）：エラーを検出（Unity (4.25, 26.25) が通行不可）。サンプルでは出入口を 0.5m 内側へ移した（着地点 Unity (5.5, 25)）。
- 斜めにだけ開いた囲い（角の 1 マスだけ開放）の中の宝箱：「歩いて行けません」を検出。
- 到着点だけが閉じた囲いの中にある魔法陣：「到着点から部屋へ出られません」を検出。
- 現サンプル：エラー 0・警告 0。
  - 新しい検査に合わせて、マーカー 4 個（敵 2・宝箱 1・出入口 1）を 0.5〜1.0m 動かし、上り階段の向きを約 29° 変えた。
  - ID・個数は変わっていない。
  - 開始地点から到達できる点は 6,567（斜めの角抜けをなくしたため減少）。
- 不正値 6 種（NaN、Infinity、負の半径、長さ 0 の橋、マップ外、不明な種類）：すべて読み込み時に拒否。

## 3. 橋・階段の共通の通行検査

**修正**
- 「足場がある」（`deckAt(x, z, margin)`）と「その体格で通れる」（`bodyClear(x, z, deckY)`）を分けた。無条件の true は廃止。
- 端の余白は固定値 0.15 / 0.05m をやめ、agentProfile.radius を使う。
- 優先順位：強制通行禁止 > 橋・階段の床（体格・床上の障害物）> 強制通行可・隠し通路 > 地面の自動判定。
- 障害物検索の固定 3m をやめ、「体の半径 + 最大の衝突半径」にした。
- 地図上の表示・walkable.png・歩くモード・検証で同じ `walkable()` を使う。

**確認結果**（幅 2.4m の橋）
- 半径 0.3 は通れる。半径 1.3 は通れない。
- 床上の障害物があると通れない。
- 床の下（堀の底）に立つ同じ障害物：カタログの高さが 1m なら通れる。5m なら床を突き抜けるので通れない。
- 橋上の通行禁止指定は有効。
- サンプルの 2 本の橋は今までどおり渡れる。

## 4. Prefab の軸と基準点

- `asset_catalog.json` の `frame` に明記した。
  - Prefab のローカル +Z = プレイヤーが入っていく向き、-Z = 近づいてくる側、+X = 右。
  - 基準点：小物は底面中央の接地点、階層移動はマーカー位置の床面。
  - 回転 = `yawDeg + yawOffsetDeg`。書き出しは yawOffsetDeg を足さない。
  - エディター内部のローカル座標とは z の符号だけが違う（ワールド変換の Z 反転と同じなので、形は鏡像にならない）。
- `meta.floorLinks[].forward` は従来どおり（= ローカル -Z を yaw で回したもの）。全体に 180° を足すような変更はしていない。
- 確認：上り階段を 0° / 90° / 180° / 270° に置いた。カタログのローカル形状（右奥に非対称の衝突円を追加したもの）を Unity の yaw で回した値と、出力の trigger・arrival・colliders・forward が一致した（誤差 0）。非対称の衝突円は、入っていく向きの右 1.5m・奥 2.0m に来る。

## 5. 変更検出のハッシュ

- `manifest.json` を新設した。中身は exporterVersion、roomId、revision、exportedAt、各ファイルのバイト数と SHA-256、contentHash。
- `contentHash` = exporterVersion の 1 行と「ファイル名 SHA-256」の行（files の順）を UTF-8 にした SHA-256。manifest.json 自身は含まない。
- exportedAt・revision・contentHash は manifest.json にだけ書く。meta.json と README からは外した（schemaVersion 3）。書き出した map.json からは revision を外した。
- revision は、contentHash が前回の書き出しと変わったときだけ 1 増える。
- エディターの保存形式：高さを Float32（`heightsF32`）、位置を完全精度にした。保存 → 再読み込み → 再書き出しで同じファイルになる。旧形式の `heightsCm` も読める。
- 確認結果：
  - 編集せずに 2 回書き出す：全ファイルの SHA-256・contentHash・revision が同一。
  - 保存 → 再読み込み → 書き出し：同一。roomId と全 instanceId も保持。
  - 0.2cm の地形編集：RAW が変わって contentHash が変化（保存形式も Float32 にしたので map.json も変わる）。
  - カタログの変更：contentHash が変化。
  - SHA-256 の実装：既知のテストベクトルと Node の crypto で一致。サンプル ZIP は Python の hashlib で全ファイルと contentHash を検算済み。

## 互換性・注意

- meta.json から `revision` / `exportedAt` / `contentHash` を外し、manifest.json へ移した（schemaVersion 2 → 3）。
- 既存の保存データ（map.json）はそのまま読める。ID の振り直しはしない。
- 部屋の広さ・個数に新しい制約は追加していない。

## 未対応の検査（validation.json の notChecked と同じ）

- 頭上空間・天井の高さ（障害物の高さは橋・階段の上でだけ使う）
- 床が重なる場所（橋の下の道など）は上の床だけを判定
- 隠し通路の天井・穴
- Unity の Collider・CharacterController・NavMesh での実際の移動
- 大型の敵など別の体格（agentProfile を変えて再検証が必要）
- 水流・滝による移動

## Unity 側で確認すること（予定どおり）

既存 Prefab との対応、開始・着地、橋・階段の移動、階層遷移を 1 部屋で確認してください。エディター側では、上記の数値の一致までを確認済みです。
