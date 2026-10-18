# Research: 認証UIのHeroUI統一

2026-10-18。既存コード、インストール済みパッケージの公開型・コンポーネントを調査。新規技術の採用・更新はない。

## 1. 表示部品とテーマ

**Decision**: 既存@heroui/reactのInput、Button、Link、Card/CardHeader/CardBody、Alertを使用する。Providers、globals.css、hero.tsの設定をそのまま使う。入力は外側ラベル、既存の標準variant/色トークン、主要操作はprimary、補助操作はflat等で統一する。

**Rationale**: src/app/providers.tsxにHeroUIProvider、globals.cssにテーマ読込、header.tsx等にHeroUI使用例がある。再設定や確認にも同じ部品を使える。

**Alternatives considered**: 生HTMLへ個別の見た目を追加する方式は原則VIIと重複削減に反する。HeroUI更新・別UIライブラリは本件に不要。標準ログイン画面の再実装は対象外。

## 2. 入力と送信

**Decision**: native form/onSubmitを維持し、Inputへtype、autoComplete、isRequired、value/onChange、label、description、isInvalid/errorMessageを渡す。検証の根拠は既存Zod。パスワードへminLength/maxLengthやtrimを追加しない。submitボタンには明示type、isDisabled/isLoading、処理中の名前を指定し、補助ボタンはtype=button。AbortControllerとrefによる重複防止は維持する。

**Rationale**: passwordSchemaは[...value].lengthで15〜128を判定し、不正サロゲートを拒否する。HTML文字数制限は同じ規則を表現できない。Inputのnative required/email制約とZodの既存順序を保ち、独自Form検証を重ねない。送信中の見た目だけでは競合や画面離脱を防げない。

**Alternatives considered**: HeroUI FormのvalidationErrorsへ全面移行すると既存制御を広げる。パスワードをUIで切り詰める方法は原文保持に反する。操作ボタンを全部onPress化するとEnter送信の回帰範囲が増える。

## 3. 結果・ナビゲーション・合成

**Decision**: AuthPanelは見出し付きCardの表示だけ、AuthFeedbackは秘密を含まないmessageをAlert role=statusとして表示する。Alert既定のassertive通知に任せず、既存のpolite通知を維持する。NextLinkをHeroUI Linkのasへ渡し、hrefと遷移先を維持する。共通表示へtoken、password、authOperationや目的別分岐を渡さない。

**Rationale**: 5画面で統一する枠と通知は共通化できるが、確認・追加は固有の認証順序を持つ。既存の非同期処理やConfirmationLinkは既に責務を分けている。

**Alternatives considered**: 汎用認証ウィザード/状態機械の追加は不要。toastだけの結果表示は画面上の案内と読み上げを弱める。入力エラーを色だけにする方法は不可。

## 4. 回帰と実画面検証

**Decision**: 既存5コンポーネントと認証表示の意味テストを維持し、実HeroUI部品でラベル・説明/エラー・submit・pending・条件分岐を検証する。必要なProviderやブラウザーAPI補助はテスト環境内だけに置く。DOMスナップショットやHeroUIの内部class名へ依存しない。

**Rationale**: jsdomはレイアウトや読み上げ・管理ツールを証明しない。320/1280px、Tab/Enter、フォーカス、ライブ通知、貼り付け・自動入力はブラウザーで別確認する。サーバー不変条件は既存統合試験を再利用する。

**Alternatives considered**: HeroUI全体を素のinput/buttonへmockすると今回の接続を検証できない。新規E2E基盤・画像比較ライブラリ導入は本件に必須ではない。

## Evidence

- src/components/{email-registration,auth-confirmation,password-reset,password-change,password-addition}.tsx
- src/components/{confirmation-link,use-auth-submission,auth-operation}.ts
- src/server/authentication/input.ts
- src/app/{providers.tsx,globals.css}、src/components/header.tsx
- node_modules/@heroui/{input,button,link,card,alert}/dist の公開型・実装（詳細は採用済み公開propsで確認）

全調査事項は上記決定で解決済み。実装時の型検査と実画面検証を受け入れ条件にする。
