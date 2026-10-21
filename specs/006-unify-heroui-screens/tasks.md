# Tasks: アプリ画面のHeroUI統一

**Input**: specs/006-unify-heroui-screens/ のspec.md、plan.md、research.md、data-model.md、contracts/ui-consistency.md、quickstart.md、ui-inventory.md。

**Prerequisites**: 憲章v1.3.0、既存HeroUI v2/テーマ/認証方針を維持。実装・自動回帰・画面検証完了。現在34/34件完了。

**Tests**: TDDの指定はないため独立したテスト先行フェーズは設けない。計画で定めた既存挙動テストの更新と、値/送信/確認の意味が変わり得る箇所の最小回帰を各実装タスクに含める。純粋な余白やclass名だけの試験を新設しない。SC-003/004の実ブラウザー確認をjsdom成功で代用しない。

**Organization**: 4ユーザーストーリー単位。新モデル/API/サービス/認証処理は作らない。各タスクのパスはリポジトリルート相対。

## Format: `[ID] [P?] [Story] Description`

`[P]`は同一フェーズの前提を満たした後、別ファイルで実施可能な作業。各タスク内の変更・回帰確認は一体として行う。同じvalidation.mdへの記録は最後に直列統合する。実環境がなく未実施ならチェックしない。

## Phase 1: Setup

**Purpose**: 変更前の状態と既存環境を記録する。

- [x] T001 specs/006-unify-heroui-screens/validation.md を作成し、ui-inventory.md の通常利用12画面群について役割・既存の状態・主操作・初期値/送信値・ブラウザー名/版・確認可能な環境を記録する。ソース確認/自動試験/実画面確認を区別し、認証や業務状態・既存の仕様005保留を変更しない。
- [x] T002 specs/006-unify-heroui-screens/contracts/ui-consistency.md と package-lock.json / src/hero.ts / src/app/globals.css / src/app/providers.tsx を照合し、既存v2公開API、共通トークン、操作別Button規則、例外をvalidation.mdへ記録する。依存追加/更新、v3移行、汎用ラッパー、グローバルtable/input/svg上書きを行わない。

## Phase 2: Foundational — 全ストーリーの前提

**Purpose**: 共通導線と認証状態の表示境界を整える。

- [x] T003 src/components/header.tsx と src/components/header.test.tsx を更新し、既存Navbar/Button/検索を再利用してリンク・余白・狭幅の折返しを共通規則へ揃える。ログイン/logoutのhandler・href・認証状態の条件を保持し、360pxで導線を単に隠さない。クリック/キー操作の重複実行を避け、既存の認証導線のassertionを維持する。
- [x] T004 src/components/authenticated-content.tsx と src/components/authenticated-content.test.tsx の案内を共通トークンで整える。利用者一致判定・再読込条件・children表示条件・状態制御を変更せず、既存テストで表示境界を維持する。src/app/layout.tsx / src/app/providers.tsx は既存基盤として保持し、新規Providerやrouting adapterを追加しない。

**Checkpoint**: T001〜T004完了後にストーリーへ進む。対象外の認証画面や空画面を新規実装しない。

## Phase 3: US1 — 楽譜の閲覧・取込・編集 (P1 / MVP)

**Goal**: 一覧→詳細→取込/確認/修正/保存を既存の内容と権限のまま統一する。

**Independent Test**: 公開楽譜を閲覧し、編集可能な利用者でファイル取込→preview→不明音符修正→保存する。空一覧/保存先なし/権限なし、各操作の送信値と遷移先も確認する。

- [x] T005 [P] [US1] src/app/page.tsx と src/app/score/[id]/page.tsx のmain・見出し・一覧・節・空状態・履歴/提案/練習リンクをplanの共通規則へ整える。src/app/score/page.tsx の既存再利用を維持し、DB取得・権限分岐・revisionId・既存URLを変更せず、ページ全体をuse clientへ移さない。
- [x] T006 [P] [US1] src/components/show-score.tsx / src/components/score-edit.tsx / src/components/score-viewer.tsx の通常操作・閲覧情報表をHeroUI Button/Link/Table等へ統一し、src/components/show-score.test.tsx / src/components/score-viewer.test.tsx を実部品操作へ適応する。表名/列名/安定キー/順序を保持して新規行選択を無効にし、楽譜描画・既存NumberInput・再生/削除確認・編集権限の意味を変えない。
- [x] T007 [P] [US1] src/components/form-create-score.tsx / src/components/import-preview.tsx の通常Input/Select/Checkbox/Button、状態表示、情報群を統一し、src/components/import-preview.test.tsx で既存の変換/取消/再検証/保存契約を維持する。「対応形式と5MiB制限、同一file再選択、入力保持、再検証、既存token/有効期限の扱いを維持。ログや表示へtokenを追加しない。」を守り、file chooserはnativeで保持する。MIDI条件の選択値・payload・送信前snapshotを維持する。
- [x] T008 [P] [US1] src/components/partial-score-editor.tsx のセル入力・説明・前後ページ・保存操作をHeroUI化し、src/components/partial-score-editor.test.tsx に必要最小限のnull/0/休符/ページ/送信回帰を追加する。「安定ID、整数音高0〜127、拍の小数、不明値null、休符の音高無効、50行ページングを維持。」を守る。意味的table/caption/thと既存入力変換を保持し、数値はまずInput type=numberを使う。
- [x] T009 [P] [US1] src/components/proposal-editor.tsx のInput/Select/Checkbox/Textarea/Buttonと密な編集表の局所スタイルを統一し、src/components/proposal-editor.test.tsx を実選択操作へ更新する。「下書き/送信/確定操作の既存payloadと遷移を維持。競合時の入力と同一再試行keyを保持。」を守り、summary・candidate・baseRevisionId・期待version/OID・keyを変えない。空欄の変換と数値精度は現コードどおりとし、新しい丸めを導入しない。この部品の統一はUS3とも共有する。
- [x] T010 [US1] T005〜T009後に src/app/score/create/page.tsx / src/app/score/[id]/edit/page.tsx の外枠・見出し・案内・戻る導線を統一し、部品を結合して保存先未選択/権限不足/変換失敗/保存中の分岐を確認する。repositoryId・revisionIdと既存のサーバー認可/保存処理はそのままにする。
- [x] T011 [US1] specs/006-unify-heroui-screens/quickstart.md のUS1シナリオを通常4画面群で実行し、validation.mdへ360px/1280px・Tab/Enter/Space・label/focus・file再選択・null/0・既存状態・同じ保存結果を記録する。表/楽譜だけの局所スクロールとSC-001〜005を確認し、実ブラウザーがなければ未実施として残す。

**Checkpoint**: US1のみで閲覧・取込・編集の独立したデモが可能。US3の共有/提案確定の統一完了はまだ主張しない。

## Phase 4: US2 — 練習・ゲーム・結果・履歴 (P1)

**Goal**: 演奏/採点/保存は既存hookのまま、条件設定と結果/履歴の通常操作を統一する。

**Independent Test**: 同じ入力機器/条件で開始→終了または中断→結果→履歴→削除確認/取消。保存失敗は同じ記録で再試行し、値と結果を比較する。

- [x] T012 [P] [US2] src/components/practice-controls.tsx の機器/トラックSelect、数値Input、Checkbox、接続/開始/終了/中断/再保存Buttonを統一し、src/components/practice-controls.test.tsx / src/components/rhythm-game.test.tsx を実HeroUI操作へ適応する。「trackIdの数値変換、開始/終了小節min1、テンポ0.25〜4/step0.05、補正-1000〜1000msを維持。」を守り、全フィールドを現コードと照合する。未選択deviceIdは空集合、Number(空文字)等の変換、active/pending/device条件、同一session/key/event batchの再保存を保持し、use-practice-sessionや採点処理は変更しない。
- [x] T013 [P] [US2] src/components/practice-history.tsx の履歴情報群・条件・導線・削除/取消/確定を統一し、src/components/practice-history.test.tsx で既存の対象/取消/保存済み結果を保持する。「入力イベント、評価数値、暫定/確定、中断/完了、best、並び順、cursor、削除対象を維持。」を守り、sessionId/conditionsと権限の意味を変えない。
- [x] T014 [P] [US2] src/components/practice-analysis.tsx / src/components/game-result.tsx の分析Table・見出し・状態・詳細展開を統一する。音符/単音/和音ごとの値・順序・精度を保持し、details/summaryは標準のまま局所スタイルを整える。表示値/中断/暫定の意味を確認する必要最小限の回帰をsrc/components/practice-analysis.test.tsxに追加し、独自Accordionや新しい結果モデルを作らない。
- [x] T015 [US2] T012〜T014後に src/app/score/[id]/practice/page.tsx / src/app/score/[id]/rythme/page.tsx / src/app/practice/history/page.tsx / src/app/practice/[id]/page.tsx の外枠・状態・リンクを統一する。canPractice/canGame・認証redirect・revisionId・既存rythme URLを維持し、既存ShowScoreと結合する。共有ShowScoreはここで再編集しない。
- [x] T016 [US2] specs/006-unify-heroui-screens/quickstart.md のUS2を通常4画面群で実行し、validation.mdへ360px/1280px・機器/トラックpopupの矢印/Escape・数値入力focusと演奏打鍵の非干渉・中断/保存失敗/再試行/履歴/削除取消を記録する。実機MIDIと試験用代替を区別し、SC-002〜005を確認する。

## Phase 5: US3 — 共有・メンバー・編集提案 (P2)

**Goal**: 同じ権限/送信値のままリポジトリ作成・共有・メンバー・提案確定を統一する。

**Independent Test**: 管理者/編集者/閲覧者で作成→共有/メンバー更新→下書き/送信→merge/reject/withdraw/競合を比較し、許可操作と入力保持が変わらないことを確認する。

- [x] T017 [P] [US3] src/components/repository-create.tsx をInput/Select/Button/Card等へ統一し、src/components/repository-create.test.tsx で初期選択/実popup選択/FormData/Enter送信1回/invalid/失敗時入力保持を確認する。「nameの必須/最大200文字、PRIVATE/INVITED/PUBLIC、INVITED/ALL_USERS、期待versionを保持。」を守り、既存create payload/keyとrefreshを維持する。createに存在しないversionを新規送信しない。submitはtype=submitを明示する。
- [x] T018 [P] [US3] src/components/repository-members.tsx を統一し、src/components/repository-members.test.tsx に初期選択/共有更新/役割/checkbox/送信の回帰を追加する。「VIEWER/EDITOR/ADMIN/REMOVEをそのまま送信。checkboxはチェック時on、未チェック時欠落。サーバーの権限判定は不変。」と「nameの必須/最大200文字、PRIVATE/INVITED/PUBLIC、INVITED/ALL_USERS、期待versionを保持。」の該当制約を維持する。Select name/item key/defaultSelectedKeys、Checkbox name/value=on、accessVersionを保持し、pending後のFormData欠落や重複値を防ぐ。
- [x] T019 [P] [US3] src/components/proposal-actions.tsx の理由Textarea、merge/reject/withdraw Button、状態表示を統一し、src/components/proposal-actions.test.tsx に必要最小限の許可操作/必須理由/失敗再試行の回帰を追加する。「下書き/送信/確定操作の既存payloadと遷移を維持。競合時の入力と同一再試行keyを保持。」を守り、期待version/OID/key/canMerge/canWithdraw/statusを変更しない。
- [x] T020 [US3] T009・T017〜T019後に src/app/repositories/page.tsx / src/app/repositories/[id]/proposals/[proposalId]/page.tsx の外枠・一覧・差分案内・作成/現在版導線を統一し、既存ProposalEditor/ShowScoreと結合する。共有エディターはT009の成果を再利用し、役割別のサーバー取得/認可/状態/遷移先を保持する。
- [x] T021 [US3] specs/006-unify-heroui-screens/quickstart.md のUS3を2画面群と共有編集画面で実行し、validation.mdへ役割別操作、初期値とenum/checkbox送信値、Enter1回・取消非送信、競合時保持、360px/1280pxとキー操作を記録する。US3の完了はT009の共有エディター確認を含み、SC-002〜005へ対応付ける。

## Phase 6: US4 — 信頼度評価・運営設定 (P2)

**Goal**: 評価/規則/調整の精度と確認フローを維持して通常操作を統一する。

**Independent Test**: 一般利用者の評価保存、運営者の規則編集→確認→適用/取消、対象スコア調整を実行し、同じ値・理由・結果と権限を確認する。

- [x] T022 [P] [US4] src/components/user-trust.tsx の対象/値Input・保存Button・状態表示を統一し、src/components/user-trust.test.tsx に小数/空欄/必須/送信値/失敗再試行の最小回帰を追加する。「step=anyの数値精度、規則の各項目、理由最大2000文字、期待version、確認内容と取消を維持。」の該当制約を保持し、targetId/valueの既存変換・key・評価範囲を変えない。
- [x] T023 [P] [US4] src/components/trust-admin.tsx をInput/Textarea/Button/Card等へ統一し、src/components/trust-admin.test.tsx で規則確認/適用/取消/手動調整の既存assertionを保持する。「step=anyの数値精度、規則の各項目、理由最大2000文字、期待version、確認内容と取消を維持。」を守る。ruleId/policyVersion/desiredScore/reason、既存inline確認とglobalThis.confirmを維持し、取消時非送信・pending二重送信防止・失敗時の確認内容保持を確認する。
- [x] T024 [US4] T022〜T023後に src/app/trust/page.tsx / src/app/admin/trust/page.tsx の外枠・見出し・案内・運営導線を統一する。一般利用者/運営者の既存分岐、標準signin redirect/notFound、現在のデータ取得と計算規則を維持する。
- [x] T025 [US4] specs/006-unify-heroui-screens/quickstart.md のUS4を2画面群で実行し、validation.mdへ数値の0/小数/負数/境界、理由、確認/取消/適用、役割別操作、360px/1280pxとキー操作を記録する。保存値/評価結果の差0とSC-002〜005を確認し、未実施は残す。

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全12画面群と例外・回帰・証跡を照合する。

- [x] T026 specs/006-unify-heroui-screens/ui-inventory.md を最終コードへ照合し、全12画面群と通常操作を変更済み/既存利用/保持例外/対象外へ分類して未分類0を確認する。native file/密な音符table/details/confirm/楽譜描画の根拠をcontracts/ui-consistency.mdへ対応付け、通常Button/Inputの無理由な残存を修正する。
- [x] T027 specs/006-unify-heroui-screens/quickstart.md に従い src/components/score-player.tsx / src/components/slider-volume.tsx / src/components/score-mixier-track.tsx / src/components/virtual-keyboard.tsx / src/components/show-score-rythme.tsx と src/app/dev/core/fixtures/page.tsx / src/app/dev/mxl/fixtures/page.tsx / src/app/dev/score-fixtures/page.tsx への波及を確認し、validation.mdへ記録する。開発画面の本番非公開、既存描画・音量・再生を維持し、対象外の全面改修を行わない。
- [x] T028 package.json の既存コマンドで全単体 `npm test -- --run --maxWorkers=2`、`npx next typegen`、`npx tsc --noEmit`、変更したtsxのeslint、`EMAIL_SERVER= EMAIL_FROM= npm run build`を実行し、specs/006-unify-heroui-screens/validation.md へ記録する。s-core回帰を省かず、失敗は関連UI境界だけを修正して必要範囲を再検証する。
- [x] T029 docs/development.md の手順で専用末尾_test DB・専用SCORE_GIT_ROOT・専用MailpitとTEST_EMAIL_SERVER/TEST_MAILPIT_URLを準備して `npm run test:integration` を実行し、specs/006-unify-heroui-screens/validation.md へ認可/保存/資産/練習/バックアップ等の結果を記録する。準備した資源だけ後片付けし、稼働DB/秘密ファイルへ触れない。
- [x] T030 specs/006-unify-heroui-screens/validation.md でT011/T016/T021/T025の全12画面群・役割・既存状態を集約し、360px/1280pxの欠落/重なり/意図しない全体横スクロール0、名前/focus/キーボード到達/確認取消、色に頼らない状態表示を確認する。不足時は対象画面を修正・再確認し、実画面不可ならこのタスクは未完了にする。
- [x] T031 specs/006-unify-heroui-screens/validation.md / quickstart.md / ui-inventory.md へFR-001〜013/SC-001〜005と証跡を対応付け、最終差分でsrc/server/・src/s-core/・prisma/・認証経路・依存・.envに無関係な変更がないことを確認する。未確認/失敗/例外を残し、未実施の実機/実認証や仕様005保留を完了にせず、tasks.mdのチェックを実施結果と一致させる。

## Dependencies & Execution Order

### Phase Dependencies

```text
T001 → T002 → T003 → T004 (共通前提)
  ├─ US1: T005 + T006 + T007 + T008 + T009 → T010 → T011
  ├─ US2: T012 + T013 + T014 → T015 → T016
  ├─ US3: T017 + T018 + T019 + (共有T009) → T020 → T021
  └─ US4: T022 + T023 → T024 → T025
全ストーリー → T026 → T027 → T028 → T029 → T030 → T031
```

### User Story Dependencies

- US1とUS2はP1。US1をMVPとして先に仕上げる。US2/US4は共通前提後、他ストーリーの完了を待たず着手可能。
- US3のフォームと確定操作は独立着手可能。ただし編集画面の共有ProposalEditorは最初に使うUS1のT009へ集約し、US3結合/受け入れはT009に依存する。US1全体の完了を必要条件にはしない。
- ShowScoreはT006、partial/import編集はT007/T008、ProposalEditorはT009だけが編集責任を持つ。他ストーリーは既存propsで再利用し、同じファイルを同時に編集しない。
- `[P]`作業は共通前提後に別ファイルで進められることを示す。関連試験が別タスクのファイルを変更する必要が出たら直列化する。
- ストーリーの画面確認でブラウザーが使えない場合、依存しない実装/自動回帰は続けられるが、その確認タスクを完了にはしない。Polishのうち独立した回帰準備は進めても、T030/T031の受け入れ完了は全証跡が揃うまで保留する。

### Parallel Examples per Story

| ストーリー | 前提後に並行できる組合せ                                                 | 結合/記録は直列           |
| ---------- | ------------------------------------------------------------------------ | ------------------------- |
| US1        | T005ページ / T006表示・ビューア / T007取込 / T008部分編集 / T009提案編集 | T010 → T011               |
| US2        | T012練習操作 / T013履歴 / T014分析                                       | T015 → T016               |
| US3        | T017作成 / T018メンバー / T019確定操作                                   | 共有T009完了後T020 → T021 |
| US4        | T022利用者評価 / T023運営設定                                            | T024 → T025               |

この表は作業分割の可能性を示す。サブエージェント起動の指示ではない。共通validation.mdの同時書込みは避ける。

## Implementation Strategy

1. T001〜T004で変更前の契約と共通導線を固定する。新規基盤の導入はしない。
2. T005〜T011でUS1を実装・検証し、楽譜の閲覧/取込/修正だけでも価値があるMVPにする。確認後は不要な承認待ちを挟まず、許可範囲で次へ進む。
3. US2、US3、US4を独立した増分として追加し、各実装に既存の値/状態/送信を検証する回帰を含める。UI全体をnative mockへ置換して試験を通さない。
4. T026〜T031で例外・波及・全回帰・実画面・要件対応を確認する。公開/デプロイ/稼働DB移行はこのタスク群に含まない。

## Coverage & Counts

| フェーズ      | タスク     | 件数 | 主な要件                                |
| ------------- | ---------- | ---: | --------------------------------------- |
| Setup         | T001〜T002 |    2 | FR-001/002/011/012/013                  |
| Foundational  | T003〜T004 |    2 | FR-003/008/009/010/012                  |
| US1           | T005〜T011 |    7 | FR-003/004/008/009/010/011、SC-001〜005 |
| US2           | T012〜T016 |    5 | FR-005/008/009/010/011、SC-001〜005     |
| US3           | T017〜T021 |    5 | FR-006/008/009/010/011、SC-001〜005     |
| US4           | T022〜T025 |    4 | FR-007/008/009/010/011、SC-001〜005     |
| Polish        | T026〜T031 |    6 | FR-001〜013、SC-001〜005                |
| Convergence   | T032〜T033 |    2 | FR-003/004/008/010、US1/AC3             |
| Convergence 2 | T034       |    1 | FR-003/005/008/010、SC-004/005          |

合計34件、完了34件、並行候補13件。MVPは共通前提4件＋US1の7件＝T001〜T011。具体的なデータ制約は対応する実装タスクへ引用済み。新DB entity/migration/APIを実装するタスクはない。

## Phase 8: Convergence

- [x] T032 src/components/repository-create.tsx / repository-members.tsx / form-create-score.tsx / import-preview.tsx / partial-score-editor.tsx / proposal-editor.tsx / proposal-actions.tsx / practice-controls.tsx / practice-history.tsx / score-viewer.tsx / trust-admin.tsx / user-trust.tsx のButtonを操作の意味ごとに照合し、主操作primary/solid、補助default/bordered、取消default/light、削除dangerという計画の基準へ揃える。現状の作成・保存・開始・提出・マージ等のprimary/flat、補助操作のdefault/flat、取り込み中止のdefault/flatを修正し、運営ルール有効化・調整の主操作も同じ基準で識別可能にする。type、handler、pending/isDisabled、FormData、payload/key、既存の確認手順を維持し、360px/1280pxで操作区分と既存の送信・取消を確認してvalidation.mdへ追記する。per FR-003、plan: Phase 1のButton規則、T002 (partial)
- [x] T033 src/app/score/create/page.tsx の作成権限不足と src/app/score/[id]/edit/page.tsx の編集権限不足で、現在の裸のpによる早期returnを、通常画面と同じmainの幅・余白・見出し・共通トークンによる状態案内へ揃える。既存の権限判定、文言の意味、認証redirect、サーバー取得と認可を維持し、新しい権限や認証フローを追加しない。保存先未選択分岐と比較し、権限不足の利用者で両画面を360px/1280pxで確認して、案内の可読性と許可されない操作を表示しないことをvalidation.mdへ記録する。per FR-003/004/008/010、US1/AC3、T010 (partial)

## Phase 9: Convergence

- [x] T034 src/app/score/[id]/practice/page.tsx のcanPractice=false分岐と src/app/score/[id]/rythme/page.tsx のcanGame=false分岐で、現在の裸のpによる早期returnを、通常画面と同じmainの幅・余白・見出し・共通トークンによる状態案内へ揃える。既存の利用不可文言の意味、認証redirect、revisionId、サーバー側の読取/認可と利用可否判定を保持し、利用不可時に評価規則や演奏/ゲーム部品を初期化しない順序も維持する。未解決の問題を持つ検証用楽譜で両経路を360px/1280pxで確認し、案内の可読性・全体横スクロール0・開始操作を表示しないことをvalidation.mdへ記録する。新しい描画・採点・認証処理や汎用ラッパーを追加しない。per FR-003/005/008/010、SC-004/005、T015 (partial)
