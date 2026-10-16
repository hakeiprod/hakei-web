# Authentication Contract

## Framework Boundary

GitHub/CredentialsのsignIn/signOut/session、cookie、CSRF、OAuth state/PKCE、JWT暗号化はAuth.js公開APIを使用する。
`/api/auth/[...nextauth]`の標準handlerへmaintenance leaseと要求スコープを接続する。
Credentials.authorizeはemail/passwordだけを受ける。ID/role/authVersion/sid/再認証証明をclientから採用しない。
標準decode後のsid/世代照合はsession読取・OAuth callback・logoutを含む全経路に適用する。
初回jwt callbackでsidを登録し、通常refreshは同じsidを使う。署名済みでもDB照合不能なら受理しない。

## Domain Operations (Bounded Route Handlers)

| Operation               | Input                       | Preconditions / result                                                   |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------ |
| requestRegistration     | email,password              | 入力検査・共有send quota。passwordは保存しない。共通案内                 |
| resendConfirmation      | email                       | 共通案内。既存credential/User変更なし。最新VERIFYだけ有効                |
| confirmRegistration     | token,newPassword           | VERIFY/期限/最新/未使用を照合、所有者のpasswordで最終確定。自動loginなし |
| requestPasswordReset    | email                       | 共通案内。確認済みcredentialがある場合だけRESET発行                      |
| resetPassword           | token,newPassword           | RESET消費と新hash/全失効を確定。通常loginへ案内                          |
| changePassword          | currentPassword,newPassword | 有効sid、現在credentialのhash/versionを確認し全失効                      |
| beginGithubReauth       | 空                          | 有効sid+既存GitHub Account。server Intentを作成して標準signInへ          |
| requestPasswordAddition | 空                          | 完成済み15分以内Intent、現在sid/User/世代/現在メール。ADD発行、共通案内  |
| confirmPasswordAddition | token,newPassword           | 同じ有効sid・Intent・メールsnapshotを再確認し証明/案内を消費、全失効     |

公開email要求は有効形式の場合、対象状態やSMTP結果にかかわらず同じ`ACCEPTED`・案内文を返す。
共通DTOは既存ActionResultに沿い、requestIdと秘密を含まないコード/文言/retryableだけを返す。
形式不正はVALIDATION_FAILED、無効案内はINVALID_CHALLENGE（詳細を分けない）、過負荷/共有制限はRETRY_LATER、停止中はMAINTENANCE。
成功した変更をSMTP通知失敗で失敗扱いにせず、通知jobだけを再送する。
Auth.jsのCredentialsSigninコードは対象/原因を問わず一定にする。内部例外・SMTPエラー・入力を表示しない。

## Mail and Browser

本番AUTH_PUBLIC_ORIGINは固定HTTPS、開発localhostのみ許す。clientのHostやcallbackUrlからメールURLを構築しない。
VERIFY/RESET/ADDリンクは`/auth/confirm#token=...`等のfragment。画面は値をメモリーへ取り、URLを置換してから操作を受ける。
GETは表示のみ、最終POSTで消費。再読み込みでraw値がなくなった場合はメールを開き直すか再要求する。
URL/referrer/analytics/ログへrawtokenを出さず、auth画面はno-store/no-referrer。redirectToは固定の同一origin相対パスだけを許す。
SMTPは固定host/from、構造化recipientと固定テンプレートのみ。添付/raw/envelopeなどをclientに指定させない。
本番は465secureまたはSTARTTLS requireTLS、証明書検証、接続/挨拶/socketの各有限timeout、logger/debugとfile/url accessを無効にする。
ログに保存するのはopaque requestIdと分類済みcodeだけ。SMTP accepted/rejectedを内部確認してsendStatusへ反映する。

## Quotas

DB時刻による固定window。loginは15min、sendは1h。運営設定は起動時に検証しwindowへsnapshotする。
loginはmailbox5/source20までの失敗（pending照合を含む）、sendは目的合算mailbox3/source10まで。
対象/sourceのキーは秘密key付きHMAC、trusted proxy以外の転送headerは無視する。
quota更新は同一TXで両キーをlockし、両方受理できるときだけ予約する。失敗/成功を予約IDで一度だけ確定する。
未登録・未確認・GitHubのみも同じ照合コストとquota。quota超過はcredential/Identity検索の前に拒否する。
再送のgeneration変更はquotaを迂回させない。DB・rate状態が確認できないときはpassword/送信要求を拒否する。

## Reauthentication Proof

Intentの開始に有効sidを要求する。要求スコープが保持するincoming sidは標準decodeの検証済み値だけ。
同じproviderAccountId/userIdのOAuth成功後、同じIntentと世代をlockしてproofを完成させ、新sidへ移管する。
通常のprovider情報、iat、client更新、URL nonce、他のGitHub Accountは証明にならない。
ADD確定時には現在sid/User/世代・proof期限/未使用・challenge目的/メールsnapshot/期限を1TXで確認する。
adapter.linkAccountは新規GitHub用の初回作成だけを許し、既存email-onlyアカウントへの追加を拒否する。

## Revocation and Concurrency

decodeは標準暗号検証後にsid/User/世代/期限/失効を確認する。cacheだけで受理しない。
新規Credentialsログインではverifyしたcredential.version/authVersionを記録し、sid作成TXで一致を確認する。
現在actorはDBの役割を使い、保護された変更TXでもsidと世代を確認して失効TXとrow lockで順序付ける。
失効後の旧認証による新規保護操作は拒否する。clientはsession更新・操作の認証エラーで本人表示をunmountする。
前景onlineは15秒pollとfocus確認、background/BFcache復帰は確認前に表示を隠す。ネットワーク不能時も本人表示を継続しない。

標準callbacks.signInが検証済みAccountを要求スコープへ記録し、OAuth初回作成receiptの回復を同じproviderAccountIdに限定する。既存利用者への連携許可には使わない。

## 解析前の本文制限

メール/password/tokenを扱うドメイン操作は `/api/account-auth/[operation]` の専用Route Handlerに集約し、request.bodyを16KiBまで読み取ってからJSONを解析する。Content-Lengthが欠落・偽装されたストリームも実測で拒否する。既存の楽譜操作に必要なServer Actionsの25MB上限は維持し、秘密を受ける公開Server Actionは追加しない。

Auth.jsのCredentials向けPOSTも標準handlerへ渡す前に16KiBの実測制限を適用する。標準OAuth GETや標準CSRF処理は変更しない。ドメインPOSTは固定AUTH_PUBLIC_ORIGINとOriginの一致、JSONのContent-Typeを境界で確認し、本人操作は標準authでsidを検証する。これは既存importと同じorigin境界で、独自のCSRF tokenやCookieを実装しない。

要求上限ちょうど/1byte超過・Content-Length欠落/偽装・chunked入力をテストする。各ドメイン操作に対応するAPI以外を使って同じ秘密処理を公開しない。

## 再認証の期限の起点

開始時はexpiresAt = requestedAt + 15分。OAuth callbackでDB時刻がこの期限未満の場合だけ完成し、completedAtを記録してexpiresAt = completedAt + 15分へ更新する。ADD発行/確定は完成済みproofのexpiresAt未満を要求する。開始期限もproof期限も等号は期限切れ。同じIntentの再callbackでcompletedAtや期限を延長しない。

## GitHub設定と公開利用可否

サーバーの共通判定でAUTH_GITHUB_IDとAUTH_GITHUB_SECRETが両方存在し、それぞれ空文字・空白だけではない場合だけproviderにGitHubを登録する。公開利用可否は `{github:boolean}` のみ。ログイン画面・security・標準 `/api/auth/providers` のGitHub提供状態が一致する。メールの提供状態をGitHubで決めない。

| 状態               | GitHub登録/表示 | GitHub signin/callback/再認証/追加 | メール操作 |
| ------------------ | --------------- | ---------------------------------- | ---------- |
| 未設定（両方空）   | なし            | 拒否・書込なし                     | 利用可能   |
| 一部設定・空白のみ | なし            | 拒否・書込なし                     | 利用可能   |
| 全必須設定あり     | あり            | 標準Auth.jsと既存本人確認を通す    | 利用可能   |

無効時の `/api/auth/signin/github` と `/api/auth/callback/github` はGET/POSTとも標準handlerに委譲する前に404と固定の利用不可案内を返す。beginGithubReauth/requestPasswordAddition/confirmPasswordAdditionはAUTH_METHOD_UNAVAILABLEという秘密のないドメイン結果を返す。code/state/ID/secretを返さず、User/Account/Session/Intent/案内の作成・更新・消費と外部OAuth要求は0件。無効なcallbackからメール方式へ自動loginさせない。

設定済みの誤った資格情報や外部障害は標準OAuth失敗として秘密なしで扱い、メール方式を停止しない。設定変更は再起動/再配置後に反映。GitHub無効化だけでは既存有効sidを削除しないが、通常の世代/期限/失効の照合は常に行う。GitHub-only利用者へRESETやメール一致でpasswordを追加しない。
