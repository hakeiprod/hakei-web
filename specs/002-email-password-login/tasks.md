# Tasks: メール＋パスワード認証と設定済みGitHubの条件付き提供

**Input**: `specs/002-email-password-login/` の最新設計

**Prerequisites**: [spec.md](spec.md)、[plan.md](plan.md)、[data-model.md](data-model.md)、[research.md](research.md)、[contracts/authentication.md](contracts/authentication.md)、[quickstart.md](quickstart.md)

**Tests**: 受け入れシナリオ、FR-001〜020/SC-001〜010と憲章IVに必要な意味・競合・境界の検証を含む。実装前にテストを追加し未実装の失敗を確認する。callbackのmockのみでSDKの動作確認を代用しない。

**Organization**: メール共通Foundation→US1登録/login→US2回復/変更→US3条件付きGitHub→横断確認。外部GitHub実資格情報はメールの前提にしない。

**Format**: `- [ ] TNNN [P?] [USn?] 説明とファイルパス`。パスはroot相対。同ディレクトリの省略名は直前のフルパスを基準に解決。migrationのtimestampはPrismaの生成値を使用し完了時に実パスを記録する。

**Progress**: T001は既存の基準記録を保持。T002は改定基準で完了。残存high10件の利用経路評価とnpm ci/native/回帰結果は[validation.md](validation.md)の通り。T001〜T053の実装・横断自動検証・専用環境の復元/負荷測定は完了。T054の実SMTP配送、T055の実OAuth、T056/T057の最終受け入れは未完了。旧番号の対応を末尾に記録する。

**Constraints**: 既存003の設計規約、User ID/role/所有・履歴、標準Auth.js暗号/cookie/CSRF/OAuthを維持。秘密操作は16KiB解析前制限付きRoute Handlerに集約。既存Server Actionsの25MBは維持。GitHubだけの設定・外部失敗でメールを停止しない。

## Phase 1: Setup

- [x] T001 既存認証とデータの基準を記録する — src/auth.ts、src/server/auth.ts、src/server/action-result.ts、prisma/schema.prisma、specs/002-email-password-login/validation.md。現在のJWT/DB Session経路と保護書き込みを列挙し、User ID/role/所有/履歴の比較事例を登録。003の既存モデル・命名・境界の規約を採用する
- [x] T002 依存の導入ゲートを実行する — package.json、package-lock.json、specs/002-email-password-login/validation.md。argon2 0.45.1とsmtp-mailer: npm:nodemailer@10.1.1を調査結果に照らし再確認。公開API、保守・脆弱性・ライセンス・peer互換性、npm ci/audit、Node22 Linux/Alpineで実hash/verifyとSMTP捕捉を検証してから採用する。auditは件数ゼロだけを条件にせず、追加依存に未評価の警告がなく、残存警告の依存経路・入力到達性・緩和・対応期限がvalidation.mdに記録され、関連回帰が通過することを条件とする。未評価・到達可能な危険経路は不合格。既存T002のaudit36件、npm修正失敗、glibc/npm ci未確認をvalidation.mdから引き継ぎ、既にインストール済みでもゲート完了とはしない
- [x] T003 検証環境と設定を用意する — src/server/authentication/config.ts、src/server/testing/authentication.ts、specs/002-email-password-login/quickstart.md。GitHub実資格情報は不要とし、設定を注入するfixtureを用意する。固定AUTH_PUBLIC_ORIGIN、SMTP、AUTH_RATE_SECRET、EMAIL_PASSWORD_ENABLED、trusted proxyと初期制限を検証。専用\_test DBとメモリーSMTP/テストOAuthを使い、本番秘密値や実宛先を記録しない

**Checkpoint**: 対象の実装と検証結果をvalidation.mdに記録する。

## Phase 2: Foundational - メール共通基盤

- [x] T004 共通モデルの検証と失効の回帰を先に追加する — src/server/authentication/input.test.ts、sessions.integration.test.ts、rate-limit.integration.test.ts、challenges.integration.test.ts。正規化、15〜128コードポイント、期限境界、世代・sid拒否、案内同時消費、別poolのquota予約と失効/書き込み競合を固定し未実装の失敗を確認する。T001〜T003完了後、このテストを共通実装より先に追加する
- [x] T005 追加認証スキーマを定義する — prisma/schema.prisma。User.authVersion int default0「変更/再設定/追加で増加。client指定不可。既存roleは維持、新規USER」; EmailIdentity normalizedEmail unique/userId nullable unique/state PENDING/OAUTH_BOUND/VERIFIED「trim+lowercase、別名/+は統合しない。PENDINGは所有の証明ではなくUserをまだ作らない」; PasswordCredential userId PK/FK/hash/version/日時「確定済みのみ。hashはArgon2 PHC。平文なし。User削除cascade」
- [x] T006 案内とログイン状態のスキーマを追加する — prisma/schema.prisma。AuthChallengeHead identityId/purpose/generation「複合一意。再発行時にgeneration増加。用途VERIFY/RESET/ADD_PASSWORD」; AuthChallenge id/headId/generation/tokenDigest unique/userId?/emailSnapshot/authVersion?/issuerSid?/reauthIntentId?/expiresAt/consumedAt/revokedAt/sendStatus「digest以外の秘密なし。ADDは本人sid/世代/証明必須。purpose/期限/最新generation/未使用をTXで検証」; AuthSessionRecord sid PK/userId FK/authVersion/method/日時「JWTのsidを照合。30日固定上限、user/version索引。rawJWTやcookieを保存しない」
- [x] T007 再認証・制限・監査・通知スキーマを追加する — prisma/schema.prisma。ReauthIntent id/userId/originSid/currentSid/authVersion/providerAccountId/日時「GitHub既存Accountに結ぶ。15分。OAuth成功により現在sidへ移管、通常refreshで完成しない」; AuthRateWindow kind/keyDigest/windowStart/windowEnd/limitSnapshot/count「複合一意、HMACキー。keyのkindはmailbox/source、用途login/send。全プロセス共通」; AuthAttempt id/mailboxWindow/sourceWindow/status PENDING/FAILED/SUCCEEDED/deadline「failure+pendingで制限。最大10秒後、未確定は失敗扱い。成功は予約を解放」; AuthChangeEvent id/userId/type/occurredAt/requestId「password/token/IP/mail本文なし。秘密以外の変更根拠を記録」; AuthNotice eventId unique/userId/recipientSnapshot/status/attempts/nextAttemptAt「変更通知専用、リンク/秘密なし。変更確定と同じTXで作成しSMTPはTX外」。OAuthCreationReceipt provider/providerAccountId複合一意、userId、PENDING/APPLIED、日時を追加する
- [x] T008 追加migrationと既存メール索引の移行を作成する — prisma/migrations/<generated_timestamp>\_email_password_auth/migration.sql、scripts/backfill-email-identities.ts、src/server/authentication/migration.integration.test.ts。生成された実パスを記録しPrisma型を生成。正規化衝突は自動統合せず該当メール追加を止めて匿名IDで報告。既存User.email/ID/role/所有を保持し、欠損索引でUserを再作成しない。旧Sessionの一括失効は切替手順で行う
- [x] T009 [P] provider設定の行列を先に検証する — src/server/authentication/providers.test.ts。両方未設定、IDのみ、secretのみ、空文字、空白だけ、両方非空を検証し、公開値がgithub:booleanだけであることと秘密非露出を確認する。空白判定にtrim()を使ってもAuth.jsへ渡す値を変更しないことを確認。起動時の純粋判定をテストし、外部OAuthへ問い合わせない
- [x] T010 [P] 認証本文の解析前制限を先に検証する — src/server/authentication/http.test.ts。16KiBちょうど/1byte超過、Content-Lengthなし/偽装、分割ストリーム、JSON/URLencoded、固定origin不一致、不明operationを確認。Auth.jsのCredentials POSTとdomain入口の両方で、拒否後に解析/hash/DB副作用を発生させない
- [x] T011 [P] 共通入力と秘密の境界を実装する — src/server/authentication/input.ts。passwordは「[...value].lengthの意味で15〜128コードポイント。空白やUnicodeを正規化しない。UTF-8入力と全本文16KiBを先に制限」。email単一形式・trim+lowercase、CRLF拒否。userId/role/source/世代はclientから受理しない
- [x] T012 [P] 公開Argon2 APIと負荷制限を実装する — src/server/authentication/password.ts、password.test.ts。Argon2id 64MiB/t3/p1初期値、同時2・待機8・5秒待機・処理deadline10秒。全体deadline後も実処理が終了するまで実行枠を解放しない。未知の対象もdummy hashで同じ照合コストとし、依存は遅延ロード、弱い方式へ自動切替しない
- [x] T013 [P] SMTP送信境界を実装する — src/server/authentication/mail.ts、mail.test.ts。固定host/from、構造化recipient、固定テンプレート。465secureまたはSTARTTLS requireTLS、証明書検証、接続/挨拶/socket有限timeout、logger/debug/file/url access無効。raw tokenは永続outboxに入れず、SMTP accepted/rejectedを内部記録する
- [x] T014 共通のprovider利用可否を実装する — src/server/authentication/providers.ts。AUTH_GITHUB_IDとAUTH_GITHUB_SECRETが両方存在し、それぞれ空文字・空白だけではない場合だけgithub=true。「公開する値はgithub:booleanのみ」。非空の秘密値をtrim変換せず保持し、欠落・一部・空白はfalse。画面・Auth.js構成・guardで同じ判定を使い、独立GitHub flagを追加しない
- [x] T015 16KiB解析前境界と無効providerの拒否を実装する — src/server/authentication/http.ts、src/app/api/auth/[...nextauth]/route.ts。実測でbounded readしてから標準Credentials handler/ドメインJSONへ渡す。Originは固定AUTH_PUBLIC_ORIGINと照合。無効のGitHub signin/callback GET/POSTは固定404、再認証/ADD操作はAUTH_METHOD_UNAVAILABLEで副作用なし。既存Server Actions25MBと標準CSRF/OAuthは維持し、秘密の公開Server Actionを作らない
- [x] T016 共有DBの利用制限を実装する — src/server/authentication/rate-limit.ts。DB時刻固定window、login15分 mailbox5/source20、send1時間 mailbox3/source10で用途合算。未知対象も同じHMACキー制限。「failure+pendingで制限。最大10秒後、未確定は失敗扱い。成功は予約を解放」。両キーを同じ順でlockし予約IDで一度だけ確定、trusted proxy以外無視・unknown bucket、超過は対象検索前に拒否する
- [x] T017 本人と目的に結ぶ単回案内を実装する — src/server/authentication/challenges.ts。「32byte乱数、base64url、digest固定長。rawはURL fragment→メモリー→POSTのみ」。VERIFY24h/RESET30分/ADDは15分以内proofにも結ぶ。headのgenerationをlockして更新し最新・未消費・未失効・DB時刻でexpiresAt未満をTX確認。SMTPはTX外、期限ちょうどを拒否する
- [x] T018 ログイン記録・世代と失効を実装する — src/server/authentication/sessions.ts。30日固定sid、User→sidのlock順、ログアウトは当該sid、設定/変更/再設定はauthVersion増加と全sid・案内・proof失効を同一TX。照合したcredential.version/authVersionをsid登録時に再確認し旧hashの成功を新世代へ昇格させない
- [x] T019 Auth.js JWTの標準decode後検証を接続する — src/auth.ts、src/types/next-auth.d.ts、src/server/auth.ts。標準JWT/encode/cookieを利用しdecode wrapperでUser/sid/世代/期限/失効をDB確認、OAuth callbackとlogoutも同じ経路。DB失敗はfail closed。標準jwt refreshとsession.updateでsid・証明・roleをclientから作らない。actorにsid/世代とDBの現在roleを渡す。共通providers判定で設定済みのときだけGitHubを明示登録し、未設定でもCredentialsと標準session/logoutを構成する。Credentialsの本人照合はUS1で接続し、未接続時に本人を受理しない。実OAuth公開はUS3のadapterガード完成後とする
- [x] T020 全認証書き込みをメンテナンスへ接続する — src/app/api/auth/[...nextauth]/route.ts、src/server/authentication/maintenance.ts、maintenance.integration.test.ts。provider判定/本文制限を共通境界とし、標準handlerと登録/消費/設定/ログイン記録/通知の書き込みを既存leaseに参加させる。要求スコープは標準decode済みincoming sidのみ。停止中の保留要求を後から無断確定せず、独自OAuth/CSRF/cookieを実装しない
- [x] T021 失効と既存保護書き込みを順序付ける — src/server/authentication/authorize.ts、src/server/action-result.ts、src/server/practice.ts、proposals.ts、merge-proposal.ts、repositories.ts、trust.ts、score-import.ts、practice-history.ts、authorization.ts。T001で列挙した全保護変更TXでUser/sid共有lockと現在世代を再確認。失効側は同順の排他lock。失効前に順序付いた操作と失効後の旧世代拒否を別接続で確認。Git確定とDB/Git復旧を壊さず認証contextを引き継ぐ
- [x] T022 本人表示とsession refreshを失効へ追従させる — src/app/providers.tsx、src/components/authenticated-content.tsx、authenticated-content.test.tsx。前景online15秒poll/focus確認、背景・BFCache復帰は検証前に本人表示を隠す。通信不能/認証エラー/logoutでunmountしMIDI・音声・購読を解放。画面が隠れてもサーバー認可を省略しない
- [x] T023 メール共通基盤とGitHub無効の標準SDK経路を検証する — src/server/authentication/authjs.integration.test.ts、specs/002-email-password-login/validation.md。標準session/signout・失効decode・refresh・旧Session拒否・別pool制限と失効競合を確認。未設定/一部設定のGitHub直接要求拒否、書込/外部要求0を確認。OAuthの設定済み正常経路はUS3に分離し、外部GitHub登録をFoundationの前提にしない

**Checkpoint**: 対象の実装と検証結果をvalidation.mdに記録する。

## Phase 3: User Story 1 - メール登録・ログインと利用可能な方式の表示 (P1)

**Goal**: GitHubなしで所有確認後にメールloginでき、利用可能な方式だけ表示する。

**Independent Test**: 未設定/一部設定でregister→confirm→標準login→logout→再loginを実SDK/cookie jarと専用DB/SMTP捕捉で確認。設定行列でUI/provider一覧/拒否が一致。

- [x] T024 [P] [US1] 登録と本人確定の契約回帰を先に追加する — src/server/authentication/registration.integration.test.ts。第三者が既知passwordで予約しても所有者の最終passwordだけ有効、確認前ログイン拒否、再発行・期限・別purpose・2接続同時確定、既存GitHub/メール衝突とPENDING回復を検証する。GitHub未設定/一部設定を含め、メール操作とGitHub非表示・provider一覧の一致を検証する
- [x] T025 [P] [US1] Credentialsの実SDK回帰を先に追加する — src/server/authentication/credentials.integration.test.ts。確認済みだけログイン、未知/未確認/GitHubのみ/誤passwordの同一公開応答、旧世代照合の競合拒否、ログアウト・再ログイン・30日期限と通常USER権限をcookie jarで検証する。GitHub未設定/一部設定を含め、メール操作とGitHub非表示・provider一覧の一致を検証する
- [x] T026 [P] [US1] 登録・確認画面の操作回帰を先に追加する — src/components/email-registration.test.tsx、auth-confirmation.test.tsx。3段階以内、貼付け/管理ツール、条件外入力、fragment即除去、GET非消費・POST確定、no-store/no-referrer、失効/再送の案内と自動ログインなしを検証する。GitHub未設定/一部設定を含め、メール操作とGitHub非表示・provider一覧の一致を検証する
- [x] T027 [US1] 登録要求と再送を実装する — src/server/authentication/registration.ts。requestRegistration/resendConfirmationは形式とquotaを検証しPENDING/VERIFYを発行。申請時passwordは形式確認のみで保存しない。「PENDINGは所有の証明ではなくUserをまだ作らない」。SMTP失敗・既存/不存在で同じACCEPTED案内、既存credentialを変えない
- [x] T028 [US1] 所有者の最終パスワードで登録を確定する — src/server/authentication/registration.ts。confirmRegistrationはTX外hash後、現在Identity/head/challengeのVERIFY・generation・メール・期限・未使用をlockで再確認。User/credential/VERIFIEDと消費を原子的に確定し、新規USER以外を付与しない。確認だけでは自動ログインしない
- [x] T029 [US1] Credentialsの本人照合と標準providerを接続する — src/server/authentication/credentials.ts、src/auth.ts。email/passwordだけ受理。quota予約後に確認済みcredentialかdummy hashを照合。本人確認versionをserver側だけで渡しT018のsid登録へ結ぶ。CredentialsSignin公開code一定、rate/DB/hash失敗を秘密なしで扱い、EMAIL_PASSWORD_ENABLED停止でもGitHubは維持
- [x] T030 [US1] 既存ActionResultに登録操作を公開する — src/app/api/account-auth/[operation]/route.ts、src/server/authentication/operations.ts。requestRegistration/resendConfirmation/confirmRegistrationを既存runActionの結果型に合わせ公開し、未認証で使う操作には認証必須wrapperを誤用しない。標準Auth.jsのCredentials POSTと専用domain Route Handlerでストリームを解析前に16KiB制限する。Server Actionsの25MBを全体で下げず、秘密を受ける公開Server Actionは設けない。固定originとの照合は既存importと同じ境界方式を用いる。VALIDATION_FAILED/INVALID_CHALLENGE/RETRY_LATER/MAINTENANCEと共通ACCEPTEDを固定し秘密をログに出さない
- [x] T031 [US1] 確認リンクをメモリーだけで扱う共通画面を作る — src/components/auth-confirmation.tsx、src/app/auth/confirm/page.tsx。固定originのfragmentからtokenを取りURL置換後に操作を受理。rawはstateからPOSTへ渡しstorage/analyticsへ出さない。GETで消費しない、再読込は再要求案内、目的別の確認処理へ接続する
- [x] T032 [US1] 登録とログイン入口を作る — src/components/email-registration.tsx、src/app/auth/register/page.tsx、src/components/header.tsx。メール＋password登録/再送と設定済みの場合だけGitHubの入口を提供。Auth.js標準signIn/signOut画面/APIを使用し独自cookieを作らない。登録・送信・確認の3段階以内、無効入力/制限/配送中の案内を提供する。Header/ログイン/securityは同じ公開利用可否を使い、未設定の空の選択肢を出さない
- [x] T033 [US1] US1の一連の利用と権限を確認する — src/server/authentication/registration.integration.test.ts、credentials.integration.test.ts、src/components/email-registration.test.tsx、specs/002-email-password-login/validation.md。登録→所有確認→標準login→本人履歴→logout→再loginを実SDKと専用DBで確認。未設定/一部設定のメール利用、private score、role/信頼度不変を記録しSC-001/002/006/007/008/009に照合する。GitHub設定済みの正常OAuth回帰はUS3のSDK検証で確認する

**Checkpoint**: 対象の実装と検証結果をvalidation.mdに記録する。

## Phase 4: User Story 2 - 再設定・変更と全端末失効 (P1)

**Goal**: メール資格情報の回復/変更と全端末失効をGitHubなしで利用する。

**Independent Test**: 確認済みfixtureでreset/changeを実行し旧password/旧sidの拒否、新passwordで同じ履歴、通知障害時の原子性を確認。

- [x] T034 [P] [US2] 再設定・変更と全失効の回帰を先に追加する — src/server/authentication/password-recovery.integration.test.ts。2端末/GitHub・Credentials両sid、旧password、同時token消費、期限/再発行、verifyとreset競合、未確認/GitHubのみの対象で追加なしを確認する
- [x] T035 [P] [US2] 再設定・変更画面と通知障害の回帰を先に追加する — src/components/password-reset.test.tsx、password-change.test.tsx、src/server/authentication/notices.integration.test.ts。current password不一致、無効リンク、成功後loginへ誘導、同一案内重複拒否、通知失敗時に確定済み変更を取り消さないことを検証する
- [x] T036 [US2] 再設定要求と確定を実装する — src/server/authentication/password-recovery.ts。requestPasswordResetは共通send quotaとACCEPTED、確認済みcredentialだけRESET30分発行。resetPasswordはTX外hash、User→sid→identity/head→challenge/proof→credentialのlock順、hash/version/authVersion・消費・全失効を同じTXで確定。自動loginなし
- [x] T037 [US2] ログイン中のパスワード変更を実装する — src/server/authentication/password-change.ts。changePasswordは有効sidとcurrent passwordのhash/version確認、TXで同じversion/世代を再確認して変更・全sid失効。本人端末も再loginが必要。旧照合とresetの競合で旧passwordを昇格させない
- [x] T038 [US2] 秘密なし変更通知と再送workerを実装する — src/server/authentication/notices.ts、scripts/deliver-auth-notices.ts。AuthChangeEvent「password/token/IP/mail本文なし」。AuthNotice「eventId unique」「変更通知専用、リンク/秘密なし。変更確定と同じTXで作成しSMTPはTX外」。notify障害は変更成功を保持しjobだけ再送、maintenance leaseを使う
- [x] T039 [US2] 再設定・変更操作と画面を接続する — src/app/api/account-auth/[operation]/route.ts、src/server/authentication/operations.ts、src/app/auth/reset/page.tsx、src/app/account/security/page.tsx、src/components/password-reset.tsx、password-change.tsx。requestPasswordReset/resetPassword/changePasswordを公開しfragmentの共通画面へ接続。変更は本人sid必須。公開文言を同一にし、成功後に旧本人表示を終了して標準loginへ案内する
- [x] T040 [US2] US2の全端末拒否と回復を確認する — src/server/authentication/password-recovery.integration.test.ts、notices.integration.test.ts、specs/002-email-password-login/validation.md。SC-003/004/006/008: reset/change後に旧password・旧cookieによる保護操作が0件成功、new passwordで同じ履歴を参照、別端末前景15秒/背景復帰/通信不能のcleanupを確認。GitHubなしでもreset/change/本人表示の試験を実行し、GitHub-only fixtureはresetで資格情報が増えないことを確認する

**Checkpoint**: 対象の実装と検証結果をvalidation.mdに記録する。

## Phase 5: User Story 3 - 条件付きGitHub接続と同一Userへの追加 (P2)

**Goal**: 設定済みの場合だけ安全なGitHub連携と本人再認証による追加を提供する。

**Independent Test**: 設定を注入した実SDK OAuth fixtureで同一Userと自動連携拒否・失効・receipt回復を確認。無効時はUIも直接要求も提供せず副作用0。

- [x] T041 [P] [US3] 本人再認証proofの回帰を先に追加する — src/server/authentication/github-reauth.integration.test.ts。標準OAuth callbackで同Account/user/有効originSid/世代に結ぶ証明だけ成功。15分境界、他Account/別sid/偽nonce/session.update、失効callback、移管同時実行を拒否する。設定を注入した自動試験で検証し、GitHub無効時は標準handlerへ進まず拒否・DB/外部要求0を確認する
- [x] T042 [P] [US3] 同一Userへの追加と衝突の回帰を先に追加する — src/server/authentication/password-addition.integration.test.ts、src/components/password-addition.test.tsx。メール未確認/変更後、proof切れ/消費済み、メール欠落、自動メール連携とemail-only→GitHub追加拒否、ID/role/信頼度/楽譜/履歴不変を検証する。設定を注入した自動試験で検証し、GitHub無効時は標準handlerへ進まず拒否・DB/外部要求0を確認する
- [x] T043 [US3] 標準OAuth adapterと初回作成回復を保護する — src/server/authentication/adapter.ts、request-context.ts、oauth-creation.integration.test.ts、src/auth.ts。標準callbacks.signInの検証済みAccountを要求スコープへ保持。createUser/linkAccount/updateUser/getUserByEmailを同じメール索引へ接続。最初のGitHub Accountだけ許可しメール一致自動連携を禁止。receipt回復は同じproviderAccountIdの未確定仮Userだけ。未所有PENDING予約はGitHub新規を恒久妨害せず失効できる。この作業はUS3に移し、設定を注入した制御可能なOAuth fixtureで固定版SDKの正常callback・失効callback・receipt回復を確認する。外部アプリ登録を作業の前提にしない
- [x] T044 [US3] GitHub再認証の開始と証明を実装する — src/server/authentication/github-reauth.ts、request-context.ts、src/auth.ts。ReauthIntent「GitHub既存Accountに結ぶ。15分。OAuth成功により現在sidへ移管、通常refreshで完成しない」。要求開始の15分期限を検証し、成功時completedAtから15分のproof期限を改めて設定する。有効sidから開始し標準signIn/state/PKCE、同providerAccountId callbackだけ完成、sid変更時は証明を新sidへTX移管して旧sid失効。URL/client時刻で証明しない。現在のgithub=trueを開始/完成前に確認する
- [x] T045 [US3] 追加のメール要求と最終確定を実装する — src/server/authentication/password-addition.ts。現在sid/世代・完成済み15分以内Intent・現在emailでADD発行。TX外hash後、同じ本人・現在sid・proof/メールsnapshot/案内世代/期限を1TXで再確認してcredential/VERIFIED・authVersion増加・全sid失効・proof/challenge消費・通知確定。新Userを作らない。「GitHub signup・receipt回復・Intent作成/完成・ADD発行/消費はgithub=trueのときだけ開始し、確定前も現在のサーバー設定を確認する」。無効時は案内/proofを消費せず拒否
- [x] T046 [US3] 本人設定に追加操作と案内を接続する — src/app/api/account-auth/[operation]/route.ts、src/server/authentication/operations.ts、src/app/account/security/page.tsx、src/components/password-addition.tsx、src/app/auth/confirm/page.tsx。beginGithubReauth/requestPasswordAddition/confirmPasswordAdditionを本人sid必須で公開。メール欠落・既存password・再認証不足を説明し、既存のsecurity画面と標準OAuth入口を使用する。github=falseでは再認証/追加操作を表示せず直接要求も拒否する
- [x] T047 [US3] 両ログイン方式の同一性と攻撃拒否を確認する — src/server/authentication/github-reauth.integration.test.ts、password-addition.integration.test.ts、specs/002-email-password-login/validation.md。SC-005/008: 正しい追加後GitHubとCredentialsで同じUserを参照。所有・role・信頼度・履歴の変更0、自動連携・異なる本人・未確認メール・期限超過の成功0、既存GitHub新規とreceipt障害回復も確認。これは制御された外部fixtureを通す実SDK試験。実資格情報でのOAuth確認とは別記録にする

**Checkpoint**: 対象の実装と検証結果をvalidation.mdに記録する。

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T048 全公開応答と秘密露出を検証する — src/server/authentication/disclosure.integration.test.ts、src/components/auth-confirmation.test.tsx。未登録/未確認/確認済み/GitHub-onlyへの失敗/要求/SMTP拒否/timeoutで文言・code・遷移・quotaを一致。DB/ログ/DTO/URL/referrerにraw password/tokenがないこと、client source/role/nonceで昇格しないことを確認する
- [x] T049 認証データの保持とcleanupを実装する — src/server/authentication/cleanup.ts、cleanup.integration.test.ts、scripts/cleanup-authentication.ts。「challengeは失効/消費/期限から7日、attempt/windowは期間終了から24h、sidは期限/失効から7日」「認証変更記録・通知は初期90日」。未確定Identityを関連案内がなくなってから回収し、期限切れで秘密を再利用させない。User削除cascadeとmaintenanceを確認する
- [x] T050 切替・復元の運用手順を作成して専用環境で検証する — docs/development.md、docs/email-password-auth.md、scripts/revoke-legacy-auth-sessions.ts、src/server/authentication/migration.integration.test.ts。全レプリカをmaintenance下で標準JWTへ切替、旧Session拒否・再login案内。メールflag停止でも設定済みGitHubを維持、rollback/backup restoreで古いsessionを復活させずAUTH_SECRET更新とsid/Session失効。既存User/role/所有件数の前後一致を記録する。本番切替はここで実行しない。GitHub無効のメール環境で切替を検証し、User/Account削除や自動資格情報追加をしない
- [x] T051 最新の全体回帰と依存検査を実行する — package-lock.json、specs/002-email-password-login/validation.md。npm ci/audit、実Auth.js経路、単体・専用DB統合、tsc、lint、build、Prettier、diff checkを実行。001のGit/認可/演奏/履歴/信頼度、003の設計互換性も回帰確認し、失敗や環境制約を記録する
- [x] T052 ネイティブhashと負荷の実測を記録する — scripts/benchmark-authentication.ts、specs/002-email-password-login/validation.md。Node22 Linux/Alpineでhash/verify各30回の時間・RSS、同時2/待機8/5秒/deadline10秒を確認。過負荷・クラッシュ予約・別poolの制限境界で超過受理0を確認し、要件を満たさなければ弱いhashへ切替えず解消する
- [x] T053 設定追加・除去・復旧の互換性を検証する — src/server/authentication/provider-transitions.integration.test.ts、src/components/auth-methods.test.tsx。同じUser/Account/credential/role/信頼度/楽譜/履歴を前後比較。無効時のsession/logoutは通常sid検証を継続し、GitHub-onlyのreset/メール一致でpasswordを付与しない。再起動単位の設定切替と外部障害時のメール継続を検証する
- [ ] T054 SMTP実配送とメール操作を検証環境で確認する — specs/002-email-password-login/quickstart.md、specs/002-email-password-login/validation.md。テスト宛先のSMTP/TLS実配送、3段階登録、reset/change後の本人表示を確認。本番宛先を自動試験にせず、送信先/資格情報がなければこのメール必須ゲートを未完了にする。メモリー捕捉を実配送として記録しない。GitHubの外部アプリ登録を前提にしない
- [ ] T055 GitHubの実環境OAuthを条件付きで確認する — specs/002-email-password-login/quickstart.md、specs/002-email-password-login/validation.md。設定済み検証環境で本人の標準GitHub login/再認証/追加・除去・復旧を確認する。未登録ならこの項目のみ条件付き未実施と記録し、メール受け入れへ依存させない。fixture試験を実OAuthとして完了扱いにせず、将来GitHub有効化前に実施する
- [ ] T056 GitHub未設定のメール受け入れを確定する — specs/002-email-password-login/validation.md。依存・ネイティブhash・SMTP実配送・本文制限・失効・秘密保護・移行のメール必須ゲートとFR-019/020・SC-009/010を照合し、未設定でも登録/確認/login/reset/changeが成功することを確認。実GitHub確認の未実施だけでメール完了を止めず、未通過の依存/SMTP等は完了扱いにしない
- [ ] T057 契約・要件と検証結果を最終照合する — specs/002-email-password-login/spec.md、plan.md、data-model.md、contracts/authentication.md、quickstart.md、validation.md。FR-001〜020/SC-001〜010を結果と照合し、実装に合わせた説明・運用・依存根拠を更新。未確認項目を完了扱いにせず、001のT079保留と003の完了を維持する。メール受け入れとGitHub有効化受け入れを別々に記録し、条件付き未実施の実OAuthを完了済みに見せない

**Checkpoint**: 対象の実装と検証結果をvalidation.mdに記録する。

## Dependencies & Execution Order

```text
Setup T001–T003 → Foundation T004–T023
  → US1 T024–T033
  → US2 T034–T040
  → US3 T041–T047（設定注入による自動OAuth検証）
  → 横断 T048–T054 → メール受け入れ T056 → 状態照合 T057
US3と横断確認 → T055（外部GitHub実確認、未設定なら条件付き未実施）
```

- T001は完了記録を保持。T002は改定基準で通過済み。T003の設定検証も完了。次はT054の検証用SMTP/TLS実配送と受信先の確認。T055は実GitHub利用前の独立した確認として残す。T003にGitHubの実資格情報を要求しない。
- Foundationのテスト: T004、T009、T010はSetup後に別ファイルで並行可能。T005→T006→T007→T008は同じschemaのため直列。
- 共通実装: T011/T012/T013はT004成功条件を定義し未実装の失敗を確認した後に並行可能。T014はT009/T011後、T015はT010/T014後、T016はT008/T011/T012後、T017はT008/T011/T013/T016後、T018はT008/T011/T012後。テストの未実装エラーを失敗として確認することと、実装後の成功確認を区別する。
- T019はT014/T018後、T020はT015/T019後。T015とT020はauth routeを共有するため直列。T021はT019/T020後、T022はT019後、T023はすべての基盤実装・回帰後。T023で設定済み正常OAuthを要求しない。
- US1: T024/T025/T026の検証はFoundation後に並行可能。T027→T028は同じregistration.ts。T029はT028後、T030はT029後、T031→T032はT030後、T033は全US1実装・回帰後。
- US2: T034/T035の検証はUS1後に並行可能。T036→T037→T038→T039→T040で回復・変更・通知・共通ルート/securityを接続する。メールの確認済みfixtureで独立に検証する。
- US3: T041/T042の検証はUS2後に並行可能。T043→T044→T045→T046→T047。src/auth.tsと共通route/securityの変更は直列。GitHubの設定・外部応答は制御したfixtureを使い、実OAuthアプリ登録を前提にしない。
- 横断はT048→T049→T050→T051→T052→T053→T054。最後にT056→T057。T055はUS3と横断確認後の独立したGitHub有効化ゲートで、T056の依存ではない。メールのSMTP実配送T054は必須のまま。
- T055が未設定で実施できない場合はcheckboxを未完了にし、理由を記録する。T056はメール受け入れ、T057はメール完了とGitHub条件付き未実施を正確に照合する。GitHubの実接続を済ませたとは扱わず、全57件完了も主張しない。
- [P]でも依存が未完了なら実装を開始しない。同じ専用DBで統合試験を実行する場合は既存configのfileParallelism=falseに従う。

## Parallel Examples

### US1

Foundation後、T024（登録契約）、T025（Credentials実SDK）、T026（登録/確認画面）は異なるファイルで並行可能。共通routeを更新する実装は直列に統合する。

### US2

US1後、T034（回復・全失効）とT035（画面・通知障害）の検証を別ファイルで並行可能。password更新・失効・通知のTX接続は順に行う。

### US3

US2後、T041（再認証proof）とT042（同一User追加）の検証を並行可能。環境値のprocess.envを同時に書き換えず、設定解決処理へfixtureを注入する。実OAuth資格情報なしで実SDKを検証する。

## Implementation Strategy

1. T001の基準を保持し、T002の検証結果を保持して実装を続ける。
2. メール共通基盤と同じprovider利用可否を整え、GitHub無効時の拒否を先に確認する。
3. MVPはSetup/Foundation＋US1。GitHubなしで登録・所有確認・login/logoutを確認できるレビュー単位にする。本番メール開放にはUS2の回復/変更とメール必須ゲートも揃える。
4. US2で全失効・通知、US3で条件付きGitHubの安全な接続と本人確認を実装する。外部GitHub登録待ちでメールの開発を止めない。
5. 自動回帰・メール実配送と負荷・復元を確認してメール受け入れを確定。GitHub実接続だけ未実施なら将来有効化前のゲートとして残す。

## Requirement Coverage

| 要件   | 主なタスク                                                             |
| ------ | ---------------------------------------------------------------------- |
| FR-001 | T014、T030〜T033、T039                                                 |
| FR-002 | T024、T027〜T028、T033                                                 |
| FR-003 | T005、T008、T011、T043、T050                                           |
| FR-004 | T011〜T012、T026、T031〜T032、T035、T052                               |
| FR-005 | T018〜T019、T023、T025、T029、T033                                     |
| FR-006 | T016、T024〜T025、T027、T029〜T030、T036、T048                         |
| FR-007 | T006、T017、T024、T028、T031、T034、T036、T045                         |
| FR-008 | T006、T017、T024、T028、T034、T036、T045                               |
| FR-009 | T034、T036、T040                                                       |
| FR-010 | T018、T034〜T040                                                       |
| FR-011 | T007、T041〜T047                                                       |
| FR-012 | T043、T042、T047                                                       |
| FR-013 | T010〜T013、T015、T017、T030〜T031、T038、T048                         |
| FR-014 | T001、T005、T008、T021、T033、T042、T047、T050、T053                   |
| FR-015 | T003〜T004、T007、T012、T016、T023、T029、T048、T052                   |
| FR-016 | T013、T027、T030、T035、T038、T048                                     |
| FR-017 | T018〜T019、T021〜T022、T033〜T034、T040、T054                         |
| FR-018 | T020、T023、T038、T049〜T050                                           |
| FR-019 | T009〜T010、T014〜T015、T019、T023、T026、T032、T041〜T047、T053       |
| FR-020 | T024〜T026、T033、T040、T050、T053〜T056                               |
| SC-001 | T026、T033、T054、T056                                                 |
| SC-002 | T026、T032〜T033、T054                                                 |
| SC-003 | T004、T017、T024、T028、T034、T036、T045                               |
| SC-004 | T018〜T019、T021〜T022、T034〜T040                                     |
| SC-005 | T041〜T047、T050、T053、T055                                           |
| SC-006 | T016、T024〜T025、T027、T029〜T030、T036、T048                         |
| SC-007 | T004、T012、T016、T023、T048、T052                                     |
| SC-008 | T010〜T023、T024、T028、T034〜T048、T049〜T057                         |
| SC-009 | T009〜T010、T014〜T015、T023〜T026、T032〜T033、T040、T047、T053、T056 |
| SC-010 | T042〜T043、T047、T050、T053、T055〜T056                               |

## 旧タスク番号との対応

T001の証拠とT002の停止理由は同じ番号で保持。新しい番号は以下の対応表を使い、以前のvalidationの記録を誤って別の作業に読み替えない。

| 旧番号 | 新番号 |
| ------ | ------ |
| T001   | T001   |
| T002   | T002   |
| T003   | T003   |
| T004   | T004   |
| T005   | T005   |
| T006   | T006   |
| T007   | T007   |
| T008   | T008   |
| T009   | T011   |
| T010   | T012   |
| T011   | T013   |
| T012   | T016   |
| T013   | T017   |
| T014   | T018   |
| T015   | T019   |
| T016   | T043   |
| T017   | T020   |
| T018   | T021   |
| T019   | T022   |
| T020   | T023   |
| T021   | T024   |
| T022   | T025   |
| T023   | T026   |
| T024   | T027   |
| T025   | T028   |
| T026   | T029   |
| T027   | T030   |
| T028   | T031   |
| T029   | T032   |
| T030   | T033   |
| T031   | T034   |
| T032   | T035   |
| T033   | T036   |
| T034   | T037   |
| T035   | T038   |
| T036   | T039   |
| T037   | T040   |
| T038   | T041   |
| T039   | T042   |
| T040   | T044   |
| T041   | T045   |
| T042   | T046   |
| T043   | T047   |
| T044   | T048   |
| T045   | T049   |
| T046   | T050   |
| T047   | T051   |
| T048   | T052   |
| T049   | T054   |
| T050   | T057   |

## Notes

- 実装・自動検証の証拠と残る外部受け入れはvalidation.mdを参照。実配送・実OAuthの未確認を完了扱いにしない。
- 003の完了40件と001/T079の保留を変更しない。
- OAuth callback・SMTP・Argon2処理をDB取引内で行わず、認可・固定版/世代・通知の原子性は維持する。
- 実SMTP/実OAuthが未実施の場合はそれぞれの記録とcheckboxを残す。設定注入による自動SDK試験で代替したとは記載しない。
