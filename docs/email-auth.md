# メールリンク認証

Auth.jsの標準Nodemailer Provider、Prisma Adapter、DBセッションを使う。パスワードの登録・保存・再設定・変更は行わない。登録とログインは `/api/auth/signin` に統一する。メールのリンクを開くと標準callbackで本人確認とログインが成立する。User/Account/Session/VerificationTokenは標準Adapterが管理する。

## 設定

```dotenv
AUTH_SECRET=<random-secret>
DATABASE_URL=postgresql://user:password@localhost:5432/hakei
EMAIL_SERVER=smtps://user:password@smtp.example.com:465
EMAIL_FROM=noreply@example.com
SCORE_GIT_ROOT=/var/lib/hakei/scores
# GitHubを使う場合だけ両方を設定
# AUTH_GITHUB_ID=...
# AUTH_GITHUB_SECRET=...
```

開発時はDev ContainerのMailpitを使い、外部登録や実メールボックスは不要。[開発手順](development.md#local-mailpit)を参照。本番はEMAIL_SERVER/EMAIL_FROMの両方がある場合だけ有効。SMTP資格情報はURIでエンコードし、サーバーの秘密設定へ登録する。GitHubも両方の設定がある場合だけ有効。

本番は認証付きsmtps（通常465）か、`smtp://user:password@smtp.example.com:587?requireTLS=true`によるSTARTTLSを使用する。本番ではユーザー名/パスワードを必須とし、URIの追加オプションは`requireTLS=true`のみ許可する。証明書検証無効化、TLS downgrade、localhost/Mailpitへの接続は拒否する。不足時に開発設定へfallbackしない。独自の送信関数・認証workerは不要。AUTH_RESEND_KEYは使用しない。

Nodemailer10.1.6はAuth.js5.0.0-beta.32/core0.41.3の公式peer範囲外。既知の修正前7/8系を避け、[隔離検証](../specs/005-standard-email-auth/smtp-compat-validation.md)と本体検証を根拠に、2箇所のnpm overrideへ限定した例外として採用する。force/legacy-peer-depsは使わない。版更新時は互換性とauditを再評価し、上流のpeer範囲が修正版を含んだ際にoverride撤去を検証する。

通常のNextAuth handlerと標準画面を使い、CSRF・token生成/単回検証・メール本文・Cookieを独自に作らない。メールリンクの有効期限やsessionの寿命も標準設定を使う。Git/DBバックアップのため、Adapterの書き込みは既存のmaintenance gateへ接続する。ここは本サービス固有の接続で、二重の認証処理ではない。

## パスワード版からの切替

`20261018123000_standard_email_auth`は旧認証テーブル（パスワードハッシュ・確認案内・失効記録・専用通知等）を削除する不可逆な移行。User・Account・楽譜・権限・信頼度・練習履歴は保持する。旧DB sessionと未消費verification tokenを消去し、旧JWTも標準DB sessionとして認証されない。切替後は全利用者が再ログインする。

1. 稼働環境への適用前にバックアップとメンテナンスを用意する。旧パスワードworkerを止め、旧アプリのレプリカを残さない。
2. メール正規化（trim/lowercase）の衝突を事前確認する。migrationも衝突があれば停止し、Userを自動統合しない。確認前のユーザー入力だけで別アカウントを統合しない。
3. 専用環境でmigrationと新規/既存Userのメールログインを検証する。メールリンクは既存メールの同じUserへログインする。GitHubの危険なメール一致自動連携オプションは設定しない。
4. SMTPを設定し、実配送・固定の公開URL/HTTPS・ホスティング側の信頼するHost設定・メール要求のレート制限を確認する。Auth.js標準設定だけで送信乱用対策まで完了とは扱わない。配送サービス/ホスティングの制限を設定してから本番公開する。
5. 運用者がバックアップ・設定・検証結果を確認してから既存の手順でmigrationを適用し、アプリを切り替える。この開発作業では稼働DBに適用しない。

旧パスワードの再設定リンク等は無効になる。旧URLは標準ログインへredirectする。DB復元を行う場合はメンテナンス下でAUTH_SECRETの更新とDB session/tokenの無効化を行い、過去のセッションを復活させない。

## 検証

Node22、専用の末尾_test DB、専用SCORE_GIT_ROOTで実行する。

```bash
npm ci
npx prisma generate
# DATABASE_URLは専用テストDBを指定した状態で実行
npx prisma migrate deploy
npm test -- --run --maxWorkers=2
npm run test:integration
npx tsc --noEmit
npm run lint
npm run build
```

TEST_DATABASE_URLも同じ専用DBへ設定する。メール試験には起動済みの専用Mailpitが必要。TEST_EMAIL_SERVER（SMTP URL）とTEST_MAILPIT_URL（HTTP API URL）を指定する。例は開発手順を参照。標準NextAuth handlers・Prisma Adapter・Nodemailerの実SMTPを使用し、公開Mailpit APIから受信リンクを読む。配送mockや独自Providerは使わない。新規User、既存GitHub Userの同一性・所有・信頼度・練習履歴、改変/期限切れ/再利用、標準DB sessionとログアウトを確認する。

実メール配送、実GitHub OAuth、画面操作、運用側の送信制限は別途確認する。自動fixtureの成功で代替しない。

## 参照

- [Auth.js Nodemailer](https://authjs.dev/getting-started/providers/nodemailer)
- [Auth.js Prisma Adapter](https://authjs.dev/getting-started/adapters/prisma)
- [仕様と移行計画](../specs/005-standard-email-auth/spec.md)
