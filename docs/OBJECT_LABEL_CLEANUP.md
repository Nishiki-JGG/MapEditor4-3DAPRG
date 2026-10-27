# 壁掛け松明の一般名称への整理

ユーザー向けの名称からプロジェクト固有語を除去。未公開ブランチ内の修正であり、GitHubへのpush・公開は行っていない。

| 対象 | 変更後 |
|---|---|
| 配置UI・資産カタログのオブジェクト名 | 壁掛け松明 |
| Web VFXのグループ表示名 | 壁掛け松明 VFX |
| Unity生成グループのHierarchy表示名 | 壁掛け松明 |
| Unityの取り込みメニュー | Tools / Map Shared Props / 壁掛け松明を取り込む |
| README・利用説明・比較記録HTMLの見出しと操作説明 | 壁掛け松明の一般名称に統一 |

`props/wall_torch.js` の表示専用スクリプトURLを更新してキャッシュに反映。全129種の実行時表示名と、関連する説明・UIソースを確認し、ほかの対象オブジェクト名には同じ固有語がなかった。専用ツールチップはもともと空欄で、旧名称を残す別ツールチップはなかった。

`wall_torch` / `tdj/wall_torch` / 元Prefab GUID `076bf4c551dc4254e85f0316aba457c6` / VFX ID `vfx.environment.torch.fire` / 元のRoomTorch資産とコンポーネント型名は変更しない。生成グループの表示名は保存IDや元資産名ではない。元ゲームのファイルは編集していない。

実ブラウザで配置ボタン、資産カタログ書き出しの `name`、配置、保存再読込、CSVのIDとassetKey、GL/ブラウザエラー0を確認。証拠は `output/playwright/night-props/torch-label/ui.png` と `report.json`。表示専用変更のため固定サンプルの整合キーは変化せず、再生成もしていない。モデル・VFX・性能の変更はない。
