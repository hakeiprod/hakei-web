# UI Contract: 認証画面のHeroUI統一

## 共通表示

| 役割       | 実装方針                                                 | 維持する意味                                                         |
| ---------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| 画面枠     | 非操作型Card + CardHeader/CardBodyをAuthPanelで合成      | sectionとh1、既存見出し。幅w-full/min-w-0/max-w-lg相当、余白と折返し |
| 入力       | Input、外側label、description、isInvalid/errorMessage    | email/password型、required、autoComplete、原文、既存Zod              |
| 主要操作   | Button color=primary、明示type=submit                    | formのEnter送信。isLoading/isDisabledと既存ロック                    |
| 補助操作   | Button type=button、統一したflat等のvariant              | 再送・本人確認はform送信と分離。無効条件を維持                       |
| 関連リンク | HeroUI Link as=NextLink                                  | href・順序・名前を維持。標準認証URLへの遷移も維持                    |
| 結果       | AlertをAuthFeedbackで合成、role=status、aria-live=polite | 既存日本語message、色だけにしない、秘密なし、消去を強制しない        |

既存Provider・テーマ・色トークンを使用し、固定幅・独自配色・新しいパスワード表示切替は追加しない。Inputは既存native必須/email検証を保つ。HTML minLength/maxLengthをパスワードに設定せず、貼付け/自動入力も変換しない。画面のformは既存native要素を維持し、検証の第二の所有者を作らない。

## 画面と操作

| 画面/コンポーネント                  | 入力・操作                                                    | 通信契約と成功後                                                                                          |
| ------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| /auth/register / EmailRegistration   | email、新規password、送信、sent後再送、既存関連リンク         | requestRegistration / resendConfirmation。共通案内、password消去。GitHubは有効時だけ既存signIn            |
| /auth/confirm / AuthConfirmation     | VERIFYの登録password、RESET/ADDの新password。目的別確定ボタン | confirmRegistration / resetPassword / confirmPasswordAddition。GET消費なし。成功時clearと通常ログイン案内 |
| /auth/reset / PasswordReset          | emailと再設定要求                                             | requestPasswordReset。対象の登録状態によらず共通案内                                                      |
| /account/security / PasswordChange   | current/new password、全端末失効の説明、変更                  | changePassword。入力消去・終了、既存getSession、通常ログイン案内                                          |
| /account/security / PasswordAddition | 本人確認、メール要求、条件の説明                              | beginGithubReauth→標準signIn、requestPasswordAddition。無効時は非表示、email欠落時は既存説明              |

account/securityで追加画面に続くホームリンクもHeroUI Linkに統一する。サーバー側のrequireActor、credential分岐、User/メール取得は変更しない。

## 不変条件

- authOperationのoperation名、DTO、POST先、Origin/CSRF/認可、HTTP/公開エラー契約は[仕様002の認証契約](../../002-email-password-login/contracts/authentication.md)を維持する。
- tokenはアドレス欄から入力受付前に除去し、表示合成・storage・ログへ渡さない。無効/欠落リンクでは入力と送信を許可しない。
- 目的別の再要求先はVERIFY→/auth/register、RESET→/auth/reset、ADD_PASSWORD→/account/security。
- 成功後の標準ログイン先は/api/auth/signin。自動ログイン・独自OAuth画面を追加しない。
- 連打/Enterでも同一画面のpending要求を重複実行しない。遅延結果は離脱後に表示しない。
- サーバー案内は登録状態や内部例外を公開しない。ローカル入力エラーだけを該当Inputに結び付ける。
- すべての入力・操作にアクセス可能な名前を持たせ、説明/エラーとの関連を維持する。主要操作とリンクは論理順でTab到達できる。

## 検証対応

| 要件               | 検証                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| FR-001、SC-001     | 5画面の部品対応レビュー。既存HeroUIテーマとの実画面比較                             |
| FR-002/011、SC-004 | label/description/errorのDOM関連・live region・Tab/フォーカスの実画面確認           |
| FR-003             | 遅延要求中の連打/Enter、loading/disabled、拒否後再試行、unmount後の結果抑止         |
| FR-004             | 14/15/128/129コードポイント、絵文字、多言語、原文送信、autoComplete、貼付け         |
| FR-005/006         | VERIFY/RESET/ADDの目的別POST/再要求先、fragment除去、GET非消費、storage非保存       |
| FR-007/009         | 共通案内、制限、GitHub可否/メール有無、再認証失敗の表示と既存拒否テスト             |
| FR-008/012、SC-002 | 既存認証統合試験で全失効・User/認可の不変条件。UIで秘密入力終了と再ログイン案内     |
| FR-010、SC-003     | 320px/1280pxの通常・長文・エラー・pending・成功で横スクロールなし、主要操作100%到達 |
| SC-005             | 必須手順/入力の前後比較。登録は要求→リンク→最終確定の3段階以内                      |

自動テストで証明できないレイアウト・読み上げ・管理ツールは手動結果を残す。SMTP/実OAuthの保留をUI確認だけで解消しない。
