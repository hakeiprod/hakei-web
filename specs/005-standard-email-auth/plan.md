# Implementation Plan: 標準メールリンク認証と開発用SMTP

> 2026-10-19 改訂: ユーザー指定の `ghcr.io/skriptfabrik/devcontainer-features/mailpit:1`（Mailpit 1.31.6）を採用。Debian専用のため `node:22-bookworm` を使用し、Compose sidecarを廃止する。開発SMTPは `smtp://localhost:1025`、UIはprivate転送8025。Featureが起動と `/var/lib/mailpit` volumeを管理する。ブラウザーでのログイン・ログアウト・使用済みリンク拒否・停止復旧はユーザー確認済み。再構築手順後のログイン成功もユーザー報告済み。独立した再作成検証と依存評価の残りは未確認。証跡はvalidation.mdを参照する。


**Branch**: `chore/setup-spec-kit` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: 仕様005と、隔離検証済みNodemailer 10系・最小overrideを採用するユーザー指示。

**Status**: SMTP実装・自動回帰済み、受け入れ確認中。Mailpit Feature/ベース環境の評価（T023）は未完了。過去の導入前に確認済みだったとは扱わず、現在の確認日と結果を記録して採用判断を再評価する。

setup-planのBRANCH出力`005-standard-email-auth`はfeature識別子。実際のGitブランチは上記のままで、作成・切替なし。

## Summary

ResendをAuth.js標準Nodemailer Providerへ置き換えた。Nodemailer **10.1.6**を固定し、next-auth **5.0.0-beta.32**・@auth/core **0.41.3**に対する2箇所のnpm overrideだけを採用する。[隔離検証](smtp-compat-validation.md)で実SMTP・標準認証・clean install・型・小さなNextアプリのbuildが通過したことと、今回のユーザー指示が採用根拠。公式peer範囲外という事実は解消していない。

Dev Containerは`node:22-bookworm`と指定Mailpit Feature（Mailpit **1.31.6**）を使用する。本番SMTPは環境変数で指定する。標準画面・Prisma Adapter・DB session・任意のGitHub・既存認可・maintenanceAdapterを維持し、独自認証/メールAPI・永続モデル・常駐管理プログラムを追加しない。

## Technical Context

**Language/Version**: TypeScript strict、Node22、React19.2、Next.js16.4。既存基盤を維持。

**Primary Dependencies**: next-auth5.0.0-beta.32、core0.41.3、Prisma Adapter2.11.3、既存Prisma、Nodemailer10.1.6（MIT-0、Node>=20）、Mailpitv1.31.6（MIT）。coreをアプリの直接依存へ追加しない。

**Storage**: 既存User/Account/Session/VerificationTokenとPostgreSQL。SMTP切替による追加migrationなし。MailpitはFeature管理の`/var/lib/mailpit` volumeへ保存する。開発メールの永続保存自体は受け入れ要件ではない。

**Testing**: Vitest、既存認証統合、実Mailpit受信、Git/認可/練習回帰、型/lint/通常の本体build。Dev Container再構築・実ブラウザー・本番相当SMTPは別の検証結果を残す。

**Target Platform**: node:22-bookwormのDev Container、Docker/Dev Containers対応ホスト。既存ツールの維持を再構築時に確認する。

**Project Type**: Webアプリの配送方式・開発環境更新。

**Performance Goals**: 外部登録0でメール要求→受信→ログイン→保護操作→ログアウトを完了。追加の一律時間目標なし。

**Constraints**: 公開APIのみ、開発メール外部中継なし、本番fallbackなし、秘密非公開、資産保持。互換性の保証範囲は固定版での実測に限定。

**Scale/Scope**: Provider設定、依存/lock、Dev ContainerのMailpit Feature、既存試験・運用手順。未解決の設計判断なし。環境が必要な検証は未実施として追跡する。

## Constitution Check

憲章v1.3.0。以下はNodemailer限定例外と旧構成の計画時評価。Feature/ベース変更後はT023の評価が未完了のため、現在の採用ゲート全体をPASSとは扱わない。T023完了後に再評価する。

| 原則             | Phase0前         | Phase1後         | 根拠                                                         |
| ---------------- | ---------------- | ---------------- | ------------------------------------------------------------ |
| I 音楽データ     | PASS             | PASS             | 音楽モデル/保存形式を変更しない                              |
| II 責務分離      | PASS             | PASS             | server設定と.devcontainerだけに配送接続を配置                |
| III 入力/秘密    | PASS             | PASS             | 標準検証と認可を維持。秘密を文書/ログへ追加しない            |
| IV 回帰検証      | PASS             | PASS             | 本体・実SMTP・資産保持・再構築の検証を必須化                 |
| V 最小変更       | PASS             | PASS             | 標準Providerと指定Feature、追加migration/APIなし               |
| VI 信頼性/互換性 | PASS（限定例外） | PASS（限定例外） | 固定版の隔離実測、採用指示、例外範囲/撤去条件/本体検証を記録 |
| VII UI一貫性     | PASS             | PASS             | Auth.js標準画面を維持。独自UIは追加しない                    |

FR-011の「未検証の互換回避」は隔離実測により限定範囲で解消した。上流の正式サポートや本番受け入れ完了とは主張しない。依存更新時や本体検証の失敗時は採用判断を再評価し、脆弱な7/8系へ戻さない。

## Project Structure

```text
specs/005-standard-email-auth/
├── spec.md
├── plan.md
├── research.md
├── smtp-compat-validation.md  # 変更しない隔離試験の証跡
├── data-model.md
├── contracts/smtp-auth.md
├── quickstart.md
├── tasks.md                  # SMTP改訂23件（完了18、未完了5）
└── validation.md             # 旧結果を保持しSMTPの結果を別記する

.devcontainer/
├── devcontainer.json         # Debian/指定Mailpit Featureとポート転送
└── devcontainer-lock.json    # Features変更が必要なら正規手順で更新
src/server/authentication/
├── authjs.ts                 # 標準Nodemailerと設定条件
├── authjs.test.ts            # SMTP/GitHubの有効化と設定不足
└── email.integration.test.ts # 実SMTPと標準handler
package.json / package-lock.json
.github/workflows/test.yml    # 専用Mailpitを検証付きで起動しSMTP試験へ接続
README.md / docs/email-auth.md / docs/development.md
```

**Structure Decision**: appはnode:22-bookworm、workspaceは既存リポジトリ。Mailpit Featureのentrypointが起動し、Featureの標準手順で停止/再起動する。appへDocker CLI/daemonや独自監視を追加しない。既存.env/.env.local・DB・秘密設定は変更しない。

## Phase 0: Research

[research.md](research.md)に一次資料、隔離試験、代替比較、採用判断を統合した。Nodemailerは直接依存10.1.6を固定し、npm overridesのnext-auth.nodemailerと@auth/core.nodemailerへ`$nodemailer`を指定する。force/legacy-peer-deps・alias・内部ソース修正なし。lockでcoreの実版も確認する。

## Phase 1: Design

- [data-model.md](data-model.md): 既存モデルと設定の制約。追加migrationなし。
- [contracts/smtp-auth.md](contracts/smtp-auth.md): SMTP、公開範囲、標準認証、不変条件。
- [quickstart.md](quickstart.md): 実装後に実行する構築/受信/回帰/本番確認。

開発Dev ContainerのcontainerEnvにだけEMAIL_SERVER=smtp://localhost:1025、EMAIL_FROM=hakei@example.invalidを設定。SMTP1025はホスト公開せず、UI8025とapp3000をprivate転送する。外部relay/forwardやSMTP認証を受け入れる追加フラグは設定しない。Featureが`/var/lib/mailpit` volumeを管理する。Featureのlock/digest、取得されるMailpit、Debianベースの対象platform/同梱依存をT023で評価する。

本番はEMAIL_SERVER/EMAIL_FROMが両方非空の場合だけ登録する。最小構成は認証付きsmtps（通常465）。STARTTLSを選ぶ場合は標準接続URIの`requireTLS=true`を必須とし、TLS失敗時の認証不成立を検証する。証明書検証無効化・平文fallbackは禁止。接続設定の妥当性は境界で確認し、独自transport/送信関数は作らない。

## 本体適用後の受け入れ条件

1. Node22で通常npm install/clean npm ci、npm ls、lockの版とoverride対象を確認。型・lint・通常のnpm run buildと全unit/専用DBintegrationが通る。隔離webpack buildを本体buildの代用にしない。
2. 実SMTPからMailpit公開API/UIで得たリンクを標準handlerへ渡す。新規/既存・改変/期限切れ/再利用・logout・配送停止を検証し、ID/role/Account/所有/信頼度/実練習履歴、Git/認可を保持する。
3. T023の依存評価後、ホストでDev Container再構築を確認。既存ツール/Features、SMTP/UIの公開範囲、外部配送0、ブラウザー到達、停止/再起動/再要求、再作成を確認する。
4. npm auditとMailpit Feature/取得バイナリ/ベースimageの既知問題を評価。隔離audit0は本体audit0の根拠にしない。既存high10の判断は旧記録を参照し、変化/利用経路/影響を再評価する。SMTPの利用経路に未対処の既知問題を残して完了にしない。
5. 分離した本番相当環境で認証付きTLS、許可宛先の実到着/リンク、不足設定/不正資格情報/TLS失敗、fallback0と運用側乱用制限を確認する。GitHub実OAuthを含め、未実施は理由とともに残し該当受け入れを未完了にする。

## Complexity Tracking

| 例外                                                               | 必要な理由                                                      | 代替と限定/解消条件                                                                                                                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth.js公式peer範囲外のNodemailer10.1.6を2箇所のnpm overrideで使用 | 宣言内7/8系は既知の修正前。指定SMTPを公開Providerで最小実装する | Resendは外部登録不要を満たさず、旧Auth.jsも解決しない。隔離済み固定版だけに限定し、本体回帰を必須にする。上流が修正版を正式範囲へ含めたらoverride撤去を検証する。版変更時は再評価する |

既存maintenanceAdapterはGit/DBチェックポイントのサービス固有要件として維持する。例外を他の依存overrideへ拡張しない。SMTP用タスクは[tasks.md](tasks.md)へ再生成済み。旧Resendの完了状態は引き継がない。
