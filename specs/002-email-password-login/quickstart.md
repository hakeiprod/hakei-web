# Quickstart Validation: メール＋パスワード認証

実装・検証ガイド。現在は依存導入ゲートを確認中で、認証機能・migrationはまだない。実装後に専用環境で実行する。
契約は[authentication.md](contracts/authentication.md)、競合と保持は[data-model.md](data-model.md)を参照。

## Prerequisites

Node22（LinuxとAlpine/musl）、専用PostgreSQLの`_test` DB、Git保存領域、ローカルSMTP捕捉先を用意する。メールと自動検証にGitHub OAuth appの実資格情報は不要。GitHub実接続確認時だけ検証用OAuth appを用意する。
AUTH_SECRET/DATABASE_URL/SCORE_GIT_ROOTに加え、固定AUTH_PUBLIC_ORIGIN、SMTP_HOST/PORT/USER/PASSWORD/FROM、AUTH_RATE_SECRETを設定する。
秘密値は記録・commit・ログへ出さない。本番はTLSを必須にし、平文SMTPはlocalhostの検証環境だけに限定する。
EMAIL_PASSWORD_ENABLEDで方式追加を有効にする。proxyの接続元設定がない環境では共有unknown bucketの制限が適用される。

```bash
npm ci
npx prisma generate
# 必ず専用DBを指定し、002の生成済みmigrationができてから適用する
npx prisma migrate deploy
npm test -- --run
npm run test:integration
npx tsc --noEmit
npm run lint
npm run build
npm run dev
```

追加依存導入時はaudit、npm ci、実argon2 hash/verify、SMTP公開transportの結合試験を実施する。
一時peerチェックは済んでいるが、ネイティブ実行やメール配送が済んだという意味ではない。
本番送信を自動試験に使わず、token入りメールはテスト用transportのメモリー/閉じた捕捉先でのみ確認する。

## Validation Matrix

| 確認             | 操作                                                                    | Expected / SC                                                 |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| 新規登録         | register→確認案内→最終password確定→login→logout→login                   | 確認前拒否、同一Userで利用。SC-001/002                        |
| 事前登録         | 第三者が他人のメールと既知passwordを申請、所有者が別passwordで確定      | 第三者passwordでlogin不可。SC-008                             |
| 単回案内         | 期限ちょうど/期限超過、改変、別purpose、再発行旧token、2接続同時確定    | 最新で有効な案内だけ1回。SC-003                               |
| パスワード再設定 | 2端末でlogin→RESET→旧password/両cookieを再利用                          | 全端末の保護操作拒否、新passwordで再login。SC-004             |
| パスワード変更   | current password不一致/一致、hash照合とreset同時実行                    | 旧照合の昇格なし、確定と全失効が原子的。SC-004                |
| GitHub追加       | 既存Accountで再認証→メール確認→同じsidでpassword確定                    | User/role/所有/履歴一致。両方式再login。SC-005                |
| 不正追加         | 普通のsession update、偽nonce、他sid/他Account、15min超過、変更後メール | 確定拒否、連携/昇格なし。SC-008                               |
| OAuthと失効      | 失効cookieでOAuth callback、email-only利用者でGithub追加を試す          | decode/adapter guardで不正連携なし。SC-005/008                |
| 存在秘匿         | 未登録/未確認/確認済み/Github-onlyへ同じ要求、SMTP障害                  | 文言/遷移/公開codeが一致。SC-006                              |
| 制限             | loginの5/20回、sendの3/10回と各+1、別poolの同時実行、期間終了           | 超過受理0、終了後再試行可。SC-007                             |
| SMTP             | captured送信、rejected、timeout、通知だけ送信失敗                       | token平文永続化なし、変更は二重実行しない。SC-008             |
| メンテナンス     | gate中に標準signIn/out、登録、token消費、通知worker                     | 新規書き込み確定なし。SC-008                                  |
| 本人表示         | resetした別端末、logout/focus/背景/BFcache/通信不能                     | 前景15秒以内/次操作で失効、背景復帰は検証前に隠す。SC-004/008 |

createUser後・linkAccount前に障害を入れ、同じGitHub Accountの再試行が同一Userを回復し、別Accountは回復できないことも確認する。

SDK統合試験はcallbackのmockだけで終えず、固定版Auth.jsのCredentials/OAuth/session/signout handlerとcookie jarを通す。
役割とownershipは001の認可・演奏保存・信頼度・Git回復の全回帰も確認する。001/T079の実機試用とは別に扱う。

## Deployment / Restore

1. バックアップを取得し、メール正規化の衝突レポートを作る。自動統合・既存User IDの再作成をしない。
2. additive migration、argon2動作、メール捕捉、標準SDK経路・旧Session拒否を専用環境で確認する。
3. すべてのレプリカをmaintenance下で同時切替し、旧DB Sessionを失効させる。再ログインの案内を出す。
4. 配送環境・trusted origin/proxy・rate設定・ログ非露出を確認して開放する。
5. 不具合時はメール方式を無効化する。旧session/失効sidやpasswordをロールバックで復活させない。
6. DB復元後はAUTH_SECRETを更新し、旧sid/Sessionを失効させてから、同じUserとして再ログインさせる。

検証記録は日時、コード版、SDK/依存版、環境、適用制限、実測hash時間/RSS、成功/失敗と秘密なし証跡を残す。
実配信先が未設定ならSMTPの実配送確認は未実施とし、メールの本番導入ゲートを残す。GitHub資格情報が未設定ならGitHubの実接続確認だけを条件付き未実施とし、メール受け入れと切り分ける。自動試験を実OAuth・実配送確認として記録しない。

## GitHubなしでの検証

GitHubの環境変数は未設定または空にする。テスト用SMTPとメール方式の設定で起動し、register/confirm/login/logout/reset/changeを確認する。GitHubボタン・provider一覧にGitHubがなく、直接signin/callback/再認証/ADDの要求は拒否されることを確認する。DBと外部要求を捕捉し、副作用が0件であることを確認する。

自動試験では未設定、IDのみ、secretのみ、空文字、空白のみ、両方非空の行列を設定解決処理へ注入する。標準Auth.jsの設定済み経路は制御されたOAuth fixtureで検証し、実資格情報をCIへ要求しない。

## GitHub有効化・除去・復旧の確認

1. 検証用GitHubアプリを登録して必要な資格情報をサーバーへ設定し、再起動する。ログイン画面・標準provider一覧が同じ利用可否を示すことを確認する。
2. 制御されたfixtureのSDK検証と別に、本人のGitHubアプリで実login/再認証を確認する。providerを有効にする運用ゲートとして結果を記録する。
3. 設定を除去して再起動し、GitHub入口・直接要求が無効でメール操作が利用できることを確認する。
4. 設定を復旧して再起動し、同じAccount/Userで再利用できることを確認する。全段階でID/role/信頼度/所有/演奏履歴の意図しない変更0を検証する。
5. GitHub-only利用者には、無効中のメール一致やRESETでpasswordが追加されないことも確認する。

| 追加確認           | 期待する結果                                         | 要件               |
| ------------------ | ---------------------------------------------------- | ------------------ |
| 未設定・一部設定   | 起動・メールの登録/回復が成功、GitHub表示・認証成功0 | FR-019/020、SC-009 |
| 設定済み           | UI/provider/利用可否一致、標準OAuth正常/失敗を扱う   | FR-019、SC-009     |
| 設定追加/除去/復旧 | User/権限/信頼度/所有/履歴不変                       | FR-020、SC-010     |
| 無効の直接要求     | 固定拒否、DB/外部OAuthの副作用0、秘密非露出          | FR-019、SC-008/009 |

## ゲートの現状

T002は改定した受け入れ基準で通過済み（[validation.md](validation.md)）。残存high10件は利用経路・入力制限と2026-11-14までの再評価条件を記録。npm ci/native動作・単体/統合/型/lint/buildを検証した。GitHub設定はメール実装の前提ではなく、SMTP実配送などの受け入れ検証は今後実施する。

## 設定検証の利用

メール設定はsrc/server/authentication/config.tsで必要な操作時に検証する。EMAIL_PASSWORD_ENABLEDはtrue/false（既定false）。AUTH_PUBLIC_ORIGINはpath/query/fragment/資格情報のないHTTPS origin、開発localhostのみHTTP。SMTP_HOST/PORT/FROMとAUTH_RATE_SECRET（32文字以上）が必要で、SMTP_USER/PASSWORDは両方または両方なし。TLSを要求する。AUTH_LOGIN_MAILBOX_LIMIT/LOGIN_SOURCE_LIMIT/SEND_MAILBOX_LIMIT/SEND_SOURCE_LIMITの初期値は5/20/3/10。AUTH_TRUSTED_PROXYの既定はfalse。trueは接続元headerを必ず上書きし直アクセスを遮断する管理済みproxy環境だけで用い、接続元処理の実装時に検証する。GitHubの実資格情報は設定テストに不要。

接続元制限はAUTH_TRUSTED_PROXY=falseを既定とする。trueにする場合、管理済みproxyがx-auth-client-ipを必ず上書きし、アプリへの直接アクセスを遮断する。X-Forwarded-Forだけでは本人の接続元として採用しない。

## 再設定・変更と通知worker

- `/auth/reset`で確認済みメールの再設定を要求する。メールのfragmentリンクを開き、最終パスワードをPOSTして確定する。登録済みかどうかにかかわらず同じ案内を表示する。
- ログイン中は`/account/security`で現在と新しいパスワードを入力する。再設定/変更後は本人を含む全端末で通常の再ログインが必要。
- 変更確定時に秘密なしの通知jobを保存する。SMTP送信はDB取引外。workerは期限付きclaimで並行取得を避け、失敗を指数backoffで再送する。SMTP受理後のプロセスクラッシュ等では同じ通知が重複し得る（at-least-once）。パスワード変更自体を再実行しない。
- 設定済みの検証環境で、次のコマンドを定期ジョブから起動する。1回の処理上限は20件。既存のSMTP設定とSCORE_GIT_ROOTが必要で、maintenance中は開始しない。

```bash
NODE_OPTIONS=--conditions=react-server npx tsx scripts/deliver-auth-notices.ts
```

このコマンドは実配送するため、自動回帰ではメモリーmailerを注入する。実配送の受け入れ確認はT054で別途実施する。

## GitHub利用者へのメール資格情報追加

GitHubが設定済みの環境で`/account/security`を開き、GitHubで本人確認→確認メール送信→同じブラウザーでメールのリンクを開く、の順に操作する。本人確認の開始と成功後のproofはそれぞれ15分。リンクだけを別ブラウザーへ移しても確定できない。完了後は全端末で通常loginが必要になる。

GitHub未設定では追加操作を提供しない。メールだけの既存UserへのGitHub追加はこの仕様の対象外で、メール一致で連携しない。GitHub側に取得できるメールがない場合は追加を案内しない。

自動試験のGitHub応答は制御fixtureであり、GitHubアプリ登録や実OAuthの受け入れ確認は実施していない。有効化前にT055、メール開放前にT054/T056を確認する。

運用の切替・復元・保持/workerは[docs/email-password-auth.md](../../docs/email-password-auth.md)を参照。実配送T054と実OAuth T055は未確認であり、自動試験の成功だけで開放しない。
