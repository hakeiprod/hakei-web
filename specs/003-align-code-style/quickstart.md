# Quickstart: 整合と互換性の検証

本書は実装後の検証手順。計画作成時にアプリテスト・性能測定・人の読解確認を実施したという意味ではない。

## 前提と基準

Node.js 22、既存依存、Git、テスト専用PostgreSQLと一致するpg_dump/pg_restoreクライアントを使用。`.github/workflows/test.yml`と`src/server/testing/database.ts`のテスト専用DB条件を満たす。DATABASE_URLとTEST_DATABASE_URLは同じ専用DBを指す。SCORE_GIT_ROOTはテスト専用の一時領域。運用・本番DBを使わない。

実装前に現在の作業ツリー、Node/OS/CPU/メモリ、既存検証の成功・既知失敗を記録する。HEADには追加機能が揃っていないため比較基準にしない。固定した入力と期待DTOをテストfixtureにし、基準の採点・保存結果と比較する。

## 実行

専用DBへの初期化はCIと同様にprisma generate、migrate deploy、db seedを行う。既存の環境変数の値は記録資料へ出力しない。

```sh
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm test -- --run
npm run test:integration
npx tsc --noEmit
npm run lint
npm run build
npx prettier --check specs/003-align-code-style
NODE_OPTIONS=--conditions=react-server npx tsx scripts/benchmark-score-practice.ts
git diff --check
```

benchmarkはDBの履歴を含むので専用DBで実行する。30回測定のp95/maxと環境を前後記録し、説明できない性能悪化を調べる。型・import経路変更があるためビルドも確認する。

## 確定比較事例

| 事例群           | 確認する意味                                                                                      | 関連既存テスト                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1 時間・楽譜     | 単一/途中変更テンポ、倍率、休符、タイ、範囲開始・終了、和音、丸め境界                             | practice/timeline.test.ts、import/ties.test.ts、core/score.test.ts                                         |
| 2 原本           | NOTE_ON/OFF、同音連打、同時刻sequence、未終了音、ゼロ件、値域拒否、往復同一                       | browser/midi-recorder.test.ts、新Performanceテスト                                                         |
| 3 評価           | 正解、誤音、欠落、余分、正負補正、判定閾値内外、和音、live、中断、null/分母/コンボ                | practice/matching.test.ts、game-evaluation.test.ts、practice/game-session統合                              |
| 4 機器・UI       | count-in、起動取消、許可拒否・切断、音声停止、hidden/pagehide、unmount cleanup、同一内容再送      | browser/clock/sessionテスト、components/practice-controls.test.tsx、rhythm-game.test.tsx                   |
| 5 保存・アクセス | 固定版・規則、チェックサム・ハッシュ、成功再送・競合拒否、履歴読取り・削除再計算、権限剥奪        | server/practice.integration.test.ts、practice-history.integration.test.ts、idempotency.integration.test.ts |
| 6 変換           | MusicXML/MXL/MIDI/Core/Sheet JSON、partial、不正データ、原本保持、preview期限・再検証、worker制限 | models/importのテスト、score-import/import-worker統合、import-preview.test.tsx                             |
| 7 Git・共同編集  | CAS競合、receipt、段階的失敗と回復、ref/retention、merge認可                                      | git-acceptance/publication/retention、merge-concurrency、proposal-decisions統合                            |
| 8 信頼度・運用   | 監査・規則、best recordの同点順序、freeze、backup/restoreとCLI                                    | trust.test.ts、trust.integration.test.ts、maintenance、operator-cli統合                                    |

各事例群内の具体的な入力・期待値・実行結果を実装タスクの検証記録に残す。失敗した事例を分母から除かず、全件一致をSC-002/003/005の受け入れ条件とする。新しいテストは公開された意味と互換性を確認し、内部の関数呼出し順のみを固定しない。

## 保守担当者の読解レビュー

[scope](scope.md)の8領域の判断と例外を確認する。そのうえで時間変換と演奏評価の2課題について、既存設計を知る担当者が入力・責務の所有者・公開操作・出力を説明できるか確認する。結果・未解決点を記録し、自動検証を人の確認の代わりにしない（SC-001/004）。

手動のサービス操作では楽譜表示・再生、練習開始/終了/中断、分析、ゲーム結果、履歴参照を確認する。T079の実機と初見5人の試用は独立した保留事項のまま。
