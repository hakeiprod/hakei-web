# Research: SMTPとMailpit

> 2026-10-19 改訂: ユーザー指定の `ghcr.io/skriptfabrik/devcontainer-features/mailpit:1`（Mailpit 1.31.6）を採用。Debian専用のため `node:22-bookworm` を使用し、Compose sidecarを廃止する。開発SMTPは `smtp://localhost:1025`、UIはprivate転送8025。Featureが起動と `/var/lib/mailpit` volumeを管理する。ブラウザーでのログイン・ログアウト・使用済みリンク拒否・停止復旧はユーザー確認済み。再構築手順後のログイン成功もユーザー報告済み。独立した再作成検証と依存評価の残りは未確認。証跡はvalidation.mdを参照する。


2026-10-18。ローカルの公開Provider/型・npm公式レジストリ・公式セキュリティ情報・Mailpit公式資料を確認。アプリ本体のソース/依存/Dev Containerは変更していない。

**追補**: ユーザー指示による[SMTP隔離互換性検証](smtp-compat-validation.md)でNodemailer10.1.6の実送信/標準ログイン・clean install・型・Next build・auditが通過した。以下の初回調査と、追補の実測結果を区別する。公式peer宣言の不一致は残る。

## R1: SMTP依存の採用 — 隔離検証後の限定例外

**Decision**: Nodemailer10.1.6と、next-auth/@auth/coreのnodemailerだけに対する`$nodemailer` overrideを採用する。今回のユーザー指示と隔離実測に基づく限定例外であり、公式peer対応とは呼ばない。具体的な設定は[隔離検証](smtp-compat-validation.md)参照。直接core依存・force/legacy-peer-deps・aliasは追加しない。

**Rationale**: npmレジストリのnext-auth5.0.0-beta.32とcore0.41.3はどちらもnodemailerを`^7.0.7 || ^8.0.5`と宣言する。Nodemailerの修正対象は10系で、現行の範囲に修正版がない。Node22は候補10.1.6のNode>=20を満たすが、それだけでAuth.js互換性を保証しない。

標準ProviderはcreateTransport(server)とsendMailへ利用者の宛先を渡す。宛先解析DoSを「このアプリには無関係」として除外しない。

| 一次資料                                                                                                                                 | 対象/修正版                       | 判断                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------- |
| [next-auth metadata](https://registry.npmjs.org/next-auth/5.0.0-beta.32) / [core metadata](https://registry.npmjs.org/@auth/core/0.41.3) | peerは7/8系                       | 修正版10系と重複なし   |
| [Nodemailer metadata](https://registry.npmjs.org/nodemailer/10.1.6)                                                                      | 10.1.6、MIT-0、Node>=20           | 採用。宣言互換ではない |
| [security policy](https://github.com/nodemailer/nodemailer/blob/master/SECURITY.md)                                                      | 10系がセキュリティ対応対象        | 7/8系を推奨しない      |
| [GHSA-v53p-9fqp-m79j](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-v53p-9fqp-m79j)                                  | high、<=10.0.5、修正10.0.6        | 宛先解析経路           |
| [GHSA-4ffr-jq9g-5ffx](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-4ffr-jq9g-5ffx)                                  | high、3.0.0〜10.0.12、修正10.0.13 | SMTP応答/AUTH解析経路  |

**Alternatives considered**:

- 7/8系: 宣言は満たすが安全性ゲートを満たさない。
- next-auth4へ戻す: latest4.24.15もpeerは7系で問題を解決せず、無関係な技術移行になる。
- 10系をforce/legacy-peer-deps/alias等で導入: 宣言を回避するだけで互換性の証明にはならない。
- 上流peer更新待ち: 最小構成を維持できるが、現時点では採用版を確定できない。
- 修正版10系の隔離検証: 公開API、clean install、型/build、実Mailpit配送、標準callback、auditを調べ、上流宣言外という例外の採用判断を別に記録する。検証前に実装へ組み込まない。
- Resend継続: 現行実装として残るが、今回のユーザー指定SMTPの達成とは扱わない。

## R2: 開発サービス配置

**Decision**: 指定Mailpit FeatureでMailpit 1.31.6を導入し、appはnode:22-bookwormを使用する。Feature/取得バイナリ/ベースの評価はT023で追跡する。

**Rationale**: 公式はSMTP1025/UI8025を案内し、amd64/arm64等のDocker imageを提供する。指定Featureの標準entrypointを利用し、自作の常駐起動/監視は追加しない。現在はDev Containerのimage指定だけでDocker CLIはなく、app内にDocker環境を増やす必要はない。

2026-10-18にGitHub公式APIでlatest v1.31.6（2026-10-15公開）、MIT、非archivedを確認。公開security advisory16件のpatched_versionsを確認し、記載修正版は1.31.2以前。対象imageのOS/同梱依存スキャンと実行環境での動作は未確認であり、最終採用前の確認項目として残す。

**Alternatives considered**: app内へbinaryをCOPYする方式は小さいが、再起動・二重起動の管理が必要。可変latest tagや実行時curlの導入は再現性を弱める。ソースビルドは不要なGo/UIビルド依存を増やす。

Sources: [公式Docker](https://mailpit.axllent.org/docs/install/docker/)、[release v1.31.6](https://github.com/axllent/mailpit/releases/tag/v1.31.6)、[repo/API](https://api.github.com/repos/axllent/mailpit)、[公開advisories](https://github.com/axllent/mailpit/security)、[security API](https://api.github.com/repos/axllent/mailpit/security-advisories)。

## R3: 設定と公開範囲

**Decision**: 開発Dev ContainerだけにEMAIL_SERVER=smtp://localhost:1025とEMAIL_FROM=hakei@example.invalidを設定する。本番は実SMTPのEMAIL_SERVER/EMAIL_FROMを必須にし、開発値へfallbackしない。秘密値を既存envへ書き込まない。

**Rationale**: Mailpitの既定SMTPは認証/暗号化なしの開発用途。コンテナ内の1025をホスト公開しない。受信UIはVS Codeの非公開ポート転送でlocalhost:8025へ接続し、ブラウザーにlocalhost:8025として開く候補。appは3000を転送する。Dev Container再構築時の検証でこの転送とリンクの到達性を確認する。relay/forward設定や認証を受け入れるための余分なフラグは追加しない。

Sources: [SMTP設定](https://mailpit.axllent.org/docs/configuration/smtp/)、[Dev Container reference](https://containers.dev/implementors/json_reference/)。

## R4: 標準認証と検証

**Decision**: 配送Provider設定だけを変更し、標準画面・Prisma Adapter・DB session・GitHub条件登録・service role取得を保持する。新しい永続モデルやmigrationなし。

**Rationale**: ローカルのNodemailer公開ProviderはcreateTransport/sendMailで標準本文を送る。旧パスワード用のfragment/確認画面/専用APIを復活させる必要がない。Resend用のHTTP代替試験はSMTP配送の証拠にならないため更新する。

Sources: [Auth.js Nodemailer設定](https://authjs.dev/getting-started/providers/nodemailer)、既存src/server/authentication/authjs.tsとnode_modules/@auth/core/providers/nodemailer.js。

## R5: 本番TLSと再評価

**Decision**: 本番の最小設定はEMAIL_SERVERの認証付きsmtps URIとEMAIL_FROM。STARTTLSの場合は標準URIオプションrequireTLS=trueを指定する。開発のsmtp://localhost:1025はDev Container内だけに置き、本番への既定値にしない。

**Rationale**: secure=falseだけではSTARTTLS必須にならない。標準の必須TLS設定と証明書検証を使い、失敗時の平文継続を防ぐ。接続文字列はserver-onlyで、ログへ追加しない。

**Alternatives considered**: 独自transport/配送関数・TLSエンジンは不要。環境変数や設定モデルの増設を避け、公開URI設定を利用する。

Sources: [Nodemailer SMTP](https://nodemailer.com/smtp)、[Auth.js設定](https://authjs.dev/getting-started/providers/nodemailer)。2026-10-18再確認。

## 結論

初回の「未検証の互換回避」ゲートは隔離検証と限定例外の明示により計画上通過。公式peer不一致は残り、本体への適用成功を意味しない。本体clean install/型/通常build/全回帰、実Mailpit受信、Dev Container再構築/実ブラウザー、Feature/取得バイナリ/ベース評価、本番認証付きTLS配送を別々に記録する。上流の正式範囲が修正版を含めた時にoverride撤去を検証し、対象版更新時は互換性と脆弱性を再評価する。

## R6: T023事後評価（2026-10-19）

固定OCI Featureと実バイナリを公式digestで照合し、保守/ライセンス/amd64での動作環境を確認した。Featureにarchive checksum検証がないこと、ベースタグが可変であることを記録した。現在のrootfsをTrivy0.76.0でスキャンした結果、MailpitにOpenPGP関連のモジュール警告1件、OS/開発ツールにも検出がある。到達性とOS検出の個別評価が残るため、採用ゲートは未完了。T023をチェックしない。詳細・一次資料・制限・CIのSMTP準備不足は[validation.md](validation.md)のT023節、集計は[t023-scan-summary.json](t023-scan-summary.json)を参照する。旧隔離試験の証跡は変更しない。

## R7: T023の利用経路評価

govulncheck v1.9.0と実バイナリのシンボル解析により、GO-2026-5932はmodule一致だけでOpenPGP package/functionの検出がなく、今回のSMTP利用経路では非該当と判断した。OSのHIGH/CRITICAL549件をDebian公式trackerへ全件照合し、28ソース、open502件、修正版あり47件に整理した。47件は全てlinux-libc-devであり、ヘッダー更新とホストカーネル更新は別。構成全体の採用ゲートはOS/開発ツールとクリーンイメージの評価等が残るため未完了。詳細は[validation.md](validation.md)のT023追跡節と[t023-impact-assessment.json](t023-impact-assessment.json)参照。

## R8: クリーンベースの比較と継続判断

Dockerなしでremote registryから標準Bookwormとslimの固定RepoDigestを取得し、Trivyでvuln/licenseを比較した。slimはOS依存を減らすが未修正項目を解決しないため、自動切替は行わない。CIの専用Mailpit起動/取得checksum検証/準備待ちを実装し、ローカルで同じstepを確認した。DB接続タイムアウトにより今回の統合再実行は未実施。採用ゲートT023は未完了。詳細は[validation.md](validation.md)と[t023-clean-image-summary.json](t023-clean-image-summary.json)。

## R9: DB接続制約への代替検証

既存接続先はタイムアウトしたため、一時領域へPostgreSQL15.19を展開して非特権/loopback限定で起動した。専用_test DBへの全migrationと、Mailpit1.31.6経由の全DB統合19ファイル49ケースが成功。既存DBを変更せず検証後に専用DB/プロセスを後片付けした。CIのPostgreSQL16での成功とは区別する。詳細は[validation.md](validation.md)末尾を参照。OS依存評価の採用保留を解除する根拠とはしない。
