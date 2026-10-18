# hakei-web

楽譜を共同で修正・管理し、MIDI楽器の演奏を記録・分析するWebアプリです。
楽譜はGitの版に固定し、練習とリズムゲームの結果は本人だけの履歴に保存します。

## 開発を始める

Node.js 22、PostgreSQL、Gitを用意してください。Dev ContainerはNode.js 22と開発用Mailpitを起動します。外部メールサービスへの登録は不要です。
[環境変数と運用手順](docs/development.md)を確認し、専用の開発DBを指定して実行します。

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

認証はAuth.js標準のメールリンク方式です。`EMAIL_SERVER`と`EMAIL_FROM`を設定し、`/api/auth/signin`から利用します。
パスワードは保存しません。[設定と旧方式からの移行](docs/email-auth.md)を確認してください。
既存環境へのmigrationは旧認証データの削除・全利用者の再ログインを伴います。適用前にバックアップと移行手順を確認してください。

GitHub OAuthのcallbackは `/api/auth/callback/github` です。
`SCORE_GIT_ROOT`にはアプリの置換で消えない絶対パスの保存領域を指定します。
通常のseedは不変の演奏判定ルールだけを作成します。信頼度の数値・運営ロールは明示的に設定してください。

## 楽譜と演奏

MusicXML 4 partwise（XML/MXL）、MIDI SMF 0/1（PPQN）、サービス用のCore/Sheet JSONに対応します。
PDF・画像の楽譜認識、SMF 2・SMPTEは対象外です。既知情報のプレビューで修正し、確認事項を承認して保存します。
未解決の演奏情報がある版は閲覧・修正でき、練習とゲームの開始・保存は拒否します。
元ファイルを永続保存しないため、元ファイルに依存する再変換には再アップロードが必要です。

練習はトラック・小節範囲・テンポ比・入力遅延補正を選んでMIDI入力を記録します。
音高と時刻ずれを分析し、本人の履歴で同じ条件の自己ベストを比較できます。
ゲームは正しい音高・和音と±60msの成功幅、±30msの最高判定を使用します。
中断した記録は完了回数・自己ベスト・正式ゲームスコアに含めません。

全ユーザー編集のマージには運営が有効化した信頼度基準が必要です。投票は使用しません。
招待限定ではリポジトリ管理者と明示的にマージ権限を付与した編集者が採用できます。

## 検証

```bash
npm test -- --run
# TEST_DATABASE_URLは末尾が_testの専用DBにし、専用Mailpitを起動する
# TEST_EMAIL_SERVER / TEST_MAILPIT_URLはdocs/development.mdを参照
npm run test:integration
npx tsc --noEmit
npm run build
```

[仕様とタスク](specs/001-score-practice-platform/tasks.md)、[検証結果](specs/001-score-practice-platform/validation.md)、
[実機・利用者確認の手順](specs/001-score-practice-platform/quickstart.md)を参照してください。

## Spec Kit

Codex用スキルは `.agents/skills/`、テンプレートと補助スクリプトは `.specify/` にあります。
`$speckit-constitution`でプロジェクトの開発原則を定義し、`$speckit-specify` → `$speckit-clarify` →
`$speckit-plan` → `$speckit-tasks` → `$speckit-analyze` → `$speckit-implement` の順に進めます。
