# 最終受け入れ対応表

仕様005の現時点の証跡対応。確認済みと未確認を分ける。全受け入れの完了宣言ではない。詳細な実行履歴は[validation.md](validation.md)、依存の評価は`t023-*.json`を参照する。

## 要件と成功基準

| ID | 状態 | 証跡・残り |
| --- | --- | --- |
| FR-001 | 実装・自動確認済み | authjs.tsの標準Nodemailer/Prisma Adapter/database session、標準handler export、設定28件・統合49件。 |
| FR-002 | 確認済み | 旧専用APIなし、schemaにpasswordHash/authVersionなし。標準Providerへ置換済み。 |
| FR-003 | 自動確認済み | maintenanceAdapterと現在DBの役割/リポジトリ認可を保持。全DB統合成功。 |
| FR-004 | 自動確認済み | 同一User/role/Account/所有/信頼度/練習履歴を統合試験で検証。正規化衝突rollbackは既存隔離移行証跡。稼働DB移行は別。 |
| FR-005 | 一部確認 | 未設定/一部/両方の設定、危険な自動連携なしを確認。実OAuthはT018待ち。 |
| FR-006 | 一部確認 | 設定不足・危険な本番URI・TLS downgrade条件の拒否を単体確認。実配送/TLS/不正資格情報はT013待ち。 |
| FR-007 | 未確認 | 運用手順あり。ホスティング/配送側の実制限はT013待ち。 |
| FR-008 | 確認済み | 標準Provider/handlerを使用。SMTP独自API/worker/modelなし。サービス固有maintenanceAdapterは維持。 |
| FR-009 | 一部確認 | Mailpit実受信・再構築手順後ログインをユーザー確認。外部中継なしの設定は確認するが、外部配送0の観測とホスト公開範囲は未完了。 |
| FR-010 | 一部確認 | 開発/本番・停止復旧・専用テストSMTP・CI準備を文書化。ホスト/運用側の残項目はT009/T013。 |
| FR-011 | 保留 | 固定OCI/binary一致、版/保守/license、全OS HIGH/CRITICALのDebian照合、OpenPGP非該当、クリーンimage比較済み。残存OS/toolの採用判断等はT023。 |
| SC-001 | 操作確認済み | 外部配送アカウント不要のMailpitログイン/保護画面/logoutをユーザー確認。T009全体の承認とは別。 |
| SC-002 | 一部確認 | ローカルSMTP受信成功。外部配送0を独立観測した証跡は未完了。 |
| SC-003 | 自動・手動確認済み | 実SMTP/Auth.js handlerによる新規/既存・改変/期限切れ/使用済み/logout・資産保持。統合19ファイル49件成功。 |
| SC-004 | 一部確認 | 設定不足と配送停止時の認証不成立を確認。本番相当実配送/TLS/fallback0はT013待ち。 |
| SC-005 | 一部確認 | 再構築手順後ログインのユーザー報告。独立した再作成・ツール維持確認等はT009待ち。 |
| SC-006 | 保留 | 未実施を成功扱いにしない。依存の全採用判断はT023、実配送/制限はT013、実OAuthはT018待ち。 |

## Quickstartとユーザーストーリー

| 範囲 | 対応するシナリオ | 状態・証跡 |
| --- | --- | --- |
| Quickstart 1 | 固定版・通常install/clean ci/npm ls | 旧SMTP本体の検証記録あり。新しい依存評価全体の採用判断はT023。 |
| Quickstart 2 | 再構築・Mailpit起動・アプリ起動 | 再構築手順後のユーザー成功報告。稼働DBmigrationは実施しない。 |
| Quickstart 3.1–3.4 / US1.1 / US3.1–3.3 | signin/受信/callback/保護画面/logout/無効リンク | 手動報告と実SMTPのDB統合。期限切れ/改変は自動試験。 |
| Quickstart 3.5 / US1.4 | Mailpit停止・要求失敗・再起動・新規リンク | ユーザー確認と配送失敗の統合試験。 |
| Quickstart 3.5 / US1.2 | 外部配送0・公開範囲 | localhost転送をスクリーンショットで確認。ホスト側bind/外部到達性や配送0の独立観測は未確認。 |
| Quickstart 3.6 / US1.3 | 独立した再作成で再現 | 再構築成功報告を保持。独立した再作成としての証跡は未完了。 |
| Quickstart 4 | unit/DB/type/lint/build/audit | 本体記録あり。直近は全単体479件、全DB49件、変更箇所lint、next typegen→tsc成功。開発SMTPをコマンド限定で空にした通常buildは静的生成21/21まで成功。既存audit high10とOSスキャンは区別。 |
| Quickstart 5 / US2.1–US2.3 | 本番相当SMTP/不足/失敗/TLS/乱用制限 | 設定単体・開発配送失敗は確認。実本番相当配送と制限はT013未完了。 |
| US3.4 | 旧パスワード移行・衝突停止 | 専用DBの旧移行証跡とmigrationレビュー。稼働DBへの適用は対象外。 |
| US4.1 | GitHub未設定/一部設定 | 設定/Provider単体試験。 |
| US4.2 | GitHub標準経路・自動連携防止 | 設定確認済み。実OAuthはT018未完了。 |

## 横断確認

- 標準認証route/Provider/session、旧APIとpasswordHash/authVersionの不在を確認した。
- 追跡済み追加差分と未追跡テキストをprivate key/GitHub token/AWS access keyの限定パターンで走査し検出0。完全な秘密検出保証ではない。.env系の変更は0。
- GitHubの基準commit bd8c5a26799ba90bbaf018170ad949843d2319daの[Test run 71](https://github.com/hakeiprod/hakei-web/actions/runs/39126668070)は単体/統合成功、tscがPageProps未生成で失敗した。現在の未push変更のCI結果ではない。
- workflowへ`npx next typegen`をtscより前に追加し、同じ順序でローカル成功。修正後の実CI成功は未確認で、古いrunの再実行では未push修正を検証できない。
- Debian公式サポート一覧のスナップショットでended一致0、limitedはbinutils/rust-sequoia-sq。結果は[t023-support-status.json](t023-support-status.json)。サポート終了0は脆弱性0を意味しない。

## 残るゲート

T009/T013/T018/T023を完了扱いにせず、T022も最終受け入れ保留として追跡する。対応表の作成は完了した。残る実環境の証跡と依存の採用判断を更新した後に、最終状態を再確認する。
