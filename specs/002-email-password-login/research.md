# Research: メール＋パスワード認証

**Date**: 2026-10-15（設計）、2026-10-16（実装検証更新）。設計判断の記録。T001〜T053の実装・自動検証を完了。auditは既存high10件を利用経路と期限付き基準で受け入れ、実配送・実OAuthは未確認。根拠と測定値は[validation.md](validation.md)を参照。

## R1: Credentialsと既存セッション

**Decision**: 全方式をAuth.js標準JWTへ変更し、Credentials.authorizeでサービス側の資格情報を照合する。
**Rationale**: Credentialsは登録/保存を提供しない。インストール済みcore0.41.3のCredentials callbackはJWTを発行する。
GitHubとの混在は初期assertを通る場合があるが、DBセッションとの一貫した処理にならない。
**Alternatives**: DB cookieを手作りする回避策は憲章違反。別認証基盤への移行は既存GitHubとの変更範囲が広い。ログインリンクのみは要求と異なる。
**Sources**: [公式Credentials](https://authjs.dev/getting-started/authentication/credentials)、[provider API](https://authjs.dev/reference/core/providers/credentials)、[strategy errors](https://authjs.dev/reference/core/errors)。ローカル`@auth/core/src/lib/actions/callback/index.ts`と`lib/utils/assert.ts`を確認した。

## R2: 失効とOAuth連携

**Decision**: 標準`next-auth/jwt` decodeを呼び、その後DBのsid/世代を確認する公開wrapperを使う。標準encode/cookieは維持する。
**Rationale**: ローカル`callback/handle-login.ts`のOAuth経路はdecode→adapter.getUser→linkAccountであり、jwt callbackによる照合だけでは連携前の失効確認が抜ける。
**Alternatives**: JWTの有効期限を短くするだけでは即時失効できない。独自暗号化/独自cookie/内部関数の差し替えは使わない。
**Sources**: [Core callbacks/options](https://authjs.dev/reference/core)、[標準JWT](https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/jwt.ts)。実装時の回帰は上流mainでなく固定SDK版の実handlerを通す。

## R3: パスワード保護

**Decision**: `argon2@0.45.1`、Argon2id、公開hash/verify/needsRehashを採用候補にする。初期64MiB/t3/p1、library生成salt、PHC文字列。
**Rationale**: Node22に対応し、Alpine/musl向けバイナリーがある。暗号アルゴリズムを自作しない。未登録/未設定の対象も固定dummy hashをverifyする。
**Alternatives**: Node標準Argon2は現行Node22の安定公開機能として使えない。bcryptは入力byte制約への追加対応が必要。パスワードを単純digestで保存しない。
**Sources**: [公式node-argon2](https://github.com/ranisalt/node-argon2)、[リリース](https://github.com/ranisalt/node-argon2/releases)、[OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)。MIT・型同梱。導入時にmusl/本番で実hashを実行し、30回の時間/RSS・同時2件の負荷・依存auditを確認する。

## R4: メール送信とpeer依存

**Decision**: `smtp-mailer: npm:nodemailer@10.1.1` aliasで公開createTransport/verify/sendMailを利用する。Auth.jsメールproviderは使わない。
**Rationale**: 固定Auth.js/coreのoptional peerは`^7.0.7 || ^8.0.5`で、直接nodemailer10を追加するとpeer競合する。旧版へ下げない。
Nodemailer公式GHSA-4ffr-jq9g-5ffxは10.0.12以前を対象、10.0.13を修正版として示す。10.1.1は候補であって、全脆弱性なしの保証ではない。
一時ディレクトリでAuth.js固定版・Next16.4・argon2・aliasを含む`npm install --package-lock-only --ignore-scripts`が成功し、nodemailer旧版が入らないことを確認した。ネイティブ実行/メール配送はまだ未検証。
**Alternatives**: peerを無視するforce/legacy-peer-deps、古い脆弱な版、SMTP自作は採用しない。特定の送信業者APIは運用依存を増やす。
**Sources**: [SMTP API](https://nodemailer.com/smtp)、[公式advisory](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-4ffr-jq9g-5ffx)、[advisory一覧](https://github.com/nodemailer/nodemailer/security/advisories)、[npm alias](https://docs.npmjs.com/cli/v11/using-npm/package-spec/)。MIT-0・型同梱・Node>=20。実装時のlockfile全体auditとnpm ciを導入ゲートにする。

## R5: 案内・登録・再設定

**Decision**: crypto.randomBytes(32)のraw案内をメール/メモリーだけに保持し、DBはSHA-256 digest・generation・期限・単回使用状態を保存する。GETでは消費せずPOSTで確定する。
**Rationale**: スキャナで誤消費せず、同時確定と再送を制御できる。登録申請時のpasswordは検査だけ、メール所有者が最終選択することで事前登録の既知passwordを有効化しない。
**Alternatives**: 確認待ちpasswordの自動有効化、token入り平文outbox、GETでの変更、自動アカウント統合を採用しない。
**Sources**: [OWASP recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)。暗号/SMTPを再実装せず、標準機能で不足するサービス固有の原子的な規則を補う。

## R6: 共有制限・配送障害

**Decision**: DBで対象/接続元の予約と確定失敗を原子的に数え、送信quotaは存在検索の前に使う。メール対象の有無と個別SMTP結果で公開応答を変えない。
**Rationale**: 多重プロセス・同時要求で迂回できず、登録の存在を公開しない。送信前にdigestを確定し、rawtokenの永続再送は行わない。
**Alternatives**: プロセス内counterだけ、偽装可能な転送header、個別送信エラーの公開、期限なしロックを採用しない。
**Sources**: [Nodemailer SMTP options](https://nodemailer.com/smtp)、[SMTP errors](https://nodemailer.com/errors)。本番は固定host/from、TLS必須、証明書検証、有限timeout、file/url access無効、debug/logger無効。通知のみ秘密なしの永続再送を許す。

## R7: GitHub再認証

**Decision**: サーバーのReauthIntentを現在sid/User/世代/既存GitHub Accountへ結び、標準OAuth成功が同じAccountであるときだけ証明を確定する。
**Rationale**: 通常ログインのprovider名や時刻では、現在の本人が明示的に再認証したことを証明できない。標準state/PKCEを維持し、追加確定のTXでメールと証明を再検証する。
**Alternatives**: URL nonceだけ、クライアント入力の時刻、メール一致、通常session更新を再認証と扱う設計を採用しない。
**Sources**: ローカルAuth.jsのhandle-login/callback経路、[公式callbacks](https://authjs.dev/reference/core)。これは標準拡張点での業務証明でありOAuth機構の自作ではない。

## R8: GitHubの設定と利用可否

**Decision**: server-onlyのprovider設定解決処理を設け、AUTH_GITHUB_ID/AUTH_GITHUB_SECRETの両方が存在し、それぞれ空文字・空白だけではない場合だけGitHubを登録する。余計なGitHub ON/OFF flagは追加しない。検査にtrimを使っても非空の秘密値を無断で変換しない。公開情報はgithub:booleanだけとし、画面・標準provider一覧・直接要求guardが同じ設定状態を使う。
**Rationale**: 変更前のsrc/auth.tsはGitHubを無条件登録していた。インストール済み@auth/core/lib/utils/env.jsは資格情報を補完するが、未設定providerを自動で除去しない。
**Alternatives considered**: UIだけ非表示、環境推論任せ、複数の独立flagは登録/表示/実利用がずれる。外部OAuthへ起動時に問い合わせる方法は不要な起動依存を増やす。
**Evidence**: ローカルsrc/auth.ts、src/components/header.tsx、installed Auth.js env推論と標準handler。調査エージェントでモデル境界・依存順を分担確認した。

## R9: メール先行と条件付きOAuth検証

**Decision**: 必須のメール・JWT失効・メンテナンス・既存保護操作を先に実装し、外部GitHub資格情報なしで受け入れ検証する。GitHubのadapterガード・receipt・再認証proof・追加は条件付き機能として同じ共通基盤へ接続する。制御されたOAuth fixtureで標準SDKを通す自動回帰は実装の要件として維持し、外部アプリでの実接続はGitHubを実際に有効化するときの別ゲートにする。
**Rationale**: 未登録のOAuthアプリをメール機能の導入条件にすると、FR-020とメール先行の目的を満たせない。GitHubを削除する必要はない。
**Alternatives considered**: GitHub機能の撤去、資格情報待ちで全作業停止、自動試験を実OAuth確認として記録することは採用しない。

## R10: 無効時の既存データと要求

**Decision**: 無効時のsignin/callback/再認証/ADD操作を処理前に拒否し、User/Account/credential/Intentを変更しない。既存の有効sidの通常session/logoutは引き続き失効・期限を検証して扱い、provider設定除去だけでUserやログイン記録を削除しない。GitHub-only利用者へメール一致やresetでpasswordを付与しない。
**Rationale**: 設定の除去は認証方法の利用停止であり、所有データの移行や権限変更ではない。メール資格情報がある利用者は同じUserでメールを使える。
**Alternatives considered**: 自動統合・強制User削除・再認証の代替としてメールのみを認める方式は本人確認を弱めるため拒否。
