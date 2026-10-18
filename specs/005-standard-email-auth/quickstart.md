# Quickstart Validation: SMTPとMailpit

> 2026-10-19 改訂: ユーザー指定の `ghcr.io/skriptfabrik/devcontainer-features/mailpit:1`（Mailpit 1.31.6）を採用。Debian専用のため `node:22-bookworm` を使用し、Compose sidecarを廃止する。開発SMTPは `smtp://localhost:1025`、UIはprivate転送8025。Featureが起動と `/var/lib/mailpit` volumeを管理する。ブラウザーでのログイン・ログアウト・使用済みリンク拒否・停止復旧はユーザー確認済み。再構築手順後のログイン成功もユーザー報告済み。独立した再作成検証と依存評価の残りは未確認。証跡はvalidation.mdを参照する。


本書はSMTP実装済み構成の受け入れ検証ガイド。自動回帰と一部の手動確認はvalidation.mdに記録済み。依存評価T023、再構築/再作成、本番相当SMTP、実GitHub OAuthなどの残りをtasks.mdで追跡する。

## 1. 採用条件と依存確認

[隔離検証](smtp-compat-validation.md)済みのNodemailer10.1.6と2箇所の限定overrideを使用する。公式peer範囲外であることを記録し、force/legacy-peer-depsなしの本体npm ciとnpm lsで固定版を確認する。上流範囲や採用版が変わる場合は再評価する。

```bash
npm ci
npm ls next-auth @auth/core nodemailer
```

## 2. 前提と構築

DockerとDev Containers対応の環境を用意する。Node22、既存の専用PostgreSQL DB、AUTH_SECRET、SCORE_GIT_ROOT等のアプリ設定は従来どおり必要。外部メール配送アカウント・SMTP資格情報・Resend APIキーは開発試験に不要。

VS Codeの **Dev Containers: Rebuild Container** を実行する。node:22-bookworm上で指定Mailpit Featureが起動する。app内で `mailpit version --no-release-check` と `node -e 'fetch("http://localhost:8025/api/v1/messages").then(r => { if (!r.ok) process.exit(1); })'` を確認する。SMTPはlocalhost:1025、private転送UIはlocalhost:8025。Composeは使用しない。

app内でnpm ci、npx prisma generateを実行する。既存パスワード撤去migrationを適用する必要がある場合は、稼働DBでなく専用の検証環境と既存の移行手順を使う。SMTP切替による追加migrationは不要。

```bash
npm run dev
```

## 3. 実SMTP/受信確認

1. privateの転送先localhost:3000で/api/auth/signinを開く。メール入力欄があり、GitHub未設定でも操作できる。
2. person@example.invalidのようなテスト用宛先で要求する。private転送のlocalhost:8025でMailpit受信UIを開き、該当メールと標準の案内を確認する。
3. メールのリンクをブラウザーで開き、標準callbackでログインし、保護画面へ進む。コンテナ内部名でなくブラウザーから到達できるURLであることを確認する。
4. 標準ログアウト後は保護操作を拒否し、消費済みリンクで新しい認証が作られないことを確認する。期限切れ/改変も拒否される。
5. Mailpitだけを停止し、要求が成功/認証成立と扱われないことを確認する。再起動後に再要求して復旧できる。外部中継の設定と外部メール配送がないことを確認する。
6. Dev Containerをもう一度再作成し、同じ手順を再現する。メールの永続保存は要求しない。

## 4. 自動回帰

専用の末尾_test DBと専用SCORE_GIT_ROOTを設定する。標準handlerを通す試験はSMTPへ更新済みであり、Mailpitの受信からリンクを得る。Mailpitの版に対応する公開APIを使用し、独自SMTPサーバーやテスト用認証Providerを作らない。

```bash
npm test -- --run --maxWorkers=2
npm run test:integration
npx tsc --noEmit
npm run lint -- src/server/authentication/authjs.ts src/server/authentication/authjs.test.ts src/server/authentication/email.integration.test.ts
EMAIL_SERVER= EMAIL_FROM= npm run build
npm audit --json
```

Dev Containerの平文localhost SMTPは本番設定検証で拒否されるため、上記buildだけはメール入口を無効にして実行する。秘密ファイルや本番のTLS要件は変更しない。本番相当SMTPでの確認は次節で別に行う。

依存/環境/期待値を合わせて結果を記録する。既存のs-core・Git回復・認可・練習/履歴の回帰も実行する。Dev Container再構築は通常のアプリbuildだけでは確認できないため、別結果を残す。

## 5. 本番相当の分離検証

開発Mailpitと分離した環境で、許可された検証先SMTPのEMAIL_SERVER/EMAIL_FROMだけを設定して起動する。認証付きsmtps（通常465）、またはSTARTTLSのrequireTLS=true・証明書検証・許可宛先への到着・リンクログインを確認する。欠落設定/不正資格情報/TLS失敗で開発先へfallbackしないことを確認する。実資格情報や接続URI/tokenを記録しない。

実配送・実GitHub OAuth・運用の送信制限は、それぞれ実施した範囲だけを記録する。用意できない項目は未実施のままにする。

## 記録

validation.mdは旧Resend方式の履歴とSMTP方式の検証結果を区別して保持している。SMTP改訂の新しい節へ、採用版と根拠、Docker/OS/platform、再構築、受信/ブラウザー結果、回帰・audit、未実施項目を区別して追加する。[contracts/smtp-auth.md](contracts/smtp-auth.md)とSC-001〜006へ証跡を対応付ける。現在のplan作成をSMTP実装/受け入れの成功とは扱わない。

本体auditは既存high10の評価と差分を照合する。Mailpit Featureのlock/digest、取得バイナリとDebianベースのplatform・脆弱性評価結果を別に記録する。Dockerホスト・実ブラウザー・本番SMTPが用意できない場合、該当確認は未完了であり、隔離試験で代用しない。
