# Authentication Contract

## Framework Boundary

GitHub/CredentialsのsignIn/signOut/session、cookie、CSRF、OAuth state/PKCE、JWT暗号化はAuth.js公開APIを使用する。
`/api/auth/[...nextauth]`の標準handlerへmaintenance leaseと要求スコープを接続する。
Credentials.authorizeはemail/passwordだけを受ける。ID/role/authVersion/sid/再認証証明をclientから採用しない。
標準decode後のsid/世代照合はsession読取・OAuth callback・logoutを含む全経路に適用する。
初回jwt callbackでsidを登録し、通常refreshは同じsidを使う。署名済みでもDB照合不能なら受理しない。

## Domain Operations (Server Actions)

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
