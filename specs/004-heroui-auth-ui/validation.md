# Validation: 認証UIのHeroUI統一

2026-10-18 UTC。基準commit `535516b`に対する作業ツリー。文書・憲章の既存変更は保持し、認証サーバー・DBスキーマ・依存バージョンは変更していない。

## 環境と基準

Node22.16.0 Linux/musl、Next.js16.4.0、既存HeroUI/React、Vitest/jsdom。既存チェックリスト16/16 PASS（読み取りのみ）。gitignoreとESLint flat configの生成物除外を確認。Prettier用の生成物/lockfile除外を追加した。非公開アプリのためnpmignoreは不要。Dockerfile/Terraform/Helmなし。

変更前: 認証UI既存7ファイル17テストPASS。追加したUI回帰では29ケース中15失敗/14成功を確認した。失敗は主に既存表示のエラー関連付けとpolite通知属性の不足で、認証条件の変更ではない。

テストDBは新規の専用hakei_heroui_ui_testへ既存migrationを適用した。接続資格情報・token・実メール・passwordは記録しない。専用Git保存領域をSCORE_GIT_ROOTへ設定して実行する。

## 画面基準と最終対応

| 画面       | 入力/必須操作                           | 維持した処理/遷移                                                                                             | 表示                                                |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 登録       | email/password→確認メール、sent後再送   | requestRegistration/resendConfirmation、成功後password消去。/auth/reset、/api/auth/signin。GitHubは有効時のみ | AuthPanel/Input/Button/Link/AuthFeedback            |
| 確認       | VERIFY/RESET/ADDの最終password→明示確定 | 目的別既存POST、fragment除去、GET非消費、成功後秘密消去。再要求先はregister/reset/security、成功後signin      | 同上                                                |
| 再設定要求 | email→メール要求                        | requestPasswordReset、共通案内                                                                                | AuthPanel/Input/Button/AuthFeedback                 |
| 変更       | current/new password→変更               | changePassword、既存getSession、入力終了・signin、全失効の説明                                                | AuthPanel/Input/Button/Link/AuthFeedback            |
| 追加       | GitHub本人確認→メール要求→既存ADD確認   | 標準signIn、同じUser/ブラウザー条件、GitHub無効時非表示、メール欠落説明                                       | AuthPanel/Button/AuthFeedback、clientのAuthHomeLink |

新規必須入力/操作は0。登録は要求→リンクを開く→最終確定の3段階以内。既存日本語案内・href・operation・DTO・Zod・AbortController・useAuthSubmission・ConfirmationLinkを維持した。共通表示へtoken/passwordを直接渡さない。入力エラーを各Inputへ関連付け、API共通案内は別の通知で扱う。再送では空のpasswordを不正表示せず、メールのエラーだけ関連付ける。

共通枠は非操作型Card、結果は常設polite live region内のAlert。既存テーマを再利用し、独自入力部品や配色を導入しない。Server ComponentからHeroUIを直接importした際のcreateContextエラーは、戻りリンクだけをAuthHomeLinkへ分離して解決した。サーバー認可は移動していない。

## 自動検証

| 確認                             | 結果                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| 既存認証UI基準                   | 7ファイル17ケースPASS                                         |
| 全単体回帰（低並列、最初の通過） | 84ファイル538ケースPASS、54.79秒                              |
| 共通表示・入力属性の追加後       | 4ファイル32ケースPASS                                         |
| 再送メールのエラー関連付け追加後 | 3ファイル32ケースPASS                                         |
| 最終全単体回帰                   | 84ファイル540ケースPASS、57.52秒                              |
| 型検査                           | npx tsc --noEmit PASS。最終ビルドでも型検査                   |
| 変更箇所lint                     | PASS。最後の変更後もPASS                                      |
| 本番ビルド                       | 最後の入力エラー補足後もPASS（型検査・静的生成を含む）        |
| 統合回帰                         | 37ファイル76ケースPASS、60.54秒。専用DBとSCORE_GIT_ROOTを指定 |

初回の高並列単体試験とビルド/統合の同時実行ではworker起動・既存MusicXML/Git試験にタイムアウトが発生した。低並列で全単体が通過し、テストの時間制限や期待値は緩めていない。古いテストDBにはGit保存領域と一致しない残留データもあったため、新しい専用DBへ切り替えた。新DBの初回統合は75/76成功、SCORE_GIT_ROOT未指定による標準SDKのセッション作成失敗1件を確認し、専用Git領域も指定して全76ケースが通過した。

C1対応: 登録に加え、確認・再設定要求・変更・追加の各送信中にunmountし、AbortSignalと遅延応答の抑止・getSession非実行を検証した。通信失敗の内部情報非表示、polite通知、再試行、重複要求防止も同じ画面別ケースで確認した。

## 要件と証跡

| 要件   | 証跡/状態                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| FR-001 | 5画面のHeroUI対応を上表とコードレビューで確認。実画面比較は未実施                                          |
| FR-002 | ローカルエラーとInputのaria-invalid/説明の関連を実部品で確認                                               |
| FR-003 | 全5画面の遅延要求・重複防止・abort・失敗後再試行PASS                                                       |
| FR-004 | 原文/14・15・128・129コードポイント/絵文字・不正サロゲート/HTML長制限なしPASS。実貼付け/管理ツールは未実施 |
| FR-005 | VERIFY/RESET/ADDの明示POST・目的別再要求先・自動ログインなしを既存/追加試験で確認                          |
| FR-006 | fragment除去・storage非保存・成功時消去の既存試験を維持                                                    |
| FR-007 | 共通案内、API拒否/通信失敗の安全な表示と再試行を確認。既存サーバー検証は統合試験で確認                     |
| FR-008 | 成功後の入力終了・通常ログイン案内・既存getSession経路を維持。全端末失効は既存統合試験で確認               |
| FR-009 | githubAvailable/hasEmail条件と標準signInの既存試験を維持                                                   |
| FR-010 | 幅/折返しを実装。320px/1280pxの実レイアウトは未検証                                                        |
| FR-011 | 名前・必須/type/autoComplete・通知とDOM関連を検証。実Tab/フォーカス/読み上げは未検証                       |
| FR-012 | 認証サーバー・スキーマ・依存差分なし。既存href/operation/順序を比較                                        |
| SC-001 | 部品対応レビュー完了。実画面の一貫性確認は保留                                                             |
| SC-002 | 自動の画面別受け入れを検証。実配送/実OAuthの既存保留は継続                                                 |
| SC-003 | 実ブラウザー未準備のため未完了                                                                             |
| SC-004 | DOM意味テストPASS。支援技術/実フォーカスの確認は未完了                                                     |
| SC-005 | T002基準と実装/要求先の比較で必須入力・手順増加なし                                                        |

## 未実施と引き継ぎ

この実行環境には操作可能なブラウザーツール・Chromium/Firefox・支援技術/パスワード管理ツールがない。レイアウト・フォーカス・読み上げ・実自動入力をjsdomで代替したと扱わない。T019/T020/T027/T028は未完了で残し、quickstartに従いブラウザー/OS/viewportと結果を記録してから完了する。コード上の折返し指定は実表示の証明ではない。

仕様002の実SMTP配送/実OAuth/最終受け入れ、仕様001の実MIDI/初見5人試用も保留のまま。既存の残存依存リスクと2026-11-14の再評価条件は002/validation.mdから引き継ぎ、本件で解消したとしない。

## タスク完了状態

26/30完了（T001〜T018、T021〜T026、T029〜T030）。T019/T020/T027/T028は実ブラウザー/支援技術での確認待ち。実装・自動検証完了と全受け入れ完了を区別する。after_implementフックの登録ファイルは存在せず、実行対象なし。
