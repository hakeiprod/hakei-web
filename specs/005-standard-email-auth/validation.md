# Validation: 標準メールリンク認証

## 最新の自動検証状況

専用の一時PostgreSQL15.19とMailpit1.31.6で全migrationを適用し、全DB統合試験19ファイル49ケースが成功した（27.88秒）。修正後の受信メール削除も含む。既存接続先への到達性は未復旧だが、DB統合試験の再実行不能は隔離環境で解消した。CIのPostgreSQL16上での成功は未確認。詳細は末尾の「隔離DBでの全統合再検証」を参照する。

## 最新の手動確認状況

ユーザーはDev Container再構築・メール要求・Mailpit受信・リンクログインの確認手順に続けて「ログインまで確認した」と報告した。文脈上、再構築後のメールリンクログイン成功として記録する（ユーザー報告、エージェントによる再構築の直接観測ではない）。これにより、下記履歴の再構築後ログイン未確認という状態を更新する。

追加のスクリーンショットではVS CodeのPortsタブに3000→localhost:3000、8025→localhost:8025の転送と、next-server/Mailpitの稼働プロセスが表示されていることを確認した。Private/Publicの表示はなく、ローカル転送の観測として記録する。localhostという表示だけでホスト側のbindアドレスや外部到達性まで保証したとは扱わない。利用環境に存在しない可視性メニューの操作を再度要求しない。

以前に報告されたログアウト・使用済みリンク拒否・Mailpit停止時のエラー・復旧後ログインの結果も保持する。private転送、既存ツールの確認、外部配送0、保存領域の永続化、修正後の専用DB統合試験、T023の採用判断を、このログイン成功だけで確認済みとはしない。T009全体は未完了を維持する。

2026-10-18 UTC。基準commit bd8c5a2に対する作業ツリー。ユーザーは旧認証コード・テストの撤去と旧認証データ削除を含むmigration作成を明示承認済み。稼働DBへの適用は未実施。

## 最終構成と範囲

- 標準Auth.js Resend Provider + Prisma Adapter + database session。NextAuth handlerは標準GET/POSTをexport。
- callbackはsession.user.idを渡すだけ。独自JWT decode、sid/authVersion、パスワード、確認token、CSRF、Cookie、メール本文、専用API・workerは撤去した。
- Git/DBの整合バックアップに必要な既存maintenanceAdapterだけは保持。標準Adapterの書き込みを既存gateへ接続するだけで、認証方式やAdapterの処理は変えない。
- server/authは標準auth()のUser IDから現在のDB上の役割を取得する。サービス固有のリポジトリ認可・採点・Git管理は維持する。
- 標準SessionProviderを利用し、独自のAuthenticationVisibilityは撤去。標準ログイン画面と旧URLの固定redirectを使用する。
- 新規依存なし。argon2とsmtp-mailerを削除。SMTP評価時に一時導入したnodemailerも最終のmanifest/lockfile/インストールから除去した。peerDependenciesの任意SMTP宣言は上流のメタデータとして残るが、パッケージは含まない。

## 検証環境

Node22.16.0 Linux/musl、Next.js16.4.0、既存Auth.js5.0.0-beta.32 / core0.41.3 / Prisma Adapter2.11.3、Prisma6.19.3、Vitest4.1.11。

新規の専用DB hakei_email_auth_testへ全migrationを適用して試験した。移行前データを入れる別の専用DB hakei_email_migration_testで移行の保持/失敗時の挙動を確認した。どちらも末尾_testで稼働DBではない。実メール・実資格情報を使わず、配送HTTPだけを試験用Responseへ置換する。Auth.js handler、Providerの本文/リンク生成、Prisma Adapter、token、Cookie、セッションは実際の公開APIを通す。

## 自動検証結果

| 検証                                      | 結果                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| 全単体 `npm test -- --run --maxWorkers=2` | 67ファイル467ケースPASS（33.02秒）                                                     |
| 全統合 `npm run test:integration`         | 19ファイル48ケースPASS（32.64秒）                                                      |
| 型検査                                    | `npx tsc --noEmit` と最終buildの型検査PASS                                             |
| 変更箇所lint                              | PASS                                                                                   |
| 本番ビルド                                | `npm run build` PASS（静的生成まで）                                                   |
| lockfile再現                              | `npm ci --offline --no-audit` PASS（973 packages、42秒）。標準認証依存にpeer不整合なし |
| audit                                     | high10 / critical0（変更前と同じ残存範囲）。Nodemailerの新規警告は最終構成に含めない   |
| 移行検証                                  | 正規化メール衝突で停止・rollback、User/role/所有保持、旧session/hash削除PASS           |

旧パスワード専用試験は廃止要件のため削除し、以下の標準方式の試験へ置換した。試験数の減少を安全性向上の根拠にはしない。s-core、Git回復、リポジトリ認可、信頼度、練習保存/履歴等の既存回帰はそのまま実行した。既存canvas未実装警告、Vite paths pluginの案内があるが失敗はない。

## 要件別の証跡

- FR-001/SC-001: authjs.tsの標準Provider/Adapter/session構成、標準route exportとauthjs.test.tsを確認。秘密の認証処理を自作しない。
- FR-002/003: password専用モジュール・UI・API・11モデルとauthVersionを撤去。DB削除はmigrationファイルに限定し、稼働DB未適用。認可は現在DB上の役割を使う単体試験を維持。
- FR-004/SC-002: email.integration.test.tsで既存GitHub UserのID・OPERATOR役割・Account・楽譜所有・信頼度・実際の練習履歴を比較して一致。新規Userはメール確認前に作成されない。
- FR-005: providers.test.tsとauthjs.test.tsでGitHub未設定・一部設定・両方設定、設定値を変更しないことを確認。危険なemail自動連携を有効化しない。
- FR-006: Resend APIキー/送信元の不足・空白時に入口を登録しない。標準画面・設定/移行手順をdocs/email-auth.mdへ記載。
- FR-007/SC-004: 本番での配送/入口の制限は未設定・未検証として明記。Auth.js標準機能だけで送信乱用を防げるとは扱わない。
- FR-008: 新規依存・独自認証基盤なし。サービス固有のGitバックアップgateと認可だけを残す。
- SC-003: 実標準handlerで確認→DB session→logout、期限切れ、消費済みリンク、未知の旧JWT cookieの拒否を確認。メール送信HTTP以外は実経路。

## 移行の検証内容

旧migrationを全て適用した隔離DBへ、大小文字だけ異なる2つのメール、OPERATORのUser、所有するリポジトリ、旧DB session、旧password hashを入れた。

1. 新migrationがメール衝突で失敗することを確認。
2. User数、旧session、旧hashが保持され、部分削除されないことを確認。
3. 衝突を別メールへ修正してmigrationを適用。
4. 同じUser ID、正規化メール、役割、リポジトリ所有者が保持されること、旧sessionとpasswordモデルが削除されることを確認。

新認証を稼働環境へ出す前に、このmigrationと全利用者の再ログインが必要。旧JWTをDB sessionとして復活させない。旧Userを作り直す移行や、メール衝突の自動統合は行わない。

## 依存選定

当初検討したNodemailer8.0.11はAuth.jsのpeer範囲には合うが、auditでSMTPの追加警告を検出したため不採用。ユーザー同意のもと標準Resend Providerへ変更し、peer overrideや独自SMTP実装は追加しなかった。導入済みAuth.jsの公開Providerを利用するため、新しいライブラリのライセンス/ネイティブ実行条件は増えない。

残るhigh10は従来のbraces/deepmerge-ts/Prisma CLI等の評価を引き継ぐ。期限2026-11-14までの再評価条件は仕様002のvalidationを参照し、ゼロになったとは扱わない。

## 保留と運用設定

- Resendの送信ドメイン、AUTH_RESEND_KEY、EMAIL_FROMは利用者の環境で設定する。実配送とサービス側のレート制限は未確認。
- 実GitHub OAuth、画面のブラウザー確認は未実施。旧004の独自認証UIに対する4タスクは今回その画面自体を撤去したため対象外となる。標準画面をHeroUIで自作し直さない。
- 稼働DBへのmigration適用はしていない。パスワード/監査記録等の削除と全端末再ログインを伴うため、運用手順に従いバックアップ後に適用する。
- 仕様001の実MIDI/初見試用は従来どおり保留。

## SMTP改訂 — 本体実装

Node22を使用。隔離試験と旧Resendの結果は本体の検証に転用しない。専用hakei_smtp_compat_test DBと試験専用Git領域を使う。Docker CLI/ブラウザー/本番SMTP資格情報はこの環境にない。既存audit high10は差分と利用経路を再確認する。稼働DB・秘密ファイルは変更しない。

### 2026-10-18 実装結果

- 標準Nodemailer Providerへ切替。Nodemailer10.1.6、next-auth5.0.0-beta.32、core0.41.3をnpm lsで確認。2箇所の限定overrideだけを採用し、公式peer対応という表現はしない。
- Node22の通常npm install成功。clean `npm ci --offline --no-audit`成功（974 packages/53秒）。force/legacy-peer-depsなし。
- 設定の変更前試験は9件失敗/8件成功。実装後17件成功、その後GitHub/SMTP組合せを追加し最終の設定・Provider試験は2 files/28 tests成功。
- 全単体は67 files/475 tests成功。最後のGitHub組合せ4件は上記の対象試験で追加確認した。jsdomの既存canvas未実装警告は残るが試験は成功。
- 全DB統合は19 files/48 tests成功。さらに配送失敗の試験を追加し、clean install後の認証統合は4/4成功。専用hakei_smtp_compat_testと試験専用Git領域を使用。
- 認証統合は本物のNextAuth GET/POST handlers→標準Nodemailer→Mailpit v1.31.6 SMTP→公開受信API→標準callback。配送mockなし。確認前User未作成、保存token非平文、改変/期限切れ/使用済み拒否、logout、配送失敗の未認証、既存ID/OPERATOR/Account/所有/信頼度/実練習履歴の保持を確認。
- VitestからNextAuthのnext/server拡張子なしimportが解決できなかったため、vitest.integration.config.mtsでnext-authだけをinline化した。標準認証をmockに置換していない。
- 型検査・変更箇所lint・通常`npm run build`成功。統合試験のlint2件は修正後に再確認した。後の変更は試験/文書のみで本体buildへの変更なし。
- npm auditはhigh10/critical0・他0で従来と同じ。Nodemailerの追加警告0。残るbracesは管理されたESLint root glob、deepmerge-tsはPrisma CLI/configの経路で、SMTP変更による新たな入力経路なし。従来の評価・緩和を維持し、次回依存更新/本番公開前/遅くとも2026-11-14に再評価する。詳細は仕様002 validation.mdのT002調査を参照。audit0とは扱わない。
- 既存パスワード撤去migrationをレビュー。衝突検出はUPDATE/DELETE/DROPより前かつ同一transactionで、User/Account/資産を削除しない。以前の隔離移行証跡を保持し、SQL自体は変更なしのため今回は再適用しない。SMTP追加migrationなし。稼働DB/.env/.env.localへの変更なし。
- Dev ContainerをCompose app+Mailpitへ変更。既存Features/postCreate/VS Code設定は維持し、SMTP host publish/relay/永続volume/独自常駐管理は追加していない。受信UIは転送先でprivateを維持する手順を記載。実Composeによる確認は下記の未実施項目。

### 受け入れ対応と残り

| 要件/成功基準              | 証跡/状態                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| FR-001/002/003/008         | 標準Provider/handlerと既存Adapter/認可を維持。自動試験・build成功                         |
| FR-004、SC-003             | 同一User/資産と無効リンク/logoutを実SMTPで確認                                            |
| FR-005                     | 未設定/一部/両方とSMTP組合せの自動試験成功。実OAuthは未実施                               |
| FR-006、SC-004             | 設定不足/危険な本番URI拒否と配送失敗の未認証を確認。認証付き本番SMTP/TLS実配送は未実施    |
| FR-007                     | 運用側制限の手順を記載。実環境の設定確認は未実施                                          |
| FR-009/010、SC-001/002/005 | バイナリMailpitの実受信は成功。Docker/Compose再構築、ブラウザー一連操作、再作成は未実施   |
| FR-011、SC-006             | npm固定版・auditを評価。Mailpit対象Docker imageのdigest/platform/同梱依存スキャンは未実施 |

未完了タスクはT009（Docker image評価/再構築/ブラウザー）、T013（本番相当SMTPと乱用制限）、T018（実GitHub OAuth）、T022（全受け入れの最終確認）。現在の環境にはDocker CLI/実ブラウザー/本番SMTP・登録済みOAuthの検証設定がない。これらを自動試験/隔離試験だけで完了にしない。開発者はDev Container再構築後にquickstartを実施し、運用者は許可された分離検証環境でSMTP/制限/OAuthを確認する。

## 2026-10-19 Feature構成への変更

ユーザー指定のMailpit Featureへ変更し、Debian版Node22・localhost SMTP・Feature管理の起動/永続volumeを採用。Composeを撤去。GitHub変数は実際のnext-auth v5公式ドキュメントに合わせAUTH_GITHUB_ID/AUTH_GITHUB_SECRETを維持。Dev Container再構築とブラウザー確認は未実施。以前のCompose検証を新構成の証跡として扱わない。

### 手動検証の追記（ユーザー確認）

上記のブラウザー未実施の記録を、以下の確認範囲について更新する。実施結果はチャットでのユーザー報告による。

- メールリンクからログインできることを確認。
- ログアウト後の保護画面へのアクセス拒否と、使用済みリンクで再ログインできないことを確認。
- Mailpit停止中のメール要求がエラーになることを確認。
- Mailpit再起動後にメールが届き、新しいリンクでログインできることを確認。
- 認証時に `SCORE_GIT_ROOT is required` が発生したため、開発環境の設定を案内し、その後ログイン成功の報告を受けた。秘密値や設定値は記録しない。

現在の環境ではMailpit Featureの起動プロセスを読み取り確認した。Dev Container再構築・再作成の再現性、保存領域の永続化、private転送、外部配送0、Featureの保守/ライセンス/platform確認については、この報告だけで確認済みとはしない。T009は残りの確認があるため未完了を維持する。T013/T018/T022も未完了。

### 分析後の文書修正

仕様・計画・タスク・quickstartと関連設計文書を現行Feature構成へ統一した。T019の旧tasks再生成待ち表記等を再確認し、現行文書の残存記述を更新した。旧Resend/Composeの実施履歴と隔離試験の証跡は保持する。

Mailpit Feature/取得バイナリ/Debianベースの依存評価をT009からT023へ分離し、本来T005導入前に必要なゲートとして明記した。導入前確認の不足自体は文書修正で解消したとは扱わず、T023を未完了とする。合計23件、完了18件、未完了T009/T013/T018/T022/T023。今回の変更は文書のみで、新たな依存調査やアプリ動作試験は実施していない。

## T023: Feature/バイナリ/ベース環境の事後評価（2026-10-19）

**判定: 未完了。採用ゲート全体のPASSとはしない。** 本来の導入前評価が不足しており、今回は導入後に確認した。実行中サービス・依存版・.env・稼働DBは変更していない。

### 固定情報と取得物

- Featureは1.0.0、lockのOCI manifest digestは `sha256:d3af8b1af43fc49189741046efbc102c29664942400ba7c6ebba9f145686c689`。GHCRからmanifestとlayerを取得し、各digestをSHA-256照合した。固定layer内のinstall.sh/metadataを直接確認した（mainだけの確認ではない）。
- FeatureはDebian/ID_LIKE=debianを要求し、curl/ca-certificates/jqをapt導入する。aarch64だけarm64、それ以外はamd64を選択するため、検証対象はlinux/amd64。arm64はソース上対応だが未実行。arm32/ppc64le等はNodeイメージに存在しても、このFeatureとの互換性を主張しない。
- Mailpit設定版は1.31.6。`mailpit version --no-release-check` は `mailpit v1.31.6 compiled with go1.27.2 on linux/amd64`。`--version` は無効だったためquickstartを修正した。
- 公式linux-amd64 release archiveのSHA-256 `10fa12ccc610f653d4ed4df848c1817f9935dcf4e9a6a458a19ab0fa02093f91` をGitHub APIのasset digestと照合し、展開バイナリとインストール済みバイナリのbyte一致を確認。バイナリSHA-256は `89ad3d1987140f5f4432be497e0aa8fbf1e8a6bb30258b7d35d5ea4bedfcd4df`。
- Featureのinstall.sh自体はHTTPS取得をtarへ渡すだけで、archiveのchecksum/署名検証をしない。今回の手動照合は将来の再構築時の自動検証を保証しない。
- `node:22-bookworm` は可変タグ。稼働環境はDebian12、スキャナ識別12.15、Node22.23.3、x86_64。Docker CLIがなく、現在のコンテナが使用したベースimageのRepoDigestは未確認。現在タグのdigestを取得しても稼働コンテナのdigestと同一とは扱わない。

### 保守とライセンス

- FeatureリポジトリとMailpitはGitHub APIで非archived。確認時pushed_atはFeatureが2026-10-06、Mailpitが2026-10-17。Mailpit1.31.6公開日は2026-10-15。更新日は保守保証/SLAとは扱わない。
- FeatureリポジトリLICENSEとMailpitのAPI licenseはMIT。再配布時は各著作権/ライセンス表示を維持する。
- Node22は公式scheduleでmaintenance期間、EOLは2027-04-30。Debian12はLTS期間で2028-06-30まで。ただしLTSは全パッケージを無条件に保証しない。
- Debian/Nodeコンテナ全体を単一MITライセンスとは扱わない。OS各パッケージのcopyrightとNode同梱第三者ライセンスの確認が必要。全425 OSパッケージの個別ライセンス棚卸しは未実施。

### 脆弱性の確認

公式Mailpit公開advisory APIは16件。記載された修正版は1.31.2以下だが、GHSA-r553-m4fv-5v97とGHSA-j3fj-qppj-fmmcには上限のないaffected rangeがあり、修正版の数字だけで全件非該当とは断定しない。v1.31.6ソースでは前者のDATA読取がReadSliceで断片ごとにサイズを検証し、後者のHTML checkにsafeDialContextが存在することを確認した。これはソース照合であり攻撃再現試験ではない。

Trivy0.76.0の公式release assetを一時領域に取得してasset digestを照合後、最新取得DBで現在のrootfsをスキャンした。scanners=vuln、pkg-types=os,library。workspace、秘密ファイルのあるroot、proc/sys/dev、tmp、Mailpit受信DBを除外し、メール本文や.envを走査対象にしなかった。生レポートは一時領域に置き、保存用には秘密値を含まない[t023-scan-summary.json](t023-scan-summary.json)を生成した。

- Mailpitバイナリ: UNKNOWN1件（GO-2026-5932、golang.org/x/crypto v0.58.0）。公式Go勧告の対象はopenpgp配下。モジュール一致だけでは到達性を示さないが、非該当とするためのpackage/symbol解析は未完了。high/critical検出0を無脆弱性の保証にはしない。
- Debian OS: CRITICAL21、HIGH528、MEDIUM2853、LOW1834、UNKNOWN51のパッケージ×勧告の検出件数。重複CVEを含み、攻撃可能な問題の件数ではない。ベースだけでなくFeature/postCreate等の追加物も含む現コンテナの結果であり、導入前との差分は未取得。
- 例: CVE-2023-45853はzlibのCRITICALとして検出されたが、Debian trackerはbookwormのcontrib/minizipがビルドされないと記載する。このようなsource/binary差もあるため、一律に実害あり/なしとは判定しない。他のOS検出は個別の利用経路・修正可否・対応優先度を未評価。
- npmグローバル/開発ツール/gh/VS Codeにも検出あり（集計JSON参照）。これは既存アプリnpm auditのhigh10とは別の対象・集計であり、加算や置換はしない。

### CIへの影響と残り

.github/workflows/test.ymlはubuntu-latest＋setup-node22で、Dev Containerイメージは使用しないためベース変更でCIのOSが変わることはない。一方、メール統合試験が必須とするTEST_EMAIL_SERVER/TEST_MAILPIT_URLとMailpitの起動がCIにない。実SMTP試験をCIで再現するには専用Mailpitの準備と設定が必要。今回は評価のみでworkflowは変更していない。

T023を完了にするには、MailpitのOpenPGP勧告の到達性、OS/同梱依存の検出と利用経路、LTSサポート外パッケージ、ライセンス確認範囲、ベースimageの実digestを評価し、採用判断を記録する必要がある。自動checksum検証がない取得方式の扱いも採用判断に含める。問題を単に無視する、可変latestへ切り替える、独自メールサーバーへ置き換える対応は行わない。

### 一次資料

- [Feature source](https://github.com/skriptfabrik/devcontainer-features/tree/main/src/mailpit)、[Feature LICENSE](https://github.com/skriptfabrik/devcontainer-features/blob/main/LICENSE)、[Feature repository API](https://api.github.com/repos/skriptfabrik/devcontainer-features)
- [Mailpit release/API](https://api.github.com/repos/axllent/mailpit/releases/tags/v1.31.6)、[Mailpit repository API](https://api.github.com/repos/axllent/mailpit)、[公開勧告API](https://api.github.com/repos/axllent/mailpit/security-advisories?per_page=100)
- [固定版SMTP読取](https://github.com/axllent/mailpit/blob/v1.31.6/internal/smtpd/smtpd.go)、[固定版HTML check](https://github.com/axllent/mailpit/blob/v1.31.6/internal/htmlcheck/css.go)
- [Go勧告](https://pkg.go.dev/vuln/GO-2026-5932)、[Debian zlib評価](https://security-tracker.debian.org/tracker/CVE-2023-45853)
- [Node公式image](https://github.com/nodejs/docker-node)、[対応platform](https://github.com/nodejs/docker-node/blob/main/versions.json)、[Node schedule](https://github.com/nodejs/Release/blob/main/schedule.json)
- [Debian12 support](https://www.debian.org/releases/bookworm/)、[Debian license information](https://www.debian.org/legal/licenses/)、[Trivy release](https://github.com/aquasecurity/trivy/releases/tag/v0.76.0)

## T023追跡: 警告の利用経路と修正可否（2026-10-19）

### Mailpit: OpenPGP警告の切り分け完了

Go公式配布のlinux/amd64 toolchainを公式SHA-256で照合して一時領域へ展開し、govulncheck v1.9.0をGo module checksum付きで取得した。`govulncheck -mode=binary -json /usr/local/bin/mailpit`（symbolレベル）はexit0。GO-2026-5932のfindingはgolang.org/x/crypto v0.58.0という**moduleのみ**で、package/functionのtraceを含まない。取得された296件のOSVレコードはfinding296件を意味しない。

同じ公式release一致済みバイナリに`go tool nm`を実行し、29,753行のシンボル情報が存在すること、x/crypto/bcryptなどは存在すること、警告対象の`golang.org/x/crypto/openpgp`配下のシンボルが0件であることを確認した。Go公式勧告が対象とするのはOpenPGP配下であり、x/crypto全機能ではない。

**判断**: このバイナリでOpenPGPの利用経路は検出されず、当該警告を認証SMTPの到達可能な脆弱性とは扱わない。警告の全面無視やx/crypto全体の安全宣言にはしない。版/バイナリ変更時に再解析する。前節の「OpenPGP到達性未完了」はこの範囲について更新する。ソースtagに対する再ビルド一致や将来の動的ロードを保証するものではない。

### OS: 全HIGH/CRITICALをDebian公式trackerへ照合

前回Trivyの549件（HIGH528、CRITICAL21）について、dpkgのsource:Packageをarchitecture suffix正規化後に取得し、Debian公式trackerのbookworm情報へ照合した。28ソースパッケージ、313種類のCVE。全549件に対応する公式レコードを確認し、502件がopen、47件がresolvedだった。resolvedはディストリビューションに修正版がある意味であり、現在のインストール版が修正済みという意味ではない。詳細と各CVEの発火条件は[t023-impact-assessment.json](t023-impact-assessment.json)に保存した。

| 分類 | パッケージ×勧告件数 | 利用経路と対応判断 |
| --- | ---: | --- |
| linux-libc-dev（src:linux） | 216 | カーネルヘッダー。ここには実行中カーネル本体がなく、これだけでSMTPからカーネル脆弱性へ到達とは扱わない。うち47件に修正版6.1.190-1。ホストカーネルは別途ホスト側で確認する。 |
| 画像・フォント系 | 130 | aom/OpenEXR/ImageMagick/HEIF/TIFF等。Mailpitは静的バイナリ、Nodeのlddにもこれらはない。server/scriptsの外部起動はGit/pg_dump等で、当該ツールの直接呼出は見つからない。Next.js推移依存・開発ツール等の別消費者までは非該当としない。 |
| OS SQLite/XML/GLib | 55 | MailpitはOS libsqlite3/libxml2/GLibを動的リンクしない。Nodeの直接リンクにもない。CVE-2025-7458は任意SQL、GLibのCRITICALは不正D-Bus XML、libxml2は不正XMLが条件。別プロセス/拡張の利用は追加レビューが必要。Mailpitに組み込まれたSQLite/Go依存は別のバイナリ解析対象。 |
| curl | 20 | Feature導入時のダウンロードに使う。稼働時SMTPと別経路だが、不正URL/資格情報/リダイレクト等の各条件を無条件に除外しない。Featureのチェックサム自動検証不足も残る。 |
| OS OpenSSL | 3 | OSのTLSツール/ライブラリ。Node/Mailpitの組込みTLSとは別。単にSMTPがTLSを使うという理由で該当・非該当とはしない。 |
| OpenSSHクライアント | 6 | Git/開発用SSHが消費し得る。CRITICALのCVE-2026-60002は悪意あるSSHサーバーの再鍵交換が条件。信頼できる接続先でも修正済みとは扱わず、更新可能性を追跡する。 |
| zlibのCVE-2023-45853 | 2 | Debian公式trackerはbookwormで該当contrib/minizipをビルドしないと記載。当該OSバイナリへの影響なしと判断。Node組込みzlib等へ判断を転用しない。 |
| その他OS/開発ツール | 117 | acl/expat/gzip/mariadb/ncurses/openldap/perl/python/systemd/util-linux/wget。開発コマンド・バックアップ・解析等に消費者があり得るため一律除外しない。発火条件とDebianの延期理由はJSONへ記録した。 |

CRITICAL21件をソース×CVEで整理すると11件。Debianはaom等をminor/no-dsa、OpenSSH/libxml2等をpostponedとするが、これは修正済みの証拠ではない。前回の生スキャン件数を、そのまま「攻撃可能な549件」や「すべて無関係」へ読み替えない。

### 採用判断と次の具体的な対応

**T023は未完了のまま。MailpitのOpenPGP警告は切り分けできたが、構成全体の承認には足りない。**

1. `linux-libc-dev`は修正版6.1.190-1以上を使うクリーンなベースで再評価する。ヘッダー更新はホストカーネル更新の代わりにならない。OSをその場でupgradeして再現性を失う対応は今回は行っていない。
2. 残る502件は全てbookwormでopen。OS画像/開発ツール等の利用経路を踏まえ、対象を限定した非該当の根拠、公式更新待ち、不要パッケージ削減、別のDebianベースとの比較を採用判断へまとめる必要がある。全体リスクの受容は今回行わない。
3. 現在のベースタグだけでは稼働イメージのRepoDigestを証明できない。Dockerホスト側で使用イメージを特定し、クリーンな構築物で再スキャンする。Docker CLI/daemonをappへ追加しない。
4. LTSサポート外パッケージと個別ライセンスの確認範囲、Featureのarchiveチェックサム検証不足、既に指摘したCIのMailpit未準備を引き続き追跡する。

今回は調査と証跡更新のみ。インストール済みOS、Mailpit、.env、アプリの認証処理、DB、ホスト設定は変更していない。別ベースへの自動移行やユーザー指定Featureの置換も行っていない。

一次資料: [Go公式のバイナリ解析](https://go.dev/blog/govulncheck)、[GO-2026-5932](https://pkg.go.dev/vuln/GO-2026-5932)、[Debian tracker JSON](https://security-tracker.debian.org/tracker/data/json)、[aom](https://security-tracker.debian.org/tracker/CVE-2023-6879)、[zlib](https://security-tracker.debian.org/tracker/CVE-2023-45853)。各OS検出の一次資料は `https://security-tracker.debian.org/tracker/<CVE-ID>` で参照できる。

## T023継続: クリーンイメージ評価とCI修正（2026-10-19）

Docker/ソケットがない環境でもTrivyのremote registry機能で公式イメージを直接評価できた。以前の「ホストがなければクリーンimageのdigest/スキャンが取得できない」という制限は、**今回取得した上流imageについて**解消した。ただし稼働中コンテナが使用したimageの同定や、Feature/postCreateを含む再構築は別の確認である。

### 上流ベースの比較

| 対象（linux/amd64） | 固定RepoDigest | OSパッケージ数 | OS HIGH/CRITICAL（重複あり） |
| --- | --- | ---: | --- |
| node:22-bookworm | sha256:0e5f906573693feaa1e21057ebdcfdb5bd5021f050b2dc7c9deceb629c7da2a8 | 413 | HIGH546 / CRITICAL21 |
| node:22-bookworm-slim（比較のみ） | sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 | 88 | HIGH60 / CRITICAL4 |

[t023-clean-image-summary.json](t023-clean-image-summary.json)へimage ID、RepoDigest、platform、スキャン集計とライセンス一覧を保存した。ライセンススキャナのHIGH（restricted等）はライセンス分類でありCVEの重大度ではない。標準版はOSライセンス2,487件、npm等197件の検出を記録し、GPL/LGPL等を含む複数ライセンスであることを確認した。自動検出は再配布条件の個別履行を保証しない。

**判断**: slimは画像処理等の依存削減に有効だが、perl-baseの3件とzlibの1件がCRITICALとして残る。zlibの個別非該当判断を他へ広げない。単なるslim切替を問題解消とは扱わず、今回devcontainer.jsonの指定ベースは変更しない。標準版の最新取得でも既知問題が残るため、現構成の無条件採用を承認しない。T023は未完了を維持する。

### CIに実SMTP前提を追加

.github/workflows/test.ymlへ、固定Mailpit1.31.6の公式archiveをSHA-256検証してから起動するstepを追加した。SMTPは127.0.0.1:11025、受信APIは127.0.0.1:18025、DB/log/archiveはrunner一時領域。テスト用TEST_EMAIL_SERVER/TEST_MAILPIT_URLをjobへ設定し、APIの準備完了を待ってから既存の試験へ進む。個人のMailpitや受信DBと共有しない。外部relay/forwardは設定しない。

ローカルではworkflow YAMLを一時領域のPyYAMLでparseし、stepのshellをそのまま抽出してbash -nで確認後、実行した。archive検証・展開・専用Mailpit起動・API準備完了待ちは成功（起動直後の接続拒否1回をretryで回復）。SMTP/GitHub設定の単体回帰は2 files / 28 tests成功。

既存DATABASE_URLから接続先を秘密値非表示で取得し、新規専用hakei_t023_20261019_smtp_testだけを作成する手順を準備したが、管理DBへの接続がタイムアウトした。CREATE DATABASEに到達していない。専用DB作成・migration・SMTP統合試験は今回未実行であり、CI上の実行成功とも扱わない。既存の専用DB試験証跡は履歴として維持する。

### 現在の限界と受け入れ条件

- こちらで修正可能だったCIのMailpit不足は修正済み。実GitHub Actionsの起動/成功確認は未実施。
- T023はOS/開発ツールの未修正項目、LTS対象外パッケージと再配布条件の判断、Feature取得時の自動検証不足等を残す。上流固定digest取得とOpenPGP警告の切り分けは完了したが、承認ゲート全体をPASSとはしない。
- T009の再構築/再作成とprivate転送確認には、Dockerホスト/IDEからの操作が必要。現在の環境にはDocker CLIもソケットもない。T013の本番SMTPとT018の登録OAuthも、この環境から確認できない。
- 現在の.env、稼働DB、実行中アプリ、指定Mailpit Featureは変更していない。今回起動した専用Mailpitは確認後に停止する。

一次資料: [Trivy remote registry対応](https://trivy.dev/docs/latest/target/container_image/)、[Node公式image](https://github.com/nodejs/docker-node)。上流imageのスキャン結果と現コンテナの結果は別資料として保持する。

### CI修正の追加検証と受信メール削除の修正

同一ツール実行セッション内でCI stepをそのまま実行し、Nodemailerから合成メールを送信して公開APIで受信を確認した。当初の削除確認で、既存email.integration.test.tsのDELETE /api/v1/messages/{ID}が404となることを再現した。既存試験はその応答を検証せず後片付けの失敗を見逃していた。

固定版1.31.6の[公式Swagger](https://github.com/axllent/mailpit/blob/v1.31.6/server/ui/api/v1/swagger.json)に合わせ、DELETE /api/v1/messagesのJSON bodyへ対象IDsを明示するよう修正した。全メールを消す空bodyは使用しない。削除成功と、対象message取得が404になることも既存統合試験へ追加した。実APIを使った隔離SMTP往復確認で、送信・受信・対象ID削除・削除後404が成功した。起動用合成メール以外のメールには操作していない。

変更箇所eslintとtsc --noEmitは成功。DB接続に依存するAuth.js統合試験全体は前述の接続タイムアウトで再実行できておらず、このSMTP往復確認で代用したとは扱わない。CIそのものの実行も未確認。開発文書の試験例を個人のFeature受信箱から専用11025/18025へ訂正した。一時検証用Mailpitは停止済み。ツール呼出終了時にバックグラウンドプロセスが終了するため、別呼出からの生存確認では接続拒否となったが、同一セッションでの往復確認は上記のとおり成功した。

## 隔離DBでの全統合再検証

既存.envの接続先はDNS解決できたが、TCP接続がタイムアウトした。秘密値/接続先アドレスは記録しない。既存DBの修正や再設定を行わず、Debian公式署名付きAPT索引経由でPostgreSQL15.19のパッケージを取得し、一時領域へ展開した。システムのサービスにはインストールしていない。

- 非特権nobodyで新規クラスタを初期化し、127.0.0.1:15439と一時socketだけで起動。
- 新規hakei_t023_20261019_smtp_testを作成し、DATABASE_URL/TEST_DATABASE_URLをこのDBへ明示上書き。末尾_testガードを維持し、SCORE_GIT_ROOTも専用一時領域を指定。
- Mailpit1.31.6を専用一時DB、SMTP11025/API18025で起動し、API準備完了を確認。開発受信箱1025/8025を使用しない。
- 全migration適用成功。`npm run test:integration`は19ファイル49ケース成功、27.88秒。修正後のメール削除成功/削除後404も既存認証統合試験内で検証した。認証・認可・Git回復/バックアップ・練習履歴等の既存回帰を省略していない。
- pg_dump/pg_restoreはサーバーと同じ15.19を使用。CIで指定するPostgreSQL16とは別環境であり、CI成功の代用とはしない。
- finallyで作成した_test DBを削除し、trapで検証専用MailpitとPostgreSQLを停止した。稼働DB、.env、アプリ用Mailpit、SCORE_GIT_ROOTの既存設定は変更していない。

これにより、履歴中の「DB統合試験の再実行が未完了」は今回の隔離環境について解消した。既存DBへの到達性・CIの実ジョブ・本番SMTP/TLS・実GitHub OAuth・OS依存の採用ゲートは別途残る。T009/T013/T018/T022/T023を、この試験だけで完了にはしない。

## T022: 最終受け入れ対応表とCIの失敗原因

[acceptance-status.md](acceptance-status.md)へFR-001〜011/SC-001〜006、quickstart全節とUS全シナリオの証跡・保留理由を対応付けた。旧認証API/独自passwordHash/authVersionの不在、標準handler/Provider/sessionを再確認。追跡差分と未追跡テキストの限定秘密パターン検出0。.env変更なし。対応表作成は完了したが、未実施の受け入れを成功扱いにせずT022の最終受け入れは保留。

GitHub CLIは未認証だったが、接続済みGitHub connectorの読み取りAPIで基準commitのrun39126668070/job117673131645を確認した。単体/統合は成功、tscは`src/app/score/[id]/page.tsx: Cannot find name PageProps`で失敗、buildはskip。未pushの現変更を検証したrunではない。公式Next CLIのtypegenでルート型を生成できることを確認し、workflowのtsc前にnext typegenを追加した。ローカルの`npx next typegen && npx tsc --noEmit`は成功。push/CI起動は行っていない。

Debian公式APTのdebian-security-support 1:12+2026.06.30を一時展開し、source packageで全インストール済み依存と照合した。endedリスト一致0、limitedリストはbinutils（信頼できる入力に限る）とrust-sequoia-sq（静的リンクのサポート条件）。これは取得したリストのスナップショットで、既存OS検出の無害化や全パッケージの無条件サポートを意味しない。詳細は[t023-support-status.json](t023-support-status.json)。システムへのパッケージインストールなし。

## 最終回帰の再確認

- 全単体: `npm test -- --run --maxWorkers=2`、67ファイル479ケース成功（26.33秒）。
- 全DB統合: 直前の隔離PostgreSQL15.19/Mailpit1.31.6で19ファイル49ケース成功。今回の後続変更はCI/文書だけで、この結果を保持する。
- `npm ls next-auth @auth/core nodemailer`: 5.0.0-beta.32 / 0.41.3 / 10.1.6、既定の2箇所overrideを再確認。
- npm audit再実行: high10 / critical0 / 他0で従来と同じ。Nodemailer検出なし。OSスキャンとは別の範囲である。
- Dev Container環境をそのまま継承した`npm run build`は、開発平文localhost SMTPを本番設定が拒否し、Invalid SMTP configurationで停止した。コンパイルと型検査は成功していたが、ビルド全体の成功とはしない。
- プロセス限定でメール設定を空にした`EMAIL_SERVER= EMAIL_FROM= npm run build`は通常のNextビルドでコンパイル・型検査・静的生成21/21まで成功。SMTP制限を弱めず、.envや稼働中開発サーバーは変更していない。この手順をdocs/development.mdとquickstartへ記載した。本番メール配送の成功を示す検証ではない。

これ以上の実配送/実OAuth検証には許可された検証用設定、修正後の実CI確認には現在の作業差分の公開が必要。push・公開・稼働DB移行は行っていない。OS依存の採用保留も維持する。利用者に同じログイン試験や存在しないPrivateメニューの操作を繰り返し要求しない。
