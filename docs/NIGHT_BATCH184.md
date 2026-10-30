# 184: 採掘ズリ積載トロッコの公開準備

独立合格候補 `af8e79f612d04572229a281d5ef7d6a23a568d08`、91点（27/17/19/20/8）、当該P1/P2なし。基点main/作業branchはともに `93d772ca0d5884e20ae9e0667425a33ab7b41fc2`。通常の追加コミットで反映し、force pushしない。

製品の最終積荷高さは1.158020496m、既存BoxCollider上端は1.095m。差は0.063020496m（約6.3cm）。182の約6.7cmは旧形状1.162270665mとの差であり、最終値として使わない。183の限界表記も最終6.3cmを採用する。積荷各片の精密衝突や荷崩れは対象外。

車体・車輪・軌間・Colliderと積荷数9を維持し、2440tri。空荷と積載の共存参照は6texture・12,064,616B。積載単体8,042,071B、空荷単体4,022,545B。単品差4.02MBをカタログ常駐増とは呼ばない。全カタログ/GPU総量は未測定。9/225個で参照共有、単品225中210可視、CPU短時間投入のみで性能保証しない。

Web正式loader/export・配置保存・直線曲線接地、正式Unity74種生成/旧73保持・Prefab/Scene保存再読込を検証。旧Readerは旧ソース再compileで73種生成と新optional省略を確認したもので、旧Playerバイナリ実行ではない。細粒の貼模様感・暗所での読みづらさ・atlas複製費用は残る。詳細はNIGHT_BATCH182/183と各証跡。

Unity利用時は同梱の `MineCartV1.cs` と `SmallPropsV1.cs` を更新し、新しいWeb export（JSON/CSV）を新出力先へ正式importして `minecart_loaded` Prefabを生成する。標準URP/Litを使い、新shader不要。既存空荷Prefabに自動で積荷が追加されるものではない。古いImporterは新optionalを省略するので、積載版には更新が必要。

公開用script URLを内容hashへ更新し、描画・手動配置専用のmineCartLoad queryを固定sample keyから除外。manifestのsource hashとrelease記録だけ同期し、固定sampleのkey/profile/bundleは変更せず再生成0を検証する。Pages配信後は正確SHA/Actions、配信hash、積載版の選択/配置/サイズ回転/保存export、空荷・レール/入力の回帰を別途記録する。ユーザーGUI/入力/フォーカス、Player、AV、画像uploadは操作しない。
