# Data Model: 開発用SMTPへの変更

> 2026-10-19 改訂: ユーザー指定の `ghcr.io/skriptfabrik/devcontainer-features/mailpit:1`（Mailpit 1.31.6）を採用。Debian専用のため `node:22-bookworm` を使用し、Compose sidecarを廃止する。開発SMTPは `smtp://localhost:1025`、UIはprivate転送8025。Featureが起動と `/var/lib/mailpit` volumeを管理する。ブラウザーでのログイン・ログアウト・使用済みリンク拒否・停止復旧はユーザー確認済み。再構築手順後のログイン成功もユーザー報告済み。独立した再作成検証と依存評価の残りは未確認。証跡はvalidation.mdを参照する。


**Status**: SMTP実装済み、受け入れ確認中。依存評価の残りはT023で追跡する。新しいDBモデル/列/migrationは追加しない。

## 標準認証と既存資産

User(id/email/emailVerified)、Account(provider/providerAccountId/userId)、Session(sessionToken/userId/expires)、VerificationToken(identifier/token/expires)は既存のPrisma Adapterで管理する。独自のsid/authVersionやpasswordを復活させない。

利用者ID・役割・GitHub Account・楽譜所有・信頼度・練習履歴との関係は変えない。過去のパスワード撤去migrationは別の既存移行であり、SMTP切替に必要な追加migrationではない。稼働DBへ自動適用しない。

## 配送設定

| 値                         | 開発                  | 本番                               | 検証/寿命                                              |
| -------------------------- | --------------------- | ---------------------------------- | ------------------------------------------------------ |
| EMAIL_SERVER               | smtp://localhost:1025   | 運用者が用意する認証付き暗号化SMTP | server-only。存在/空白不足ではメール入口を有効にしない |
| EMAIL_FROM                 | hakei@example.invalid | SMTPが許可する送信元               | server-only。接続先と両方必要                          |
| GitHub ID/secret           | 任意                  | 任意                               | 既存の両方設定条件を維持                               |
| AUTH_SECRET/DB/Git保存領域 | 既存設定              | 既存設定                           | 変更/転記しない                                        |

開発既定値はDev Containerにのみ置く。アプリの本番既定値や共有envファイルへ入れない。AUTH_RESEND_KEYは新構成の有効化条件に使用しないが、利用者の秘密ファイルから自動削除しない。

## Mailpit受信メール

開発のMailpitだけが所有する一時メール。宛先・本文・ログインリンクをWeb UI/APIで確認する。外部配送と永続volumeは不要。再起動で消えたら標準の要求操作で再発行する。ログインtokenをアプリ側の別テーブル/ログ/fixtureファイルへ保存しない。

## 状態遷移

要求→標準の案内/受信→有効なリンク→標準DB session→標準signOut。配送失敗、無効/期限切れ/使用済みリンクでは新しい認証を成立させない。SMTPが失敗しても開発先への代替配送や自動ログインをしない。

## 設定の検証

本番は認証付きsmtps URIを基本とし、STARTTLSはrequireTLS=trueを指定する。証明書検証の無効化は禁止。不正URIや本番の平文継続可能な設定を境界で拒否し、秘密値をエラーへ含めない。SMTP設定の欠落とGitHub設定の判定は独立する。
