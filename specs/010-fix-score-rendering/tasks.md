# Tasks: 大きな楽譜の描画無応答の解消

**Input**: `specs/010-fix-score-rendering/` の spec.md、plan.md、research.md、data-model.md、contracts/rendering.md、quickstart.md、measurements/baseline.json。

**Prerequisites**: 010の設計成果物は作成済み。`.specify/feature.json` の対象は010。Gitブランチは独立しており、このタスク生成ではブランチ切替・実装・コミットを行わない。

**Tests**: spec FR-009、SC-001〜006の明示的な回帰検証と憲章IVに基づき含める。挙動テストを実装前に用意し、対象の不足が失敗することを確認する。既存で成功する音楽意味は基準として保持する。時間の合否は専用ベンチマークで判定し、単体timeoutやモック時計の成功で代替しない。

**Organization**: 当初35タスク＋Convergence追補T036。US1=P1、US2=P1、US3=P2。`[P]`は前提完了後に別ファイルで並行できる作業。サブエージェント起動の指示ではない。パスはリポジトリルート相対。

## 最新の完了状態（2026-10-28 JST）

T001〜T036完了。T031指定の集約先もT036で補完済み。全96条件の最終性能/独立描画、全体回帰、要件対応、秘密検査、専用環境終了が完了した。最終convergeの照合後は、この実装差分とvalidation.md/最終集計をレビューする。再開指示を個々に求めず、承認済みの実装・検証は連続して処理した。過去の「未達/作業中/次の作業」は各時点の履歴で、最新状態は本節とvalidation.md冒頭を参照する。

## Phase 1: Setup

**Purpose**: 作業範囲と入力・測定条件を固定する。依存・DB schema・認証・保存方式は変更しない。

- [X] T001 specs/010-fix-score-rendering/validation.md を作成し、Node/ブラウザー/CPU/メモリー、現行の型・lint・回帰の基準、稼働環境から分離するDB/Git/ブラウザー手順を記録する。package.json、.gitignore、.prettierignore、eslint.config.mjs の現行設定で依存・生成物・秘密・一時基準が除外されることを確認し、不足する必須ignoreだけ補う。既存チェックリストは読み取りのみとし、新規依存や設定変更を先回りしない。per plan: Technical Context、憲章II/III/VI。
- [X] T002 specs/010-fix-score-rendering/measurements/fixtures.json を作成し、原本 src/s-core/fixtures/files/musicxml/naitoobunaitsu-bitomario.mxl（SHA256=1d15dcf279b2de186682740fbdfb501eb5e2e80f5977993cde04f1027b9f36fe）、quarter_middle_c.mxl、既存の複数段・臨時記号・連桁・タイ・TAB・打楽器代表の実在パス/hashとBravuraのhashを固定する。007の原本出所・利用条件・全5,540音の独立期待値へ参照を付け、3方式×1280×900/360×800×scale12/18、advanced=true/debug=false、debug=trueの別回帰条件を列挙する。per FR-003/009/010、SC-003/004/006。
- [X] T003 scripts/benchmark-score-rendering.ts と scripts/verify-score-rendering-browser.mjs を作成し、quickstart.md の呼出契約でモデルと実ブラウザー双方の変更前基準を採取できるようにする。ブラウザー側は固定した変更前アプリを専用DB/Git環境で起動して表示と操作応答を採取し、モデル用ツールから独立して再利用できるようにする。contracts/rendering.md の操作時計・入力待ち時間・画面表示の終了点を実装し、ハンドラー開始のみの計測やrequestAnimationFrameのみの完了判定を拒否する。基準用と改善後で同じ計測実装を使い、新規製品依存は追加しない。記録はdata-model.mdの「input/font/source hashes、環境、条件、cold/warm、stage開始終了、表示/操作応答、cutoff、エラー、試行番号」と「集計は5試行の最大値と中央値、失敗/打切り件数」を満たす。モデル試行はfresh子プロセス、通常試行は外側30秒、offline基準は外側30分で中断・進捗報告できるようにし、同期ループに効かないsetTimeoutだけに依存しない。DOM/ブラウザー値は別実測として扱い、「原本内容・token・接続secretは含めない」。per FR-002/010、contracts: 3〜5。

## Phase 2: Foundational

**Purpose**: 製品変更前の基準を確保し、全ストーリーが使う索引・ステップ実行を整える。

- [X] T004 T003で現行renderer/入力/フォントのchecksum付きコピーを試験用の隔離領域へ固定し、specs/010-fix-score-rendering/measurements/reference-manifest.json に識別情報・成果物hash・取得条件を記録する。原本全体とT002代表のDocument/SVGを旧実装でoffline取得し、属性順・生成font family名以外を変えず保持する。30分で未完了なら未取得を validation.md に明記してこのタスクを未完了に保ち、変更後出力や短縮素材で原本全体の成功を代替しない。別の独立した同等基準が必要なら根拠を設計へ記録して取得完了まで製品変更を始めない。per FR-004/009、SC-004、research: 5。
- [X] T005 T003で作成した scripts/benchmark-score-rendering.ts と scripts/verify-score-rendering-browser.mjs の両方をT004の固定ソースへ適用し、各条件5試行のモデル・実ブラウザーの変更前性能を採取し、specs/010-fix-score-rendering/measurements/before-results.json に全試行と小素材/既存代表の非悪化閾値 max(旧最大値×1.20, 旧最大値+20ms) を固定する。通常試行30秒の原本未完了は下限として記録し、offline完了時間を性能値へ混ぜない。モデル6,500ms・browser初回/reload12,500ms・redraw6,500ms・入力/取消/離脱/ページ100msを改善後に変更しない。per FR-002/010、SC-002/006。
- [X] T006 [P] src/s-core/models/sheet/layout-index.test.ts に既存getter結果を独立期待値と照合する関連検索テストを追加する。data-model.mdの「既存の音符配列順」「Beat.equalと同じ比較、和音順」「同じstaff IDの別パートを混同しない」「既存isOverlapped、ゼロ長と境界を保持」「同一和音が持つ複数連桁レベルを保持」を含める。「単一IDが一意とされる関係は重複を拒否し、元契約が複数を許す関係は配列を保持する」「float値を丸めたキーで別の開始位置を統合しない」を境界例で検証し、新Score/明示再構築後の値も確認する。per FR-003/004/005、plan: Phase1/2。
- [X] T007 src/s-core/models/sheet/layout-index.ts を実装し、sheet/score.ts の既存notesByChordIdとchord/slot/stave/bar/masterbar/beamの検索へ接続してT006を通す。「所有者は一つの私有Score。生成中の全関連が揃ってから利用開始する」「データ変更は新Scoreへ渡す」「既存同期APIで変更を扱う際は明示的な再構築を行い、古い索引で返さない」を守る。slot.ts、chord.ts、stave.ts、bar.ts、masterbar.ts、row.ts は必要な参照だけ変更し、export/保存形式へ索引を含めない。per FR-003/004/008、data-model: LayoutIndex。
- [X] T008 [P] src/s-core/models/browser/render-scheduler.test.ts と src/s-core/models/sheet/render-steps.test.ts に同期/協調drainの出力・順序一致、yield中の実タスク実行、scheduler未対応fallback、各継続前後の取消・例外伝播・解放を検証するテストを追加する。大きな単位をPromise.resolveで包むだけの経路が応答性の代替にならないことを確認する。per FR-002/006、contracts: 2。
- [X] T009 src/s-core/models/sheet/render-steps.ts と src/s-core/models/browser/render-scheduler.ts を実装し、純粋モデルの進行ステップと同期drain、ブラウザーの8ms目標の協調drainを分けてT008を通す。scheduler.yieldは機能検出し未対応時はsetTimeout(0)、signalはyield前後で確認する。モデルへDOM/React/Performance依存を持ち込まず、abort/例外時のiterator/timer/購読を終了させる。per FR-002/006、plan: Phase1/4、憲章II/V/VI。

**Checkpoint**: T004の原本全体基準とT005の閾値固定が完了し、T006〜T009が通るまでユーザーストーリーの製品変更へ進まない。

## Phase 3: User Story 1 - 実ファイルを確認して保存・再表示する (Priority: P1) MVP

**Goal**: 原本の変換後に操作できるプレビューを出し、警告確認・保存・保存後表示・reloadを完了する。

**Independent Test**: 専用環境の新規リポジトリで原本を取り込み、全段階を実ブラウザーで操作。初回/reload12.5秒、モデル6.5秒、入力100msと、5,540音・元版・診断・利用可否・旧描画一致を確認する。

### Tests first

- [X] T010 [P] [US1] src/s-core/models/engraving/render-score.test.ts に原本とT002素材の同期/協調構築→Document比較を追加する。src/s-core/models/import/naitoobunaitsu.test.ts の意味期待値を再利用し、入力候補の不変性、glyph/source/全座標/曲線/ページ寸法がT004基準と一致することを検証する。時間の合否は単体timeoutで主張しない。per FR-003/004/009、SC-003/004。
- [X] T011 [P] [US1] src/components/show-score.test.tsx と src/components/import-preview.test.tsx に、候補受領後の準備待機、表示完了後の警告確認と保存、元版/診断/canPractice保持、音声準備待機と描画readyの分離を検証する操作テストを追加する。render中の重い同期準備を通らない経路を検証し、既存partial/BLOCKINGの案内を維持する。per FR-001/007/008/011、US1/AC1/2。

### Implementation

- [X] T012 [US1] src/s-core/models/sheet/score.ts と src/s-core/models/engraving/score.ts の重いimport/constructor関連構築を共通builder/stepsへ移し、既存同期importと協調adapterが同じ手順を利用できるようにする。音符・slot・beam関連生成の内側も分割し、中間graphを公開せず、既存schema検証を型アサーションで置換しない。T007索引を構築後に利用し、候補やmetadataを変更しない。per FR-002/003/008、plan: Structure Decision。
- [X] T013 [US1] src/s-core/models/engraving/controller.ts、stave.ts と src/s-core/models/sheet/controller.ts、slot.ts、masterbar.ts、row.ts で準備・幅・末尾余白・累積位置を描画パス単位に計算する。既存のglyph/clef準備・改行判定・加算順を保持し、mount/toDocumentの重複layoutを同等性確認後に除く。重いnotation/glyph/和音/小節ループをT009へ接続し、1ステップ内に数秒の処理を残さない。per FR-002/003/004、research: 2/3。
- [X] T014 [US1] src/s-core/models/engraving/extensions/to-document.ts と notation/ties.ts を同じ要素順で協調実行できる形にし、controller.ts の同期/協調経路で共用する。sort・タイアンカー収集・曲線・ページ生成を計測して応答予算を超える単位を分割し、T010の旧Document全体一致を通す。per FR-002/003/004、SC-003/004。
- [X] T015 [US1] src/s-core/models/document/extensions/to-svg.ts と src/s-core/models/browser/bind-note-highlights.ts に既存の要素生成を共用する協調経路を追加する。detached SVGを同順で構築し、全音符へのbindingも分割する。既存の同期toSVG・note/source ID・glyph class・scroll-on-highlightを維持し、未公開bindingの終了処理とSVG同等性のテストを src/s-core/models/browser/score-svg.test.ts に追加して通す。per FR-002/004/007、contracts: 2/5。
- [X] T016 [US1] src/s-core/models/browser/render-score.ts を作成し、src/components/show-score.tsx と score-viewer.tsx に接続する。候補からモデル/Document/SVG/bindingまでを私有ジョブで準備し、useMemo等のrender中に重いSheet/Engraving import/toAudioを残さない。音声モデルの生成も協調化して同じ入力世代へ結び、「新しい表示が公開されるまで再生の開始を待機させ、音楽的な利用可否と画面のready状態を別に管理する」。基本のloading/ready/errorと最新世代だけの一括公開・unmount cleanupを実装し、T010/T011を通す。per FR-001/002/003/007、data-model: RenderJob/Viewer状態。
- [X] T017 [US1] T003で作成しT005の変更前計測に使った scripts/verify-score-rendering-browser.mjs を再利用して改善後のアプリを専用DB/Git・実ブラウザーで検証し、src/server/score-import.integration.test.ts の原本保存回帰と組み合わせ、新規リポジトリ→原本選択→プレビュー→警告確認→保存→詳細→reloadを実操作する。元版3.1、5,540音、312警告と候補・metadata・validationのDB/Git一致を記録する。既存の安全制限/権限/署名は変更せず、実操作未完了を統合成功で代替しない。ブラウザーツールは検証環境に用意し新規製品依存を追加しない。per FR-001/007/008/011、US1/AC1〜3、SC-001/003。
- [X] T018 [US1] scripts/benchmark-score-rendering.ts と scripts/verify-score-rendering-browser.mjs で原本の基本表示を単独5試行ずつ測定し、specs/010-fix-score-rendering/measurements/us1-results.json と validation.md にモデル6,500ms、初回/reload12,500ms、入力100msの全試行合否と旧描画比較を記録する。30秒打切りは不合格、失敗/未完了0を確認し、未達ならT012〜T016を修正して予算を動かさず再測定する。per FR-002/010、SC-001/002、contracts: 3/4。

**Checkpoint**: 原本を基本表示で保存・再表示できるMVP。US2/US3の全条件・失敗系の完了を意味しない。

## Phase 4: User Story 2 - 表示条件を変えても同じ楽譜を利用する (Priority: P1)

**Goal**: 既存の表示方式・倍率・画面幅・改訂変更で正しい再描画とページ操作を行う。

**Independent Test**: 保存済み楽譜を直接開き、横/縦/ページ、幅360/1280、scale12/18の変更と復帰を行う。旧描画一致・余白非累積・redraw6.5秒・ページ100msと既存譜の非悪化を確認する。

### Tests first

- [X] T019 [P] [US2] src/s-core/models/engraving/controller.test.ts に表示条件往復と連続再描画のテストを追加する。data-model.mdの「row割当でheaderが変わる場合は該当測定を無効化」「spacingとallocatedWidthを初期化せず再利用することを禁止」「ジョブ間の共有キャッシュは持たない」を検証し、T004の同条件基準との座標・改行・ページ一致を確認する。per FR-004/005、US2/AC1/2、SC-004。
- [X] T020 [P] [US2] src/components/score-viewer.test.tsx に倍率・viewport・layout・改訂変更、同じ楽譜の再表示、ページ数減少時のclampを検証する操作テストを追加する。data-model.mdの「有限・正の値、既存layout enumとpage範囲を検証する」「pageIndexは完了したページ数へclamp」「scale/viewportは値スナップショットとして凍結し、処理中に参照元が変化しても混ぜない」を含める。per FR-005、US2/AC1/2。

### Implementation / validation

- [X] T021 [US2] src/s-core/models/sheet/controller.ts と src/s-core/models/engraving/controller.ts のLayoutPassを条件変更時に再生成し、行頭clef/header測定とspace後の座標を依存順に更新する。src/s-core/models/browser/render-score.ts で楽譜/改訂/optionsの変更ごとに新generation・私有Scoreを用い、T019を通す。旧パスや別楽譜の索引を共有していないことを確認する。per FR-003/004/005、data-model: LayoutPass。
- [X] T022 [US2] src/components/score-viewer.tsx のresize observer/debounce、倍率/方式変更、ページ切替を新jobへ接続し、同じDocument内のページ生成と現在のglyphへのハイライト接続を協調化する。選択ページclamp、ページ前後往復、元条件復帰を実装してT020を通す。ページ操作は100msの検証対象とし、先読み等が必要でも条件世代内の所有に限定する。per FR-002/005、US2/AC1/2、contracts: 3。
- [X] T023 [US2] src/components/score-fixture-gallery.tsx の同期import/mount/toDocument/toSVG経路を共通render adapterへ接続し、各fixture単位のエラー隔離・debug・全ページ生成・現在の検証結果の意味を維持する。src/components/score-viewer.test.tsx のギャラリー回帰で一つの失敗が他素材の表示を壊さず、原本を含むギャラリーでもUIが応答することを確認する。per FR-004/005/009、plan: source touch-points。
- [X] T024 [US2] src/s-core/models/browser/notation-accidentals-svg.test.ts、notation-ties-svg.test.ts、tablature-svg.test.ts、percussion-svg.test.ts、mixed-staves-svg.test.ts の既存期待値を再利用し、T002代表の同期/協調と条件往復後の記号・source ID・glyph・配置を確認する。追加が必要な挙動だけ試験を補い、描画前後の音楽意味も独立に照合する。per FR-003/004/009、US2/AC3、SC-003/004/006。
- [X] T025 [US2] scripts/verify-score-rendering-browser.mjs と scripts/benchmark-score-rendering.ts でT002の全素材・3方式×2幅×2倍率を各cold5回/条件往復5回検証し、specs/010-fix-score-rendering/measurements/us2-results.json に全時間・Doc/SVG比較・目視結果を記録する。redraw6,500ms、ページ100ms、小素材/既存代表のT005非悪化閾値と全描画保持を確認する。debug=trueの別回帰・フォント/音源条件を記録し、構造試験を目視成功と混同しない。per FR-002/004/005/009/010、US2/AC1〜3、SC-002/004/006。

**T025完了と次の作業（2026-10-28 JST）**: galleryの保存debug=false時SSR不整合を回帰RED→修正。SSR/初回clientのcontrolを揃え、hydrate後の保存値で一度だけ描画開始。関連42試験・型・lint成功。実MXL18/notation188カードでhydration error0、debug OFF/ON/OFF・各SVG/ページ/source IDs保持（原本5,540）、Bravura loaded。production Viewerの原本/小素材×3方式debug6件もSVG/source IDs保持・error0、計10画像を明示目視。変更はgallery本体/試験の2ファイルのみで他の全測定ソースはbyte一致。前回のブラウザー/モデル各96条件×5回・独立Document/SVG・原本警告/保存/再表示の固定証拠と併せT025完了。次はT026で既存adapter取消試験を棚卸し→開始前/各stage abort・例外・retry・A→B後の遅いA成功/失敗と未公開資源解放の不足を試験化→必要なT028補完。T027以降も依存順に進む。描画/固定目標/取消復帰/終止線別変更維持。再開文:「T026の取消・例外・再試行・A→B切替の試験から続けて。」詳細はvalidation.md冒頭。

**T025の前回停止記録（履歴、2026-10-27 JST、gallery SSR未合格）**: 独立旧アルゴリズム+終止線別変更の全96条件と現行モデル各5回/480試行はDocument/SVG/音符数/ページ数一致、192成果物の展開全byte一致。モデル最大1,648.202msで固定絶対/非悪化目標内。原本のプレビュー操作→312警告確認→保存→再読込、全5,540音とDB/Git保存意味hash一致。MXL gallery全16カードのdebug OFF/ON/OFF描画保持も確認したが、保存debug=falseではSSR ONと初回client OFFが不一致でhydrationエラー。wrapper/debugAtomはHEADとbyte一致の既存問題で、T025は未完了。次はgalleryの保存値false/trueのSSR回帰RED→初回control整合/client commit後に一度だけ描画開始する最小修正→MXL/notation debug往復・全ページ/source IDs・素材間失敗隔離/入力→原本/小素材production Viewer3方式debug往復。描画モデル/Viewer依存を変えない場合はhash対応を記録し、依存変更時は必要な性能再検証。全通過後T025完了・T026へ。描画保持・固定目標・取消復帰・終止線別変更維持。再開文:「T025のgalleryの保存debug=false時SSR不整合を修正し、残りの機能検証を完了して。」詳細はvalidation.md冒頭。

**T025の前回ブラウザー結果（履歴、2026-10-27 JST、全96条件ブラウザー合格）**: 同一の現行ソースで全96条件×5回/480試行を採取し、全3,890場面とページ番号50場面を明示目視、既存CLIのafter判定がvalidationPass=true。初回最大3,529.128ms、再描画3,568.998ms、ページ53.017ms、入力88.445ms。固定非悪化84条件/絶対上限全96条件を満たし、SVG往復一致480/480。収集器・時計・固定基準・製品ソースを変更せず、全trace/画像/sourceを保存。**残る旧独立Document/SVG比較・gallery/debug/workflowが未実施のためT025は未完了**。次は固定旧アルゴリズムの別コピーに終止線別変更のみをoverlayし1ファイル差分を確認→全素材/原本全体Document/SVG比較→gallery/debug=true→プレビュー/警告/保存/保存後再表示。差分/失敗時は原因/回帰/修正と必要な再測定を行い、全通過後T025完了・T026へ進む。描画/音楽保持・固定目標・遷移失敗時復帰・別作業は維持。再開文:「T025の旧独立Document/SVG比較とgallery/debug/workflow検証を、現在ソースで続けて。」詳細はvalidation.md冒頭。

**T025の前回限定結果（履歴、2026-10-27 JST、初回超過修正・限定再検証済み）**: stage計測を基に横表示の不要な事前DOM測定/初回待ちを省き、倍率入力をHeroUIのnative数値Inputへ変更（min1/小数/上下キー/不正値防止維持）。関連87試験・型・lint・専用build成功。小素材通常5回/40場面は初回最大109.172ms≤固定112.894ms、再描画31.304ms、入力98.071ms≤100ms。原本5回/40場面も全目標内（初回3,528.626ms・再描画3,366.290ms・入力60.487ms）。各SVG/geometry対照一致5/5、viewport独立性16組Document/SVG一致、実Next取消で同一SVG/scroll149px/世代復帰。全モデル・SVG生成・終止線別作業・固定目標は維持。**T025は全96条件等が未実施のため未完了**。次は同一ソースを照合→小素材先行の全96条件×5回/全画像→旧独立アルゴリズム+終止線別変更の全Document/SVG比較→gallery/debug/workflow。超過時は該当trace/画像から段階待ち/処理を特定→回帰/修正→問題条件5回/原本/取消復帰を確認して全条件へ戻る。全件通過後にT025完了・T026へ進む。再開文:「T025の全96条件検証を、初回描画修正済みの現在ソースで続けて。」詳細は [validation.md冒頭](validation.md)。

**T025の前回結果と次の作業（履歴、2026-10-27 JST）**: 画面外Pixi renderer初期化を初回可視まで待ち（実測環境はCanvas2D fallback）、Graphics/入力/同寸法canvasを保持。鍵盤4状態は旧PNG byte一致。SSR controlを保ち取得済み保存設定でclient commitから描画開始する修正も実施。関連94試験・型・lint・専用build成功。小素材通常5回/40画像は離脱最大83.237ms、原本5回/40画像は全入力74.616ms・離脱56.156msで100ms以内、各SVG対照一致5/5、実Next取消復帰も成功。ただし小素材初回run1=116.784ms（固定112.894ms）で未達、T025未完了。元115.828msは更新前比較5回でも再現せず、間欠超過の完全除去を断定しない。次はquarter H360 scale18 run1の候補→SVG bound101.592msをprivate onStage計測（build/layout/document/svg/highlights）で調査し、Tab59.134〜focus86.777msとの競合を特定→回帰/修正→小素材通常5回/40画像→原本5回/実Next取消復帰→小素材先行の全96条件×5回。全ブラウザー通過後に旧独立アルゴリズム+終止線別変更とのDocument/SVG比較、gallery/debug/workflow。描画/音楽保持・固定上限・遷移失敗時復帰・元基準・別作業を維持。詳細/再開文は [validation.md冒頭](validation.md)。

**T025の前回停止記録（履歴）**: 全条件再採取97/480試行の初回116.056ms超過を保存。音声準備background分離と描画開始layout effect化を実施（関連73試験・型・lint・専用build成功）。最新quarter H360 scale18の通常5回/40画像は初回最大109.427ms（固定112.894ms）・再描画30.706ms・SVG往復一致5/5だが、離脱run2=115.828ms/run3=100.371ms（固定100ms）で未達、全収集器停止中。次は小素材離脱のpointer処理→React unmount→compositor/trace画像欠落を切り分ける。run2はhandler20.1ms、状態反映52.333ms、Paint54.729ms、61.121ms/frame69は対応画像なしで成功値へ代用不可、最初の画像照合済み提示115.828ms/frame73。アプリ側の修正対象を特定後、quarter通常5回/40画像→原本通常5回/実Next取消復帰→同一ソースで小素材先行の全96条件×5回。全ブラウザー通過後、終止線別変更のみを加えた旧独立アルゴリズムとのDocument/SVG比較、gallery/debug/workflow。固定目標・描画保持・元基準・別作業を維持し、T025未完了。詳細・再開指示文は [validation.md冒頭](validation.md)。

## Phase 5: User Story 3 - 表示の待機・失敗・やり直しを判断する (Priority: P2)

**Goal**: 待機・失敗を判断し、取消・離脱・再試行・別楽譜への切替を安全に行う。

**Independent Test**: 制御した待機/失敗で取消・離脱・retry・A→B切替を行い、応答100ms、stale commit0・意図しない保存0・継続購読0を確認する。実装単体の検証は小さい素材と制御schedulerで独立して行える。

### Tests first

- [X] T026 [P] [US3] src/s-core/models/browser/render-score.test.ts にcancel-before-start、各stageでのabort、途中例外、retry、A→Bで遅いAが成功/失敗するケースを追加する。「generation: Viewer内の単調増加ID。楽譜/改訂/条件変更、再試行で更新」「publication: 開始時の世代と入力・optionsが最新の場合のみ成功を公開する」を検証し、未公開Score/DOM/購読の解放を確認する。per FR-006/008、US3/AC1〜3、SC-005。

**T026完了と次の作業（2026-10-28 JST）**: adapter18ケース（開始前/各stage/公開直前の取消・同期/継続例外・同snapshot retry・timer/listener/binding/未公開Score/SVG解放）と、実Viewerの遅いA成功/失敗8ケース（source/scale/取消→retry/unmount）を追加。世代判定は実Viewerで検証し、adapterへ試験用の世代管理を作らない。関連5ファイル122試験・型・lint・diff check成功。現行製品が通過したため製品修正なし、描画/固定目標/終止線別変更/取消復帰維持。根拠は[summary](measurements/us3-t026/summary.json)。停止要因なし、次はT027でViewerの待機/失敗/取消→retry・旧表示の保持/非表示と、フォーム取消/離脱時の警告確認/canPractice/保存状態の不変を棚卸し・追加する。失敗時はT028/T029の該当責務で最小修正→関連adapter/Viewer/ShowScore/preview・型・lint→全通過後T030/T031。再開文:「T027のViewer・取り込みフォームの状態操作試験から続けて。」詳細はvalidation.md冒頭。

- [X] T027 [P] [US3] src/components/score-viewer.test.tsx と src/components/import-preview.test.tsx に「idle → loading → ready | error | cancelled」、同一楽譜の更新中表示、別楽譜の旧表示非表示、安全な失敗案内と同snapshotでのretry、描画待機中のフォーム取消/離脱を検証する操作テストを追加する。表示readyと音楽的なcanPracticeを混同せず、確認/保存状態を変更しないことを確認する。per FR-006/007/008、US3/AC1〜3。

### Implementation / validation

**T027〜T029完了と次の作業（2026-10-28 JST）**: Viewer5/実ShowScore接続preview・form7ケースを追加し、関連8ファイル166試験・型・lint成功。待機/error/cancel/retry、同一譜の更新中DOM保持/別譜除去、警告確認・canPractice・保存状態不変、フォーム取消/unmount/pagehideの描画abortと保存/遷移0を確認。T028のiterator/timer/listener/未公開所有解放・世代照合とT029のstatus/alert/retry/observer/debounce/音声終了は既存実装で成立し、製品追加変更なし。T026等の証拠コピーが試験/型検査に混入した不備は、4ファイルをbyte/hash不変で.txtへ改名して解消（設定変更なし）。[根拠](measurements/us3-t027-029/summary.json)。停止要因なし、次はT030で既存highlight試験棚卸し→retry/取消/再描画/ページ変更後の最新glyphのみ接続・旧SVG/別譜非更新・callback/scroll残存の不足追加→必要箇所のみ修正→関連ShowScore/Viewer/adapter/SVG・型・lint→T031実操作各5回/固定100ms。描画/目標/終止線別変更維持。再開文:「T030の最新glyph接続と旧SVG・購読・scroll処理の回帰試験から続けて。」詳細はvalidation.md冒頭。

- [X] T028 [US3] src/s-core/models/browser/render-score.ts と render-scheduler.ts の世代・signal・例外終了を補完してT026を通す。loading中の変更は旧jobをabortし、cancelledの遅い完了を破棄する。timer/signal購読/iterator/未公開SVG/bindingを全終了経路で解放し、abort後に新しい重い処理を始めない。per FR-006/008、contracts: 2/5。
- [X] T029 [US3] src/components/score-viewer.tsx、show-score.tsx、import-preview.tsx と必要最小限の form-create-score.tsx に処理中role=status・失敗role=alert・再試行の既存HeroUIを接続してT027を通す。同じ楽譜の旧表示は更新中と分かる状態でのみ維持し、別楽譜では隠す。unmount、resize observer/debounce、音源/音声ノード、highlightを各所有者で解放し、新規保存/音楽制限解除を発生させない。per FR-006/007/008、憲章V/VII。
- [X] T030 [US3] src/components/show-score.test.tsx と src/s-core/models/browser/score-svg.test.ts で、retry/取消/再描画/ページ切替後に最新glyphだけが音声ハイライトへ接続し、古いSVG・別楽譜に反映されず、重複callback・残存scroll処理がないことを確認する。既存の音声処理自体は変更せず、実機未検証は明記する。per FR-003/005/006/007、contracts: 2/5。
**T030完了と次の作業（2026-10-28 JST）**: SVG3/ShowScore1ケースを追加し、取消/例外後に既存bindingを保持、retry後の最新Scoreのみ接続、複数ページ5往復/同ページ連続選択で通知重複0、dispose後callback/scroll0、更新/離脱時RAF終了を確認。関連7ファイル155試験・型・lint成功、製品変更なし。[根拠](measurements/us3-t030/summary.json)。ただし準備中にquarter-sheet.jsonのtempo[0,1)外の補完休符[1,4)でHighlighterのtempo.value例外を観測し、正式対象への適用判定/修正は未実施。所有試験は全小節tempoを持つ入力で通過したもので、別境界の修正済みとはしない。次の最初はT031前に正式quarter_middle_c.mxl/原本の変換後・保存済みsnapshotのtempo/全休符を調査→AudioContext有効ShowScore再現→正式経路に該当なら回帰/最小修正→関連Highlighter/ShowScore/Viewer/SVG/adapter・型・lint→原本/小素材の待機/失敗/取消/離脱/retry/A→B各5回の実操作を固定100msで検証。再現しない場合もhash/区間/環境と別境界の扱いを記録。描画・音楽保持・固定目標・終止線別変更を維持。再開文:「T031前のテンポ・補完休符境界の確認と、原本・小素材の実操作検証から続けて。」詳細はvalidation.md冒頭。

**T031の現在の未達と修正（2026-10-28 JST）**: 初回正式の原本/小素材各5回は機能確認完了したが、最初の操作が原本371.622ms/小素材106.184msで固定100ms未達。traceとCPU profileからAudio.Track.keyRangeの反復safeParse/firstByを特定し、getter内の同値検証Mapと一走査で旧スキーマ/音域/同値先頭参照/不正値・空の挙動/再計算を保持して改善。旧処理の回数上限RED→修正後関連試験/正式2素材Audio.export不変を確認。検証補助表示の不要な親/Header再描画も分離。修正後の専用build→型/lint→T031各5回/画像照合→全単体/統合/本番build→必要なT033性能再検証を続行中。まだT031以降は未チェック。詳細はvalidation.md冒頭。

**T031/T032作業中（2026-10-28 JST）**: 正式2素材はtempo区間外0、AudioContext有効の保存画面ready/error0。専用統合14件成功。全単体初回109失敗は旧基準参照104件と直接配列変更後の索引再構築5件で対処。T025の独立旧アルゴリズム+承認済み終止線overlayを新しい索引から参照し、旧基準/性能閾値は不変。DOMを条件ごとに分離して関連119件成功。全単体最終再実行、本番build最終終了、T031制御実操作/固定100msは未完了。個別タスク完了で停止せず、build/全試験→専用制御境界と実操作trace→T033以降へ続行する。現停止なし、詳細はvalidation.md冒頭。

- [X] T031 [US3] scripts/verify-score-rendering-browser.mjs で原本と小素材の待機・失敗・取消・離脱・retry・A→B切替を制御して各5試行実操作し、specs/010-fix-score-rendering/measurements/us3-results.json と validation.md に入力受理から対応する状態の画面表示まで100ms以内（contracts/rendering.md の同一時計で入力待ち時間を含む）、stale commit0・意図しない保存0・継続購読0を記録する。heartbeatは補助とし、実操作の完了を省略しない。per FR-002/006/008/010、US3/AC1〜3、SC-005。

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全機能の回帰・性能・文書と憲章適合を確定する。

**T031完了・最終検証続行（2026-10-28 JST）**: Audio.Trackの重複検証削減後、実Header/ShowScore/音声準備込み原本/小素材各5回・110入力を145候補画像から明示照合。旧状態35枚を除外して最初の正しいPresentationを採用し、最大93.436ms/中央値43.469msで固定100ms以内、入力未計測0。stale20件破棄、BのSVG/source IDs/generation保持、Score ResizeObserver0、page error/意図しない書込0。[根拠](measurements/us3-final/summary.json)。cold未採取は別扱い。全単体132ファイル1,143試験成功。T032の現行build/専用統合、T033性能、T034/T035の対応/終了処理を再開指示なしで続行する。描画/目標/終止線別変更は維持。詳細はvalidation.md冒頭。

- [X] T032 specs/010-fix-score-rendering/quickstart.md の全単体 `npm test -- --run`、型、変更箇所lint、worker再生成を含む本番build `EMAIL_SERVER= EMAIL_FROM= npm run build`、専用DB/Gitでの src/server/score-import.integration.test.ts と import-worker.integration.test.ts を実行し、validation.md に結果を記録する。既存partial/BLOCKING・入力/変換上限・署名・編集権限・保存互換性を維持し、実行できない試験は理由と影響を示す。per FR-007/008/011、SC-003/006、憲章III/IV。
- [X] T033 scripts/benchmark-score-rendering.ts と scripts/verify-score-rendering-browser.mjs の最終版で全条件を他処理と競合させず再検証し、specs/010-fix-score-rendering/measurements/final-results.json に全試行・最大値/中央値・打切り/失敗件数・環境・checksumを固定する。時間目標・旧描画一致・独立意味一致がすべて成立することを確認し、未達時は該当実装を修正して目標を動かさない。per FR-002/003/004/009/010、SC-001〜006。

**T033完了（2026-10-28 JST）**: [最終集計](measurements/final-results.json)。現行モデル480試行、最大1,557.151ms、独立旧実装＋承認済み終止線overlayとの全480試行hash/192展開成果物byte一致。通常productionブラウザー480試行/3,890画像対応でafter validationPass=true。初回2,936.754ms、再描画3,078.169ms、ページ30.367ms、入力94.594ms、非悪化84条件/絶対上限96条件合格、SVG往復480/480、エラー/cutoff/未計測0。archive3件のchecksum検証、final/us3-final40,865項目の秘密照合0、runtime3,183ファイルのソース一致確認済み。T034/T035の文書・終了処理とconvergeへ続行、停止なし。

- [X] T034 specs/010-fix-score-rendering/validation.md に11FR・6SC・9受入シナリオとタスク/試験/素材/結果の対応表を作成し、quickstart.md を実際の実行方法へ合わせる。原本基準未取得・画面操作未完了・未検証の実音声をPASSにしない。docs/development.md へ必要な範囲でベンチマークと一時環境の運用方法を追記し、検証用server/browser/DBと専用一時データを終了・削除する。per FR-009/010、全SC、憲章IV/V。
- [X] T035 specs/010-fix-score-rendering/validation.md に憲章I〜VIIと最終スコープを記録し、src/s-core/models/、src/components/、scripts/ の変更が計画内であることを確認する。新しい永続化/認証/音楽意味/描画簡略化/依存追加や秘密ログがないこと、.specify/feature.json が010であること、全タスクの根拠付き完了を確認し、次をspeckit-convergeとする。

**T034/T035完了（2026-10-28 JST）**: validation.mdの11FR/6SC/9ACと憲章I〜VIIの対応、quickstart/developmentの実行手順・目視/時計/基準/専用環境運用を更新し、local link/diff check成功。現行とproducerの3,183 runtimeファイル一致、計測制御は私有コピーのみ、依存/認証/永続schema/音楽意味/描画省略の追加なし、終止線別変更維持、feature.jsonは010。秘密照合0とarchive checksumを確認後、専用server3組/ブラウザー/DBを終了し私有一時データを削除した（[終了記録](measurements/final/cleanup.json)）。全35タスクの根拠を確定し、次はspeckit-convergeをこのまま実行する。実音声/MIDIと旧素材の別テンポ境界は確認済みとしない。

## Dependencies & Execution Order

### Phase dependencies

```text
Setup: T001 → T002 → T003
                        |
Foundation: T004 → T005 → { T006 → T007,
                           T008 → T009 }
                        |
US1: {T010, T011} → T012 → T013 → T014 → T015 → T016 → T017 → T018
                        |
US2: {T019, T020} → T021 → T022 → T023 → T024 → T025
                        |
US3: {T026, T027} → T028 → T029 → T030 → T031
                        |
Final: T032 → T033 → T034 → T035
```

- T003でモデル・ブラウザー両方の計測ツールを用意し、T005で変更前アプリへ適用する。T017は同じブラウザーツールを再利用する検証であり、初めて作成する段階ではない。
- T004は製品コード変更前の必須ゲート。通常30秒の性能試行と30分のoffline基準を混同しない。取得できない基準を新実装で作って先へ進まない。
- T006/T008はT005後に別ファイルで並行可。T007はT006後、T009はT008後、ユーザーストーリーは両者の完了後。
- US1は最初の利用可能な増分。US2は保存済み楽譜を直接使って単独検証できるが、共有rendererを使うため実装順はUS1後。US3は制御schedulerと小素材で独立検証できるが、共有adapter/UIの変更衝突を避けてUS2後とする。
- 各ストーリーのテストを先に書き、対象不足の失敗を確認して実装する。同じファイルの編集は直列化し、T020/T027など共有テストも別フェーズで扱う。
- 専用DB/Gitやベンチマークは直列実行。同時に複数のrenderer・build・テストを走らせた時間を性能の合否へ使わない。
- 後段で前段の修正が必要なら修正と関連回帰を完了して再計測する。既に通る期待値を削ったり、予算・入力上限を緩めたりしない。

### Parallel examples per story

| 区分 | 並行できる作業 | 前提 |
| --- | --- | --- |
| Foundation | T006 索引試験 / T008 スケジューラ試験 | T001〜T005完了 |
| US1 | T010 モデル描画試験 / T011 ShowScore・プレビュー試験 | Foundation完了 |
| US2 | T019 LayoutPass試験 / T020 Viewer条件変更試験 | US1完了 |
| US3 | T026 adapter終了試験 / T027 Viewer・フォーム操作試験 | US2完了 |

[P]はこれらの作業可能性だけを示す。実装・性能計測や同一ファイルの同時編集を許可する意味ではない。

## Implementation Strategy

### MVP first

Setup/Foundation→US1（T010〜T018）で、原本を通常画面から確認・警告確認・保存・再表示できる状態を最初に作る。最低限の世代破棄・終了処理はUS1でも実装し、失敗系を後回しにした理由で古い結果を公開しない。US2の全表示条件とUS3の制御失敗ケースは後続の増分とする。

### Incremental delivery

US2で表示方式・倍率・幅・改訂・ギャラリーの同等性を広げ、US3で待機・失敗・取消・切替の案内と所有期間を完全に検証する。小さなモデル試験→旧描画比較→専用性能→実ブラウザー→保存回帰の順で根拠を重ね、最終全回帰で完了を確定する。

### Coverage summary

| 区分 | タスク | 件数 | 主な検証 |
| --- | --- | ---: | --- |
| Setup | T001〜T003 | 3 | 環境・fixture/hash・計測器 |
| Foundation | T004〜T009 | 6 | 旧基準・変更前時間・索引・協調基盤 |
| US1 (P1) | T010〜T018 | 9 | US1/AC1〜3、原本E2E・保存・初回時間 |
| US2 (P1) | T019〜T025 | 7 | US2/AC1〜3、条件往復・旧描画・非悪化 |
| US3 (P2) | T026〜T031 | 6 | US3/AC1〜3、待機/失敗/取消/切替 |
| Final | T032〜T035 | 4 | 全11FR・6SC・9AC・憲章7原則 |
| Total | T001〜T035 | 35 | 実施結果はチェックとvalidation.mdに記録 |

### Requirement traceability

| 要件 | 主なタスク |
| --- | --- |
| FR-001 | T011、T016〜T018 |
| FR-002 | T003/T005/T009、T012〜T018、T022/T025/T031/T033 |
| FR-003 | T002/T006/T007/T010、T012〜T016、T024/T033 |
| FR-004 | T004/T006/T007/T010、T013〜T015、T019/T021/T024/T025 |
| FR-005 | T019〜T025、T030 |
| FR-006 | T008/T009、T026〜T031 |
| FR-007 | T011/T015〜T017、T029/T030/T032 |
| FR-008 | T007/T011/T012/T017、T026〜T029、T032 |
| FR-009 | T002/T004/T010/T023〜T025、T033/T034 |
| FR-010 | T003/T005/T018/T025/T031/T033/T034 |
| FR-011 | T011/T017/T032 |
| SC-001 | T017/T018/T033 |
| SC-002 | T005/T018/T025/T031/T033 |
| SC-003 | T010/T017/T024/T032/T033 |
| SC-004 | T004/T010/T019/T024/T025/T033 |
| SC-005 | T026〜T031/T033 |
| SC-006 | T005/T024/T025/T032/T033 |

## Notes

生成時点では全タスク未実施。tasks.mdを作ったことは不具合修正・基準取得・性能達成を意味しない。文書生成のみのためアプリケーションテストは実行しない。次は `$speckit-analyze`。

## Phase 7: Convergence

- [X] T036 specs/010-fix-score-rendering/measurements/us3-results.json に既存us3-finalのT031正式10試行・110操作・固定100ms・stale/保存/購読結果とsource/trace/画像/失敗試行の参照を集約する。未測定cold・実音声/MIDI・旧素材の別テンポ境界を区別し、既存値や目標を変更せず参照/hash/validation.mdとの整合を確認する。per T031、FR-010（partial、LOW）。

**T036完了（2026-10-28 JST）**: 指定先us3-results.jsonへ既存の正式10試行/110入力とsource/trace/画像/失敗試行の参照を集約し、全入力のtrusted/measurable/固定100ms、最大93.436ms、archive hashと参照を再確認。新規測定・値/目標変更なし。汎用reviewerのcold未計測を保ち、専用lifecycleの合否と区別した。次は最終converge再照合、合格後は実装差分/最終結果のレビュー。

## PR準備（2026-10-28 UTC）

差分レビューの追加対応は標準全単体のworker数を1へ揃える設定と、PR掲載証拠の選別のみ。通常1,143試験/型/lintが成功し、製品361ファイルは最終性能producerと一致。終止線の独立コミット/010コミットとGit binary属性の修正を完了。Git内の385 binaryファイルと原本は一致、製品/固定目標/比較基準は不変。生証拠はローカル保持、SMuFL監査文書は除外。ブランチfix/010-responsive-score-renderingからdevelopへPRを作成する。次はPRのCI結果と差分レビュー。未解決の実装指摘0、マージは実行しない。
