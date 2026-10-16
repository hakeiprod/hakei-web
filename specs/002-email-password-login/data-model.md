# Data Model: メール＋パスワード認証

追加モデルはPrismaで定義しmigrationと型を生成する。既存User IDと所有参照は維持する。

| Entity             | Fields / relations                                                                                                                              | Constraints                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| User（追加）       | authVersion int default0                                                                                                                        | 変更/再設定/追加で増加。client指定不可。既存roleは維持、新規USER                               |
| EmailIdentity      | normalizedEmail unique, userId nullable unique, state PENDING/OAUTH_BOUND/VERIFIED, createdAt                                                   | trim+lowercase、別名/+は統合しない。PENDINGは所有の証明ではなくUserをまだ作らない              |
| PasswordCredential | userId PK/FK, passwordHash, version, createdAt, updatedAt                                                                                       | 確定済みのみ。hashはArgon2 PHC。平文なし。User削除cascade                                      |
| AuthChallengeHead  | identityId,purpose, generation                                                                                                                  | 複合一意。再発行時にgeneration増加。用途VERIFY/RESET/ADD_PASSWORD                              |
| AuthChallenge      | id,headId,generation,tokenDigest unique,userId?,emailSnapshot,authVersion?,issuerSid?,reauthIntentId?,expiresAt,consumedAt,revokedAt,sendStatus | digest以外の秘密なし。ADDは本人sid/世代/証明必須。purpose/期限/最新generation/未使用をTXで検証 |
| AuthSessionRecord  | sid PK,userId FK,authVersion,method,createdAt,expiresAt,revokedAt                                                                               | JWTのsidを照合。30日固定上限、user/version索引。rawJWTやcookieを保存しない                     |
| ReauthIntent       | id,userId,originSid,currentSid,authVersion,providerAccountId,requestedAt,completedAt?,expiresAt,consumedAt?,revokedAt                           | GitHub既存Accountに結ぶ。15分。OAuth成功により現在sidへ移管、通常refreshで完成しない           |
| AuthRateWindow     | kind,keyDigest,windowStart,windowEnd,limitSnapshot,count                                                                                        | 複合一意、HMACキー。keyのkindはmailbox/source、用途login/send。全プロセス共通                  |
| AuthAttempt        | id,mailboxWindow,sourceWindow,status PENDING/FAILED/SUCCEEDED,deadline                                                                          | failure+pendingで制限。最大10秒後、未確定は失敗扱い。成功は予約を解放                          |
| AuthChangeEvent    | id,userId,type,occurredAt,requestId                                                                                                             | password/token/IP/mail本文なし。秘密以外の変更根拠を記録                                       |
| AuthNotice         | eventId unique,event.userId参照,recipientSnapshot,status,attempts,nextAttemptAt                                                                 | 変更通知専用、リンク/秘密なし。変更確定と同じTXで作成しSMTPはTX外                              |

## OAuth初回作成の回復記録

OAuthCreationReceiptはprovider/providerAccountIdを複合一意にし、userId・状態PENDING/APPLIED・作成日時を持つ。
標準callbacks.signInが受け取った検証済みAccount情報を要求スコープに保持し、adapter.createUser/linkAccountの別呼び出しを同じ記録へ結ぶ。
Account作成前に失敗した再試行は、同じproviderAccountIdで、まだAccount/credential/所有データを持たない同じ仮Userだけを再利用できる。
この限定状態のgetUserByEmailは、同じ検証済みAccountの要求に限りcreateUserの回復へ進ませる。別Accountや確定済みUserは回復対象にしない。
linkAccount成功時にAPPLIEDとし、他人のメール登録や別GitHub Accountへの統合に利用しない。回復試験でUser重複・孤児登録による恒久ログイン拒否を確認する。

## Validation

- password: `[...value].length`の意味で15〜128コードポイント。空白やUnicodeを正規化しない。UTF-8入力と全本文16KiBを先に制限。
- email: 単一アドレス形式を検証、trim+lowercase後の値で索引検索。SMTP recipientは構造化アドレスでCRLF等を受理しない。
- challenge: 32byte乱数、base64url、digest固定長。rawはURL fragment→メモリー→POSTのみ。
- source: サーバーで信頼可能なproxy設定から取得し正規化する。clientのsource/key/userId/roleは受理しない。
- 外部データの日時、世代、role、providerは確定TXの現在値と照合する。DB時刻で期限を比較する。

## State Transitions

1. 登録: Identity PENDING → VERIFY発行 → 所有者がpassword最終入力 → User/credential作成 + Identity VERIFIED + challenge消費。
   申請時のpasswordは保存しない。再登録/再送だけではUserや既存credentialを変更しない。
2. GitHub新規登録: 未所有PENDING予約を失効できる → 同一TXでUser/Identity OAUTH_BOUNDを作成。
   createUser/linkAccountの標準adapter契約を保ち、初回Accountだけ許す。途中障害でできたOAuth用Userはpassword登録に流用しない。
3. 追加: 有効sidでIntent作成 → 同じGitHub Accountで標準OAuth成功 → proof完成 → ADDメール発行 → 同じ現在sidでpassword確定。
   proof/challenge消費、credential作成、Identity VERIFIED、authVersion増加、全sid失効、変更通知を1TXで確定する。
4. 再設定/変更: hash計算はTX外 → User/credentialと案内/現在password検証時versionを再確認 → 新hash/version + authVersion増加 + 全sid失効 + 案内/証明失効 + 通知。
5. challenge再発行: headを排他lockしてgeneration増加、古い案内を失効。SMTP失敗でも有効化や過去案内の復活を行わない。
6. logout: standard eventで該当sid失効。期限切れ/失効sidはdecodeがnullを返し、refreshで蘇らせない。

## Atomicity / Ordering

利用者変更はUser→AuthSessionRecord→EmailIdentity/head→challenge/proof→credentialの順でlockする。
同じUserの保護書き込みは共有User/sid lockで現在世代を確認し、変更側の排他lockと順序付ける。
メール新規登録は同じnormalizedEmailのidentity/headをlockし、GitHubのcreateUser側も同じ索引を利用する。
一意制約と条件付き更新件数で二重確定を拒否し、競合再試行で古い世代を再発行しない。
SMTP、OAuthネットワーク、Argon2処理はDB TXに入れない。各書き込み全体は既存maintenance leaseの中で実行する。

## Migration / Retention

まずEmailIdentity候補を生成して衝突を検出する。既存User.emailは保全し、衝突を自動修正・統合しない。
adapterのすべてのメール検索・新規作成を同じ索引へ切替え、EmailIdentityなしの既存利用者を無断で再作成しない。
User数/ID/role・所有件数を移行前後で比較し、旧Sessionは切替時に失効する。VerificationTokenの標準用途を変更しない。
期限を過ぎた未確定identity/challenge/attemptは定期cleanupする。期限切れ自体で同じ秘密を再利用可能にしない。
初期保持: challenge/proofは失効/消費/期限から7日、attempt/windowは期間終了から24h、sidは期限/失効から7日。
認証変更記録・通知は初期90日。User削除時の関連削除と、バックアップのアクセス制限・復元後の秘密更新を運用へ記載する。

## 期限と入力境界の確定

ReauthIntent.expiresAtは開始時requestedAt+15分、初回OAuth成功時にcompletedAt+15分へ更新する。開始期限超過のcallbackは拒否し、再callbackでは期限を延長しない。DB時刻が期限と等しい場合は拒否する。

ドメインのメール/password/token操作は専用Route Handlerで本文16KiBを解析前に実測制限する。既存Server Actionsを通る秘密操作は公開しない。

## ProviderAvailability（非永続・起動時設定）

- server-onlyで必須のGitHub ID/secretを解決し、すべて非空・形式を満たすときgithub=true。それ以外はfalse。設定の秘密をDTOやDBへ複製しない。
- 公開する値はgithub:booleanのみ。メール方式のflag/設定は独立して扱う。AuthSessionRecord.methodは実際の認証方式を記録し、clientから採用しない。
- 無効時はGitHubのUser/Account/Receipt/Intent/credentialを削除・移行しない。通常session/logoutと期限・世代の検証は継続。メール資格情報を持つ利用者は同じUserでメールlogin可能。GitHub-only利用者はメール一致/RESETで資格情報を増やせない。
- GitHub signup・receipt回復・Intent作成/完成・ADD発行/消費はgithub=trueのときだけ開始し、確定前も現在のサーバー設定を確認する。falseでの要求は既存案内やproofを消費せず拒否する。
- 設定追加/除去/復旧をUser/role/所有/履歴の変更イベントとして扱わない。新しいDBマイグレーションは従来のメールモデル分のみ。
