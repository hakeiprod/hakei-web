# Tasks: 認証UIのHeroUI統一

**Input**: `specs/004-heroui-auth-ui/`の[spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[UI契約](contracts/auth-ui.md)、[quickstart.md](quickstart.md)。憲章v1.2.0を適用する。

**Scope**: 既存5画面を導入済みHeroUIへ統一する。DB・認証方式・サーバー契約・依存・標準ログイン画面は変更しない。

**Tests**: 仕様のUser Scenarios & Testing、SC-002〜004とUI契約に従い、既存意味テストの拡張と実画面検証を含める。追加する回帰ケースは変更前の不一致を確認してから表示を修正する。既存の成功ケースを故意に壊す必要はない。

**Format**: `- [ ] Tnnn [P?] [USn?] 説明とファイルパス`。全パスはリポジトリルート基準。[P]は同一グループ内で別ファイルを扱えるタスク。前提タスク完了後にのみ並行可能。

## Phase 1: Setup

**Purpose**: 現行動作を基準として記録する。新しいプロジェクトや依存は作らない。

- [x] T001 Node22と既存依存・Prisma生成状態を確認し、quickstartの認証UI既存テストを実行する。コード版・結果・既存失敗・002のSMTP/実OAuthと001の実機試用保留を `specs/004-heroui-auth-ui/validation.md` に記録する。
- [x] T002 `src/components/email-registration.tsx`、`src/components/auth-confirmation.tsx`、`src/components/password-reset.tsx`、`src/components/password-change.tsx`、`src/components/password-addition.tsx` の入力/主要・補助操作/リンク/結果をUI契約と対応付け、既存href・operation・文言・必須手順を `specs/004-heroui-auth-ui/validation.md` に基準として記録する。

## Phase 2: Foundational

**Purpose**: 全ストーリーに必要な表示部品だけを用意する。T001〜T002完了後に開始し、T003〜T005完了後に画面改修へ進む。

- [x] T003 [P] `src/components/auth-panel.tsx` にtitle/childrenだけを受ける非操作型CardのAuthPanelを作成する。section/h1、既存テーマ、w-full/min-w-0/max-w-lg相当と長文折返しを保持し、認証状態・秘密・送信処理を持たせない。
- [x] T004 [P] `src/components/auth-feedback.tsx` にAlertのAuthFeedbackを作成する。「公開可能な日本語案内のみ。入力エラーと共通サーバー案内を区別する」を守り、messageのみを受け、role=status/aria-live=polite、空messageで本文なし、秘密・生例外なしとする。
- [x] T005 T003〜T004の実HeroUI描画で見出し・通知名/role・空結果を確認する `src/components/auth-panel.test.tsx` と `src/components/auth-feedback.test.tsx` を作成する。Provider/ブラウザーAPI補助が必要な場合だけテスト内に置き、HeroUI全体を素のHTMLへmockしない。

## Phase 3: US1 — 統一された画面で登録・確認する (P1 / MVP)

**Goal**: 登録・再送と共有確認画面をHeroUIへ置換する。共有確認の全目的の表示置換はこのフェーズだけで行い、後続ストーリーで重複改修しない。

**Independent Test**: 登録要求→共通案内→VERIFYの明示確定→通常ログイン案内。再送、無効入力、リンク欠落、通信失敗、pendingも独立に確認できる。

### Tests

- [x] T006 [P] [US1] `src/components/email-registration.test.tsx` にラベル・入力エラー関連、送信中表示/無効化、連打/Enterの要求重複防止、離脱時abort、再送、共通案内、成功時password消去、GitHub条件表示の回帰を追加する。
- [x] T007 [P] [US1] `src/components/auth-confirmation.test.tsx` にVERIFYの条件/エラー関連、fragment除去後だけ入力可、GET非消費、欠落/無効/再読込の再要求、明示POST、成功時秘密消去/通常ログイン案内の回帰を追加する。既存RESET/ADDケースも維持する。 送信中のunmountでabortし、遅延結果・成功後処理が発生しないことも `src/components/auth-ui-accessibility.test.tsx` の該当画面ケースで検証する。

### Implementation & Validation

- [x] T008 [P] [US1] `src/components/email-registration.tsx` の入力・操作・リンク・結果をInput/Button/Linkと共通表示へ置換する。「メールは既存emailSchemaで検証。パスワード原文を保持し15〜128コードポイント。不正サロゲート拒否」を維持し、minLength/maxLength/trimを追加しない。native form、type/autoComplete、再送、operation、AbortControllerを保持する（T006後）。
- [x] T009 [P] [US1] `src/components/auth-confirmation.tsx` の共有表示をInput/Button/Linkと共通表示へ置換する。「fragment除去後メモリーのみ。表示合成部品へ渡さない。成功時clear。再読込は再要求」を保持する。VERIFY/RESET/ADD_PASSWORDの既存operation・ラベル・再要求先・getSessionと明示POSTを変更しない（T007後）。
- [x] T010 [US1] T006〜T009のテストと登録/VERIFYの独立シナリオを実行し、3段階以内・自動ログインなし・既存遷移先維持の結果を `specs/004-heroui-auth-ui/validation.md` に記録する。

## Phase 4: US2 — 同じ操作体系でパスワードを回復・変更する (P1)

**Goal**: 再設定要求と変更を統一し、共有確認のRESET動作を維持する。

**Independent Test**: RESET要求/リンク確定と、既存credential利用者の現在passwordによる変更を独立実行し、成功後に秘密入力がなく通常ログインへ進めることを確認する。

### Tests

- [x] T011 [P] [US2] `src/components/password-reset.test.tsx` にメールのラベル/エラー、共通案内、通信失敗後再試行、pending/重複要求防止の回帰を追加する。 送信中のunmountでabortし、遅延結果・成功後処理が発生しないことも `src/components/auth-ui-accessibility.test.tsx` の該当画面ケースで検証する。
- [x] T012 [P] [US2] `src/components/password-change.test.tsx` にcurrent/newのラベル・条件/エラー、利用制限/不正password/通信失敗、pending、成功時入力終了・getSession・ログイン案内の回帰を追加する。 送信中のunmountでabortし、遅延結果・成功後処理が発生しないことも `src/components/auth-ui-accessibility.test.tsx` の該当画面ケースで検証する。

### Implementation & Validation

- [x] T013 [P] [US2] `src/components/password-reset.tsx` をInput/Buttonと共通表示へ置換し、既存emailSchema/native email検証・useAuthSubmission・requestPasswordReset・共通日本語案内を維持する（T011後）。
- [x] T014 [P] [US2] `src/components/password-change.tsx` をInput/Button/Linkと共通表示へ置換する。current-password/new-password、既存Zodと「処理中は再要求を拒否。unmountでabortし、遅延結果を描画しない」を保持し、成功後入力消去・全端末失効の説明・getSessionを維持する（T012後）。
- [x] T015 [US2] `src/components/auth-confirmation.test.tsx` でRESETのPOST/再要求先/自動ログインなしを確認し、T011〜T014と合わせた独立シナリオの結果を `specs/004-heroui-auth-ui/validation.md` に記録する（共有画面T009後）。

## Phase 5: US4 — 画面幅や入力方法に左右されず操作する (P1)

**Goal**: 共通表示と利用可能な各画面で、幅・キーボード・支援技術・パスワード管理の契約を満たす。US3の最終画面確認はT027〜T028で補完する。

**Independent Test**: 対象コンポーネントを制御された入力/通信条件で直接描画し、他の認証手続きや実OAuthに依存せず名前・条件・通知・入力原文・操作順を確認できる。

### Tests

- [x] T016 [P] [US4] `src/components/auth-ui-accessibility.test.tsx` に5コンポーネントのアクセス可能な名前・required/autoComplete・description/errorの関連・polite通知・明示button typeの意味テストを追加する。実HeroUIで描画し、内部class名/スナップショットに依存しない。
- [x] T017 [P] [US4] `src/components/auth-ui-password-input.test.tsx` に登録/確認/変更の14/15/128/129コードポイント、絵文字・多言語・不正サロゲート、原文送信、パスワードのminLength/maxLengthなし、貼付け相当の値更新を検証するケースを追加する。

### Implementation & Validation

- [x] T018 [US4] T016〜T017で見つかったUI接続の不一致だけを `src/components/email-registration.tsx`、`src/components/auth-confirmation.tsx`、`src/components/password-reset.tsx`、`src/components/password-change.tsx` で修正する。ローカルZodエラーをInputへ関連付け、API共通案内を登録状態のフィールドエラーへ変換しない。既に満たす箇所は再実装しない（T008/T009/T013/T014後）。
- [ ] T019 [US4] `src/components/auth-panel.tsx` と `src/components/auth-feedback.tsx` の実画面で320px/1280px、長文・pending・成功時の折返しとフォーカスを確認し、必要な幅/折返しだけ修正する。利用可能な画面のTab/Shift+Tab/Enter、読み上げ、貼付け/管理ツールも確認し、結果・未実施理由を `specs/004-heroui-auth-ui/validation.md` に記録する。
- [ ] T020 [US4] T016〜T019の結果を `specs/004-heroui-auth-ui/validation.md` のSC-003/004へ対応付ける。jsdomで証明できる項目と実ブラウザー項目を区別し、US3最終画面の再確認をT027〜T028へ明示する。実施不能な項目をPASSにしない。

## Phase 6: US3 — 条件に応じてパスワードを追加する (P2)

**Goal**: GitHub利用可否・メール有無を維持して追加画面を統一し、共有確認のADD動作を検証する。

**Independent Test**: githubAvailable/hasEmailを切替え、既存再認証開始・メール要求・ADD確認を制御されたfixtureで実行する。実OAuth未登録でも表示と分岐を検証できる。

### Tests

- [x] T021 [P] [US3] `src/components/password-addition.test.tsx` にGitHub無効時非表示、メール欠落説明、再認証→標準signIn、メール要求、pending/重複防止、失敗後再試行と日本語通知の回帰を追加する。 送信中のunmountでabortし、遅延結果・成功後処理が発生しないことも `src/components/auth-ui-accessibility.test.tsx` の該当画面ケースで検証する。
- [x] T022 [P] [US3] `src/components/auth-confirmation.test.tsx` のADD_PASSWORDで明示POST・再要求先/account/security・成功時入力終了/getSession/通常ログイン案内を検証する。既存の同一ブラウザー・本人条件をUI側で緩和しない。

### Implementation & Validation

- [x] T023 [US3] `src/components/password-addition.tsx` をButtonと共通表示へ置換する。「サーバーから既存の公開bool/分岐だけ。秘密の設定値や認可判断をUIへ移さない」を保持し、15分/同一ブラウザーの案内、既存再認証とメール要求順序・失敗処理を維持する（T021後）。
- [x] T024 [US3] `src/app/account/security/page.tsx` の対象内ホームリンクをHeroUI Linkへ統一する。requireActor、credential/User取得と既存分岐は維持する。client依存の配置が必要ならリンクの表示部だけを分離し、サーバー認可を移さない。
- [x] T025 [US3] T021〜T024とT009のADD確認を実行し、`src/components/auth-ui-accessibility.test.tsx` の追加画面ケースを再実行する。GitHub可否/メール有無・標準遷移・秘密なしの結果を `specs/004-heroui-auth-ui/validation.md` に記録する。

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全画面の最終回帰・実画面確認。各ストーリーの実装完了後に行う。

- [x] T026 `specs/004-heroui-auth-ui/quickstart.md` の型検査、変更した全TS/TSXとテストのlint/書式、`npm test -- --run`、専用DBで`npm run test:integration`、`npm run build`を実行し、結果を `specs/004-heroui-auth-ui/validation.md` に記録する。既存認証テストで全失効・User/Account・権限不変・無効リンク/条件拒否を確認する。
- [ ] T027 全5画面の通常/エラー/pending/成功と確認3目的を320px/1280pxで実ブラウザー確認し、横スクロールなし・主要操作とリンク100%到達・見えるフォーカス・長文折返しを `specs/004-heroui-auth-ui/validation.md` に記録する（T019の再利用可、US3は最終状態を確認）。
- [ ] T028 全5画面の入力ラベル/条件/エラーと結果通知を支援技術で確認し、Tab/Enter・貼付け・パスワード管理の自動入力も実ブラウザーで確認する。使用環境と結果を `specs/004-heroui-auth-ui/validation.md` に記録する。未準備の確認は未完了で残す。
- [x] T029 `specs/004-heroui-auth-ui/contracts/auth-ui.md` とT002基準を最終差分に照合し、5画面のHeroUI部品対応、登録3段階以内、追加必須入力/操作なし、operation/href/秘密寿命/認証条件不変を `specs/004-heroui-auth-ui/validation.md` に記録する。独自表示部品が必要になった場合だけ具体的理由を `specs/004-heroui-auth-ui/plan.md` へ追記する。
- [x] T030 `specs/004-heroui-auth-ui/validation.md` にFR-001〜012/SC-001〜005の証跡・残る未実施をまとめ、`specs/004-heroui-auth-ui/quickstart.md` のコマンドを実装後の実ファイルへ合わせる。002の実SMTP/実OAuth/最終受け入れと001の実機試用保留は別管理で維持し、未検証を完了扱いにしない。

## Dependencies & Execution Order

```text
T001 → T002 → {T003, T004} → T005
T005 → US1(T006〜T010)
T005 → US2(T011〜T014) ; T009 + T011〜T014 → T015
T005 → US4 tests(T016,T017)
T008,T009,T013,T014 + T016,T017 → T018 → T019 → T020
T005 → US3(T021〜T024) ; T009,T021〜T024 → T025
US1 + US2 + US4 + US3 → T026 → T027 → T028 → T029 → T030
```

- 推奨順序はSetup→Foundational→US1(P1)→US2(P1)→US4(P1)→US3(P2)→最終検証。
- US1が共有確認を一度だけ置換し、US2/US3は目的別のテストで結果を受け入れる。これらの共有ファイル編集は同時に行わない。
- US4は独立した直接描画テストから開始できる。画面側の修正T018は対象ストーリーの変更後、最終の全画面判定はUS3後に行う。
- validation.mdは各チェックポイントで順番に更新し、同時編集しない。各ストーリーの独立試験は実OAuth/実SMTPの保留を解除する条件ではない。
- [P]は並行作業の可能性を示すだけで、エージェント起動の指示ではない。

## Parallel Execution Examples

| ストーリー/基盤 | 前提                  | 同時に扱えるタスク                                 | その後               |
| --------------- | --------------------- | -------------------------------------------------- | -------------------- |
| 基盤            | T002                  | T003とT004（別表示部品）                           | T005                 |
| US1             | T005                  | T006とT007（別テスト）、その後T008とT009（別画面） | T010                 |
| US2             | T005                  | T011とT012、その後T013とT014                       | T009完了後T015       |
| US4             | T005                  | T016とT017（別の横断テスト）                       | 画面変更後T018〜T020 |
| US3             | US1の共有確認変更完了 | T021とT022（別テスト）                             | T023→T024→T025       |

US1/US2の別画面は基盤後に並行可能。ただし共有確認テスト、共通表示の再修正、検証記録の編集は順番に行う。[P]タスクでも自分の明記された前提は待つ。

## Requirement Coverage

| 要件               | タスク                                               |
| ------------------ | ---------------------------------------------------- |
| FR-001、SC-001     | T003〜T009、T013〜T014、T023〜T024、T029             |
| FR-002/011、SC-004 | T004〜T007、T011〜T012、T016、T018〜T020、T027〜T028 |
| FR-003             | T006〜T009、T011〜T014、T021〜T023、T026             |
| FR-004             | T008、T014、T017〜T018、T028                         |
| FR-005/006         | T007、T009、T015、T022、T026、T029                   |
| FR-007/009         | T006、T008、T011〜T014、T021〜T026                   |
| FR-008/012、SC-002 | T007、T009〜T015、T022〜T026、T029                   |
| FR-010、SC-003     | T003、T019〜T020、T027〜T028                         |
| SC-005             | T002、T010、T029                                     |

## Implementation Strategy

MVPはUS1（基盤+T006〜T010）の登録/確認。既存フローとの一致を確認してからUS2、US4、US3を追加する。MVPだけで全5画面の統一完了とはしない。新規永続モデル・API・migration・依存追加のタスクは不要。

各段階で失敗原因がUI置換以外にある場合は既存問題と切り分け、認証仕様を変更して試験を通さない。手動確認や環境準備待ちは具体的な未実施として残す。完了チェックは実装・検証結果を得てから付ける。
