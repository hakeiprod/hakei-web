# Quickstart Validation: メール＋パスワード認証

設計段階の検証ガイド。002の実装・migrationはまだない。実装後に専用環境で実行する。
契約は[authentication.md](contracts/authentication.md)、競合と保持は[data-model.md](data-model.md)を参照。

## Prerequisites

Node22（LinuxとAlpine/musl）、専用PostgreSQLの`_test` DB、Git保存領域、検証用GitHub OAuth appとローカルSMTP捕捉先を用意する。
既存AUTH_SECRET/AUTH_GITHUB_ID/AUTH_GITHUB_SECRET/DATABASE_URL/SCORE_GIT_ROOTに加え、固定AUTH_PUBLIC_ORIGIN、SMTP_HOST/PORT/USER/PASSWORD/FROM、AUTH_RATE_SECRETを設定する。
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
OAuth資格情報や実配信先が未設定なら、その確認だけ未実施と明示する。自動試験の結果を実配送確認と扱わない。
