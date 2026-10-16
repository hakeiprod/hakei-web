# 整合対象一覧

対象は機能001の追加変更。関連テスト・actions・ルート・運用入口も各領域に含める。全ファイルの全面書き換えではなく、次の判断で実装タスクを作る。

| 領域                 | 対象                                                                                                            | 既存の参照例                                                                                               | 判断・理由                                                                                                               | 確認                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 音楽・時間モデル     | s-core/models/practice、core/units                                                                              | core/score.ts、event.ts、units/beat.ts、sheet/track.ts                                                     | モデルの所有・操作・import/exportを整合。計算関数は内部に保持                                                            | 原本往復、timeline/matching/gameテスト                                         |
| ブラウザー録音・再生 | browser/midi-recorder、practice-clock、practice-session、audio                                                  | browser/audio/controller.ts、keyboard.ts                                                                   | 既存クラスを維持しPracticeモデル接続を整理。所有者を二重化しない                                                         | 録音・clock・session・controllerテスト                                         |
| インポート・変換     | models/import、filesの変更、server/import-\*、score-import、revision-validation                                 | files/standard-midi-file/extensions/to-core.ts、files/musicxml/extensions/to-sheet.ts、browser/importer.ts | 形式別パーサーと変換を再利用。境界スキーマ・partial・worker・制限を維持。独立検証を理由のある差異として残す              | JSON、ties、MIDI、MusicXML、convert、workerとimport統合                        |
| UI                   | practice-controls、分析・ゲーム・history・import・proposal・repository・trust画面、show-score等の変更           | components/score-player.tsx、score-viewer.tsx、show-score.tsx                                              | 関数コンポーネントを維持。practice-controlsの機器ライフサイクルと送信をhookへ分離。宣言の連結をほどき命名とpropsを明確化 | practice-controls、rhythm-game、show-score、import-preview等のテスト、画面確認 |
| サーバー・アクセス   | practice、practice-access、score-reader、authorization、app/actionsと関連ルート                                 | app/actions/index.ts、既存Prisma利用                                                                       | 薄い関数境界と依存引数を維持。共通Evaluator利用。直接DB/Git読取りに置換しない                                            | auth、reader、practice、再送・権限統合                                         |
| Git・共同編集        | git-store、git-operation、acceptance、publication、repositories、proposals、merge、recovery、archive、retention | 新領域に旧来の完全な参照例なし。GitStoreのroot所有と憲章II/III/Vを基準                                     | GitStoreクラスと関数取引を維持。prepare/adopt/publishの流れ・命名を明確化。安全な取引は分断しない                        | concurrent merge、acceptance、publication、retention、receipt、recovery        |
| 履歴・信頼度         | practice-history、trust、trust-calculation、evaluation-rule                                                     | 旧来の同等機能なし。モデル/境界分離と憲章を基準                                                            | 計算とDBを分離する現構造を維持。qualityの位置依存タプルを意味のある名前へ整理。ユーザー信頼度を音楽モデルへ移さない      | history、削除再計算、access、trust、game統合                                   |
| 運用・構成           | backup/verify/recover/benchmark等scripts、score-backup、maintenance、testing、CI・devcontainerの001変更         | 既存package scripts・CI、新運用領域は憲章基準                                                              | 運用入口とfreeze/recoveryを維持。密な宣言・分岐のみ関連箇所で整理。生成データ・依存・DB変更なし                          | operator、maintenance、backup/restore、benchmark、CI相当検証                   |

## 境界

関連していないs-coreモデル、SMuFLやSoundFont等の生成・定数データ、002の認証計画、001の未実施T079は変更しない。既存コードの型アサーション等を全域で修正する作業は含めない。明確な不具合が見つかっても本整理で判定結果を変えず、別の不具合として入力・影響を記録する。

## 追跡

実装時は上表の領域ごとに変更ファイル・維持ファイル・理由・実行した確認結果を追記する。追加の対象を発見した場合は理由と事例を同時に追記し、SCの分母から除外しない。

## 実装後の判断

練習モデルはPerformance/Conditions/Timeline/Evaluatorと公開indexに整合し、browserの既存Recorder/Clock/Sessionは維持。UIは条件/表示と機器/送信hookを分離。serverは共通評価入口と従来の認可・取引を利用。残りの判断は以下に統合した。

- [T028の判断](review-notes/T028.md)
- [T029の判断](review-notes/T029.md)
- [T030の判断](review-notes/T030.md)
- [T031の判断](review-notes/T031.md)
- [T032の判断](review-notes/T032.md)
- [T033の判断](review-notes/T033.md)
- [T034の判断](review-notes/T034.md)

各領域の比較事例と実行結果は[validation](validation.md)を参照。ソース変更の対象は上記の責務・宣言の整理に限り、規則や保存形式は変更していない。
