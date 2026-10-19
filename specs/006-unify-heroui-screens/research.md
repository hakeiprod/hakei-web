# Research: HeroUI画面統一

2026-10-19。ソース・lock・導入済み公開型・公式v2資料を照合した。実装/ブラウザー検証は未実施。

## R1: 既存v2を維持する

**Decision**: @heroui/react2.8.10と現在の個別パッケージを利用し、依存追加/更新を行わない。

**Rationale**: package-lockと公開exportsで必要なButton/Input/Textarea/Select/Checkbox/Card/Link/Tableが利用可能。現在の公式トップサイトはv3へ誘導するため、v2資料と導入済み型を基準にする。既存のsrc/hero.ts/globals.css/providers.tsxを再利用する。

**Alternatives considered**: v3移行は別の互換性変更。独自デザインシステムは重複する。どちらも今回の目的に不要。

Sources: package-lock.json、node_modules/@heroui/*/dist/*.d.ts、[v2 Button](https://v2.heroui.com/docs/components/button)、[v2 Input](https://v2.heroui.com/docs/components/input)。内部配布コードは挙動調査の証跡のみで、アプリから内部importしない。

## R2: フォーム送信・チェック・選択

**Decision**: form/onSubmit/FormDataを維持し、送信Buttonへtype=submit、その他へtype=buttonを明示。既存disabled条件をisDisabled、同じpendingをisLoadingへ対応させ、同一操作にonClick/onPressを二重登録しない。

**Rationale**: 導入済みuse-aria-buttonはtype=buttonが既定。元の暗黙submitを置換するだけでは送信されなくなる。SelectはnameとdefaultSelectedKeys/selectedKeysを指定し、SelectItem keyを既存enum値・IDに一致させる。canMergeはnameとvalue=onを保持し、未選択ではFormDataに存在しないことを確認する。

**Alternatives considered**: ラベルを送信する、送信処理をonPressへ全面移動する、追加hidden inputを無条件に重ねる方式は値の重複や既存検証の変更を招くため不採用。

Sources: repository-create.tsx、repository-members.tsx、node_modules/@heroui/use-aria-button/dist/index.mjs、selectのhidden-select公開型/配布コード、[v2 Select](https://v2.heroui.com/docs/components/select)。

## R3: 数値の空欄・null・0

**Decision**: 置換対象の数値はまずHeroUI Input type=numberを使い、既存onChangeの文字列変換とmin/max/stepを保持する。既にNumberInputを使うビューアは保持する。

**Rationale**: 練習のNumber("")=0と、partial-score-editorの空欄=nullは異なる契約。NumberInputのonValueChangeは空欄NaNで、同じ意味ではない。step=anyの編集を自動丸め・ロケール書式化へ変えない。required等のネイティブ検証も既存に合わせる。

**Alternatives considered**: 全数値をNumberInputへ統一する方式は不要な変換規則を増やすため不採用。数値モデル/検証スキーマの変更も対象外。

Sources: practice-controls.tsx、partial-score-editor.tsx、proposal-editor.tsx、trust-admin.tsx、node_modules/@heroui/number-input/dist/use-number-input.d.ts、[v2 NumberInput](https://v2.heroui.com/docs/components/number-input)。

## R4: 表と専用UIの境界

**Decision**: 通常の閲覧用情報表（show-score/practice-analysis）はHeroUI Tableを使い、安定した行キー、表名/列見出し、selectionMode=none、既存順序を維持する。音符の密な編集表（partial-score-editor/proposal-editor/import-preview）は意味的tableを残し、セル内の適合する入力・チェックをHeroUI化し、既存トークンと局所スクロールで外観を統一する。

**Rationale**: 閲覧表は通常のTableで満たせる。一方、密な音符表は行内編集・休符disabled・50行ページング・不明値の編集を持ち、コレクションの選択/フォーカスモデルを新しく導入する必要がない。見出し/意味構造を保持した表は独自汎用部品の再実装ではない。音楽描画/仮想鍵盤/演奏レーンも既存表現を維持する。

**Alternatives considered**: すべてをgrid/仮想化/新しい編集器へ置換する、すべての標準tableを無理由に放置する方式は不採用。

Sources: 対応する既存4表部品とpartial-score-editor、[v2 Table](https://v2.heroui.com/docs/components/table)。

## R5: 遷移・確認・状態

**Decision**: Next Linkと現在のhref/queryを保持。対話部品の必要箇所だけHeroUI Link/Buttonのasと既存Next Linkを組み合わせ、Providerへ新しいrouting adapterを追加しない。既存inline確認、globalThis.confirm、details/summaryとrole=statusを保持する。

**Rationale**: 新規Modal/Toastや全体routing変更は確認フロー・フォーカス・認証導線を変え得る。Button/Link/Cardで通常操作を整えながら、既存の確認・状態管理を再利用できる。

**Alternatives considered**: 独自routing wrapper、全確認をModal化、全結果を一時Toastに置換する方式は不採用。

Sources: header.tsx、practice-history.tsx、trust-admin.tsx、score-edit.tsx、[v2 Routing](https://v2.heroui.com/docs/guide/routing)。

## R6: 検証の中心は利用者の挙動

**Decision**: 既存テストのpayload/結果/assertionを維持し、実際のHeroUI操作でsubmit/enum/checkbox/空数値/再試行/取消を検証。既存native selectイベントだけに依存する試験はポップアップとキーボード操作へ適応する。UI全体をnative要素のmockへ置換しない。

**Rationale**: クラス名やimport数の試験だけでは値の変化を捉えられない。jsdomでは外観/レイアウトを証明できないため、360px/1280pxとキーボードは実ブラウザー確認を別記録にする。既存音楽モデルの回帰を維持する。

**Alternatives considered**: 新しいE2E基盤導入、外観だけのスナップショット大量追加、標準要素が0かの検査を完了基準にする方式は不採用。

Sources: vitest.config.mts、vitest.setup.ts、practice-controls.test.tsx、proposal-editor.test.tsx、trust-admin.test.tsx、import-preview.test.tsx。

未解決の設計上のclarificationは0件。実装後の実機・外部サービス・実ブラウザーの結果は今回の調査完了と区別する。
