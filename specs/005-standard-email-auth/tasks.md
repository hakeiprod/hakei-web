# Tasks: 標準メールリンク認証と開発用SMTP

> 2026-10-19 改訂: ユーザー指定の `ghcr.io/skriptfabrik/devcontainer-features/mailpit:1`（Mailpit 1.31.6）を採用。Debian専用のため `node:22-bookworm` を使用し、Compose sidecarを廃止する。開発SMTPは `smtp://localhost:1025`、UIはprivate転送8025。Featureが起動と `/var/lib/mailpit` volumeを管理する。ブラウザーでのログイン・ログアウト・使用済みリンク拒否・停止復旧はユーザー確認済み。再構築手順後のログイン成功もユーザー報告済み。独立した再作成検証と依存評価の残りは未確認。証跡はvalidation.mdを参照する。


**Input**: `specs/005-standard-email-auth/` のspec.md、plan.md、research.md、data-model.md、contracts/smtp-auth.md、quickstart.md。

**Prerequisites**: 計画の限定例外を採用。憲章v1.3.0に従う。SMTP改訂は18/23件完了。修正後の全DB統合再検証は隔離PostgreSQL15.19で19ファイル49ケース成功。T023は依存評価待ち。T009/T013/T018/T022は受け入れ待ち。旧Resendの完了記録はvalidation.mdに保持し、隔離検証はsmtp-compat-validation.mdを参照する。

**Tests**: spec.mdのIndependent Test/Acceptance ScenariosとSC-001〜006を検証する。既存試験を更新し、独自認証・SMTPサーバー・配送workerは作らない。

**Format**: `- [ ] Tnnn [P?] [USn?] 内容と対象パス`。[P]は前提完了後に別ファイルで並行実施可能。実環境がなく未実施のタスクはチェックしない。

## Phase 1: Setup

- [ ] T023 Mailpit Feature/取得されるMailpit 1.31.6/Node22 Debianベースの公式資料、保守、ライセンス、既知の脆弱性、lock/digest、対象platformと実行環境の互換性を確認し、research.mdとvalidation.mdへ確認日・結果・残る制限を記録する。本来T005の導入前ゲート。今回は導入済みのため事後評価と明記し、導入前確認済みへ遡及しない。未評価または利用経路に未対処の脆弱性があれば採用完了とせず計画を再評価する。

- [x] T001 specs/005-standard-email-auth/validation.md にSMTP改訂の記録欄を追加し、旧Resend結果・隔離結果・本体結果を分離する。Node22、対象版、既存audit high10の評価、専用末尾_test DBと専用SCORE_GIT_ROOT、Docker/ブラウザー利用可否を秘密値なしで記録する。
- [x] T002 package.json と package-lock.json にnodemailer10.1.6を直接固定し、next-authと@auth/coreのnodemailerだけを`$nodemailer`へoverrideする。next-auth5.0.0-beta.32/core0.41.3の解決を確認し、Node22の通常install・clean npm ci・npm lsとaudit差分を specs/005-standard-email-auth/validation.md に記録する。force/legacy-peer-deps・alias・core直接依存は追加しない。利用経路に未対処の脆弱性があれば停止して計画を再評価する。

## Phase 2: Foundational — 全ストーリーの前提

- [x] T003 src/server/authentication/authjs.test.ts のResend設定試験を標準nodemailerの登録条件へ更新する。「存在/空白不足ではメール入口を有効にしない」「接続先と両方必要」をEMAIL_SERVER/EMAIL_FROMの欠落・空白・両方設定で検証し、AUTH_RESEND_KEYだけでは有効にならない期待を確認する。T004前に対象の失敗を確認する。
- [x] T004 src/server/authentication/authjs.ts を公開`next-auth/providers/nodemailer`の最小設定へ変更する。EMAIL_SERVER/EMAIL_FROMの条件登録と標準本文/リンク/セッションを使い、Prisma Adapter・maintenanceAdapter・GitHub条件・user.idを維持する。「独自のsid/authVersionやpasswordを復活させない」。追加API・モデル・migrationを作らずT003を通す。

**Checkpoint**: T001〜T004が完了してから各ストーリーへ進む。公式peer範囲外の限定例外を正式対応と表記しない。

## Phase 3: US1 — 外部登録なしでログインを開発・確認する (P1 / MVP)

**Goal**: Dev ContainerとMailpitで外部メール登録なしにログインを確認する。

**Independent Test**: 再構築→メール入力→Mailpit受信→ブラウザーリンク→保護画面→logout。Mailpit停止から再試行でも復旧し、外部配送0。

- [x] T005 [P] [US1] node:22-bookwormと指定Mailpit Feature（1.31.6）を構成する。採用ゲートはT023（未完了）を前提とし、このチェックは構成変更の実施だけを示す。Dockerfile/Compose sidecarを使わずFeature標準の起動/volumeを利用する。
- [x] T006 [P] [US1] src/server/authentication/email.integration.test.ts のResend HTTP代替を実Mailpit SMTP経由へ更新する。公開APIの受信本文からリンクを得て標準NextAuth handlersでログイン/logoutする。専用DB/メール宛先と後片付けを使い、token・Cookie・本文をログへ出さない。接続先は試験専用TEST_EMAIL_SERVER/TEST_MAILPIT_URLから与え、稼働DBへ接続しない。実行前にMailpitを起動し公開APIの準備完了を確認する。起動方法と設定名はdocs/development.mdへ記載する。.github/workflows/test.ymlにも専用Mailpitとchecksum検証・API準備待ちを設定する。受信メールは公式DELETE /api/v1/messagesへ対象IDsを明示して削除し、成功と削除後404を検証する。
- [x] T007 [US1] devcontainer.jsonで開発限定EMAIL_SERVER=smtp://localhost:1025とEMAIL_FROM、3000/8025転送を設定する。公式CLIでFeature lockを更新し、既存.env/.env.localは変更しない。
- [x] T008 [US1] docs/development.md にホストからのDev Container再構築、localhost:3000/8025、メールリンク確認、停止/再起動/再要求、ポート競合とenv優先順位の確認を記載する。外部登録不要・一時受信・private公開範囲と本番への転用禁止を説明する。
- [ ] T009 [US1] T023の評価完了後、Dev Containerを再構築/再作成する。既存ツール、private転送、ブラウザー操作、Feature管理プロセスの停止/復旧、外部配送0をvalidation.mdに記録する。T006も実施し、Docker/ブラウザーがなければ未完了で残す。

  進捗: 再構築確認手順に続くユーザー報告で、メールリンクログインまで成功。以前のログアウト/使用済みリンク拒否/停止復旧確認も記録済み。T023未完了の状態での動作確認であり、採用ゲート通過とは扱わない。スクリーンショットで3000/8025のlocalhost転送と稼働プロセスを確認。修正後のT006を含む全DB統合は隔離PostgreSQL15.19で19ファイル49ケース成功。既存ツール/ホスト側の公開範囲/外部配送0等の残りはvalidation.mdで追跡する。

## Phase 4: US2 — 本番の配送先を設定して利用する (P1)

**Goal**: 環境変数だけで認証付きTLS SMTPへ切り替え、失敗時に開発先へ配送しない。

**Independent Test**: 開発Mailpitと分離した環境で許可宛先へ実配送/リンク認証。不足設定・不正資格情報・TLS失敗で未認証、fallback0。

- [x] T010 [P] [US2] src/server/authentication/authjs.test.ts に本番の不正URI、認証なし/平文継続可能な設定、証明書検証無効化の拒否、smtpsとrequireTLS=true付きSTARTTLSの許可を追加する。設定不足時に開発先へfallbackしないことと、エラーに秘密値を含めないことを検証する。T011前に失敗を確認する。
- [x] T011 [US2] src/server/authentication/authjs.ts の設定境界で「不正URIや本番の平文継続可能な設定を境界で拒否」「証明書検証の無効化は禁止」を実装しT010を通す。本番は認証付きsmtpsまたはrequireTLS=true付きSTARTTLSを公開設定で指定する。開発Mailpitの平文SMTPは許容し、独自transport/送信関数・汎用設定基盤を作らない。
- [x] T012 [US2] docs/email-auth.md にEMAIL_SERVER/EMAIL_FROM、本番のsmtps/STARTTLS設定、秘密管理、設定不足・認証/TLS失敗、開発先fallbackなし、運用側の送信制限を記載する。Resendの登録/APIキー前提を外し、既存秘密ファイルは書き換えない。
- [ ] T013 [US2] 分離した本番相当SMTPで許可宛先の実到着/リンクログインと認証/TLSを確認し、不正資格情報・TLS失敗で認証不成立とfallback0を検証する。ホスティング/配送側の乱用制限も確認し specs/005-standard-email-auth/validation.md に記録する。配送先/資格情報がなければこのタスクは未完了とし、送信成功だけで実到着と扱わない。

## Phase 5: US3 — 既存利用者と資産を保持する (P1)

**Goal**: 配送変更後も標準認証の保護と同じ利用者/資産を維持する。

**Independent Test**: 新規Userはリンク確認後だけ作成、無効/期限切れ/使用済みは未認証、logout後は保護操作拒否。既存ID/role/Account/所有/信頼度/実練習履歴を前後比較する。

- [x] T014 [US3] T006の src/server/authentication/email.integration.test.ts を拡張し、確認前User未作成・保存tokenの非平文・有効リンク・改変/期限切れ/再利用拒否・logoutと保護操作拒否を標準handler/実SMTPで検証する。同じUser ID/role/GitHub Account/楽譜所有/信頼度/実練習履歴の保持も比較し、必要な最小fixtureだけを更新する。
- [x] T015 [P] [US3] prisma/migrations/20261018123000_standard_email_auth/migration.sql と docs/email-auth.md の既存移行をレビューし、User/資産保持・旧認証削除・再ログイン・メール正規化衝突時停止を確認する。必要時は専用_test DBで衝突rollbackと正常移行を再検証し specs/005-standard-email-auth/validation.md に記録する。SMTPの追加migrationや稼働DBへの適用は行わない。
- [x] T016 [US3] src/server/authentication/email.integration.test.ts と既存 src/server/ 配下の認可・Gitバックアップ/回復・練習履歴統合試験を専用DB/Git領域で実行し、maintenanceAdapterと現在のサーバー認可を含む結果を specs/005-standard-email-auth/validation.md に記録する。不具合があれば関連箇所だけを修正して再検証する。

## Phase 6: US4 — 設定済みGitHubを利用する (P2)

**Goal**: GitHubは両方の設定が揃う場合だけ表示し、メール認証と独立して利用する。

**Independent Test**: GitHub未設定/一部設定/両方設定で標準入口を比較。危険なメール一致自動連携を有効にしない。

- [x] T017 [P] [US4] src/server/authentication/authjs.test.ts と src/server/authentication/providers.test.ts の既存試験を再利用/更新し、GitHub未設定/一部/両方とSMTP設定の組合せ、標準Provider・標準画面・危険なメール一致自動連携なしを確認する。既存実装が満たす場合は不要な本体変更をしない。
- [ ] T018 [P] [US4] docs/email-auth.md の任意GitHub設定/標準ログイン手順を確認し、登録済み検証アプリがある場合だけ実OAuthとログイン/logoutを確認する。別人のアカウントをメール一致だけで自動連携しないことを確認し specs/005-standard-email-auth/validation.md に記録する。未登録なら実OAuth部分は未完了で残す。

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T019 README.md の導線を docs/development.md / docs/email-auth.md のSMTP・Mailpit手順へ合わせ、Resend前提の残存箇所と仕様005内の「旧tasks再生成待ち」表記を確認・更新する。旧validation履歴と smtp-compat-validation.md の検証範囲は保持する。
- [x] T020 package.json の既存コマンドで全unit（npm test -- --run --maxWorkers=2）、専用DBintegration、型、変更箇所lint、通常npm run buildを実行し specs/005-standard-email-auth/validation.md に記録する。s-core等の回帰を省かず、隔離webpack buildを代用しない。
- [x] T021 package.json / package-lock.json の最終npm ci・npm ls・npm auditを確認し、固定版・2箇所override・既存high10との差分/利用経路/影響を specs/005-standard-email-auth/validation.md に記録する。公式peer範囲外、更新時再検証、上流対応後のoverride撤去条件を docs/email-auth.md に残す。
- [ ] T022 specs/005-standard-email-auth/quickstart.md の全シナリオとFR-001〜011/SC-001〜006を specs/005-standard-email-auth/validation.md の証跡へ対応付け、未実施/失敗と完了を区別する。T009/T013/T018が未完了なら該当受け入れを完了扱いにせず、独自認証/API/DBモデルの再導入と秘密の差分混入がないことも最終確認する。

**T022進捗**: acceptance-status.mdへ全FR/SC・quickstart・USシナリオの証跡/未実施を対応付け、旧認証の不在と限定秘密パターンを確認。実CIの基準commit型生成不足を修正し、next typegen→tscはローカル成功。残る受け入れゲートがあるため最終状態は保留。

**T023進捗**: 固定OCI/実バイナリ照合、保守/ライセンス/実行環境確認、OpenPGP警告の切り分け、OS検出のDebian照合、クリーン上流imageのdigestとvuln/license比較を実施。CIのMailpit起動不足と統合試験の削除APIを修正。OS/開発ツールの残存問題・再構築後の評価等が必要なため未完了。証跡はvalidation.mdのT023各節とt023-*.jsonを参照。

## Dependencies & Execution Order

```text
T001 → T002 → T003 → T004 (共通前提)
                        ├─ US1: (T023 → T005) + T006 → T007 → T008 → T009
                        ├─ US2: T010 → T011 → T012 → T013
                        ├─ US3: T015 / (T006 → T014) → T016
                        └─ US4: T017 + T018
各ストーリー → T019 → T020 → T021 → T022
```

- T023は追加した導入前評価ゲート。T005は既に実施済みだが、評価の完了を意味しない。T023を次に実施し、採用判断を再評価してからT009へ進む。
- US1はMVP。US2は共通前提後に独立して設定を検証可能。US3は実SMTP試験のT006を再利用するためその完了を待つ。US4は共通前提後に独立して検証可能。
- 同一ファイルの編集は直列化する。T010/T011とUS4のT017はauthjs関連で競合するためT011完了後、T014はT006後に進める。T018の文書編集はT012後に行う。
- [P]も明示した前提を省略しない。共通のvalidation.mdへの結果追記は統合時に直列化する。
- T009/T013/T018の実環境待ちは依存しない実装/自動回帰を止めないが、該当タスクを完了にはしない。最終の全受け入れ完了にはその証跡が必要。

## Parallel Examples

- US1: 共通前提後、T005（Mailpit Feature、T023評価後）とT006（SMTP統合試験）を並行作成し、T007で接続後に検証する。
- US2: T010〜T011の本体設定と、US1のT008（開発文書）は別ファイルなので並行可能。ストーリー内の設定/試験は同じファイルのため直列。
- US3: T006後のT014（認証/資産試験）とT015（既存migrationレビュー）は別ファイルで並行可能。
- US4: T011/T012の編集完了後、T017（設定試験）とT018（手順/外部OAuth確認）は別ファイルで並行可能。記録は最後に統合する。

## Implementation Strategy

1. SetupとFoundationalを完了し、依存採用と最小Provider切替を確認する。
2. US1で開発用MVPを作り、Mailpit実受信とブラウザーの一連操作を確認する。
3. US2の本番設定、US3の標準認証/資産保持、US4の任意GitHubを追加確認する。共通機能は既存ライブラリへ任せる。
4. 全回帰・依存/脆弱性・quickstartを照合する。実環境不足は未完了として具体的に残す。

## Coverage & Counts

| 範囲               | タスク     | 件数 | 主な要件                     |
| ------------------ | ---------- | ---- | ---------------------------- |
| Setup/Foundational | T001〜T004・T023 | 5    | FR-001/002/003/008/011       |
| US1                | T005〜T009 | 5    | FR-009/010、SC-001/002/005   |
| US2                | T010〜T013 | 4    | FR-006/007/010、SC-004/006   |
| US3                | T014〜T016 | 3    | FR-003/004、SC-003           |
| US4                | T017〜T018 | 2    | FR-005                       |
| Cross-Cutting      | T019〜T022 | 4    | FR-008/011、SC-006と全体回帰 |

合計23件。完了18件、未完了はT009/T013/T018/T022/T023の5件。MVP範囲はT001〜T009とT023。SMTP切替で新しいDB entityはなく、標準モデルの制約はT004/T014、配送設定はT003〜T005/T010〜T011、受信メール寿命はT005/T008〜T009へ対応する。
