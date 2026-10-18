# Contract: SMTP配送とDev Container

> 2026-10-19 改訂: ユーザー指定の `ghcr.io/skriptfabrik/devcontainer-features/mailpit:1`（Mailpit 1.31.6）を採用。Debian専用のため `node:22-bookworm` を使用し、Compose sidecarを廃止する。開発SMTPは `smtp://localhost:1025`、UIはprivate転送8025。Featureが起動と `/var/lib/mailpit` volumeを管理する。ブラウザーでのログイン・ログアウト・使用済みリンク拒否・停止復旧はユーザー確認済み。再構築手順後のログイン成功もユーザー報告済み。独立した再作成検証と依存評価の残りは未確認。証跡はvalidation.mdを参照する。


**Status**: SMTP実装済み、受け入れ確認中。依存評価T023と実環境の残りは未完了。

## 認証インターフェース

- 既存/api/auth/[...nextauth]の標準GET/POST handler、標準ログイン・verify-request・callback・session・signoutを使用する。新しい配送/確認APIを公開しない。
- Provider識別子は標準nodemailer。ResendのAPIキー・HTTP配送は新構成に使わない。
- GETのメールcallbackによる所有確認/単回消費は標準動作。旧パスワード仕様のfragment/明示POST確定を導入しない。
- メール本文、token、CSRF、Cookie、DB sessionは標準処理。個人のroleは既存server認可で確認する。
- GitHubの両方設定条件と既存Prisma Adapter/maintenanceAdapter接続を維持する。

## Dev Container設計

| 接続               | アドレス/公開範囲                               | 用途                   |
| ------------------ | ----------------------------------------------- | ---------------------- |
| app→Mailpit        | localhost:1025、コンテナ内だけ                   | 認証なしの開発SMTP     |
| ブラウザー→Mailpit | VS Code非公開転送 localhost:8025 → localhost:8025 | 受信UIと開発確認用API  |
| ブラウザー→app     | 3000の非公開転送                                | ログイン画面・callback |

appはnode:22-bookworm、workspaceは既存リポジトリ。既存ツールを維持し、指定Mailpit Featureの標準entrypointと停止/再起動手順を利用する。appへDocker CLI/daemonや独自常駐起動スクリプトを追加しない。

Mailpitは指定Featureで1.31.6を導入し、Feature管理の`/var/lib/mailpit` volumeを使用する。SMTP1025をhostへpublishしない。UI転送の公開範囲をprivateとし、必要時だけ利用者が明示的に開く。外部relay/forward設定は指定しない。Featureのlock/digest、取得バイナリとDebianベースの対象platform/脆弱性はT023で確認する。すでに導入済みのため事後評価と記録し、導入前に確認済みとは扱わない。

Dev ContainerのcontainerEnvにだけEMAIL_SERVER=smtp://localhost:1025、EMAIL_FROM=hakei@example.invalidを設定する。既存の.env/.env.local・DB・秘密値は書き換えない。既存envによる優先順位も再構築時に確認する。

## 本番契約

EMAIL_SERVER/EMAIL_FROMが揃った場合にのみメールProviderを登録する。標準Nodemailerの接続文字列/公開設定で認証とTLSを使用する。最小の例はTLSが明示されたsmtps接続。TLS確立に失敗した際に平文へfallbackしない。STARTTLSを使用する場合も標準URIのrequireTLS=true設定を必須にして別途検証する。不正URIや本番で平文継続を許す設定は境界で拒否する。

開発Mailpit環境を本番へ持ち込まない。設定不足をsmtp://mailpitやlocalhostへ置き換えない。SMTP実到達と要求の乱用制限は運用環境で別途確認する。資格情報・URI・メール本文/tokenを独自ログ/エラー/クライアントへ追加しない。

## 検証対応

| 要件/成功基準              | 確認                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| FR-001/002/008、SC-003     | 標準handlerの実経路、独自認証/配送処理なし、成功/無効/期限切れ/再利用/logout                                |
| FR-003/004、SC-003         | 同じUser/role/Account/所有/信頼度/実練習履歴、Gitバックアップ/認可回帰                                      |
| FR-005                     | GitHub未設定/一部設定/両方設定、危険な自動連携なし                                                          |
| FR-006、SC-004             | SMTP設定不足/認証失敗/TLS失敗、許可宛先の実配送、開発先へのfallback0                                        |
| FR-007、SC-006             | 運用側の送信制限の設定と未実施記録                                                                          |
| FR-009/010、SC-001/002/005 | Dev Container再構築、Mailpit受信、ブラウザー到達、外部登録/実配送0、停止/再起動/再試行                      |
| FR-011、SC-006             | 宣言互換と脆弱性/保守/ライセンス/実行環境評価。固定版の限定overrideと隔離実測を記録。本体適用後の確認が必要 |

## 依存契約

Nodemailer10.1.6を直接固定し、next-auth5.0.0-beta.32とcore0.41.3のnodemailerにだけ`$nodemailer` overrideを設定する。公式peer範囲外であり、隔離実測とユーザー指示による限定例外。lockとclean installを本体で検証し、上流正式対応時の撤去・版更新時の再評価を行う。詳細は[plan.md](../plan.md)参照。
