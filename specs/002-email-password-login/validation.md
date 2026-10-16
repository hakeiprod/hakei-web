# Validation: メール＋パスワード認証

## 基準と対象

開始時のコード版: 5c15943。既存GitHubはAuth.js database strategy、User IDとDBのserviceRoleで認可する。001/003の確定済み回帰（単体451件・統合45件）を基準とする。今回の導入前に追加依存を検証し、既存の所有参照を維持する。

保護書き込みはapp/actionsのrunAction→requireActor→各serviceの取引、およびimport APIの認証・worker/確定取引。Gitはacceptance/adopt/publicationの順序を維持してsid世代検証を接続する。具体的な移行事例でUser ID/role/楽譜/練習/信頼度の件数と所有者を比較する。

## 実装前分析の修正

認証POSTのストリーム実測16KiBを解析前に適用するため、ドメイン操作を専用Route Handlerへ集約する。既存の楽譜操作のServer Action本文上限25MBは維持。GitHub再認証の開始期限と完了後proof期限を15分ずつ定義し、テスト先行T004を共通実装の前提にした。

## 実行環境

Node22 Alpine/muslと専用PostgreSQL_test DB、テスト専用Git領域。Gitignoreとflat ESLintの生成/依存/秘密の除外を確認。Dockerfile・Prettier設定・公開npm package・Terraform/Helmはなく不要なignoreは追加しない。秘密設定の値は記録しない。

## 依存の根拠

[公式Argon2](https://github.com/ranisalt/node-argon2)と[公式SMTP API](https://nodemailer.com/smtp)の公開API・運用条件を確認。npm registryでargon2 0.45.1（MIT）とnodemailer 10.1.1（MIT-0）の版・エンジンを確認。auditと実hash/verify、捕捉SMTPの結果は確認後に追記する。

## T002の検証結果と停止理由

- npm registry確認: argon2 0.45.1はMIT・Node>=16.17、nodemailer 10.1.1はMIT-0・Node>=20。npm aliasでpeer競合なくinstall成功。
- Node22 Alpine/musl: Argon2id 64MiB/t3/p1のhash、正しいpasswordのverify、誤passwordの拒否が成功。streamTransportを使うメモリー内のメール捕捉も成功。実配送ではない。
- lockfile全体audit: 36件（critical2/high27/moderate6/low1）。変更前HEADのlockfileでも同じ36件。argon2/smtp-mailerに新しく増えた項目はない。
- 互換範囲のnpm audit fixはnpm内部エラー（null.edgesOut）で失敗。npm11の再試行はECONNRESETで失敗。--forceやNext/Prismaのダウングレードは行っていない。
- T002は未完了。npm ciの再現確認、全体auditの解消とNode22 glibc環境の実行は未通過。後続の共通認証実装へ進める条件を満たさないため、既存認証は変更していない。
- plan.mdの「依存auditを通すことは導入ゲート」、implementスキルの非並行タスク失敗時に停止する規則に従う。次の再開では依存ゲートの解消から進める。

## 終了時の回帰

npm lsで固定版とpeer状態を確認。既存単体451件/65ファイル成功。文書リンクとgit diff --check成功。認証ソース・DB・ログイン方式はまだ変更していない。変更した依存と設計文書は未コミット。

## T002の再開検証（2026-10-14）

- requirements.mdは16/16項目が確認済み。拡張フック設定は存在しない。
- npm auditを再実行し、36件（critical2/high27/moderate6/low1）が残ることを確認。結果は/tmp/hakei-auth-resume-audit.json。
- npm audit fixを現在の依存範囲内で再試行したが、Cannot read properties of null (reading edgesOut)で失敗。ログは/tmp/hakei-auth-resume-audit-fix.log。
- T002は未完了のまま。非並行タスク失敗時の停止規則に従い、T003以降と認証ソース・DB変更には進んでいない。次はnpmの依存解決エラーを切り分け、互換性を検証しながら依存ゲートを解消する。

## T002の依存解決切り分け

- npm10.9.2のArborist peer解決でnull.edgesOutが発生。npm11.21.0のnpm update --package-lock-only --ignore-scriptsでは解決が成功した。npm10の同一処理が修正されたとは扱わない。
- 指定範囲内の更新候補ではauditが36件からhigh10件へ減少し、criticalは0件。522パッケージに変更が及ぶため候補lockを/tmp/hakei-t002-repair/updated-package-lock.jsonへ退避し、未検証の変更を適用せず元のlockへ戻した。node_modulesは変更していない。
- 残る警告はbracesとdeepmerge-tsから波及。bracesの[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)には修正版がない。deepmerge-tsの[GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)は8.0.0未満が対象で、Prisma6の現在の依存範囲外。
- 全体auditの解消という現行ゲートは未通過。npm ci/glibcと認証実装へは進んでいない。次の設計判断は、既存開発ツールの警告について利用経路・入力到達性を評価し、期限と対応方針を記録した受け入れ基準へ改定するか、関連ツールの移行で依存を除去するか。audit結果を隠す設定や未検証の強制更新は導入しない。

## 残存警告の利用経路評価と受け入れ条件

- braces: eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces。lockではdev依存。get-root-dirs.jsがsettings.next.rootDirをglobへ渡す。現行eslint.config.mjsはrootDirを設定せず既定cwdを使い、HTTP/MIDI/アップロードを渡すアプリ経路は検索で見つからない。影響は深いbraceパターンによるプロセス停止。緩和はlint設定を管理されたリポジトリ設定に限定し、外部入力をglob設定へ接続しない。
- deepmerge-ts: Prisma CLI/@prisma/configがc12設定読み込みのmergerとして利用。loadConfigTsOrJsはrcFile/giget/extend/packageJsonを無効化し、管理されたprisma.config.tsを読む。生成済みClientは@prisma/client/runtime/libraryを使い、アプリはprisma/configをimportしない。lockのdev:falseだけを本番到達性の根拠としない。影響は再帰グラフのマージによるプロセス停止。緩和は生成/移行設定を固定し、HTTP由来の設定や再帰グラフを渡さない。
- 上記は静的経路調査に基づく限定的評価であり、全依存に脆弱性がない保証ではない。次回依存更新時・本番公開前・遅くとも2026-11-14に再評価する。上流修正版または互換性を確認した移行が可能になったら更新する。設定を外部入力へ接続する変更ではこの判断を再利用せず再審査する。
- ユーザーが基準見直しを指示。auditを継続し、未評価警告・到達可能な危険経路は不合格。新規argon2/smtp-mailerへの警告がなく、上記の限定と期限を記録できても、npm ci/hash/SMTP/回帰・環境検証が失敗または未確認ならT002を完了にしない。

## T002改定基準による最終検証

- npm11で指定範囲内のlock更新を解決し、最終lockはnpm10.9.2のnpm ciでも再現成功。npm11の新しいinstall-script制限に頼らず既存npmで検証した。
- jsdomは27.1.0、remedaは2.32.0へ固定して既存型互換性を維持。Vitest4.1.11ではNode FileとブラウザーFormDataの混在を解消し、ファイル名保持のアサーションを維持した。
- 最終audit: high10/critical0、他0。新規argon2/smtp-mailerへの警告なし。残存警告は上記の入力到達性と期限に基づき限定的に受け入れる。
- Node22 musl: Argon2id64MiB/t3/p1 hash/正しいverify/誤password拒否、SMTPメモリー捕捉成功。
- 公式Node22.16.0 Linux binaryを一時領域のDebian glibc2.41 loaderで起動し、同じhash/verify/SMTP捕捉成功。C++共有ライブラリのversion情報警告あり。これはglibc native smokeであり、完全なUbuntu CI再現ではない。通常Ubuntu CIでの回帰も継続する。
- 単体451/451、専用DB統合45/45、tsc、変更箇所eslint、本番build成功。実SMTP配送とは扱わない。
- 改定T002条件を満たしたため完了。以降の実装へ進む。

## T003の設定基盤

- server-onlyのauthenticationConfigで方式停止、公開origin、SMTPヘッダー/資格情報/port、rateSecret、初期制限、proxy opt-inを検証。メール未設定でOAuth起動を妨げないよう必要時に解決する。GitHub資格情報を読む処理は含めない。
- テスト用設定・GitHub設定fixtureと、実SMTPへ接続しないstreamTransport helperを追加。既存_test DB保護を再利用する。
- 設定境界テスト7件、変更箇所lint、tsc通過。ログイン方式自体の接続は後続タスクであり、メールログインを実装済みとは扱わない。
- T002のproduction build追跡*.nft.jsonではbraces/deepmerge-ts/@prisma/configへの参照0件。これは今回ビルドの静的追跡結果であり、今後の設定変更や動的ロードへの保証ではない。

## T004からの共通基盤実装

- T004: input/sessions/challenges/rate-limitの4テストファイルを先に追加。単体1/統合3ファイルが未実装モジュールで失敗することを確認。テスト追加の完了であり、統合挙動の成功ではない。
- T005〜007: User.authVersion、Identity/credential/head/challenge/sid/proof/rate/attempt/change/notice/receiptを追加。Prisma validate成功。AuthNoticeの本人はevent.userIdを参照し重複列を持たず、User削除はevent経由でcascadeする。
- T008: Prisma生成migrationはprisma/migrations/20261014215342_email_password_auth/migration.sql。専用hakei_testに適用しClient/Zodを正式生成。本番DBは変更していない。移行helperはmaintenance中のtable lockで既存メールを保全し、衝突/不正メールはopaque User IDだけ報告し、自動統合しない。移行の専用DBテスト1件成功。
- T011: 純粋Zod入力スキーマを追加、正規化/別名保全/CRLF/コードポイント/原文保持/client権限入力拒否の7件成功。解析前本文16KiB境界の接続はT015で実装する。
- sessions/challenges/rate-limitは未実装のため、これらの先行テストはまだ失敗する。全体型検査・統合回帰の成功とは記録しない。

- T009/T014: provider設定行列は未実装で失敗することを確認してから共通判定を実装。入力7件とprovider7件の計14件が成功、lint成功。秘密のtrim変換をせず、公開DTOはgithub:booleanのみ。Auth.js/provider一覧/UI/直接要求の接続は後続タスクで行う。

## 共通認証処理（T010/T012〜013/T015〜018）

- T010/T015: 先行テストの未実装エラーを確認後、実測16KiBのbounded read、固定Origin/JSON、UTF-8 fatal decoding、無効GitHub signin/callback GET/POSTと再認証/ADD拒否を実装。標準Credentials handlerには再構築したNextRequestを渡し、標準CSRFを変更しない。超過時はhandler副作用0。domain入口への実接続はT030以降。
- T012: Argon2id64MiB/t3/p1、同時2/待機8/待機5秒/処理10秒。タイムアウト後も実処理が終了するまで枠を解放しない。未知対象はdummy hashで照合。公開ライブラリのPHCパラメーター順序に依存しないテストで検証。
- T013: SMTPの必要時ロード、固定host/from/構造化recipient/fragment案内、TLS/証明書検証/有限timeout、ログ/file/url access無効を実装。accepted/rejectedと送信例外は秘密なしの内部結果。実配送ではなくtransport fixture試験。
- T016: DB clock固定window、HMACキー、mailbox→sourceのlock順、pending予約、単回確定、期限後成功の拒否。x-auth-client-ipは管理済みproxyが上書きする設定時だけ利用し、不正・欠落・未信頼headerはunknownへ集約。生メール/IPをrate記録へ保存しない。
- T017: digest保存、head generation再発行、目的/世代/メール/期限照合と単回消費。ADDは現在sid/世代と完成proofへ結び、無効GitHubを拒否。SMTP/hashはTX外で後続domainへ接続する。
- T018: User→sid共有lock、資格情報version再照合、個別logoutとUser世代増加/全sid/案内/proof失効。別接続の失効競合と複数sid拒否を確認。
- 全単体481件・全DB統合52件成功。その後の不正UTF-8と接続元header補強は認証単体32件で成功。型検査/lint/build成功。期限ちょうどの拒否では時計のみ制御し、DBの単回消費とrollbackは実DBで検証。
- Auth.jsはまだdatabase strategy。JWT decode接続/全サービス認可/本人表示/メール登録等はT019以降で実装する。ログイン方式全体が完成したとは扱わない。T001〜T018の18/57件が完了。

## T019〜T023 Auth.jsと保護操作の接続

- T019: 標準JWT/encode/cookieを維持し、公開decode後にDBのsid/User/世代/期限を照合。初回jwtだけsidを作り、refresh/session.updateのclient値を使わない。標準signOut eventで個別sidを失効。actorへsid/authVersionと現在DBのroleを渡す。GitHubは必須設定が揃う場合だけ標準providerへ登録。CredentialsはUS1の照合を接続するまで常に拒否。
- 旧DB Session cookieはJWT戦略で受理しない。既存ログイン状態の再ログインが必要になる。運用切替・旧Session無効化の本番作業はT050で実施し、ここでは本番DBを操作していない。
- T020: 標準handlerの書き込みを既存leaseへ接続。decodeが確認したincoming actorのみ要求scopeへ記録。DB照合失敗のflagを保持してadapter操作を拒否し、SDK内でエラーを捕捉されても失敗した要求からCookie変更を返さない。
- T021: runActionで認証contextを渡し、repository/proposal/trust/practice/history/score作成・Git採用の確定TXでUser/sid共有lockと世代を再確認。scopeのない内部書き込みは拒否する。テストfixtureには専用DBのsidを付与し、Git子プロセスも_test DBの既存sidだけで動かす。旧actorの失効後書き込み/receipt作成0と、元のクラッシュ復旧7ケースを確認。
- T022: 前景15秒の公開getSession確認は成功時に練習リソースを維持。背景/BFCache/通信不能では本人表示を隠してunmount、現在のID/sid/世代が一致する再確認後のみ表示。遅延応答を世代で破棄し、同時確認は1件まで。イベント/intervalをcleanupする。
- T023: 固定SDKの実Auth handler・標準JWTでsession取得、client更新偽装拒否、CSRF取得→標準signOut→旧cookie拒否、未設定/一部設定provider一覧と直接OAuth拒否を検証。DB照合失敗時のadapter拒否とCookie非返却も検証。実OAuth確認の代替とは扱わない。
- 全単体485件、全専用DB統合56件成功。追加DB失敗シナリオも成功。型検査・lint・本番build成功。新しいAuth.js Session型へ既存テストを更新した。T001〜T023の23/57件完了。メール登録/login/reset/change/US3と実配送は未実装・未確認のまま。

## T024〜T033 メール登録・標準Credentials接続

- 申請時のパスワードは形式チェックのみ。PENDING/VERIFYにはdigestだけ保存し、所有者が確認画面で指定した最終パスワードをArgon2idで確定する。User/credential/VERIFIEDと単回消費は同じTX。新規roleはUSER、確認後の自動loginなし。
- 2つのDB接続の同時確定で成功1件、第三者の申請パスワードと競合敗者の最終パスワードの拒否、再発行による旧案内拒否、SMTP失敗と既存Userへの同一ACCEPTEDを確認。目的・期限境界・世代・PENDINGへの再発行は共通challengeテストも併せて確認。
- 移行時の索引欠損/正規化衝突を保全するため、要求時に既存User.emailを純粋スキーマで照合し、確定時はusers table lock後に再確認する。既存メールの走査は件数に比例する。大規模運用への拡張は索引移行完了を確認してから最適化する。GitHubの新規作成との統合保護はT043で完成させるため、GitHub有効化受け入れは未完了。
- 標準Auth handler/cookie jarによる登録→確認→Credentials login→session→標準signOut→再loginを確認。未知/未確認/誤password/資格情報なしの既存アカウントは同一CredentialsSignin。client指定role/authVersionを採用せず、資格情報version/世代をsid作成時に再照合する。sid期限と旧世代照合競合は共通session回帰で検証。
- GitHubのIDだけ設定した場合にもprovider一覧がCredentialsのみでメール操作は成功。未設定/一部/空白の一覧と直接OAuth拒否は既存SDK/providerテストを維持。実GitHubOAuthの確認ではない。
- 登録/再送・確認ページと秘密操作専用Route Handlerを接続。URL fragmentはuseSyncExternalStoreの購読時に除去してからフォームを表示し、画面寿命に閉じたConfirmationLinkオブジェクト内で保持。StrictMode、GET非消費、明示POST、リンク欠落、標準loginへの案内をUIで確認。コピー/パスワード管理用autocompleteを使用、コードポイント規則は共通スキーマを再利用。
- /auth/*にno-store/no-referrerを設定。固定Origin不一致/過大JSON/不正JSONはDB操作0で拒否。秘密を受ける公開Server Actionを追加せず既存25MBを維持。SMTP/status更新失敗も固定案内を保ち、ログには秘密を出さない。
- T024とT026は未実装エラーを先に確認した。T025のSDKテストは照合実装後に追加しており、テスト先行の手順を満たしていない。この手順上の逸脱を後からred実行したようには扱わない。
- 全単体487件・全専用DB統合60件成功。その後のStrictMode/リンク欠落/API副作用境界の単体3件と、再発行/一部設定を含む登録・Credentials統合4件も成功。既存楽譜認可・履歴・信頼度・Gitクラッシュ復旧の統合回帰も維持。最終型検査、全体lint、本番build、変更コードのPrettier、git diff --checkはすべて通過。
- T001〜T033の33/57件完了。T034以降のreset/change/通知/追加・運用・実配送受け入れは未完了。本番メール開放はUS2とT054/T056の必須ゲート通過後。実SMTP配送や実OAuthを済ませたとは扱わない。001/T079の保留と003の完了は変更しない。

## T034〜T040 再設定・変更と全端末失効

- T034/T035のDB/UIテストを先に追加し、未実装モジュールの失敗を確認してから実装した。
- requestPasswordResetは共通send quotaを対象検索前に消費し、確認済みcredentialだけにRESETを発行する。未登録/未確認/OAuth-onlyは同じACCEPTEDで、資格情報を追加しない。SMTP失敗でも案内を変えず、raw tokenの永続outboxを作らない。
- resetPasswordはTX外hash後、既存challengeのUser→identity/headのlockと目的・世代・メール・期限の再照合を使用。credential.versionとUser.authVersionの更新、単回消費、全sid/案内/proof失効、変更イベント/通知予約を同じTXで確定する。
- changePasswordは現在sidと共有quota付きcurrent password照合を要求。照合したversion/世代/emailを確定TXで再照合し、現在端末を含め全失効する。resetとchangeの2接続競合で確定1件、イベント1件、世代増加1回、旧password/旧sid拒否を確認。
- 登録UserのID/roleを維持し、期限切れ・再発行・同一案内の同時消費・誤current passwordを拒否。Credentials/GitHub両sidの標準JWTを実Auth handlerへ渡し、reset後の旧Cookieのsessionがnullになることを確認。既存の保護書き込みの世代再照合と前景15秒/背景復帰/通信不能の本人表示cleanupは全体回帰でも維持。
- AuthChangeEvent/Noticeには変更根拠と送信先だけを保存。workerはSKIP LOCKED/60秒claim、有限SMTP timeout、失敗時のbackoff、期限切れclaim回収を使用する。SMTP受理後のDB更新失敗等は通知が重複し得るat-least-onceであり、変更を重複実行しない。配送失敗後もイベントを保持し、再試行2回目のDELIVEREDを専用DBで確認。
- /auth/reset、/account/security、Header入口、秘密操作APIを接続。RESET fragmentをURLから除去してから明示POSTで確定し、成功後はパスワード入力を消して通常loginへ誘導する。変更成功時は標準getSessionでSDKの本人状態も更新する。新規hookのAbortControllerはunmountで中断する。
- 全単体492件、全専用DB統合63件成功。その後に追加した未確認対象/更新競合を含むDB4件も成功。最終型検査・全体lint・本番build・変更範囲のPrettier・diff checkはすべて通過。実SMTP配送・実OAuthは実施していない。
- T001〜T040の40/57件完了。T041以降の条件付きGitHub接続と横断/運用/実配送受け入れは未完了。T054/T056通過前に本番メール開放済みとは扱わない。001/T079保留、003完了を維持する。

## T041〜T047 条件付きGitHub再認証・資格情報追加

- 基本の再認証・追加・adapter回復・UIのテストを先に追加し、未実装エラーを確認した。実SDK OAuth fixtureと追加拒否ケースは結合時に追加しており、全受け入れテストを実装前にredにしたとは扱わない。
- 専用テストPostgreSQLが停止していたため既存の/tmp/hakei-pgを再起動した。初回のDB接続失敗は挙動の不合格と混同せず、再起動後に実DBで検証。本番DBを操作していない。
- protectedOAuthAdapterは標準PrismaAdapterの公開操作を継承し、User作成/Account連携/メール検索/更新にドメインの保護を加える。標準signIn callbackが受けたGitHub Accountだけを要求scopeに保持。共通EmailIdentityを参照し、移行中の未索引/正規化衝突も既存User.email照合で保全する。PENDING予約はUser作成と同じTXで失効・OAUTH_BOUNDへ移す。
- 初回作成とlinkAccountの間で失敗しても、同providerAccountIdのPENDING receipt、未使用USER/世代0、Account/credential/session/所有・演奏・信頼度データなしの場合だけ同じ仮Userを回復。別Account/確定済みUser/メール一致自動連携を拒否する。OAuth access/refresh/id tokenは新しいAccount行に保存しない。既存Accountの削除や資格情報の自動付与は行わない。
- beginGithubReauthは有効sidと既存Accountへ15分Intentを結ぶ。標準OAuth callback中のdecodeが検証したincoming actorだけを使い、同Account/User/世代の成功で新sid発行・proof移管・旧sid失効を同じTXで確定。最初の成功時だけcompletedAt+15分にし、通常refresh/偽nonce/client session.updateでproofを作らない。期限ちょうど、期限超過、別Account、同時移管、失効済みsidを拒否。
- ADD発行は同じ有効sid/現在メール/完成proofを要求。最終POSTはTX外hash後に現在メール・Account・案内・proof・世代を再照合し、同じUserへcredential/VERIFIEDを追加、proof消費・全失効・秘密なし通知を同時確定。GitHub無効時はhash/DB処理前に拒否し、既存proofや案内を消費しない。
- 実Auth handler/cookie jarで標準PKCE/state/CSRF→GitHub callback→新規User→link失敗→receipt回復→再認証→ADD確認→Credentials login→再度GitHub loginを確認。外部token/userinfo応答だけをfixtureに限定し、callbacksを成功mockで代用していない。state改ざん、失効callback、email-onlyへのGitHub追加、別Accountを拒否。User ID/役割・楽譜所有者・信頼度を前後比較し不変。既存演奏履歴/認可/Git復旧の全体回帰も維持。
- /account/securityとADD fragment確認を接続。GitHub無効時の操作非表示、メール欠落時の説明、空のdomain入力のstrict検証、直接要求でDBアクセス0、現在ブラウザーのsid必須、最終POSTだけの確定を確認。標準signIn以外のOAuth/cookie/state暗号機構を作っていない。
- 全単体497件、全専用DB統合69件成功。単体の初回実行では既存score-viewerの5秒timeoutが発生し、ビルド終了後にmaxWorkers=2で全件再実行して成功。ADDフォームのラベル不一致とlint条件式は修正後に再検証。最終adapterのSDK/回復2件も再実行して成功。型検査・全体lint・本番build・変更範囲の書式/diff checkも通過。
- T001〜T047の47/57件完了。T048以降の横断・保持/移行・負荷・実配送・方式切替の受け入れは未完了。制御されたSDK OAuth試験は、実GitHubアプリでの本人操作T055の代替ではない。SMTP実配送T054も未確認。本番メール開放/実GitHub有効化受け入れの完了を主張しない。001/T079の保留と003の完了を維持。

## T048〜T053 横断・保持・切替/復元・負荷・設定遷移（2026-10-16）

- T048: 未登録/PENDING/VERIFIED/OAUTH_BOUNDの登録・reset要求をSMTP timeout例外で比較し、同じACCEPTEDと同じmailbox超過RETRY_LATERを確認。例外へ意図的に含めたpassword/tokenがDB/ログ/DTOへ出ないことを確認。ブラウザーはfragmentを即除去、Web Storageへの保存0、GET非消費を検証。既存の本文制限/role/source/nonce拒否、no-store/no-referrerと標準SDK失敗応答の試験も維持。
- T049: cleanupの未実装エラー確認後に実装。DB時刻でchallenge/proof/sidを非有効化から7日、attempt/windowを期間終了から24h、変更イベント/通知を90日で回収する。bound Identity/User/Account/receiptは削除しない。PENDING回収はIdentity lockと再照合、1回500件まで。発行中の別接続との競合で新しい案内が消えないこと、有効な案内・sid・最近の通知の保持、期限後の削除、User削除cascadeを確認。CLIはmaintenance write leaseを使用。
- T050: 切替失効helperの未実装エラー確認後に実装。全User世代増加、旧Session削除、sid/案内/proof失効を同一TXで実施し、User/Account/資格情報/所有・履歴を保持。専用DBでmaintenance中の新規lease拒否と再失効を確認。
- T050の物理復元: 専用hakei_testのfixtureをpg_dumpで保存し、新規hakei_auth_restore_20261016_testへpg_restore。実CLIをmaintenance gate下で実行し、User/Account/楽譜件数、OPERATOR role、所有User IDの維持、旧Session0、標準Auth.jsで旧Cookie拒否、新鍵で旧JWT拒否を確認。作成した復元用DBとdumpは後片付け済み。本番DB/本番secret/本番切替を変更していない。全レプリカの配布・旧鍵fallback除去・入口/worker停止の運用はdocs/email-password-auth.mdへ記載。
- T051: Node22/npm10のnpm ci --offline --no-auditで980 packagesを45秒で再現。最新auditはhigh10/critical0（braces・deepmerge-tsと既存開発/Prisma CLIの経路）で前回と同じ。新規argon2/smtp-mailerの警告なし。T002に記録した到達性・緩和・2026-11-14までの再評価基準を維持し、audit0とは扱わない。
- 全単体502件・全専用DB統合76件が成功。実Auth.js/Git/認可/演奏/履歴/信頼度の回帰を含む。lint整理後の公開応答/方式遷移DB2件、既定負荷unit4件、ブラウザー秘密保持4件も再検証。最終の型検査・全体lint・本番build・Prettier・diff checkもすべて成功。
- T052: Node22.16.0でArgon2id64MiB/t3/p1のhash/verifyを各30回実測。12同時要求のうち実行2/待機8を受理し、2件を拒否、上限超過受理0。既定の待機5秒/実行10秒と、deadline後も実作業完了まで枠を保持することは制御時計のunitで確認。共有DB別poolのquota/クラッシュ予約・単回確定の回帰も成功。

| 環境                        | hash中央値 / p95 / 最大(ms) | verify中央値 / p95 / 最大(ms) | peak RSS(MiB) | 受理 / 拒否 |
| --------------------------- | --------------------------- | ----------------------------- | ------------- | ----------- |
| Linux musl Node22.16.0      | 137.21 / 150.36 / 153.68    | 137.25 / 147.71 / 149.04      | 209.64        | 10 / 2      |
| Linux glibc2.41 Node22.16.0 | 137.72 / 165.14 / 184.20    | 136.85 / 155.97 / 169.08      | 212.63        | 10 / 2      |

- 再現: `node --conditions=react-server --import tsx scripts/benchmark-authentication.ts`。glibcは公式Linux binaryを一時Debian loaderで実行し、host libstdc++のversion情報警告あり。これはローカルnative測定であり、完全なUbuntu CIや本番負荷のSLO保証ではない。弱いhashへ変更していない。
- T053: 新しいAuth.js構成を作る単位で未設定→一部→設定済み→除去→復旧→除去を検証。標準Credentials login、provider一覧、無効GitHubの直接拒否、無効時session/logoutを確認。外部fetchが失敗するfixtureでもメール方式は継続。実際にsavePracticeした演奏履歴、同じUser/Account/credential/OPERATOR role/楽譜所有/信頼度の前後snapshotが一致。UIの設定行列は秘密を表示せず、利用可能なGitHub操作だけを表示。

### 残る受け入れゲート

T001〜T053の53/57件完了。T054は検証用SMTP/TLSと受信可能なテスト宛先が未指定のため実配送を行っていない。T055は実GitHubアプリと本人操作が未確認の条件付きゲート。T056のメール受け入れはT054が必須のため未完了。T057は以下の暫定照合までで、外部確認後の最終確定を残す。001/T079の保留と003の完了を維持する。

| 要件        | 自動検証の主な根拠                                               | 実環境で残る確認                  |
| ----------- | ---------------------------------------------------------------- | --------------------------------- |
| FR-001〜004 | auth-methods/input/registration/UI、migration/adapter            | T054登録・入力・実受信            |
| FR-005〜008 | credentials実SDK、sessions/challenges/rate-limit/disclosure      | T054の実リンク操作                |
| FR-009〜010 | password-recovery/change/notices、旧JWT・全sid拒否               | T054 reset/change/通知の実配送    |
| FR-011〜012 | GitHub実SDK fixture、proof/ADD/receipt・衝突拒否                 | T055本人OAuth/追加                |
| FR-013〜018 | disclosure/http/負荷/本人表示、cleanup/cutover/復元・通知        | T054の本人表示と実配送            |
| FR-019〜020 | providers/auth-methods/provider-transitions、GitHubなしメールSDK | T054メール、T055有効化前のOAuth   |
| SC-001〜002 | registration/credentials実SDKと3段階UI                           | T054実配送を含む利用              |
| SC-003〜004 | challenge競合、reset/change競合・全失効・本人表示                | T054複数端末の本人操作            |
| SC-005      | 同User追加・役割/所有/信頼度/履歴保全                            | T055実OAuth                       |
| SC-006〜008 | 公開応答・quota・秘密/本文境界・負荷・maintenance                | T054の実配送と利用                |
| SC-009〜010 | 設定行列・再構成と実履歴snapshot維持                             | T054メール、T055の独立した実OAuth |

## コミット前レビュー

- T054の実配送はユーザー指示で保留。T054〜T057の未完了状態と本番開放保留を維持する。
- 再認証後にGitHub Accountを差し替えると旧proofでADD確定できる再照合不足を回帰テストで再現。発行/消費時の共通checkProofで現在のproviderAccountId/Userを再照合し、変更後はINVALID_CHALLENGEで拒否するよう修正した。秘密と案内の消費は失敗TXでrollbackする。

- 標準GitHub signIn開始の通信失敗をUIで捕捉し、内部エラーを出さず再試行の固定案内を表示するよう補強した。

- レビュー修正後の全単体503件・全DB統合76件、最終Accountロックを含むSDK/追加2件、型検査・全体lint・本番build・diff checkが成功。実SMTP/OAuth未確認と既存high10件の期限付き評価を維持したままコミットする。
