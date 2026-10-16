# Implementation Plan: メール＋パスワードのログイン追加

**Branch**: `chore/setup-spec-kit`（実Gitブランチ。Spec Kitの機能識別子は002-email-password-login） | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: `specs/002-email-password-login/spec.md`

## Summary

Credentialsを先行提供し、GitHubは設定済み環境だけで併用する。有効なログイン方式を標準JWT戦略へ統一する。
暗号化・cookie・OAuth・CSRFはAuth.jsへ委ね、標準JWT decodeの後にDBのログイン記録と世代を照合する。
新規登録のパスワードはメール所有者が確認画面で最終確定し、事前登録による乗っ取りを防ぐ。
パスワード変更・再設定は全ログイン記録を失効し、GitHub既存利用者への追加は再認証と独立したメール確認を要求する。
既存User ID・楽譜・演奏履歴・信頼度・役割を保つ。切替時は既存DBセッションで再ログインが必要になる。

T001〜T053の実装・自動回帰・専用環境の復元/負荷測定まで完了。T002は改定した利用経路・期限付き基準で通過しており、残るhigh10件の扱いをvalidation.mdに保持する。実SMTP配送T054、実OAuth T055、メール受け入れT056と最終照合T057は未完了で、本番開放済みとは扱わない。

## Technical Context

**Language/Version**: TypeScript strict、Next.js 16.4.0、React 19.2、Node.js 22。

**Primary Dependencies**: 既存next-auth 5.0.0-beta.32 / @auth/core 0.41.3 / @auth/prisma-adapter 2.11.3、Prisma 6.18、Zod 4。
導入中の依存はargon2 0.45.1（MIT）と、`smtp-mailer: npm:nodemailer@10.1.1`（MIT-0、npm alias）。
Auth.jsのoptional nodemailer peerは7/8系のため、SMTP送信はAuth.jsのメールproviderを使わず別名の公開SMTPライブラリを直接利用する。
安全性調査、peer解決確認、公開APIと比較は[research.md](research.md)を参照。

**Storage**: 既存PostgreSQLへ認証情報・メール案内digest・再認証証明・JWT失効記録・利用制限・通知を追加。
原文パスワードと案内tokenを永続化しない。既存Auth.js Session/VerificationTokenを別用途へ転用しない。

**Testing**: Vitest、Testing Library、専用PostgreSQLの別接続による競合試験、固定版Auth.jsの実callback/セッション経路。
SMTPはテスト用transport/捕捉先へ限定。本番GitHubの本人再認証とメール配送は設定済み検証環境で確認する。

**Target Platform**: Node実行のApp Router / proxy、HTTPS（開発はlocalhost）、Node22 LinuxとAlpine/musl。

**Project Type**: 既存の単一Webアプリ。独立認証サーバーや追加の状態管理基盤を作らない。

**Performance Goals**: 本番SLOは未指定。Argon2は64MiB/t3/p1を初期候補にし、各環境30回のhash/verify時間・RSSを記録する。
1プロセス同時hashは2、待機8件・5秒まで、処理deadline10秒。過負荷は拒否し、弱いhashへの自動切替はしない。
前景・オンラインの画面では失効を15秒以内または次の操作時に認識する。背景復帰/BFcache復帰時は本人表示を一旦隠して再確認する。

**Constraints**: JWT callbackだけで失効を判定しない。OAuthの内部経路も標準decode後に同じ照合を通す。
クライアントのUser ID、JWT更新内容、役割、再認証日時を権限の根拠にしない。
既存メンテナンスgateへ全認証書き込みを接続。DB/制限の確認不能時は確定しない。

**Scale/Scope**: 3ユーザーストーリー・20要件・10成功基準。規模保証は未設定。
パスワード15〜128 Unicodeコードポイント、trim/Unicode正規化なし、登録等の本文上限16KiB。
メール確認24h、再設定30min、GitHub再認証15min。利用制限は仕様の初期値を共有DBで適用する。

## Constitution Check

_GATE: Phase 0前とPhase 1後に同じ条件で確認。両方PASS。_

| 原則                          | 設計の対応                                                                                     | 結果 |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ---- |
| I 音楽情報・互換性            | 音楽モデルを変更せず、既存User IDと所有参照を保持                                              | PASS |
| II 責務分離                   | 認証はserver/authentication、provider設定はserver-only共通判定、画面へ公開するのは利用可否だけ | PASS |
| III 入力・永続検証            | Zod、digest単回消費、世代照合、共有制限、同一TXの本人再確認                                    | PASS |
| IV 再現検証                   | 実Auth.js経路・競合・秘密の非露出・001回帰と切替試験                                           | PASS |
| V 範囲                        | 002だけを設計。001/T079の完了状態を変更しない                                                  | PASS |
| VI 標準・信頼できるライブラリ | Auth.js標準戦略/公開decode、Argon2、Nodemailer、標準cryptoを利用                               | PASS |

登録確定・案内単回消費・再認証証明・失効世代・利用制限はサービス固有の規則として補う。
Credentialsが提供しないこれらの責務を、既存ライブラリの公開拡張点へ接続する。
独自cookie、JWT暗号処理、OAuth状態機構、SMTP実装は作らず、憲章例外は不要。

## Phase 0: Research Decisions

[research.md](research.md)に候補・一次資料・ローカル固定版の調査を集約した。
設計上の未解決マーカーはない。実装段階でネイティブhash動作、固定版SDK経路、依存auditを通すことは導入ゲートとする。
SMTPの実プロバイダー/資格情報は環境設定であり、設計を特定業者へ固定しない。

## Phase 1: Design

### セッションと認可

Auth.jsの標準JWTに`sub/sid/authVersion`を含め、AuthSessionRecordをDBへ登録する。
標準decodeを呼ぶ公開wrapperで、有効期限・失効・User世代を確認してからtokenを返す。例外時も受理しない。
JWT refreshや`useSession().update`で新しい認証証明を作らず、クライアント値は捨てる。
標準encodeとcookieは変更しない。sidは標準cryptoのランダム値で、JWT外の独自認証tokenには使わない。

新規ログインのDB登録は世代とPasswordCredential.versionを再確認する。
照合した旧passwordHashを、新しい世代の認証済みtokenに昇格させない。
個別logoutは標準signOut eventでsidを失効し、変更/再設定/追加はUser.authVersion増加と全sid失効を同一TXで行う。
ログイン有効期間は両方式とも30日を上限とし、sid登録時のexpiresAtも固定する。

全保護操作のactorにsid/世代を引き継ぎ、既存サービスの確定TXでUserとsidを再確認する。
保護書き込みはUserとsidの共有row lock、失効は排他row lockを同じ順で取る。
失効成功前の進行中操作は先に確定し得るが、失効後に開始・確定する旧世代の操作は拒否する。
DB照会失敗では本人を受理しない。operator等の役割は従来通りDBの現在値だけを使う。

### 起動時のprovider設定

AUTH_GITHUB_IDとAUTH_GITHUB_SECRETの両方が存在し、それぞれ空文字・空白だけではないときだけGitHub providerを明示登録する。片方だけ・空文字・空白だけは無効とする。空白判定にはtrim()を使うが、Auth.jsへ渡す値は変更しない。資格情報はサーバーに留め、公開可能な情報はgithub:booleanだけ。設定値の正しさは起動時に外部問い合わせせず実ログインで確認する。設定反映は再起動/再配置単位。認証構成・標準provider一覧・Header/ログイン/securityの表示と直接要求guardは同じ判定を使用する。独立したGitHub flagは増やさない。

未設定の/api/auth/signin/githubと/api/auth/callback/githubのGET/POSTは標準handlerへ渡す前に一定の404で拒否。再認証/ADD操作もドメイン操作の前に拒否する。秘密、code、stateをログや応答へ出さず、DB変更・外部OAuth要求を起こさない。session/logoutは通常のsid/世代確認を継続する。メール操作やCredentialsの提供条件はGitHub設定に依存しない。

### GitHubとの関係（設定済み環境）

`allowDangerousEmailAccountLinking`はfalse。getUserByEmailは共通の正規化索引を使う。
adapter.createUser/linkAccount/updateUserに現在のメール所有索引・資格情報・既存Accountを再確認するガードを入れる。
初回GitHub利用者への最初のAccount作成だけを許可し、メール利用者へのGitHub追加や既存利用者への別Account追加を拒否する。
createUser/linkAccount間の障害は検証済みproviderAccountId付き作成receiptで同じ仮Userだけを回復する（データモデル参照）。
未確認の登録予約は所有の証明ではないため、新規GitHub登録を妨げる恒久予約にしない。初回GitHub確定時に予約と案内を失効できる。

GitHub再認証の開始で、現在sid・User・世代・既存providerAccountIdに結び付くReauthIntentを作る。
標準signIn/OAuth state/PKCEを利用し、Nodeの要求スコープで検証済みの元sidを保持する。
成功した同じGitHub Accountのcallbackのみが証明を確定できる。sidを更新する場合、証明を新sidへ原子的に移し旧sidを失効する。
redirectToやnonce文字列、通常ログインのprovider/iatだけを証明として扱わない。
追加の確定で15分以内の証明・現在sid/世代・現在メールの別途確認を再照合し、証明と案内を消費する。

### 登録・メール・制限

登録時のパスワードは形式確認だけに使い、資格情報として保存しない。
確認画面で所有者が選び直したパスワードをhashし、メール索引/案内消費/User/資格情報を同一TXで確定する。
既存User.emailの正規化索引が欠損した移行期間にも重複登録を拒否するため、要求時に既存メールを入力スキーマで照合し、確定時はusers table lock後に再照合する。この保全処理はUser数に比例するため、索引移行を確認してから最適化する。OAuth新規作成との統合保護はT043で接続し、それまではGitHub有効化受け入れを完了扱いにしない。
案内は256bitのランダム値とSHA-256 digest。raw値はメモリーと送信メールに限定する。
リンクは固定AUTH_PUBLIC_ORIGINのfragmentへ入れ、確認画面で直ちにURLから除去する。
GETは表示だけ、POSTで最終確定。no-store/no-referrerを使い、アクセスログや分析に秘密を残さない。

SMTPはdigest確定後にTX外で有限時間送信する。送信リンク入りの永続outboxは作らない。
既存/不存在/未確認/GitHubのみの対象へ同じ送信案内を返し、個別SMTP失敗も公開応答を分けない。
再要求で新しい案内を発行し、旧generationを無効にする。変更通知だけは秘密なしの通知jobとして再送可能にする。

利用制限はメールと接続元のHMACキーで共有DBへ保持する。信頼できるプロキシが上書きした接続元だけを使用する。
未信頼の転送headerを無視し、接続元が確認できない場合は共有unknown bucketで制限する。
失敗数だけでなく進行中の照合予約も上限へ含め、同時要求で迂回させない。クラッシュ予約は期限後に失敗として確定する。
送信要求は存在確認前に消費し、対象の有無でquotaを変えない。詳細は契約を参照。

### 導入・移行

追加スキーマ生成、メール正規化の衝突検出、既存ID/データ比較を専用DBで先行検証する。
衝突は自動統合せず、対象のメールログイン追加を停止して運営へ匿名IDで報告する。
JWT切替と古いSession行の無効化はメンテナンス下の一度の切替にする。全レプリカと各環境で有効な方式を同時更新し、旧DB cookieを受理しない。
案内送信やhashの不具合時はメール方式をfeature flagで停止できる。JWT切替後の既存GitHub利用者はGitHubが設定済みなら再ログインして使う。GitHub無効中は自動でメール資格情報を付与しない。
ロールバックで旧DBセッションを復活させない。DB復元時はAUTH_SECRETを更新し、sidと旧Sessionを無効にしてから開放する。

## Project Structure

### Documentation

```text
specs/002-email-password-login/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/authentication.md
├── quickstart.md
└── checklists/requirements.md
```

### Source Code (planned)

```text
src/auth.ts                              # 標準providers/callbacks/JWT公開wrapper
src/server/auth.ts                       # 現在sid/世代と役割の検証
src/server/authentication/               # 入力、パスワード、登録、案内、制限、失効、再認証
src/server/authentication/mail.ts        # 公開SMTP APIと秘密なし通知
src/server/authentication/providers.ts   # server-only利用可否とGitHub設定
src/server/authentication/operations.ts  # 16KiB制限後のドメイン操作
src/app/api/auth/[...nextauth]/route.ts  # 標準handlerのlease/要求スコープ
src/app/api/account-auth/[operation]/route.ts          # 登録/確認/再設定/変更/再認証
src/app/auth/{register,confirm,reset}/   # ドメイン操作画面
src/app/account/security/               # 変更・GitHubからの追加
src/components/authenticated-content.tsx
src/app/providers.tsx                    # 失効照合・背景復帰/表示cleanup
src/components/header.tsx               # 同じprovider利用可否のログイン導線
prisma/schema.prisma, prisma/migrations/
```

**Structure Decision**: 既存App Routerと標準ログイン画面を使い、秘密を受ける認証操作は本文制限付きRoute Handlerに配置する。再利用可能な純粋入力処理とI/Oを分け、大きい認証コンポーネントを作らない。

## Validation and Next Phase

[データモデル](data-model.md)、[操作契約](contracts/authentication.md)、[検証手順](quickstart.md)を作成済み。
憲章の再評価はPASS。共通基盤・メール認証・条件付きGitHub・保持・移行/復元・負荷と自動回帰は完了。次は検証用の実配送と、設定済み環境での本人OAuth操作を確認して受け入れを確定する。

メール/ネイティブhash依存は必要な操作で遅延ロードし、SMTP未設定やhashライブラリのロード失敗だけで既存GitHubログインを停止しない。DB照合不能は全方式でfail closedとする。

## 実装前分析の反映

本文16KiBの解析前制限のため、認証ドメイン操作のtransportを専用Route Handlerへ集約する。標準Auth.jsのCredentials POSTも解析前に制限し、標準CSRF/OAuthを維持する。他のServer Actionsの25MB上限は変えない。操作・本人認証・出力DTOは従来計画通り。再認証の開始期限と完成後proof期限を各15分に分け、T004のテストを共通実装の前提にした。詳細はcontracts/authentication.md。

## 実装順と受け入れゲート

1. 依存導入ゲートを解消し、User/role/所有・履歴の基準を固定する。現状の全体audit36件、npm再現/glibc確認の未通過を完了扱いにしない。
2. provider設定判定、メールIdentity/password/challenge/rate/mail、標準JWT sid/世代、maintenance、既存保護変更TX、本人表示cleanupと16KiB境界を実装する。GitHub未設定を通常の検証環境とする。
3. US1登録/loginとUS2reset/change/通知を実装・検証する。メール受け入れに外部GitHubアプリ登録を要求しない。実SMTP配送・メールに必要なセキュリティ/負荷/復元の確認は必須のまま。
4. 条件付きGitHubのadapter/初回作成receiptとUS3proof/追加を同じ基盤に接続する。自動回帰では設定を注入して標準OAuth handlerと制御された外部fixtureを通す。
5. 設定3状態のUI/provider/拒否一致、追加→除去→復旧でID/role/所有不変を検証する。GitHub実資格情報がない場合は実環境OAuth確認だけ未実施と記録し、GitHub有効化前のゲートとして残す。

設計の憲章チェックはPhase 0前/Phase 1後ともPASS。これはライブラリ導入・実機・実配送のゲート通過を意味しない。コード・依存・DBはこのplanコマンドでは変更していない。

## 要件の追跡

FR-019/SC-009 → providers.ts、標準handler前guard、公開利用可否、設定行列と画面/SDK試験。FR-020/SC-010 → GitHubなしのメールE2E、設定変更の既存ID/Account/credential/role/所有/履歴比較。FR-011/012/014/SC-005は設定済みGitHubの条件付き検証として維持。FR-001〜018/SC-001〜008の失効・制限・本人確認・秘密保護は従来計画を維持する。

## T002の受け入れ基準の改定

ユーザーの指示により、audit件数ゼロだけを合格条件とする扱いを改定する。npm ciの再現性、対象環境のhash/verify・SMTP捕捉、依存の互換性と回帰を検証する。新規依存に未評価の警告がなく、残存警告について依存経路・入力到達性・緩和・対応期限をvalidation.mdへ記録する。到達可能な危険経路や未評価項目、検証失敗があれば通過しない。auditを無効化せず、再検証で新しい経路や警告が見つかったら再評価する。
