# Tasks: 既存プロダクトの設計・コードスタイルへの整合

**Input**: `specs/003-align-code-style/` の設計文書

**Prerequisites**: [plan.md](plan.md)、[spec.md](spec.md)、[research.md](research.md)、[data-model.md](data-model.md)、[scope.md](scope.md)、[contracts](contracts/)、[quickstart.md](quickstart.md)

**Tests**: FR-011とSC-002/003/005の変更前後比較・回帰確認に必要な検証を含む。新しい公開APIの検証は実装前に失敗を確認し、既存の挙動を固定する特性検証は変更前に成功を確認する。

**Format**: `- [ ] TNNN [P?] [USn?] 説明とファイルパス`。パスはリポジトリルートからの相対表記。

**Scope**: 新機能・依存追加・DB移行・判定規則変更なし。実装時も既存の適切な関数を維持する。維持判断のタスクは根拠と検証結果を記録して完了とする。

## Phase 1: Setup

- [x] T001 現在の作業ツリーを変更前の基準として記録し、Node/OS/CPU/メモリ・既知の検証結果と未コミット変更を specs/003-align-code-style/validation.md に記載する。HEADへの巻戻しや秘密値の出力は行わない
- [x] T002 specs/003-align-code-style/scope.md の8領域について対象ファイルと参照例を確定し、specs/003-align-code-style/validation.md に quickstart.md の8事例群の入力・期待結果・分母を登録する
- [x] T003 専用DBと一時Git領域を用意し、specs/003-align-code-style/quickstart.md の既存検証と scripts/benchmark-score-practice.ts の30回測定を変更前に実行して specs/003-align-code-style/validation.md に結果を記録する

**Checkpoint**: このフェーズの確認結果を記録してから依存する作業へ進む。

## Phase 2: Foundational

- [x] T004 変更前の楽譜・イベント・条件・期待タイムライン・照合・分析・ゲーム結果を src/s-core/fixtures/practice/compatibility.json に固定する。途中テンポ・タイ・和音・誤音・余分・正負補正・live/中断を含め、旧実装をコピーして期待値を再計算しない
- [x] T005 src/components/practice-controls.tsx と src/server/practice.ts のlive/終了時の未評価条件、時刻の意味、丸め順序、エラーを比較し specs/003-align-code-style/contracts/practice-api.md に具体的な境界条件を追記する
- [x] T006 固定事例と保存契約を検証する src/s-core/models/practice/compatibility.test.ts を作成し、既存入口で成功する基準検証を確立する。原本・期待音・集計・null・スコア・コンボ・非変更を比較する

**Checkpoint**: このフェーズの確認結果を記録してから依存する作業へ進む。

## Phase 3: User Story 1 - 既存の知識で追加機能を理解する (P1)

**Goal**: モデルと共通評価入口を整備して既存の知識で処理を追えるようにする。

**Independent Test**: 公開モデルの検証と固定事例の一致、時間変換・演奏評価の入出力と所有者の説明。

- [x] T007 [P] [US1] src/s-core/models/practice/performance.test.ts と conditions.test.ts に公開import/exportの回帰を追加する。「最大100000件、sequence厳密増加、時刻非減少」、MIDI値域、NOTE_ON velocity>0、relativeUs上限1801200000、不明キー拒否、コピーの独立性、未終了NOTE_ON、ゼロ件、条件値域を検証する
- [x] T008 [P] [US1] src/s-core/models/core/units/microseconds.test.ts と src/s-core/models/practice/tempo-map.test.ts に「非負の安全な整数」「符号付きの安全な整数」、負の差、途中テンポ、倍率、端点丸めの事例を追加する
- [x] T009 [P] [US1] src/s-core/models/practice/evaluator.test.ts に固定DTOを使ったLIVE/COMPLETED/INTERRUPTEDの契約検証を追加し、同時刻順序、正誤・欠落・余分、閾値、和音、未評価、null/分母/コンボを検証する
- [x] T010 [US1] src/s-core/models/core/units/microseconds.ts と time-offset.ts を既存NumericValueObjectに合わせて実装し index.ts に公開する。「非負の安全な整数」と「符号付きの安全な整数」を検証し、負になり得る差はTimeOffsetを返す明示的な操作とする
- [x] T011 [US1] src/s-core/models/practice/tempo-map.ts にTempoMapを実装する。「最初の区間start=0、開始位置重複なし」、正のtempoと倍率を検証し、小数の絶対時刻を返す。Timelineで小数originを引いた後に端点をMath.roundし、絶対時刻同士を丸めてから引かない。Beat.toSecondsの単一テンポ処理へ置換しない
- [x] T012 [P] [US1] src/s-core/models/practice/performance.ts にPerformanceを実装し contracts.ts の既存strict schemaを再利用する。「最大100000件、sequence厳密増加、時刻非減少」、既存MIDI値域、時刻上限を維持し、独立コピーを所有する。exportで未終了音を補完・量子化・並替えしない
- [x] T013 [P] [US1] src/s-core/models/practice/conditions.ts にConditionsを実装し contracts.ts の既存schemaを再利用する。「rangeは1起点の包含範囲、tempoScaleは正、calibrationUsは符号付きTimeOffset」、既存値域±1000000、trackId非負整数、ruleVersion正整数、mode enumを維持する
- [x] T014 [US1] src/s-core/models/practice/timeline.ts をTimelineモデルへ整理する。validated Sheet snapshotとConditionsから期待値を生成して所有し「対象トラック・小節存在、正の範囲、30分上限」を維持する。休符、タイ、chordId、bar、丸め順序と原本を保持し、Core.Score.createでSheet情報を落とさない
- [x] T015 [US1] src/s-core/models/practice/evaluator.ts にEvaluatorと判別可能なcontextを実装する。matching.ts、analyze.ts、game-evaluation.tsの計算とInputPoolを再利用し、ライブ/中断の未評価処理を共通入口へ集約する。LIVE.elapsedUsは符号付きTimeOffset、終了時endedUsは非負Microsecondsとし、負のカウントインと未評価条件の等号境界を維持する。PRACTICEのgameはnull、原本・期待値は不変とする
- [x] T016 [US1] src/s-core/models/practice/index.ts でConditions・Performance・Timeline・Evaluatorを公開し、移行中の既存入口を同一実装へ委譲する。contracts.ts の外部DTOと型、analysis-contracts.ts、game-contracts.ts の保存キーを維持する
- [x] T017 [US1] src/server/practice.ts を共通モデルの利用へ移行する。practice-access.ts の認可された版・evaluation-rule.ts の規則選択・取引を維持し、クライアントの採点を信頼せずexportしたDTOだけを保存・ハッシュ化する
- [x] T018 [US1] src/components/use-practice-session.ts に機器・clock・session・live/終了評価の制御を分離し、practice-controls.tsx を接続する。既存browser/midi-recorder.ts、practice-clock.ts、practice-session.tsの所有・起動取消・購読解放を維持する
- [x] T019 [US1] src/components/use-practice-submission.ts に送信・再試行・結果の制御を分離して practice-controls.tsx を接続する。同一clientSessionId、条件、原本、終了情報による再送と画面の状態遷移を維持する
- [x] T020 [US1] src/components/practice-controls.tsx の条件入力と結果表示を責務単位で整理し、名前付きpropsと概念ごとの宣言を使う。practice-analysis.tsx、game-result.tsx、rhythm-game.tsx を再利用し、操作と表示内容を維持する
- [x] T021 [US1] scripts/benchmark-score-practice.ts と src/s-core/models/browser/practice-session.ts の利用側を公開モデルへ接続し、src/components/practice-controls.tsx・src/server/practice.ts を含む旧入口参照をrgで確認する。移行専用の委譲を削除し内部計算は保持する
- [x] T022 [US1] src/s-core/models/practice/compatibility.test.ts と関連モデル・browser・components・serverの既存テストを実行し、specs/003-align-code-style/validation.md に結果と2つの読解課題の説明資料を記録する

**Checkpoint**: このフェーズの確認結果を記録してから依存する作業へ進む。

## Phase 4: User Story 2 - 整理後も同じ楽譜と練習記録を使う (P1)

**Goal**: 保存済みの楽譜と練習記録を同じ結果で使えることを確認する。

**Independent Test**: 既存DTOの保存・再読込・再送・履歴と中断の互換事例を単独実行。

- [x] T023 [P] [US2] src/server/practice.integration.test.ts に変更前DTOの保存・再読込、checksum/submissionHash/comparisonKey一致、成功再送・内容競合拒否、固定版・規則、中断・未終了音の互換事例を追加する
- [x] T024 [P] [US2] src/server/practice-history.integration.test.ts と game-session.integration.test.ts に保存済み完了/中断記録、権限剥奪、削除再計算、評価JSON/null値・同点順序の互換事例を追加する
- [x] T025 [P] [US2] src/components/practice-controls.test.tsx にhook分離後の起動取消、許可拒否・切断、count-in、hidden/pagehide/unmount、音声停止と内容不変の再送事例を追加する
- [x] T026 [US2] 既存JSONの原本往復と音楽情報を src/s-core/models/import/json.test.ts、score-schema.test.ts、ties.test.ts と practice/compatibility.test.ts で確認し、既存の期待値に差があれば新モデルの変換を修正する。保存形式・規則・バージョンを更新して差を隠さない
- [x] T027 [US2] specs/003-align-code-style/quickstart.md の事例群1〜5を実行し、保存済み楽譜・履歴の移行なし参照、表示・再生・練習・ゲーム・分析を確認して validation.md に全分母と結果を記録する

**Checkpoint**: このフェーズの確認結果を記録してから依存する作業へ進む。

## Phase 5: User Story 3 - 変更全体の範囲と例外をレビューする (P2)

**Goal**: 追加変更全体の8領域で整合判断と例外をレビューできるようにする。

**Independent Test**: scopeの全領域に参照例・判断・対象ファイル・検証結果が揃い、事例群6〜8が一致。

- [x] T028 [P] [US3] src/s-core/models/import/convert.ts、midi.ts、musicxml.ts、json.ts と形式別extensionsの再利用を確認し、必要な命名・宣言・責務のみ整える。partial、不明値、原本、converterVersionを保持し specs/003-align-code-style/review-notes/T028.md に判断と検証結果を記録する。scope.mdはT035で統合する
- [x] T029 [P] [US3] src/server/import-http.ts、import-worker.ts、score-import.ts、import-limits.ts の境界を確認して密な宣言・分岐を整理する。origin・制限・取消・worker・preview・revalidateを維持し specs/003-align-code-style/review-notes/T029.md に判断と検証結果を記録する。scope.mdはT035で統合する
- [x] T030 [P] [US3] src/server/git-store.ts、git-operation.ts、git-acceptance.ts、git-publication.ts、merge-proposal.ts、proposals.ts、repositories.ts の整合判断を確認する。必要箇所だけprepare/adopt/publishの命名・流れを明確化し、CAS・receipt・lease・取引・recoveryを維持して specs/003-align-code-style/review-notes/T030.md に判断と検証結果を記録する。scope.mdはT035で統合する
- [x] T031 [P] [US3] src/server/practice-history.ts のqualityの位置依存タプルと密な宣言を意味のある名前へ整理する。比較キー・同点順序・完了のみの達成判定・削除再計算の取引を維持し specs/003-align-code-style/review-notes/T031.md に判断と検証結果を記録する。scope.mdはT035で統合する
- [x] T032 [P] [US3] src/server/trust-calculation.ts、trust.ts、src/components/user-trust.tsx、trust-admin.tsx の命名・宣言を必要箇所だけ整える。計算/永続化/認可の既存分離、監査と規則を維持して specs/003-align-code-style/review-notes/T032.md に判断と検証結果を記録する。scope.mdはT035で統合する
- [x] T033 [P] [US3] src/components/use-mutation-key.ts、import-preview.tsx、proposal-editor.tsx、repository-create.tsx、authenticated-content.tsx と src/app/actions/ の変更を領域別規約でレビューする。必要なprops/命名のみ整え、再送キー・ActionResult・認証・画面操作を維持して specs/003-align-code-style/review-notes/T033.md に判断と検証結果を記録する。scope.mdはT035で統合する
- [x] T034 [P] [US3] src/server/score-backup.ts、maintenance-gate.ts、scripts/backup-score-git.ts、verify-score-git.ts、recover-git-publications.ts と .github/workflows/test.yml・.devcontainer/devcontainer.json を確認する。必要な密な宣言だけ整理し運用入口・freeze・backup/recoveryと環境を維持して specs/003-align-code-style/review-notes/T034.md に判断と検証結果を記録する。scope.mdはT035で統合する
- [x] T035 [US3] specs/003-align-code-style/scope.md にreview-notes/T028.md〜T034.mdを直列統合して8領域すべての変更・維持ファイル、参照例、差異の理由、関連検証結果を確定し、quickstart.md の事例群6〜8を実行して validation.md に記録する

**Checkpoint**: このフェーズの確認結果を記録してから依存する作業へ進む。

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T036 src/s-core/models/practice/index.ts の公開契約と実際の利用側を照合し、specs/003-align-code-style/contracts/practice-api.md・compatibility.md・data-model.md・quickstart.md の内容とリンクを最終実装に合わせる
- [x] T037 specs/003-align-code-style/quickstart.md に従い npm test -- --run、npm run test:integration、npx tsc --noEmit、npm run lint、npm run build と変更ファイルのPrettier・git diff --checkを実行して validation.md に成功/失敗と影響を記録する
- [x] T038 scripts/benchmark-score-practice.ts を同環境で30回測定して変更前と比較し、specs/003-align-code-style/validation.md にp95/max・環境・悪化時の調査と解消結果を記録する
- [x] T039 既存設計を知る保守担当者による時間変換・演奏評価の2課題（入力/所有者/入口/出力）の読解確認と8領域のレビューを実施し specs/003-align-code-style/validation.md に結果を記録する。未実施は未完了とし、自動検証で代用しない
- [x] T040 specs/003-align-code-style/validation.md でFR-001〜011/SC-001〜005と全比較事例を照合する。prisma/schema.prisma・保存JSON・規則バージョンの不変を確認し、002と specs/001-score-practice-platform/tasks.md のT079保留を維持する

**Checkpoint**: このフェーズの確認結果を記録してから依存する作業へ進む。

## Dependencies & Execution Order

```text
Setup T001–T003
  → Foundation T004–T006
  → US1 T007–T022
  → US2 T023–T027
  → Final T036–T040
Foundation → US3 T028–T030 / T032–T034
US2 T024 → US3 T031
US3 T028–T034 + US1/US2完了 → T035 → Final
```

- T001→T002→T003→T004→T005→T006。基準を保存する前にソースを変更しない。
- US1: T007/T008/T009はFoundation後に別ファイルで並行可能。T010→T011。T012/T013はT010後に並行可能。T014はT011/T013後、T015はT012/T014後、T016はT015後。
- T017はT016後、T018→T019→T020はT016後。同じpractice-controls.tsxを変更するためT018〜T020は直列。T021はT017/T020後、T022はT021後。
- US2のT023/T024/T025はUS1の公開契約確定後に別ファイルで並行可能。T026はその後、T027はT023〜T026の完了後。US2はUS1を前提とするが、保存・履歴の互換事例として独立して検証できる。
- US3のT028〜T030/T032〜T034のソース調査・整理はFoundation後に別担当領域で並行可能。scope.mdへの追記は各作業結果をまとめてT035で直列統合し、同時編集しない。T030で取引を分断しない。T031はUS2の履歴検証確定後に実行する。
- T036→T037→T038→T039→T040。最終の全体検証はソース整理を終えてから実施する。

## Parallel Examples

### US1

Foundation完了後、T007（Performance/Conditions検証）、T008（単位/TempoMap検証）、T009（Evaluator検証）を別ファイルで進められる。T010完了後にT012（Performance）とT013（Conditions）を並行できる。

### US2

US1完了後、T023（保存/再送）、T024（履歴/ゲーム）、T025（UIライフサイクル）の検証はファイルが異なるため並行できる。専用DBを共有する統合テストの実行は既存configに従って直列化する。

### US3

T028（音楽変換）、T029（サーバーimport）、T030（Git共同編集）、T032（信頼度）、T033（UI/actions）、T034（運用）のソース対象は別領域。scope.mdへの最終結果追記はT035で統合する。依存が未完了のタスクは[P]でも開始しない。

## Implementation Strategy

1. Setup/Foundationで現在の作業ツリーの意味と比較事例を固定する。
2. MVPはUS1（T007〜T022）。公開モデルと呼び出し側を統合し、既存の固定事例が一致するところまでをレビュー可能な単位とする。互換性検証を省いて公開しない。
3. US2で保存済み記録・履歴・再送の互換性を確認し、US3で残りの領域の必要な整合と例外を記録する。
4. 最後に全体検証、性能比較、人の読解確認を行う。人による確認が未実施ならT039は保留し、他の許可済み作業を進める。
5. T079の実機・初見5人試用は本機能で代替せず保留を維持する。コミット・公開・新しい認証機能はこのタスク生成では行わない。

## Requirement Coverage

| 要件                   | 主なタスク                               |
| ---------------------- | ---------------------------------------- |
| FR-001/002/010・SC-001 | T002、T028〜T035、T039〜T040             |
| FR-003                 | T008、T010〜T014、T028                   |
| FR-004/005・SC-004     | T015〜T022、T039                         |
| FR-006                 | T004、T007、T012、T026                   |
| FR-007・SC-003         | T023〜T027、T040                         |
| FR-008・SC-002         | T006、T009、T014〜T015、T022、T024〜T027 |
| FR-009・SC-005         | T017〜T019、T023〜T025、T029〜T035、T037 |
| FR-011                 | T001〜T006、T022、T027、T035、T037〜T040 |

## Notes

- checkboxは実装と検証の証拠を確認して更新する。実施結果はvalidation.mdに記録する。
- 行数削減や形式的なクラス化を目的にしない。既存再利用と責務の追跡を改善する。
- 文書の仕様品質チェック完了は、これらの実装タスクの完了を意味しない。
