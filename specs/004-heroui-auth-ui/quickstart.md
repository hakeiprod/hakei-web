# Quickstart Validation: 認証UIのHeroUI統一

これは実装後の検証手順であり、実施済み結果ではない。[UI契約](contracts/auth-ui.md)、[状態と寿命](data-model.md)を参照する。

## 前提

- 既存Dev Container/Node22、lockfileに沿った依存とPrisma生成済み環境を使う。依存追加やDB変更は不要。
- 自動UI試験は既存fetch/next-authの制御された代替を使い、HeroUI自体は実部品で描画する。
- 統合試験は専用PostgreSQLの_test DBと専用Git保存領域を使用する。接続情報はローカル環境へ設定し、ログ/記録に秘密を出さない。
- 実ブラウザーでメール操作を進める場合だけ、既存メール認証設定と隔離したSMTP捕捉先が必要。環境変数・worker操作は[仕様002の手順](../002-email-password-login/quickstart.md)に従う。外部送信や本番DBでの試験はしない。

## 自動検証

リポジトリルートでNode22を使用する。初回のみnpm ciとnpx prisma generateを行う。

```bash
npm test -- --run src/components/email-registration.test.tsx src/components/auth-confirmation.test.tsx src/components/password-reset.test.tsx src/components/password-change.test.tsx src/components/password-addition.test.tsx src/components/auth-methods.test.tsx src/components/authentication-visibility.test.tsx
npx tsc --noEmit
npm run lint -- src/components/auth-panel.tsx src/components/auth-feedback.tsx src/components/email-registration.tsx src/components/auth-confirmation.tsx src/components/password-reset.tsx src/components/password-change.tsx src/components/password-addition.tsx src/app/account/security/page.tsx
npm test -- --run
# TEST_DATABASE_URLは専用の_test DB、SCORE_GIT_ROOTは専用の絶対パスを設定してから実行
npm run test:integration
npm run build
npm run dev
```

新規の共通表示テストを作る場合は同じ単体試験スイートで実行する。統合設定は全既存server統合試験を検出するため、専用DBを先に確認する。環境未準備の項目は未実施と記録し、PASSに含めない。

期待結果: 既存の認証挙動が一致し、UI接続に関する型/lint/回帰が通過する。既存の残存依存リスクは[002 validation](../002-email-password-login/validation.md)の評価を引き継ぎ、本件で解消したとしない。

## ブラウザー確認

1. /auth/register、/auth/resetを開く。登録・再送・無効入力・通信失敗・制限・pendingを確認する。GitHub無効時に選択肢がなく、有効時だけ既存入口があることを確認する。
2. 隔離環境で得た確認リンクでVERIFY/RESET/ADDの各状態を確認する。fragmentは入力表示前に消え、開くだけで確定しない。目的別のラベル・再要求先・成功後ログイン先を確認する。欠落/無効/消費済み/再読込でも秘密を露出しない。
3. /account/securityでpassword設定済みの変更、GitHub利用者の追加、GitHub無効、メール欠落を確認する。変更の失敗/成功・入力消去・本人表示終了を確認し、追加では標準本人確認とメール要求の順序を保つ。
4. 全画面を幅320px/1280pxで確認する。長いアドレス・説明・結果、pending、成功でも主要操作を隠さず、documentの横幅がviewportを超えない。
5. Tab/Shift+Tabで全入力・操作・リンクへ移動し、フォーカスを視認する。Enterでformを一度送信でき、再送/本人確認が誤ってformを送信しない。二重クリック・連続Enterでも要求は一つ。
6. 支援技術でラベル・条件・入力エラーの対応と結果のpolite通知を確認する。絵文字を含む境界値15/128を貼り付け、原文保持と自動入力を確認する。管理ツールでcurrent/new/emailの用途が維持されることを確認する。
7. 対象5画面の入力・主要/補助操作・リンク・結果をHeroUI対応表と照合する。登録3段階以内、その他も必須操作・入力が増えていないことを確認する。

## 記録と受け入れ

実装時にこのディレクトリへvalidation.mdを作り、コード版・日時・ブラウザー/viewport・自動検証結果・手動確認結果・未実施理由を秘密なしで記録する。画面例を残す場合はテストデータを使い、実メールアドレス/token/パスワードを含めない。

SC-001〜005とUI契約の各行に結果を対応付ける。jsdomのPASSをレイアウト・読み上げのPASSにしない。仕様002の実SMTP・実OAuth・最終受け入れ保留と仕様001の実MIDI/初見試用保留は別に残す。実OAuth資格情報がないときは自動fixtureで表示と分岐だけを確認し、実本人確認を完了扱いにしない。

## この環境での再現補足

全単体試験の既定並列度では他の検証との同時実行時にworker起動/既存fixture処理がタイムアウトしたため、`npm test -- --run --maxWorkers=2`で全スイートを検証する。テスト条件・期待値・タイムアウト設定は変更しない。ビルドは別に実行する。統合試験はTEST_DATABASE_URLだけでなく、標準Auth.js callbackが利用するSCORE_GIT_ROOTにも専用の絶対パスが必要。
