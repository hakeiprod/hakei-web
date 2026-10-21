# SMTP隔離互換性検証

**Date**: 2026-10-18
**Result**: 隔離した構成でPASS。アプリ本体・依存・Dev Container・秘密設定・稼働DBは変更していない。

## Mailpitの役割

開発用のSMTP受信サーバーとブラウザー受信箱。アプリが送ったメールを捕捉して本文やログインリンクを見せる。外部宛先への配送や外部サービス登録を必要としない。本番のメール配送サーバーの代わりに公開するものではない。

## 試験構成

- /tmp/hakei-smtp-compatだけに依存・小さな試験用Next.jsアプリを作成。
- Node22.16.0、Next.js16.4.0、React19.2.0、next-auth5.0.0-beta.32、core0.41.3、Prisma Adapter2.11.3、Nodemailer10.1.6。
- Mailpit v1.31.6の公式Linux amd64バイナリを使用。リリースAPIのSHA256と配布物を照合した。
- SHA256: 10fa12ccc610f653d4ed4df848c1817f9935dcf4e9a6a458a19ab0fa02093f91。
- SMTP127.0.0.1:11025、UI/API127.0.0.1:18025のみで受信。外部relay/forwardなし。バージョン確認通信も無効化。
- 新規の専用hakei_smtp_compat_testだけに既存migrationを適用。テスト用Userは終了時に削除。
- Prismaの生成済みクライアントは既存の同じ版を読み取り利用。試験から変更/生成していない。

## peer依存の扱い

Auth.jsの公式宣言は依然としてNodemailer7/8系。テスト用package.jsonだけで次の標準npm overridesを明示した。force/legacy-peer-deps、alias、パッケージソースの書換えは使っていない。

```json
{
  "dependencies": { "nodemailer": "10.1.6" },
  "overrides": {
    "next-auth": { "nodemailer": "$nodemailer" },
    "@auth/core": { "nodemailer": "$nodemailer" }
  }
}
```

これは上流の公式対応宣言の代替ではない。組み合わせを実際に検証するための隔離環境だけの例外である。アプリのpackage.json/lockfileへは反映していない。

## 結果

| 確認                           | 結果                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| 通常のnpm install              | PASS。force/legacy-peer-depsなし                                                   |
| clean npm ci                   | PASS。43 packages、8秒（試験用型依存含む、ignore-scripts）                         |
| npm ls                         | 同じNodemailer10.1.6へ解決、invalid peerなし（上記override適用下）                 |
| TypeScript strict/noEmit       | PASS                                                                               |
| 小さなNext.js production build | PASS。Next build --webpack、型検査・静的生成・標準認証routeを含む                  |
| Mailpit UI                     | HTTP200。ブラウザー描画の目視はしていない                                          |
| 実メール受信                   | 標準NextAuth handlers→標準Nodemailer Provider→実SMTP→Mailpit APIの実受信本文を確認 |
| メール確認前                   | 新規User未作成、保存tokenはリンクの生tokenと異なる                                 |
| メールリンクcallback           | 標準handlerから同じUserのDB sessionが成立                                          |
| ログアウト/再利用              | session削除・未認証、同じリンクの再利用を拒否                                      |
| 期限切れ                       | 標準の失敗遷移、認証不成立                                                         |
| 既存利用者                     | 新しいメールリンクでもUser IDとOPERATOR役割を維持                                  |
| 再現確認                       | clean install後にも上記実SMTP/認証試験を再実行してPASS                             |
| 最終npm audit                  | この隔離構成ではinfo/low/moderate/high/criticalすべて0                             |

メール配送、token/本文生成、CSRF、Cookie、Prisma Adapter、NextAuth GET/POST handlersは実物で、配送や認証のmockは使用していない。ログにメール本文・生token・リンク・Cookie・接続資格情報を出していない。最初にreact-server条件を強制した単独Node起動ではNext内部のReact Contextエラーになったため、通常のNode条件へ戻して実行し、別にNext本番ビルドも確認した。

## 再現材料と制限

隔離作業ディレクトリにpackage.json/lockfile、verify.ts、試験アプリ、Mailpitバイナリを保持。ライブラリの版と上記overrideを固定し、npm ci→tsc→Next build→Mailpit起動→verify.tsの順で再現できる。試験スクリプトは既存生成クライアントと専用DBを参照するため、別環境ではそのパスと接続先を合わせる。/tmpのため環境再作成後の永続保存は保証しない。

実アプリ全体の回帰/Turbopack build、Docker image/Compose再構築、arm64、実ブラウザー、認証付きTLS/STARTTLSの本番SMTPは今回の試験範囲外。隔離audit0をアプリ全依存のaudit0と読み替えない。既存のアプリ側依存high10の評価は従来どおり。

## 採用判断への影響

「修正版10系の実動作が未検証」という点は、上記範囲で解消した。公式peer宣言の不一致は残る。次の計画更新では、この検証済みの最小overrideを明示して採用する案を評価できる。実アプリへ適用する場合は本体のclean install・型/build・既存認可/資産回帰とDev Containerの確認が必要であり、この試験だけで本番導入完了にはしない。
