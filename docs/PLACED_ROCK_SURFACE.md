# 置物の岩の石肌改善（2026-10-23）

「岩」の既存3塊・120三角形を流用し、黒い面ごとの塗り分けを位置に沿う灰褐色へ変更した。緩い面の法線を平均して三角形の陰影を弱め、大きな稜線は残す。512²の鉱物粒・細い層理・途切れる亀裂を重ね、上面には少量の地衣、接地部には控えめな暗さを付けた。

- 位置・面・UV・ピボット・共有ID・配置寸法は不変。
- 法線・頂点色・PNGを共有データとして保存し、Webと共有モデル書き出しで同じデータを使う。モデル版は5。Unity再描画は未実施。
- 配布データ: `props/shared/rock-surface.js`。起動時に画像生成を行わない。
- 原稿: `tools/nature/rock-surface-recipe.js`。再生成は `node tools/nature/bake-rock-surface.cjs`。
- 見た目変更後は `node tools/build-prepared-samples.cjs`、続けて `--check` で固定サンプルの署名を更新・検査する。新材質を生成元一覧に含めた。
- `node tests/rock-surface-browser.cjs`：固定サンプル初回読込、形状・UV保全、法線、保存、共有メッシュ/画像書出しを確認。
- 既存の岩もページ再読込で更新される。再配置は不要。

旧表面調整の記録は [ROCK_SURFACE_REFRESH.md](ROCK_SURFACE_REFRESH.md) に保持。
