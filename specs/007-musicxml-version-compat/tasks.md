# Tasks: MusicXMLの複数バージョン取り込みと旧importer互換性

**Input**: `specs/007-musicxml-version-compat/` の spec.md、plan.md、research.md、data-model.md、contracts/、quickstart.md。

**Prerequisites**: 設計成果物は作成済み。現在の作業ブランチ名と仕様IDは独立し、`.specify/feature.json` が007を指すことを確認する。今回のタスク生成では実装・ブランチ切替・コミットを行わない。

**Tests**: spec FR-013/014と各Independent Test、憲章IVの要求に基づき含める。各段階の挙動テストを先に追加し、変更対象で失敗することを確認してから実装する。既存で通る保持条件は成功を基準として残す。クラス名だけの試験や実装から採取した期待値は追加しない。

**Organization**: US1=P1、US2=P1、US3=P2、US4=P2。T013の原本検証を含む全35タスク完了。各タスクの実測はvalidation.mdを参照。`[P]`は同一段階の前提完了後、別ファイルで並行できる作業を示す。パスはリポジトリルート相対。

## Phase 1: Setup

**Purpose**: 比較基準・証跡と素材調達の手順を整える。新規基盤・依存・DBは作らない。

- [x] T001 specs/007-musicxml-version-compat/validation.md を作成し、現在の単体/型/lint結果、対象4版×XML/MXLの実施表、旧MXL16件の4.0という調査結果、Menuett原本未入手を記録する。src/s-core/models/import/musicxml.ts の版拒否と convert.ts の4.0固定、旧 `5c15943^:src/s-core/models/browser/importer.ts` の実行時版制限なしを比較根拠として記録し、音楽意味の差を調査する対象を固定する。per FR-003/012/013、SC-004/006。
- [x] T002 specs/007-musicxml-version-compat/fixture-provenance.md に、各版の公式定義に適合する素材の出所・利用条件・hash・独立期待値の記録方法を作成する。Menuettは報告された実ファイルの入手が必要で、同名の別配布物・版番号だけの置換・合成楽譜を原本成功の代用にしないことを明記する。既存素材は src/s-core/fixtures/import/manifest.json と src/s-core/fixtures/files/musicxml/ を参照する。per FR-013/014。

## Phase 2: Foundational

**Purpose**: 全ストーリーが利用する素材と版の定義を整える。T001/T002完了後に開始する。

- [x] T003 src/s-core/fixtures/import/musicxml-versions/ に2.0/3.0/3.1/4.0の仕様に適合する原本XMLと対応MXLの8組を用意し、src/s-core/fixtures/import/manifest.json と specs/007-musicxml-version-compat/fixture-provenance.md に出所・利用条件・hash・版/容器・期待する音楽情報/確認事項/利用可否を記録する。共通内容の比較に加え、各版のDOCTYPE・声部・設定等の実際の記法を確認した例を含め、実装出力を期待値の生成元にしない。Menuett未入手はこの一般素材整備の完了を妨げない。per FR-001/004/005/013、SC-001/002。
- [x] T004 [P] src/s-core/models/import/musicxml-support.ts にparserと既存UIが共有できる小さい対応版・文書構造の定義を用意する。data-model.md の「rootまたは標準PUBLIC DOCTYPEの明示文字列2.0/3.0/3.1/4.0。DOCTYPEでも確定できない欠落・未知・対象外を補完しない」「score-partwiseのみ。timewise/opus等は対象外」を守り、共通importMetadataSchemaの文字列制約や永続schemaは変更しない。新しい汎用パーサー機構・依存・DB移行は追加しない。per FR-001/002/007/008/012。

**Checkpoint**: 8組と独立期待値、対応版定義が揃う。アプリが対応したことはまだ意味しない。

## Phase 3: User Story 1 - 以前利用できた楽譜をそのまま取り込む (Priority: P1) MVP

**Goal**: 対象4版をXML/MXLから読み、元版を表示・保存・再読込できる。

**Independent Test**: 新規リポジトリ作成→8組それぞれのアップロード→元版・内容確認→保存→再表示。原本入手後のMenuettも同じ操作で確認する。

### Tests first

- [x] T005 [P] [US1] src/s-core/models/import/musicxml.test.ts に4版の成功、DOCTYPEでも確定できない欠落/未知/対象外version、timewise/opus、DOCTYPEのPUBLIC/SYSTEM・一重/二重引用符・改行と版不一致のケースを追加する。version/rootの拒否を新契約の定数コードと照合し、標準外部宣言は取得しないことを検証する。現在の3.1拒否ケースを正常3.1の成功と真の対象外版の拒否へ分ける。src/s-core/fixtures/import/unsupported-version.musicxml の3.1/4.0宣言不一致は独立した不一致素材へ分け、真の対象外版素材と manifest.json の期待codeも新契約に合わせる。per FR-001/007/009、US1/AC1/3。
- [x] T006 [P] [US1] src/s-core/models/import/convert.test.ts に8組の元版保持と対応範囲内の成功、MusicXMLのQUANTIZE拒否を追加する。新規metadata.converterVersion=score-import-v2、MIDIのformatVersion=SMF-1.0、JSONのformatVersion=1を照合し、共通schemaをMusicXML専用enumに狭めないことを確認する。per FR-001/008/012、SC-001/006。
- [x] T007 [P] [US1] src/server/import-worker.integration.test.ts と src/server/score-import.integration.test.ts に8組のworker通過、保存、Git settings.json・DB ImportMetadata・score-reader経由の元版/候補/利用可否一致を検証するケースを追加する。専用末尾_test DB/Gitだけで実行し、既存署名・確認・保存操作を使う。per FR-008/011、SC-001。
- [x] T008 [P] [US1] src/components/import-preview.test.tsx に、対応4版の案内、MusicXMLの実際のmetadata.formatVersion表示、MIDI/JSONにMusicXML版表示が出ないことを検証するケースを追加する。既存の確認・取消・保存操作は維持する。per FR-002/008、US1/AC1。

### Implementation

- [x] T009 [US1] src/s-core/models/import/musicxml.ts の4.0限定をT004の対象版/構造検証へ変更し、変換戻り値に検証済みformatVersionを追加する。「標準外部DOCTYPEをオフラインで処理。内部subset/ENTITY、矛盾する明示版は拒否」を守り、SYSTEMの共通URLから欠落versionを推測しない。root版欠落時に限り、標準PUBLIC DOCTYPEの対応版を採用してINFOを残し、宣言なし/未知/矛盾の拒否テストを維持する。未対応版はUNSUPPORTED_MUSICXML_VERSION、構造はUNSUPPORTED_MUSICXML_STRUCTURE、矛盾/不正はINVALID_*で返し、raw XMLや例外本文を外部公開しない。T005を通す。per FR-001/007/009。
- [x] T010 [US1] src/s-core/models/import/convert.ts の固定formatVersion=4.0を変換が返す実版へ置き換え、converterVersionをscore-import-v2へ更新する。data-model.md の「MusicXML元版をそのまま記録」「当時の値を再推測・上書きしない」「既存PRESERVE。MusicXMLでQUANTIZEは拒否」「既存のbasenameのみ」を守る。src/s-core/models/import/contracts.ts の既存文字列schemaとworker/保存/読込の契約は維持し、T006/T007を通す。per FR-008/011/012。
- [x] T011 [US1] src/components/import-preview.tsx の4.0限定案内をT004の対応版一覧に合わせ、MUSICXMLの場合だけ元版を既存部品で表示する。UI再設計・独自アップロード導線は追加せず、既存ラベル・警告確認・pending・取消・保存を維持し、T008を通す。per FR-002/008、憲章VII。
- [x] T012 [US1] specs/007-musicxml-version-compat/quickstart.md のブラウザー手順で、専用環境の新規リポジトリ→4版×XML/MXLの8組→確認→保存→再表示を実施し、specs/007-musicxml-version-compat/validation.md に元版・独立期待値・実測・環境・操作結果を記録する。既存4.0の内容・利用可否も比較し、UI表示はキーボードと狭幅で確認する。per US1/AC1/3、SC-001/006。
- [x] T013 [US1] 報告された Menuett_in_G-Dur_BWV_Anh._114.mxl の実ファイルを入手し、src/s-core/fixtures/import/musicxml-versions/ と specs/007-musicxml-version-compat/fixture-provenance.md に許可される範囲で原本・利用条件・hash・実版・期待値を記録する。新規リポジトリ作成後のアップロード→プレビュー→確認/保存→再表示を実施し、問題要素の回帰を src/s-core/models/import/musicxml.test.ts または convert.test.ts に追加し、validation.md に実測と制限を記録する。原本未入手ならこのタスクは未完了のまま残し、別素材で代替完了にしない。必要なUS2/US3修正後に最終確認し、原本待ちでも他タスクは進める。per FR-014、US1/AC2、SC-004。

**Checkpoint**: T005〜T012で一般の受入経路を確認できる。US1全体とSC-004の完了にはT013が必須。表示警告やBLOCKINGの説明を要する実ファイルの最終確認はUS3完了後でもよい。

## Phase 4: User Story 2 - バージョンが違っても同じ音楽情報を利用する (Priority: P1)

**Goal**: 版にかかわらず音楽情報・声部の独立性と設定変化を保持する。

**Independent Test**: 各版の独立期待値を持つ楽譜を変換・保存し、音高/位置/音価/声部/和音/タイ/構成/設定の値と適用位置を比較する。US1の画面試験に依存せずモデルと保存経路から検証可能。

### Tests first

- [x] T014 [P] [US2] src/s-core/models/import/musicxml.test.ts に各版のduration/divisions、backup/forward、和音cursor、休符、弱起、タイ、複数段/パート、途中の拍子・調号・テンポ変更、direction offset/metronomeを独立期待値で検証するケースを追加する。版間の音楽内容が同等であることと、clef/beam/stem/type/dotsの既存意味も照合する。設定について、テンポ0・負数・非数値は拒否、有効だが解釈不能な指示とパート間の矛盾はBLOCKING、省略に対する既存既定値の補完はWARNINGになる独立したケースを追加する。per FR-004、FR-005、US2/AC1〜3、SC-002。
- [x] T015 [P] [US2] src/s-core/models/import/musicxml-voices.test.ts に数値/文字列voice、01と1、後から出る数値IDとの衝突、voice省略、パート別の同ラベルとタイの連続性のケースを追加する。data-model.md の「同じラベルは同じID、異なるラベルは異なるID」「省略voiceは従来の1と同じ扱い」を検証し、単に読込成功で済ませない。per FR-004、US2/AC1、SC-002。
- [x] T016 [P] [US2] src/server/score-import.integration.test.ts に、複数声部/和音/タイ/設定変更を持つ各版候補について保存前後の音楽意味と元版の一致、提案経由の引継ぎを検証するケースを追加する。版番号以外が同内容の対照例も使い、保存後の値を独立期待値と照合する。per FR-004/005/008/011、US2/AC2/3。

### Implementation

- [x] T017 [US2] src/s-core/models/import/musicxml.ts のXML数値化を必要な値の境界に限定し、voice字句を保持してパート内で安定した非負整数IDへ対応させる。「既存の正規の非負整数表記はそのIDを優先して予約し、その他のラベルは衝突しない空きIDへ対応する」「01と1等を別ラベルとして保持する」を満たす。Sheet/schemaをstringへ変更せず、clef/beam等の既存数値正規化も保持してT015を通す。per FR-004、plan:Phase1/2。
- [x] T018 [US2] src/s-core/models/import/musicxml.ts の時刻・音符・設定正規化についてT014/T016で確認した差だけを修正し、拍と秒を混同せず、保持対象の値と適用位置を一致させる。既存で正しい処理は維持する。欠落pitch/onset/durationは既存nullableとBLOCKINGを用い、パート時刻矛盾を黙って合わせず、反復展開や新しい演奏表現を追加しない。per FR-004/005/006、SC-002。
- [x] T019 [US2] src/s-core/models/files/musicxml/extensions/to-sheet.test.ts と旧MXL16素材について、旧モデルとの音楽意味の比較を src/s-core/models/import/musicxml-compatibility.test.ts に追加し、specs/007-musicxml-version-compat/validation.md に回復した差と正確性/安全性のため残す差を記録する。旧モデルを正解の唯一の根拠にせず独立期待値と照合し、4.0素材を旧版の成功件数へ含めない。per FR-003/004/005/013、SC-004/006。

**Checkpoint**: 保持対象の意図しない差0件。解析成功だけでなく、版間・保存前後の意味を確認する。

## Phase 5: User Story 3 - 未対応・不完全な内容を理解して判断する (Priority: P2)

**Goal**: 表示省略の警告、音楽上の利用不可、入力の拒否を区別して案内する。

**Independent Test**: 正常な音楽＋表示省略、演奏順未対応、欠落音符、対象外版/構造、不正入力をそれぞれ投入し、説明と保存/練習/ゲーム可否が対応表と一致する。

### Tests first

- [x] T020 [P] [US3] src/server/import-http.test.ts と src/app/api/score-import/preview/route.test.ts にUNSUPPORTED_MUSICXML_VERSION/STRUCTURE→415、VALIDATION_FAILED→422、上限→413、期限→504と既存401/403/429/499/503の安全な案内を検証するケースを追加する。テンポ0・負数・非数値等の不正な設定値はVALIDATION_FAILED/422となり、設定省略のWARNINGや有効だが解釈不能な指示のBLOCKINGをHTTP拒否と取り違えないことも検証する。対応版/構造と次の行動が判断でき、raw XML・path・parser例外を公開しないことを確認する。per FR-007、US3/AC3。
- [x] T021 [P] [US3] src/s-core/models/import/diagnostics.test.ts と src/s-core/models/import/ties.test.ts に対応表のWARNING/BLOCKING/partialの代表例を追加する。「severityはINFO/WARNING/BLOCKING、statusはUNRESOLVED/RESOLVED」「未解決BLOCKINGまたはpartialはcanPractice/canGame=false」「acknowledgementは同意記録であり、validationの制限解除ではない」を検証し、通常編集で出所依存の問題が消えないことも確認する。per FR-006、SC-003。
- [x] T022 [P] [US3] src/components/import-preview.test.tsx に、表示警告・利用不可理由と位置・確認後も残る制限・欠落値修正と再検証の操作ケースを追加する。装飾情報の省略だけの例は演奏可、演奏へ影響する例は利用不可と区別する。per FR-002/006、US3/AC1/2。

### Implementation

- [x] T023 [US3] src/server/import-http.ts を contracts/score-import.md のエラー表に合わせ、未対応版/構造を区別し、対応範囲と次の行動を含む安全な日本語案内へ対応させる。既存envelope/HTTP/cache制約を維持する。src/server/import-worker-entry.ts の許可コード経由でも同じ分類が届くことを確認し、T020を通す。per FR-007。
- [x] T024 [US3] src/s-core/models/import/musicxml.ts と必要な範囲の diagnostics.ts を contracts/compatibility-matrix.md の分類に揃える。未認識要素を一律無視せず、lyric/print/表示装飾/和声記号等の表示省略と、repeat/ending/segno/coda・grace等の不確定な演奏情報を区別する。設定値の形式・値域の不正は拒否、有効だが解釈不能な指示とパート間の矛盾はBLOCKING、省略に対する既存既定値の補完はWARNINGへ揃え、不正値を既定値へ置換しない。識別可能なfieldPath/track/barを付け、修正可能な欠落はpartialへ残し、T014/T021を通す。診断規則の変更時だけvalidatorVersionの更新要否を記録し、過去成果物を自動再検証しない。per FR-002/005/006。
- [x] T025 [US3] src/components/import-preview.tsx の説明と既存確認/再検証表示を診断分類へ合わせ、T022を通す。表示のみの省略で開始を禁止せず、BLOCKINGを確認チェックだけで解除しない。独自ラッパーや新規画面を追加しない。per FR-002/006、憲章VII。
- [x] T026 [US3] specs/007-musicxml-version-compat/contracts/compatibility-matrix.md の全分類の代表例を実ブラウザーとAPIで確認し、specs/007-musicxml-version-compat/validation.md に警告/利用不可/拒否、位置の説明、保存可否、練習/ゲーム開始可否と操作結果を記録する。例と説明の一致100%、未解決演奏問題の誤許可0件を確認する。per US3/AC1〜3、SC-003。

**Checkpoint**: 正確な説明が届き、確認操作を制限解除と取り違えない。

## Phase 6: User Story 4 - 安全性と既存データを保って取り込む (Priority: P2)

**Goal**: MXL/XMLの制限・認可・署名・原子性・旧成果物互換性を維持する。

**Independent Test**: 不正/境界入力、改変metadata、失敗/取消/再試行、権限不足、旧成果物を検証し、外部取得・制限回避・部分更新がないことを確認する。

### Tests first

- [x] T027 [P] [US4] src/s-core/models/import/mxl.test.ts に複数rootfileの選択、欠落root、重複/危険path、破損圧縮、未使用entryを含む展開量、件数の境界を追加する。src/s-core/models/import/musicxml.test.ts には通常外部DOCTYPEと内部subset/ENTITY・版不一致を対にした安全性ケースを補い、外部取得や格納先外書込0を検証する。既存テストで十分なケースは重複追加しない。per FR-009、SC-005。
- [x] T028 [P] [US4] src/server/import-worker.integration.test.ts に「入力5MiB、総展開20MiB、100件、10,000音、変換10秒、利用者ごと同時1要求」と全体worker上限、heap128MiB、40,000拍span/16段の既存制限の回帰を追加する。IMPORT_MAX_INPUT_BYTES/IMPORT_TIMEOUT_MSを低くした設定も尊重し、本文読込と変換の期限を分ける。小さい制限値での分岐試験と既定上限の確認を区別する。per FR-010、SC-005。
- [x] T029 [P] [US4] src/server/import-preview-token.test.ts、import-revalidate.test.ts、score-import.integration.test.ts に元版だけの改変拒否、再検証の元metadata/初回expiry保持、有効な旧v1署名、settings無しの旧revision、metadata:nullと旧文字列値の読込、Git/DBの保持を追加する。既存MIDI/JSONと新規変換識別子以外の意味が変わらないこと、失敗/権限不足時の部分更新0も確認する。per FR-008/011/012、SC-005/006。
- [x] T030 [P] [US4] src/components/form-create-score.test.tsx に通信失敗後の入力保持・同じ内容の再試行・取消/離脱、src/components/import-preview.test.tsx に保存失敗後の確認/入力保持を検証する必要最小限の操作ケースを追加する。必要なら既存の同等テストを再利用し、同一mutation keyを送る経路と原本の所有期間を維持する。per FR-011、US4/AC2。

### Implementation / end-to-end validation

- [x] T031 [US4] T027〜T030で見つかった本機能の回帰だけを、src/s-core/models/import/mxl.ts、src/server/import-worker.ts / import-revalidate.ts / revision-validation.ts / score-import.ts、src/components/form-create-score.tsx の該当箇所で修正する。既存の認証・admission・署名・保存基盤を再実装せず、新しいschema/DB移行/原本保存/ログを追加しない。既存で通る安全性・互換性処理は維持する。per FR-009〜012、SC-005/006。
- [x] T032 [US4] specs/007-musicxml-version-compat/quickstart.md の専用環境で、上限付近と超過、不正入力、取消、同一内容の再試行、編集権限不足を実行し、specs/007-musicxml-version-compat/validation.md にサイズ/展開量/音数/実行環境/時刻/結果を記録する。既存10秒のworker期限、外部取得・格納先外書込・部分更新0を確認し、稼働DB/.envは変更しない。per US4/AC1/2、SC-005。

**Checkpoint**: 版の拡張によって安全性・認可・旧データ互換性を緩めていない。

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全体の検証と対応範囲・証跡を確定する。T013以外のタスクは原本待ちでも進められるが、全機能完了は原本確認後。

- [x] T033 specs/007-musicxml-version-compat/quickstart.md の全単体 `npm test -- --run`、型、変更箇所lint、worker再生成を含む `EMAIL_SERVER= EMAIL_FROM= npm run build` と専用環境の全統合を実行し、specs/007-musicxml-version-compat/validation.md に結果を記録する。src/s-core/models/files/musicxml/extensions/to-sheet.test.ts の旧16素材とMIDI/JSON/保存済み楽譜の回帰も確認し、未実施をPASSと混同しない。per FR-012/013、SC-006、憲章IV。
- [x] T034 specs/007-musicxml-version-compat/contracts/compatibility-matrix.md、quickstart.md、validation.md を実測と突き合わせ、14FR/6SC/全受入シナリオのタスク・試験・素材・結果を対応付ける。仕様001の旧記述との差は specs/001-score-practice-platform/contracts/score-import.md と docs/development.md の現行案内へ必要な範囲で反映し、UIと対象版・制限の不一致をなくす。Menuett原本未入手ならT013/FR-014/SC-004は未完了と明記する。per FR-002/003/013/014、SC-001〜006。
- [x] T035 specs/007-musicxml-version-compat/validation.md に最終スコープと憲章7原則の適合を記録し、src/s-core/models/import/、src/components/import-preview.tsx、src/server/ の実変更が計画内であることをレビューする。不要な依存/schema/認証/音楽描画/採点の変更や秘密情報・原本内容ログの混入がないこと、設定参照が007であることを確認する。全タスクの実施状況と残る原本依存を確定し、次を `$speckit-converge` とする。

## Dependencies & Execution Order

### Phase dependencies

```text
Phase1: T001 + T002
          |
Phase2: T003 + T004
          |
US1: T005/T006/T007/T008 -> T009 -> T010 -> T011 -> T012
          |
US2: T014/T015/T016 -> T017 -> T018 -> T019
          |
US3: T020/T021/T022 -> T023/T024 -> T025 -> T026
          |
US4: T027/T028/T029/T030 -> T031 -> T032
          |
Final: T033 -> T034 -> T035

原本入手 + 必要なUS1〜US3処理 -> T013 -> FR-014/SC-004の最終確認
```

- T003とT004はT001/T002完了後に並行可。T005〜T008はその両方が前提。
- 各ストーリーはPhase2の共通基盤からモデル・契約単位で独立検証可能。ただしmusicxml.ts、import-preview.tsx、同じテストファイルを共有するため、標準実行順はUS1→US2→US3→US4とする。完了した共通実装を再実装しない。
- T009→T010は元版戻り値の依存、T011はT004/T008/T010が前提。T007の試験は先に作成し、worker bundle再生成後に成功を確認する。
- T017/T018は同じmusicxml.tsのため直列。T016の保存試験はT010完了後、最終成功はT018後に確認する。
- T023とT024はT020/T021完了後なら別ファイルで並行可。T025はT022/T024と完了済みT011が前提。
- T027〜T030はUS1〜US3の該当ファイル変更完了後なら別ファイルで並行可。統合試験は共有DB/Gitを同時更新せず、専用環境を分けるか直列実行する。
- T013は原本待ちで他作業全体を止めない。入手後、未対応要素の分類や音楽意味に関係する修正が必要ならUS2/US3後に再確認する。T033〜T035は実施済み範囲について実行可能だが、T013未完了のまま「全タスク完了」「SC-004達成」と報告してはならない。

### Parallel examples per story

| Story | 並行できる例                                                                              | 共通の前提                                    |
| ----- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| US1   | T005 parser試験、T006 conversion試験、T007 worker/保存試験、T008 UI試験の作成             | Phase2完了。統合試験の実行は専用環境で直列    |
| US2   | T014 musicxml.test、T015 musicxml-voices.test、T016保存試験の作成                         | 基盤完了、対象ファイルに先行編集なし          |
| US3   | T020 HTTP試験、T021診断試験、T022 UI試験。後にT023 HTTP実装とT024診断実装                 | 共有ファイルのUS1/US2変更完了、各試験追加済み |
| US4   | T027 ZIP/XML安全試験、T028 worker制限試験、T029成果物/署名試験、T030取消/再試行試験の作成 | 先行ストーリーの同一ファイル変更完了          |

[P]は並行実行の可能性であり、サブエージェント起動の指示ではない。同じファイルの編集は直列化する。

## Implementation Strategy

### MVP first

Phase1/2→US1の一般8組（T005〜T012）で、手動版変更なしの受入と元版の保存を最初に確認する。これは限定した中間成果で、US2の意味保持・US3の診断・US4の安全性回帰やT013の原本検証の代わりにはしない。T013が確認できればUS1全体の受入条件を満たせる。

### Incremental delivery

US2で音楽意味・voiceの互換性を保証し、US3で説明と利用可否、US4で安全性と旧成果物を確認する。通った試験を保持しながら進め、無関係なパーサー/描画/認証の変更を広げない。既存実装で満たす部分は回帰結果を記録してそのまま利用する。

### Coverage summary

| 区分         | タスク     | 件数 | 主な対応                                                |
| ------------ | ---------- | ---- | ------------------------------------------------------- |
| Setup        | T001〜T002 | 2    | 比較基準・出所・原本依存                                |
| Foundational | T003〜T004 | 2    | 8組・版/構造定義                                        |
| US1 (P1)     | T005〜T013 | 9    | FR-001/002/007/008/011〜014、US1/AC1〜3、SC-001/004/006 |
| US2 (P1)     | T014〜T019 | 6    | FR-003〜006/008/011/013、US2/AC1〜3、SC-002/004/006     |
| US3 (P2)     | T020〜T026 | 7    | FR-002/005〜007、US3/AC1〜3、SC-003                     |
| US4 (P2)     | T027〜T032 | 6    | FR-008〜012、US4/AC1〜2、SC-005/006                     |
| Final        | T033〜T035 | 3    | 全14FR・6SC・憲章7原則・証跡                            |
| Total        | T001〜T035 | 35   | 実施状況はチェック欄・validation.mdを参照               |

## Notes

原本が不要なタスクは継続実行する。実施不能な確認、実機/本番環境の未検証、原本未入手は理由と影響を明示する。tasks.mdのチェックは実施した作業と根拠に基づいて更新する。次のコマンドは `$speckit-analyze`。
