# Validation: 描画無応答修正

実施開始: 2026-10-22 UTC。対象010、既存の007変更・原本を維持。

チェックリスト16/16 PASS。before_implementフックなし。ignoreは既存のnode_modules/dist/build/coverage/var/.env*/logを確認し、追加不要。新規依存・DB schema変更なし。専用環境は/tmp/hakei-010-implement。稼働DB/.env/既存Nextサーバーは変更しない。

## PR作成済み（2026-10-28 UTC）

[PR #62](https://github.com/hakeiprod/hakei-web/pull/62) をdevelop向けに作成し、open/ready for review・競合なしを確認した。ローカル通常1,143試験・型/lint成功、GitHub CIは結果待ち。**次はPRのChecksを確認し、差分をレビューする**。CI失敗時は失敗stepのログ→原因/修正→影響範囲の再確認→pushの順で対応する。マージは実行していない。生証拠と無関係なSMuFL監査文書はローカル保持。

## PR準備の最新状態（2026-10-28 UTC）

差分レビューとコミット準備の確認は完了。[レビュー記録](review.md)、[再検証結果](review-checks.json)。通常の全単体はmaxWorkers=1で132ファイル/1,143試験成功、型/lint成功。製品361ファイルは最終性能producerと一致し、固定目標/描画基準/終止線別変更を保持した。Gitの既存改行変換で圧縮基準54ファイルの格納byteが変わる問題も、binary属性と原本の再登録で修正。Git object/原本の385 binaryファイルが一致した。

生証拠約5.1GBはローカル保持。[PR掲載範囲](evidence.md)と[hash一覧](published-evidence.json)を参照。終止線を独立コミットで区別し、無関係なSMuFL監査文書は含めない。PR用ブランチは `fix/010-responsive-score-rendering`、baseは `develop`。本記録をpushしてPRを作成し、**次はPRのCI結果と差分をレビューする**。未解決の実装指摘0、マージは実行しない。

## 最新状態（2026-10-28 JST）

**T001〜T036完了。最終convergeは未対応0件。** 実装・最終全条件検証・文書更新・専用環境終了を完了した。描画保持条件と固定性能上限は変更していない。

### 最新結果（2026-10-28 JST、全36タスク完了）

**T031完了**。[実操作集計](measurements/us3-results.json)、[全110操作の明示レビュー](measurements/us3-final/reviews.json)、[生trace/画像/失敗試行のarchive索引](measurements/us3-final/archives.json)。原本/小素材各5回、実Header/ShowScore/AudioContext/SF2/鍵盤の準備を含む専用productionコピーで待機・取消・失敗・retry・A→Bの遅い成功/失敗・待機中離脱を操作した。

- 110操作すべて、入力受理→画像照合済みの対応Presentationが100ms以内。最大93.436ms、中央値43.469ms（小素材最大81.476ms、原本93.436ms）。145候補フレームを明示確認し、前状態の35枚を除外して最初の正しい状態を選択した。元のframeEvidence関数本文は既存収集器とbyte一致、入力待ち時間を除かず、clock/source/sequence/image hashを既存reviewerで検証した。
- 10試行完了・未計測入力0・stale成功/失敗20件すべて破棄、BのSVG/source IDs/generation保持、Score ResizeObserver残存0、page error0、意図しない書込0。glyph callback/RAF/Controller/鍵盤の解除は関連単体と併せて確認し、実音声出力/実機MIDIの成功とは呼ばない。
- このsuiteは入力応答を測定しておりcoldは採取しない。汎用reviewerのcold未計測10件を入力未計測と混同せず、cold性能は別の最終検証で判定する。最初の正式試行の371.622/106.184ms超過もarchiveへ保持し、Map改善と検証補助表示の親/Header再描画分離をまとめた新シリーズの合格である（改善量すべてをMapだけへ帰属しない）。
- T032の全単体最終実行は132ファイル/1,143試験すべて成功。現行Map修正後の本番build・専用統合・T033最終性能も後述のとおり確認済み。描画・音楽保持・固定目標・終止線別変更は維持。

T032も完了。[全体チェック集計](measurements/us3-final/t032-summary.json)。現行Audio.Track修正を含む全1,143試験、専用統合14試験、広い変更範囲のlint、型、worker再生成込みの通常本番build（型エラー無視なし）が成功。性能用の最終productionコピーもWebpack/型無視なしでbuild成功し、測定用markはT025とbyte一致、lifecycle制御境界は含まない。

**T033完了**。[最終集計](measurements/final-results.json)、[モデル全試行](measurements/final/model-results.json)、[独立192成果物のbyte比較](measurements/final/model-comparison.json)、[ブラウザー全試行とafter判定](measurements/final/browser-results.json)、[画像確認方法](measurements/final/review-integrity.json)、[archive/checksum](measurements/final/archives.json)。現行ソースのモデル/通常productionブラウザーを各96条件×5回、他の大きな処理と競合させず採取した。

| 測定 | 件数 | 最大ms | 中央値ms | 固定上限ms |
| --- | ---: | ---: | ---: | ---: |
| モデル | 480 | 1,557.151 | 13.271 | 6,500 |
| cold | 480 | 2,936.754 | 69.262 | 12,500 |
| 再描画 | 960 | 3,078.169 | 29.531 | 6,500 |
| ページ | 50 | 30.367 | 20.029 | 100 |
| 入力 | 2,450 | 94.594 | 21.129 | 100 |

- 全96条件の絶対上限、有限の非悪化84条件を満たし、旧原本全cutoff12条件は絶対上限で判定。収集エラー/cutoff/未計測0、SVG往復480/480、Document/SVG/音数/ページ数全480一致、展開192成果物byte一致。元の固定基準/目標・終止線別変更を保持した。
- 全3,890場面を新traceへ対応させた。3,120場面は既存の明示目視済み同条件/同操作のJPEG byte一致、focus target/anchorも一致。残り770場面は166固有初回画像、後続63/14画像、9枚の期待画像対比sheetと個別原寸で確認。縮小sheetで不明瞭だったfocusは原寸で確認し、保守的c2の超過を正しいc1へ対応。時計/目標/ソース/試行は変えていない。archive内の途中の未確認一覧/仮判断は最終reviews/reviewed/native-size correctionsで更新済みの履歴で、未完了3件が残っている意味ではない。
- [ソース監査](measurements/final/final-source-audit.json): 計測mark4ファイルを除き現行とproducerの3,183 runtimeファイルが一致。収集器/helperもbyte一致。lifecycle制御routeなし。通常buildは型無視なし、通知終了の初回も記録し同じコマンドの再実行でexit0。
- [秘密検査](measurements/final/evidence-security.json): final/us3-finalの40,865ファイル/archive項目をprivate secret/token/password/DB URL/cookieの実値へ照合し一致0。実値は報告へ含めない。

T034/T035も完了。11FR/6SC/9ACと憲章I〜VIIを下表へ対応付け、手順のlocal link/diff check成功。専用server3組/browser/DBを終了し私有一時データを削除した（[終了記録](measurements/final/cleanup.json)）。共有環境は変更していない。最初のconvergeでT031指定のus3-results.jsonへの集約不足だけを検出し、追補T036で[正式US3集計](measurements/us3-results.json)を補完。10試行/110入力/参照/archive hashを確認した。再照合は11FR/6SC/9AC・計画8項目・憲章7原則・全36タスクで未対応0件（[記録](measurements/final/convergence.json)）。after_implement/after_convergeの登録hookなし。

**次に行う作業**: 実装差分と本記録・final-results.jsonをレビューし、問題がなければコミット/PRへ進む。今回の仕様範囲で追加のimplement再開は不要。未完了タスク/停止理由なし。コミット・公開は実行していない。

## 最終要件対応表（T034）

既存の完了根拠と今回の最終ソース検証を区別する。音楽意味は007の独立期待値、描画は独立旧アルゴリズムを比較元とし、承認済み終止線overlayだけを別に識別する。最終性能はfinal-results.jsonの現行ソース全条件、その他は各タスクの機能根拠とT032の全体回帰へ対応する。

| 要件 | 実装・試験と根拠 | 判定 |
| --- | --- | --- |
| FR-001 | T017/T018/T025: 通常取込・312警告確認・保存・詳細・再読込、[最終workflow](measurements/us2-final-validation/us2-final-import-workflow/)とDB/Git照合 | 機能確認済み |
| FR-002 | T005固定予算、T031全110入力、T033最終モデル/ブラウザー全96条件各5回 | 確認済み（T033） |
| FR-003 | 原本独立意味試験、保存前後の全5,540音/設定、Audio.export不変、T033全Document/SVG | モデル/統合確認済み |
| FR-004 | T004独立旧基準、T024/T025全条件比較、T033全192成果物展開byte一致 | 描画一致確認済み |
| FR-005 | T019〜T025 LayoutPass/条件往復/改訂/ページclamp、gallery/debug往復、T033 SVG往復 | 確認済み（T033） |
| FR-006 | T026〜T031実adapter/Viewer取消・失敗・retry・遅い成功/失敗、[110操作](measurements/us3-final/summary.json) | 確認済み |
| FR-007 | preview/formの警告/BLOCKING/確認checkbox/利用可否保持、通常workflow/保存統合 | 確認済み |
| FR-008 | 既存snapshotの直接再表示、取消/失敗時の書込0、同snapshot retry、保存/移行形式不変 | 確認済み |
| FR-009 | 007出所/hash/独立期待値、T004旧描画、正式8素材、TAB/打楽器/記譜gallery | 確認済み |
| FR-010 | before-results固定96条件、環境/収集器/hash/trace/時計・画像・全試行を保持、競合測定なし | 確認済み（T033） |
| FR-011 | converter上限/安全性/認可/確認規則の既存試験、[専用統合14件](measurements/us3-final/integration.log) | 確認済み |
| SC-001 | US1/AC1〜3の実workflowと保存後reload画像、操作阻害0 | 機能確認済み |
| SC-002 | T031 110入力100ms以内、T033モデル480試行合格、最終ブラウザー480試行 | 確認済み（T033） |
| SC-003 | 独立全音符/設定/元版/診断/利用可否、保存DB/Git、T032統合 | 確認済み |
| SC-004 | 96条件Document/SVG、展開192byte一致、debug往復、表示条件往復 | 確認済み（T033） |
| SC-005 | T031制御10試行/110入力、stale20破棄、書込0/Score observer0、所有単体 | 確認済み |
| SC-006 | 正式7代表84条件非悪化、音楽/描画/警告/保存回帰 | 確認済み（T033） |

| 受入シナリオ | 根拠と確認内容 |
| --- | --- |
| US1/AC1 | 原本3.1・5,540音・312警告、プレビュー画像/通常取込成功 |
| US1/AC2 | 警告確認→明示保存→DB/Git全成果物の意味照合、確認条件保持 |
| US1/AC3 | 詳細/再読込画像、保存内容不変、原本cold/入力の最終測定 |
| US2/AC1 | 3方式×2幅×2倍率、更新中入力、ページ数/clamp、最終96条件 |
| US2/AC2 | scale/幅/方式往復のSVG byte一致、反復余白/重複回帰 |
| US2/AC3 | 7代表・原本の旧Document/SVG、TAB/打楽器/記譜gallery、音楽意味独立比較 |
| US3/AC1 | 実ShowScore待機/取消/離脱、100ms画像付き応答、意図しない書込0 |
| US3/AC2 | 失敗alert/取消status→同snapshot retry、候補・確認済み警告・保存内容不変 |
| US3/AC3 | 遅いA成功/失敗20件を破棄、BのSVG/sourceIDs/generation保持、離脱後observer0 |

実音声出力/実機MIDIは未検証。旧quarter-sheet/短いCore入力のtempo区間外の補完休符は別の未解決境界として記録を残す。正式quarter_middle_c.mxl/原本はtempo区間外0、AudioContext/SF2準備込みの画面ready/error0を確認した。この境界を修正済みとはしない。

## 憲章・最終スコープ（T035）

| 原則 | 最終確認の根拠 |
| --- | --- |
| I 音楽情報/互換性 | 原本5,540音/設定の独立期待値、保存DB/Git意味一致、Audio.export不変、旧描画全96条件一致。音符/記号/反復の間引きなし |
| II 責務分離 | Sheet/Engraving/Documentの共通steps/索引/パスは純粋モデル。Worker/時刻/DOM/Abortはbrowser、世代/状態/操作は既存UI。描画snapshotを保存へ書き戻さない |
| III 入力/永続検証 | 大素材は既存Sheet schemaをWorkerで実行、小素材も同じ完全schema。snapshot/optionsを取得時固定。既存認可/署名/保存/入力上限維持、表示処理から書込なし |
| IV 回帰検証 | 全1,143単体・専用統合14、通常build/type/lint。独立旧Document/SVG/意味検証、全96条件各5回、画像/trace付き入力、失敗試行も保存 |
| V 目的と寿命 | 関連検索/計測再利用/協調処理と既存UI所有境界が対象。古い世代破棄、binding/observer/RAF/Controller/鍵盤解除、終了時専用環境撤去。Map音域修正は実profileによる限定追加 |
| VI 標準機能 | 既存Zod/HeroUI/Next Linkのpending・Auth.jsを継続。Map/generator/AbortController/Worker/標準schedulerの機能検出とtimer fallback。新規依存/独自認証/永続schemaなし |
| VII UI一貫性 | 既存HeroUIのButton/Input/RadioGroup/Switch/Autocompleteを再利用。待機status/失敗alert/取消/retryを既存Viewerへ接続。Navbar/検索変更は入力とSVG再paintの切り分けに限定 |

追加範囲はresearch/planで根拠を記録したSnapshot検証Worker、ScoreSurface/Next Linkのpending購読、音声準備の遅延・協調化、Audio.Track.keyRangeの同値検証再利用。保存/認証/音楽意味/音声合成方式/依存を変更しない。resource/[id]のparamsは既存awaitに合うPromise型だけを修正。終止線geometry/barline試験は利用者確認済みの別作業で、維持したまま独立旧基準へその変更だけをoverlayした。SMuFL監査・007の既存変更を巻き戻していない。

仕様IDは `.specify/feature.json` の010。新しい遅延/失敗制御ページ、candidate JSON、private env、認証cookieは製品へ追加していない。検証ソースコピーはarchiveまたは.txtとして保持し、Vitest/型検査の収集へ混入させない。実音声/MIDIの未検証と、旧素材のテンポ/補完休符境界は残る制限として区別する。

### 途中の調査記録（履歴、2026-10-28 JST、T031/T032）

個々のタスクごとに再開指示を求めず、承認済み範囲を続行する（AGENTS.mdにも記録）。T031〜T035は未完了のまま。

**追加の最新状況**: T031の初回正式各5回は機能上10試行完了・stale成功/失敗破棄・退出後Score observer0・page error/意図しない書込0。ただし原本の最初の操作371.622ms、小素材106.184msを最初の候補フレームから超過し、性能未達。inputDelay291.8ms/FunctionCall281.6msとCPU profileからAudio.Track.keyRangeの反復スキーマ検証を特定し、呼出し内の同値検証Mapと一走査の最小/最大へ変更。スキーマ・同値の先頭参照・不正値/空の扱い・入力変更後の再計算を保ち、正式MXL2素材の全Audio.exportも不変。旧処理でRED（11,080回>88）、修正後の関連30試験と正式素材/時計16試験が通過。検証補助表示の不要な親/Header再描画も分離。現在、型の試験側修正と専用コピーを再build中で、修正後の実操作/全体最終確認は未実施。描画保持・固定100msを変えない。

- 正式MXLの再変換では原本5,540音/休符・小素材2音/休符にtempo区間外0。保存画面もAudioContext有効・Bravura loadedでready、page error0。[実ブラウザー確認](measurements/us3-preflight/native-ready.json)。前回の補完休符例外はこの正式2素材では再現せず、旧quarter-sheet/短いCore入力の別境界として残す。製品を変更していない。
- 全単体の初回は1,017成功/109失敗。104件は承認済み終止線変更前の旧基準への参照で、T025で既に取得・検証した独立旧アルゴリズム+当該終止線overlayの96条件を索引化して試験から参照（旧基準そのものを上書き/現行出力で再生成していない）。残るTAB/打楽器5件は配列直接変更後の索引再構築を追加した。
- 大量SVGの試験用DOMは条件ごとに分離・closeし、timeout/描画条件を変えず関連119試験成功（96条件の同期/協調の旧Document/SVG比較を含む）。途中の長時間/timeout試行も私有ログに保持し、性能値へ混ぜない。索引/overlay hashを守る試験を追加済み、全単体の最終再実行は未実施。
- 専用_test DB/Gitによるscore-import/import-worker統合は14試験成功。本番resource/[id]のparamsを既存awaitに合うPromise型へ最小修正し、型/lint通過。本番buildはcompile/type/page生成まで成功したがCLIのsecurity通知による終了を確認、依存更新はせず同一コマンドの再実行で正常終了（exit0）。

本番buildは正常終了。T031は原本/小素材の各1回診断で実操作10件/fixture・遅いA成功/失敗の破棄・page error0・unexpected write0を確認（画像未レビュー、正式性能合格ではない）。通常Headerを含む専用コピーへ揃えて各5回の正式採取へ進む。次は全単体の最終確認（大きな描画/ビルドを同時実行しない）を進め、専用productionコピーだけに制御境界を加えたT031の待機/失敗/取消/retry/A→B/離脱を実操作・trace時計で検証する。制御境界は製品ソースへ追加せず差分を記録する。単体成功を100ms達成/目視成功と読み替えず、T031と全体完了は未チェック。描画保持・固定目標・別作業は維持。

### 前回の完了記録（履歴、2026-10-28 JST、T030完了）

**T030の所有期間・最新glyph接続の回帰試験を完了**。[集計と差分](measurements/us3-t030/summary.json)。関連7ファイル155試験・型・変更箇所lint・diff check成功。チェックリスト16/16、before/after implement hooksなし。変更はShowScore/SVG試験の2ファイルのみ。他の測定ソースはT029時点とbyte一致し、製品コード・音楽情報・描画保持条件・固定性能目標・終止線別変更・遷移失敗時復帰を維持。

- SVGに3ケース追加。取消/例外で未公開binding準備が終了しても、表示中glyphのcallbackとscroll通知を置換しない。同snapshot retryの新Score/SVGへ切替後、古いScoreのclass変更は新旧SVGへ届かず、現在glyphの通知だけが1回届く。
- 複数ページを0→1→0→1→0で往復し、各ページを連続選択しても表示ページからの通知は1回。非表示ページの全SVG byteは不変。disposeを2回呼んでも全callbackを解除し、以後のglyph変更でDOM更新/scroll通知が発生しない。
- ShowScoreに1ケース追加。実Highlighterと実Score/SVG、制御した音声時計/RAF/Controller/soundfontを使用。更新中にclassを保持してframeを終了し、次の公開Scoreだけへ接続、旧SVG非更新、離脱時の残frame0とController終了を確認。ShowScore試験のViewer公開境界は既存probeで制御し、実Viewerの世代/破棄は別の既存操作試験で検証する。実音声/MIDI成功とは呼ばない。

**別境界の観測・未解決**: 接続試験の準備中、`quarter-sheet.json` のtempo区間[0,1)外にある補完休符[1,4)について、実Highlighterが `note.tempo.value` を読んで例外になることを観測した。短いCore入力のSheet化でも同様。これは所有期間とは別の入力境界で、製品側の修正・正式対象素材への適用判定は未実施。[観測ログ](measurements/us3-t030/tempo-boundary-observation.log)。今回の所有試験はテンポが全小節を覆う2音の入力で確定しており、この観測を修正済み/全素材成功へ読み替えない。全体featureの完了・実音声対応の成功は主張しない。

**現在の状態**: T030の所有試験は通過。T031の実操作は未実施で、その前に上記テンポ/補完休符の境界と正式対象素材の関係を確認する必要がある。

**次の具体作業**: 最初に正式 `quarter_middle_c.mxl` と原本の変換後/保存済みsnapshotで、全音符・休符に対するtempo区間を確認し、AudioContext有効のShowScoreで同じ例外が起きるか再現する。正式経路で再現したら回帰試験を先に追加し、候補/音楽情報・描画保持・固定目標を変えず最小修正する。関連Highlighter/ShowScore/Viewer/SVG/adapter・型・lintを通してからT031の原本/小素材の待機・失敗・取消・離脱・retry・A→Bを各5試行実測する。正式素材で再現しない場合も区間・入力hash・環境の根拠と別境界の扱いを記録して進む。操作は入力受理→対応画面表示の固定100ms、stale commit/意図しない保存/継続購読0を満たした場合のみT031完了。実音声/MIDIの未検証とjsdom canvas fallbackは残る。

再開指示の例: 「T031前のテンポ・補完休符境界の確認と、原本・小素材の実操作検証から続けて。」

### 前回の完了記録（履歴、2026-10-28 JST、T027〜T029完了）

**T027〜T029完了**。[集計・ソース差分](measurements/us3-t027-029/summary.json)。チェックリスト16/16、before/after implement hooksなし。製品コード・描画/保存仕様・依存・固定性能目標・終止線別変更・遷移失敗時復帰は変更していない。

- T027: Viewer5ケース、実ShowScore/Viewerを接続したpreview/form7ケースを追加。同一snapshotの条件更新中は旧DOMを保持して更新中statusを表示し、別snapshotでは旧SVGを除去する。失敗時は内部例外を露出しないalert、取消時は取消status、どちらも同じ最新snapshot/optionsからretryしてreadyへ移行。入力未受領時はcontrolsを保持し、source到着後に描画する。旧DOMが更新中にも画面上で可視であるとの主張はせず、既存surfaceの非表示契約を維持した。
- 警告/WARNINGとBLOCKINGの両方で、描画のerror/cancel→retryが確認済みcheckbox、保存ボタンの条件、canPracticeの案内、candidate/issues/metadata/validationを変更しない。自動保存・自動再検証0、保存callbackは明示clickのときだけ呼ぶ。フォームの取り込み中止/unmount/pagehideは実Viewerのsignalをabortし、previewを除去、保存/遷移0。描画を待たせる境界のみ制御し、ShowScore/Viewerの状態管理は実物を使用。音源/鍵盤等の実機成功を主張しない。
- T028: render-score/render-schedulerを再点検。開始前/各継続前後/完了後のsignal確認、iterator.return、timer/listener解除、例外時dispose、未公開binding/SVG/Score破棄は既存実装でT026を通る。世代はViewerが所有し、signalとgeneration照合で古い成功/失敗を排除する。追加の製品変更は不要だった。
- T029: Viewerのstatus/alert/cancel/retry、入力変更/unmount時の世代無効化、observer/resize listener/debounce/surface解除、ShowScoreのrenderReadyと音声準備・音源fetch/Controller/Highlighter終了、preview/formの取消と保存境界を照合した。既存接続と関連試験で成立し、不要なUI/音声/フォーム変更は加えていない。
- 関連8ファイル166試験、型検査、変更箇所lint、diff check成功。[試験ログ](measurements/us3-t027-029/tests.log)。jsdomのcanvas getContext未実装の通知は残るため、これはライフサイクル/状態の検証であり、フォント・paint・実音声の成功には読み替えない。T025の実測/独立描画証拠も新規測定として数えない。T026完了時との製品ソースbyte一致を確認し、今回は試験2ファイルのみ変更。
- **前回証拠保存の不備を修正**: T026等で保存した試験コピーがVitestの収集とTypeScript検査に混入し、相対import不足で失敗した。[失敗ログ](measurements/us3-t027-029/archive-collection-failure.log)、[4ファイルの改名/hash](measurements/us3-t027-029/evidence-renames.json)。証拠本文/hashを変えず`.txt`へ改名し、自動実行対象から外した。設定のexclude追加で隠していない。今回の型検査と166試験は改名後に実行済み。前回の122試験/型成功は証拠コピー保存前の観測として保持する。

**現在の状態**: T027〜T029の失敗・停止要因なし。T030以降、US3の実ブラウザー100ms検証、全体最終検証は未完了。

**次の具体作業**: T030で `src/components/show-score.test.tsx` と `src/s-core/models/browser/score-svg.test.ts` の既存highlight試験を棚卸しする。retry/取消/再描画/ページ切替後の現在glyphだけへの接続、旧SVG/別譜の非更新、callback重複と残存scroll処理の不足を追加し、失敗した所有経路のみ修正する。関連ShowScore/Viewer/adapter/SVG、型・lintが通過したらT031へ進む。T031は原本/小素材の待機・失敗・取消・離脱・retry・A→Bを各5試行、入力受理→対応画面表示の固定100msとstale commit/意図しない保存/継続購読0で実測する。描画保持・固定目標・終止線別変更を維持する。

再開指示の例: 「T030の最新glyph接続と旧SVG・購読・scroll処理の回帰試験から続けて。」

### 前回の完了記録（履歴、2026-10-28 JST、T026完了）

**T026完了**。[試験結果・変更範囲](measurements/us3-t026/summary.json)。チェックリスト16/16、before/after implement hooksなし。製品コード・依存・保存経路は変更していない。

- adapterへ18ケースを追加。開始前取消、build/layout/document/svg/highlightsの各実task待機でのabortと例外、各stageの同期例外、全binding完了後から公開までのabort、fallback timer待機中abortを検証した。32音の複数ページで一部のbindingが準備済みの状態も中断し、iterator終了、layoutPass破棄、未公開SVGの非接続、binding dispose、glyph callback未接続、abort listener/timer解除、後続stage未実行を確認。未準備glyphは未生成のままを許容し、GC完了を観測したという主張はしない。
- 同じ不変snapshotからfresh Scoreでretryでき、途中例外後の全Documentと全ページSVGが正常描画と一致。実測時間や独立旧描画基準の代替ではない。
- 世代の所有者はViewerなので、その実コンポーネントへ8ケースを追加。入力/改訂を表すsnapshot変更、scale変更、取消→retry、unmountそれぞれで、遅いAの成功/失敗を強制到着させた。Bだけが公開され、BのSVG/generation/ready状態を上書きせず、古い成功のScore/SVGはdisposeし、unmount後はcallbackを解除する。試験だけの世代管理を作って製品の検証へ代用していない。
- 関連5ファイル122試験、TypeScript、変更2ファイルのESLint、diff check成功。[試験ログ](measurements/us3-t026/tests.log)。snapshot検証/Worker取消・scheduler・SVGの既存試験も含む。初回の試験器修正（未生成glyph、値オブジェクト、ボタン名、fake timerの時計設定等）を製品不具合のREDとは呼ばない。現行製品が追加した契約試験をそのまま通過したため、不要な実装修正は加えていない。
- T025完了時の測定ソースを照合し、今回の変更はadapter試験とViewer試験の2ファイルのみ。他の測定ソースはbyte一致。T025の固定性能・独立描画証拠を保持し、今回はfresh性能/目視合格を追加していない。描画保持条件・固定目標・別作業の終止線変更・遷移失敗時復帰は維持。

**現在の状態**: T026の失敗・停止要因なし。T027以降およびUS3の実ブラウザー100ms検証は未完了。

**次の具体作業**: T027で `src/components/score-viewer.test.tsx` と `src/components/import-preview.test.tsx` の状態操作試験を棚卸しする。最初に待機→失敗/取消→同snapshot retry、同一譜更新時の旧表示と別譜切替時の旧表示非表示を確認し、続いて描画待機中のフォーム取消/離脱が確認済み警告・canPractice・保存状態を変更しない試験を追加する。既存のT026と重複させない。失敗した挙動はT028/T029の該当責務で最小修正し、関連adapter/Viewer/ShowScore/preview試験・型・lintを再検証する。全通過後T030の最新glyph接続、T031の実ブラウザー5試行/100ms検証へ進む。

再開指示の例: 「T027のViewer・取り込みフォームの状態操作試験から続けて。」

### 前回の完了記録（履歴、2026-10-28 JST、gallery SSR修正・T025完了）

**T025完了**。[今回の集計](measurements/us2-gallery-ssr-fix/summary.json)、[変更範囲と既存測定との対応](measurements/us2-gallery-ssr-fix/source-proof.json)。保存debug=false/trueのSSR→hydrate回帰を追加し、false時の不一致をREDで再現して修正した。SSRと初回clientでは同じcontrol値（既定ON）を使い、client commit後に保存値へ切り替える。galleryのjobはhydrate完了後だけ開始するため、保存OFFなのに既定ONで余分に描画する経路も防いだ。

- 関連3ファイル42試験、TypeScript、ESLint、diff check成功。保存false/trueともhydration error0、保存値でrenderScore一度のみを確認。既存の失敗素材隔離・全ページ表示・live Document/SVG検証結果の意味も維持。
- [実開発gallery](measurements/us2-gallery-ssr-fix/us2-gallery-ssr-fixed/results.json): MXL18カード・notation188カード、保存OFFから初回表示しdebug OFF→ON→OFFを確認。hydration/page error0、各SVGのOFF往復byte一致、ページ数/source IDsと既存検証表示を保持。原本は各状態で5,540 IDs、ON時debug bounds11,479。描画中の実click受理も確認。document.fonts.ready、Bravura loadedを記録。4画像を明示目視。registryのvisual pendingは勝手にpassへ変えていない。
- [production Viewer](measurements/us2-gallery-ssr-fix/us2-final-viewer-debug/results.json): 原本/小素材×Horizontal/Vertical/Pageの6ケースでdebug往復、source IDs、OFF時SVG一致、page error0。原本H/Vは5,540 IDs、Pageは表示中ページの72 IDsを保持（全譜5,540を1ページへ描いたという意味ではない）。6画像を明示目視。非表示radio inputへの直接操作が失敗した検証器の試行は、通常collectorと同じ可視labelの実clickへ修正し、最終6件で判定した。
- 今回の変更はgallery本体と試験の2ファイルのみ。音楽モデル・SVG生成・Viewer・scheduler・終止線別変更を含む他の測定ソースは、全96条件合格時とbyte一致。gallery本体の実行時利用は/dev経路で、production Viewerの性能経路を変更していない。前回のブラウザー全96条件×5回/3,890画像、モデル全96条件×5回、独立192成果物展開byte一致、原本312警告確認/保存/再読込/DB・Git意味一致を、その固定ソースへの証拠として保持する。今回のfresh性能測定と読み替えない。固定目標・描画保持・遷移失敗時復帰は不変。

**現在の状態**: gallery SSRによる停止理由は解消しT025をチェック済み。feature全体はT026以降が未完了。

**次の具体作業**: T026で `src/s-core/models/browser/render-score.test.ts` の既存取消試験を棚卸しし、開始前/各stageのabort、途中例外、retry、A→B後の遅いA成功/失敗の不足を追加する。世代/入力/optionsが最新のときだけ公開し、未公開Score/DOM/購読が解放されることを確認してからT028の必要な補完へ進む。T027のViewer/フォーム状態操作試験も依存順で進める。描画・固定性能目標・別作業の終止線は維持する。

再開指示の例: 「T026の取消・例外・再試行・A→B切替の試験から続けて。」

### 前回停止時の記録（履歴、2026-10-27 JST、gallery SSR不整合）

[今回の確定集計](measurements/us2-final-validation/summary.json)。製品コードの追加変更なし。全96条件ブラウザー合格ソースと測定manifestの一致を再確認した。

- **独立描画比較・モデル性能は合格**。[480試行の比較](measurements/us2-final-validation/us2-final-current-model/comparison.json)。旧独立アルゴリズムの別コピーへ確認済み終止線geometry変更だけを適用し、差分1ファイルを記録。原本含む全96条件の旧getter参照専用メモ化結果と、現行fresh Nodeプロセス各5回/480試行のDocument/SVG SHA・音符数・ページ数が全一致。192成果物はgzip展開後の全byteでも一致。モデル最大1,648.202ms、固定6,500msと有限84条件の非悪化閾値をすべて満たす。参照用offline時間を性能へ流用していない。
- **原本の機能・保存意味は合格**。[実操作](measurements/us2-final-validation/us2-final-import-workflow/results.json)、[DB/Git読戻し](measurements/us2-final-validation/us2-final-import-workflow/storage.json)。プレビューのTab操作、全5,540音描画、312警告の確認と確認前の保存不可/確認後の保存可、保存、保存後再読込を確認。candidate/metadata/issues/validationの保存前後hash、独立した全音楽情報hashが一致。preview/warnings/saved/reloadedの4画像を明示目視。専用DB/Gitへの検証用保存のみ。
- **galleryのSSRは未合格**。[確認結果](measurements/us2-final-validation/gallery-failure.json)。保存debug=falseで `/dev/mxl/fixtures` を開くと、SSRのdebug ON/aria-pressed=trueと初回clientのOFF/falseが食い違い、React hydration mismatchで再生成する。ScoreFixtureGallery wrapperとdebugAtomの初期化はHEADとbyte一致であり、既存問題と判断する（旧HEAD全ブラウザー実行の再現とは呼ばない）。目標や既存仕様を緩めて無視しない。
- [外部所有SVGを正しく観測した補助結果](measurements/us2-final-validation/us2-final-gallery-observed/results.json): MXL全16カードが描画され、debug OFF→ON→OFFでSVG byte往復一致・ページ数/各source ID数保持。原本は全5,540 IDsを各状態で保持、ON時debug bounds11,479。描画中の実clickも受理された。ただしhydrationエラーがあり全gallery合格にはしない。最初のarticle内だけの観測による0件は検証器の誤りで、未描画と扱わない。debug ON/OFF画像を明示目視した。notation gallery、独立したproduction Viewerのdebug全方式確認は未完了。

**現在の停止理由**: モデル/独立描画比較・原本取込保存再表示は完了したが、galleryの保存debug=false時SSR不整合でT025最終ゲートが失敗。T025は未完了。speckit-implementの非並列タスク失敗時停止に従い、製品修正をこのまま混ぜず失敗証拠と次手順を固定する。

**次の具体作業**: 最初の対象は `src/components/score-fixture-gallery.tsx` のdebug初期化。保存debug=false/trueでSSR→hydrateの回帰試験を先に追加し、不一致と不要な旧値描画開始を再現する。SSRと初回clientのcontrol値を一致させ、client commit後の保存値で一度だけgalleryの描画jobを開始する最小修正を行う。MXL/notation galleryのdebug ON/OFF・全ページ/source IDs/検証結果・1素材失敗時の隔離と入力受理を再検証し、production Viewerの原本/小素材3方式debug往復を確認する。音楽モデル/描画依存/Viewerを変えない場合はそのhash一致で今回の独立比較・全96条件性能との関係を記録し、依存変更があれば必要なモデル/ブラウザー時間再検証を実施。残りの全機能が通過してからT025をチェックしT026へ進む。描画保持・固定目標・遷移失敗時復帰・終止線別作業は維持する。

再開指示の例: 「T025のgalleryの保存debug=false時SSR不整合を修正し、残りの機能検証を完了して。」

### 全96条件の最新結果と次の作業（2026-10-27 JST、ブラウザー検証完了）

**現在ソースの全96条件×5回、480試行が固定基準で合格**。[確定集計](measurements/us2-scoped/us2-native-scale-full-browser/scope-summary.json)、[既存CLIのafter判定](measurements/us2-scoped/us2-native-scale-full-browser/reviewed.json)。8素材×3方式×2幅×2倍率を小素材先行/原本最後で新規採取し、採取エラー・cutoff・未計測0。各試行固有の期待画像と全3,890場面を明示照合し、複数ページの50場面はページ番号の2→1往復も拡大確認した。SVG往復一致480/480。

- 初回最大3,529.128ms（絶対上限12,500ms）。有限の非悪化固定基準84条件はすべて合格、旧全cutoffの原本12条件も絶対上限内。
- 再描画960件の最大3,568.998ms（6,500ms）。ページ切替50件の最大53.017ms（100ms）。入力2,450件の最大88.445ms（100ms）。
- 準備中のcold画像、枠が付く前/消えた後のfocus画像、検索前の文字、遷移前の楽譜1/2見出しは成功画像へ採用しない。候補0を全件正しいとは扱わず、正しい後続画像の実時刻を既存review CLIへ渡した。最初の一致を証明しない選択は保守的な画像付き応答上限であり、画像のない早い提示への置換ではない。
- 時刻に依存しないcrop誤差/青枠の補助抽出は自動合格判定ではない。誤った候補も出たため未採用の一覧生成を区別し、最終採用は `blue-matched-condition-review` 全96枚と `page-counter-review` 全5枚を明示目視。生画像、trace全480本、SHA/時計、収集器、ソースを保存した。
- 計測前後でrootと測定manifestは全件一致。今回製品コードの追加変更なし。描画/音楽保持・固定上限・遷移失敗時復帰・別作業の終止線変更を維持。過去の失敗と旧ソースを保持し、全条件の合格で間欠超過が永久に起きないとは断定しない。

**現在の未完了理由**: 指定された全96条件ブラウザー検証は完了。T025全体には旧独立Document/SVG比較、gallery/debug/workflowの確認が残るため、T025のチェックはまだ付けない。ブラウザー成功を全US2成功へ拡張しない。

**次の具体作業**: まず固定旧アルゴリズムの別コピーへ、利用者確認済みの終止線geometry変更だけを同じ形で適用し、差分が1ファイルだけであることを記録する（`/tmp/hakei-010-implement/prepare-barline-reference.py`）。元の固定基準/性能閾値は上書きしない。その比較元と現在ソースで既存素材・原本全体のDocument/SVGを比較→gallery/debug=true別回帰→プレビュー/警告/保存/保存後再表示のworkflowを確認する。描画差分や機能失敗があれば該当条件の原因特定・回帰/修正を先行し、ソース変更後は影響範囲と必要な性能再検証を行う。残りの全件通過後にT025完了・T026へ進む。

再開指示の例: 「T025の旧独立Document/SVG比較とgallery/debug/workflow検証を、全96条件合格済みの現在ソースで続けて。」

### 前回の限定結果（履歴、2026-10-27 JST、初回116.784ms超過の修正後）

[今回の集計](measurements/us2-native-scale-summary.json)。stage別5回ではlayout経過24.553〜29.387ms中18.654〜21.780msのyield待ちと、viewport事前読取約9msを確認。待ち除外の経過はCPU時間ではない。優先度変更だけでは待ちが残り非採用。初回commit後へ測定を移すだけ、横表示の事前DOM測定を除くだけの試行にも超過が残ったため、失敗記録とソースを保持した。

採用修正は、viewportに依存しない横表示だけ事前DOM読取/初回task待ちを省き、初期ResizeObserverもDOMを読まず、完成SVG配置時に実寸を確定すること。縦/Pageは実寸と初回commit後の中断を維持。倍率入力はHeroUIの外観を保つnative type=number Inputに変更し、locale整形付きNumberFieldの初期化経路を減らした。min=1/step=anyと既存finite-positive検証、上下キー18→19→18、小数1.5、不正値の描画防止、SVG倍率往復を実アプリで確認した。

- [小素材H360/scale18、通常5回・40場面](measurements/us2-scoped/us2-native-scale-quarter/scope-summary.json): 全件固定上限内。初回最大109.172ms（固定112.894ms）、再描画31.304ms、入力最大98.071ms（100ms）。SVG往復/修正前SVG・geometry対照一致5/5。warmfocus2は青枠を明示確認できる候補1を採用し、早い不明瞭な候補へ推定しない。
- [原本H360/scale18、通常5回・40場面](measurements/us2-scoped/us2-native-scale-original/scope-summary.json): 全件固定上限内。初回最大3,528.626ms、再描画3,366.290ms、入力/離脱最大60.487ms。SVG往復/修正前対照一致5/5。focusの候補0には枠がなく候補1で一致、他は候補0を明示照合。
- [既存8素材×倍率12/18の16組](measurements/us2-horizontal-viewport-invariance.json): viewport1×1と2048×1536で全Document/SVG SHA一致、入力不変。原本5,540音を含む。現在アルゴリズムのviewport独立性であり旧独立基準との全比較の代替ではない。
- [実Next取消復帰](measurements/us2-native-scale-cancel/results.json): 同一SVG・scroll149px・世代を復帰し旧Home応答の遅い公開なし。pending/restored画像を明示確認。hard network error自体のブラウザー検証ではなく、失敗後idleの回帰試験を維持する。
- 関連87試験・型・lint成功。専用productionコピーのbuild成功（既存Next params型ゲートを分離、root production build成功とはしない）。[固定ソース](measurements/us2-native-scale-source/archive.json)の今回差分はViewerと試験の3ファイルだけ。全音楽モデル・SVG生成・Bravura・別作業の終止線は前回ソースとbyte一致。収集器・時計・終了点・固定上限は変更していない。

**現在の停止理由**: 指定された初回超過の修正と限定再検証は完了。ただし同じ現行ソースの全96条件×5回、旧独立Document/SVG比較、gallery/debug/workflowは未実施でT025は未完了。限定5回の成功から間欠超過の完全除去や全条件合格とは断定しない。以下の116.784ms等は過去ソースの履歴として保持する。

**次の具体作業**: 現在の固定ソースと専用環境を照合し、小素材先行で全96条件×5回を新しい出力先へ収集する。最初にquarter_middle_c/Horizontal/360×800/scale18の初回112.894msと入力100msを監視し、各条件の正しい提示画像を照合する。超過が出たらその条件のtrace/画像→段階別待ち/処理→回帰試験/限定修正→問題条件5回→原本/取消復帰→全96条件の順で再検証。全ブラウザー条件通過後、固定旧独立アルゴリズムへ終止線別変更だけを加えた比較基準で全Document/SVG、gallery/debug/workflowを確認してT025完了・T026へ進む。描画保持・音楽情報・固定目標・遷移失敗時復帰・別作業を維持する。

再開指示の例: 「T025の全96条件検証を、初回描画修正済みの現在ソースで続けて。」

### 前回の結果と次の作業（履歴、2026-10-27 JST、小素材離脱115.828msの調査・修正）

[今回の集計](measurements/us2-small-leave-summary.json)。画面外のPixi renderer初期化/グローバルpointerup/破棄をなくし、Graphicsとキーボード/MIDI購読・同寸法canvasは維持した。rendererは初回可視で作成する。headless環境はCanvas2D fallbackであり、初期説明の「WebGL初期化済み」はcanvasだけからの誤推論で訂正。通常・押下・解放・画面外押下後の初回表示は修正前PNGとbyte一致、canvas座標/寸法も一致した。

SSRのcontrol値と保存設定を区別し、client commit時に取得済みのJotai設定で協調描画を開始する追加修正も実施。SSR値12を保持しつつ保存値18で一度だけ描画を始める回帰試験を含む関連94試験・型・lint成功。専用productionコピーも成功（既存Next型ゲート分離を継続し、root production build成功とはしない）。[固定ソース](measurements/us2-small-leave-hydration-source/archive.json)の変更はViewer/VirtualKeyboardとその試験4ファイルのみで、全モデル・SVG生成・Bravura・別作業の終止線実装は前回ソースとbyte一致。収集器・時計・終了点・固定上限は変更していない。

- [小素材H360 scale18の通常5回/40場面](measurements/us2-scoped/us2-small-leave-hydration-quarter/reviewed.json): 離脱最大83.237ms、全入力最大83.237msで全5回100ms以内。SVG往復/修正前対照一致5/5。ただし初回run1の正しい候補0が116.784ms（固定112.894ms）で1回失敗し、scope全体は未合格。初回中央値91.577ms、再描画最大31.908ms。
- [原本H360 scale18の通常5回/40場面](measurements/us2-scoped/us2-small-leave-hydration-original/scope-summary.json): すべて固定上限内。離脱最大56.156ms、全入力最大74.616ms、初回3,706.337ms、再描画3,357.526ms。SVG往復/修正前対照一致5/5。
- [実Next遷移取消](measurements/us2-small-leave-cancel/results.json): 同一SVG・scroll640px・世代を復帰、遅い旧Home応答が公開されないことを確認。pending/restored画像を明示目視。hard network error自体のブラウザー試験ではなく、失敗後idleの単体試験は維持。
- [因果の範囲](measurements/us2-small-leave-profile.json): 原本115.828msは更新前の比較5回でも再現しなかった（最大82.257ms）。今回の修正後5回成功だけで間欠超過の完全除去とは断定しない。画面外Pixi pointerupは前回各1回から現在各0回になった。画像のない61ms提示を成功値に置き換えず、過去失敗を保持している。

**現在の停止理由**: 離脱の限定再検証と原本/取消復帰の確認は完了したが、小素材の初回描画116.784msが固定非悪化上限112.894msに未達。全96条件の収集器は停止中で、T025は未完了。今回ソースの全96条件・独立した全Document/SVG比較・gallery/debug/workflowは未実施。

**次に行う具体作業**:
1. quarter_middle_c / Horizontal / 360×800 / scale18 / run1の初回を先に調査する。候補受領→SVG bound101.592msと、bound→正しい提示116.784msを分ける。private copyの既存renderScore.onStageへbuild/layout/document/svg/highlightsのUser Timingを追加し、初回Layout33.095〜40.297ms後からSVG boundまでの待ち/処理、59.134msのTab入力〜86.777msのfocus-stateとの競合を特定する。元の固定ソース・収集器・時計・終了点を保持し、画像のない早い提示を成功としない。
2. 特定した描画開始/継続のボトルネックだけを回帰試験→修正する。画面外renderer分離、保存設定/SSR整合、8ms中断、大入力background、音楽/描画保持、遷移取消/失敗時復帰、別作業の終止線変更は維持する。
3. 小素材の通常5回/全40画像で初回112.894ms・入力100msとSVG一致をすべて満たす。その後に原本5回/全画像と実Next取消復帰を再確認して、小素材先行の同じ全96条件×5回を新出力へ採取する。全ブラウザー通過後に旧独立アルゴリズムへ終止線別変更だけを加えたDocument/SVG比較、gallery/debug/workflowを完了してT025をチェックしT026へ進む。

再開指示の例: 「T025の小素材の初回描画116.784ms超過を、stage別計測で調査・修正してください。離脱改善・描画保持・固定目標・遷移失敗時復帰・別作業の終止線変更を維持してください。」

### 前回停止時の記録（履歴、以下の値・失敗は保持）

全96条件の通常収集は117/480試行で停止した。quarter_middle_c / Horizontal / 1280×900 / scale18 / run2は正しい初期再生ハイライトを含む提示284.452msで固定非悪化上限149.472msを超過した。[採取記録](measurements/us2-scoped/us2-navigation-priority-full-browser/results.json)は旧ソース・画像・traceとともに保持。他の未照合画像を合格扱いにしない。backgroundタスクの再開待ちが小入力でも約71ms発生していた。

小入力を通常優先度にした限定検証も、初期再生ハイライトを最初の公開前に準備した状態で5回中1回153.334msとなり、固定112.894msを超過した。[失敗記録](measurements/us2-scoped/us2-initial-highlight-quarter/provenance.json)を保持。赤色は警告色ではなく時刻0の再生ハイライトであり、以前のレビュー理由の「警告色」は用語の誤り。画像の採用フレーム・測定値は変更しない。

1. 小入力だけscheduler.yield、大入力はbackgroundを維持する修正と、初期ハイライトの公開前準備・音源取得/解析の表示後への分離を実装した。関連91試験・型・lint成功。測定用productionコピー成功（既知のNext型ゲート分離を継続）。[ソース固定](measurements/us2-bounded-boost-source/archive.json)。
2. [quarter H360 scale18限定5回](measurements/us2-scoped/us2-bounded-boost-quarter/scope-summary.json)は40場面すべて成功。初回最大105.366ms（固定112.894ms）、入力最大40.909ms。[原本の同条件5回](measurements/us2-scoped/us2-bounded-boost-original/scope-summary.json)も40場面すべて成功。初回3,625.077ms、再描画3,349.143ms、全入力70.351ms、離脱最大57.737ms。各素材のSVG/geometryは同一終止線の修正前対照と一致5/5。画像の青いフォーカス枠を確認し、候補0が未描画の原本8場面では候補1を採用した。
3. [実Next遷移取消](measurements/us2-bounded-boost-cancel/results.json)も同一SVG・scroll640px・世代を復帰し、遅い旧Home応答が公開されないことを確認。hard network errorそのもののブラウザー試験ではない。失敗/取消後にidleへ戻る処理は単体試験で確認済み。
4. このソースの全条件再採取も97/480試行で停止。[失敗詳細](measurements/us2-scoped/us2-bounded-boost-full-browser/confirmed-failure.json): quarter H360 scale18 run1の正しい候補0が116.056ms、固定112.894msを3.162ms超過。原本60試行の候補時刻には超過なし、全97試行SVG往復一致。ただし96件のcold画像は未レビューで、全体合格にはしない。旧ソース・画像・traceを保持。
5. traceではSVG公開86.303ms後、100.798msのフレーム内で音声準備が9.191ms実行されていた。音声準備の開始と各継続をfresh backgroundへ分離し、取消を含む関連91試験・型・lint成功。ただし[次の限定5回](measurements/us2-scoped/us2-audio-background-quarter/scope-summary.json)でも最大119.749ms（固定112.894ms）で失敗。画像5件は正しい候補0を明示確認した。音声準備だけでは解消せず、空画面レイアウト後のpassive effect待ちが残った。
6. 描画の開始をlayout effectへ移す修正を実施。8ms中断・大入力background・初期ハイライト・描画保持は維持する。「無関係のpassive effectより先に協調描画を開始」の回帰試験が修正前に失敗、修正後の関連73試験・型・lint・専用buildは成功。[現在の固定ソース](measurements/us2-layout-start-source/archive.json)。
7. **現在の停止理由**: [最新の限定5回・40場面](measurements/us2-scoped/us2-layout-start-quarter/confirmed-failures.json)は初回最大109.427ms（固定112.894ms）で全5回成功、再描画最大30.706ms、SVG往復一致5/5。一方、quarter H360 scale18の離脱がrun2で115.828ms、run3で100.371msとなり固定100msに失敗。正しい候補0の画像とPresentationを全40場面明示照合済み。このソースの原本5回/実Next取消復帰/全96条件は未実施。全収集器は停止済みで、T025未完了。
8. **最初の調査対象と順序**: run2/run3の小素材離脱を先に調査する。run2は入力→click handler約20.1ms、状態反映52.333ms、Paint54.729ms。61.121msのPresentation/frame69には対応Screenshotがなく、画像で確認できる最初の提示は115.828ms/frame73。61msを成功値に代用しない。pointerイベント・React unmountとcompositor/trace画像欠落を順に切り分け、同一時計・source_id/frame_sequence・正しい画像という契約を保持してアプリ側の修正対象を特定する。
9. **再検証範囲と後続条件**: 修正後にquarter問題条件の通常5回・全40画像で初回固定112.894ms/入力100ms/描画保持をすべて満たす。その後、原本H360 scale18の5回・全画像と実Next取消後の同一SVG/scroll復帰を再確認し、新ソース固定で小素材先行の全96条件×5回へ戻る。対象・回数・固定上限は変更せず採取順だけを変更する。全ブラウザー通過後、別作業の終止線変更だけを加えた旧独立アルゴリズムとのDocument/SVG比較、gallery/debug/workflowを完了してからT025をチェックしT026へ進む。元基準・失敗記録・描画/音楽保持・別作業は維持する。

再開指示の例: 「T025のquarter H360 scale18の離脱115.828ms超過を、イベント処理と提示画像欠落から切り分け、固定目標と描画保持を維持して修正してください。その後、小素材先行の全96条件検証を再開してください。」

### 検証結果

- 最新の[原本離脱修正後の限定結果](measurements/us2-scoped/us2-navigation-priority-original/latency-report.json): 通常5回・40場面が全件成功、離脱最大72.775ms、全入力最大73.989ms。Layerize最大1.120ms。64試験・型・lint成功。実Next遷移の取消で同一SVG・640pxのscroll・世代が保持され、遅い旧応答の非公開も確認した。このソースの全条件採取は117/480試行で小素材の超過を検出し停止（最新状態は上記）。
- この修正前の[全条件再採取](measurements/us2-scoped/us2-sections-full-browser/confirmed-failure.json): 22/480試行で原本の離脱100.584ms超過を検出、正しい候補0を明示照合し停止。初回描画修正の限定成功は保持し、T025全体は未完了。
- 最新の[パネル遅延レイアウト修正後の限定検証](measurements/us2-scoped/us2-sections-tab18/scope-summary.json): 失敗したTAB Page/360px/倍率18を5回・40場面照合し、時間上限と修正前SVG/geometryの一致5/5を確認。原本312警告・全4パネルの表示/フォーカスと本文保持も確認。型・lint・diff check成功。全条件再測定は原本離脱の別失敗で22試行停止（以下）。
- 前回ソースの[全96条件×5回のモデル検証](measurements/us2-model-final/comparison.json): 480試行すべて旧独立基準のDocument/SVGと一致。絶対上限・固定非悪化上限とも成功。最大2,057.830ms。
- [追加調整前の小素材測定](measurements/us2-scoped/us2-jitless-visibility-small/scope-summary.json): 2条件各5回・80場面目視、固定非悪化上限を含め成功。
- [追加調整前の原本縦表示測定](measurements/us2-scoped/us2-jitless-visibility-vertical/scope-summary.json): 1条件5回・40場面目視、離脱最大82.170ms。限定条件の成功であり全条件の代替ではない。
- [全条件採取の停止記録](measurements/us2-scoped/us2-jitless-final-browser/reviewed.json): 原本横表示の入力115.016ms・離脱104.299msを検出した12試行を保持。追加調整後の[横表示2条件各5回](measurements/us2-scoped/us2-hit-target-horizontal-resumed/scope-summary.json)は80場面を明示目視し全10試行成功、入力最大82.647ms、SVG復元10/10。全96条件の合格を代替しない。
- 過去の全条件採取は323/480試行まで。超過3件を明示目視し提示時刻と照合した（[記録](measurements/us2-scoped/us2-hit-target-final-browser/confirmed-failures.json)）。小素材の固定非悪化上限2件・描画中入力100ms上限1件が失敗。残り画像は未レビューで、原本60試行も全面合格とはしない。
- その後の[全条件採取](measurements/us2-scoped/us2-capabilities-full-browser/confirmed-failure.json)は336/480試行で停止。TAB Page/360px/倍率18/run4のcold127.025msが固定非悪化125.7708msを1.2542ms超過。1フレームを明示目視しSHA・Presentation照合済み。他の画像は未レビューで、T025は失敗・未完了。
- 追加修正後の[失敗2条件各5回](measurements/us2-scoped/us2-capabilities-targets/scope-summary.json)は80場面を目視し全10試行の時間上限を満たす。初回最大85.903ms、入力最大82.876ms。同一終止線実装の対照とSVG一致10/10。ただし前回後の別変更geometry.tsで旧固定基準とのSVG差分があり、描画保持・T025全体は未合格。今回関連19試験・型・lint成功。
- 関連59試験、型・lintは成功。gallery/debug/workflow、US3、最終検証も残る。feature全体のperformancePassはnull、T025は未完了。計測専用productionコピーは既存Next型ゲートを分離しており、root production build成功とはしない。

以下は初期段階からの実施履歴。各節の「未実施」「取得中」は記録当時の状態であり、最新状態は上記と末尾の結果を参照する。

## 初期段階の進捗（履歴）

T001/T002/T004完了。初回の旧実装30分打切りは下記の履歴として保持。再開後、既存84条件のbyte一致と原本12条件の独立同等基準を確立した。T003の実アプリ計測とT005へ作業再開。製品変更・性能達成・受入操作はまだ未実施。

## T001/T002

旧ソースを/tmp/hakei-010-implement/referenceへコピーし、入力・モデルソース・フォントのhashを固定。関連基準試験2ファイル16件PASS（5.84秒）。ignore確認済み。素材manifestを作成。

## T003/T004 進行中

モデル計測器はfresh子プロセスと外側30秒/30分期限を実装。ブラウザー収集器は入力受理のEvent.timeStampとtimeOrigin、handler開始、状態mark、同一CDP traceの画面フレームを採取し、フレームの確認前はtimingPass=nullのまま保持する。原本の旧Document/SVGを単独offline取得中。完全取得・全計測・100ms合否は未実施。

## 固定環境と分離手順

Node 22.23.4、Linux x86_64、Intel Core i9-10900K、logical CPU 20、約8GB RAM。Chromium 156.0.8078.4を/tmp内に取得し、不足共有ライブラリーも/tmpへ展開して起動確認した。製品の依存・OSインストールは変更していない。型検査は成功。現行関連回帰は上記16件成功。全回帰・本番build・実アプリE2Eはまだ実行していない。

ブラウザー用には専用ポート3107、末尾_testの専用DB、/tmp内専用Gitを利用する。稼働中の3000番サーバー・DB・.envは利用/変更しない。認証状態は私有/tmpファイルに限定し結果JSONに含めない。計測器の動作確認は別ポート3110の合成テスト画面で実施し、原本性能やアプリ受入の結果から除外する。

T002: 原本・小素材・複数段・臨時記号・連桁・タイ・TAB・打楽器の8素材について実在パス/hashを固定した。Bravuraの実ファイルhash照合済み。原本の利用条件・独立全音符意味期待値は007へ参照し、debug=trueの別回帰条件も登録した。

### 計測器の動作確認（受入検証の代替ではない）

`npx tsc --noEmit`成功。追加3スクリプトへのESLint成功。合成画面の1クリックでEvent.timeStamp、handler、状態markを採取し、tracingのmicrosecond時計へ換算できた。状態変更後のScreenshotが含まれ、最終フレームの`changed`を目視確認した。出力は依然timingPass=null。原本・実アプリの性能、保存、全条件、フレーム提示の対応確認は未実施。

参照専用メモ化はコードと未採用案のみ準備済み。純粋な旧出力との全代表比較・原本全体の取得は未実施で、T004完了の根拠にはしていない。

計測器の打切り動作も合成画面で確認した。クリック後に同期無限ループへ入るChromiumを、ページ内setTimeoutに頼らずNode側期限からcontext終了させ、cutoff-or-failure / timingPass=null / 時計・フレーム欠測を記録できた（動作試験用期限1秒。正式な原本30秒/参照30分とは別）。合成画面サーバーは終了済み。

専用PostgreSQL15.19を/tmpへ展開し、127.0.0.1:15439のhakei_010_testへ既存migration適用成功。実アプリ操作・保存試験は未実施。

## T004: 取得失敗による停止

2026-10-22T21:16:05.597Z、無変更の固定ソースによる原本全体のoffline参照取得を外側1,800,000msで打切り。importとmountを通過したがDocument段階で未完了。条件はHorizontal、1280×900、scale12、advanced=true、debug=false。結果はmeasurements/reference-attempt.json、ソース/入力/フォント識別はreference-manifest.json。Document/SVG成果物は未取得。これはofflineの打切りであり、通常30秒の性能試行・改善率・改善後の達成時間へ読み替えない。

T004とPhase2の必須ゲート、speckit-implementの逐次タスク失敗時停止規則に従い、後続の製品実装を開始せず停止した。T003の実アプリ収集・全条件・集計も未完了で、両タスクをチェックしない。T005以降未着手。不具合は未修正。既存007の変更は維持し、この実行ではsrcの製品コードを変更していない。

次の技術作業は、research.mdの未採用案について旧実装の取得可能な全代表・全条件でDocument/SVG一致とgetter純粋性を検証し、原本全体の独立同等基準を確立すること。参照専用メモ化は未実行・未採用で、これを成功基準として進めていない。基準確立後にT003/T004を完了し、T005の変更前5試行へ進む。

終了確認: 参照取得の親子プロセスは終了。合成画面サーバー・Chromium・専用PostgreSQLは停止し、専用DBデータは削除。再現に使う固定ソースと検証ツール/ログは/tmp/hakei-010-implementに保持（永続参照の代わりにはしない）。稼働中のユーザー環境は変更していない。after_implementの.specify/extensions.ymlは存在せず、後フックなし。

## T004再開: 独立同等基準の確立

利用者の明示指示に基づき参照専用メモ化を検証した。旧計算式を保持した固定ソースに対し、既存7素材×3方式×2幅×2倍率=84条件のDocument/SVGを無変更実行とメモ化実行で比較。gzip展開後のbyte全体が全84件一致（正規化・丸めなし）。音符数・ページ数も一致し、全件で元モデルexport不変を確認。結果はmeasurements/reference-equivalence.json、検証コマンドはquickstart.md。

メモ化は旧getter関数の結果のみを保持。関係配列を凍結し、Document開始時にモデル・glyph/word・Map/Set等の入力を変更禁止にする。タイが変えるrow.notationTop/Bottomだけを例外にし、これらに依存する高さ・縦位置は保持しない。全使用getterを元関数で再計算し、Object.isまたは配列の参照・順序一致を確認する。原本では各条件64,000件以上のgetterと200,000個以上の不変入力を検査して完了。保持値を新しい数式・索引の実装で計算していない。

原本そのものの全12条件を取得。各5,540音、入力export不変、getter再計算一致。ページ表示のページ数は幅/倍率条件順に56/103/145/145。Documentと全ページSVGのgzip計192ファイル（全素材96条件、約11MB）をmeasurements/referencesへ保存し、圧縮前後のhashをreference-manifest.jsonに固定した。これは旧getterを使う独立同等基準で、無加速の原本全体取得が成功したという意味ではない。初回30分打切りは引き続きreference-attempt.jsonに残す。

この結果によりT004を完了とし、speckit-implementを再開。T003の実アプリ収集・T005の性能基準は別途必要。参照取得の15秒等を改善後性能へ混ぜず、モデル6.5秒/ブラウザー12.5秒/redraw6.5秒/操作100msと5試行の条件は変更していない。製品コードはこの時点で未変更。

## T003: 実アプリ計測器と画像確認の完了

固定した旧ソースの別コピーを専用DB/Git・localhost:3107でproduction起動。8素材を既存サービスでseedし、私有テストセッションを利用。元のrendererモデルは凍結ソースと同一。測定用コピーだけに候補受領mark（取り込みは応答JSON後・クライアント検証前、直接表示はShowScore入口）を追加し、DOM公開後のmicrotaskでSVG/binding完了を観測する。音楽計算・描画式は変更していない。コピーのinstrumentationとhashはmeasurements/browser-instrumentation.json。

計測器はfixture×layout×viewport×scaleと各5試行を処理し、新contextの事前ページでBravura/音源のネット取得をwarmした後、新page・新Score/jobでcold測定する。日本語UI表示用Noto CJKを/tmpへ展開してFONTCONFIG_FILE経由で利用（OS/製品依存は変更しない）。条件・入力/フォント/ソースhash、環境、cold、開始終了、試行、cutoff、エラーと全試行を記録する。モデル用には親子共通のhrtime時計で、外側期限から起動/変換時間を分けたモデル下限を記録する。

入力はnative Event.timeStamp/handlerとtrace時計を較正。描画中のnative Tab、描画後のSearch入力、ホームへの離脱を観測する。小素材のTabで、traceのブラウザー入力受理と換算Event.timeStampの差は約0.104ms、handlerまで約25msの待ちも含まれた。ページ/世代、state mark、Screenshotのsource_id/frame_sequenceとAnimationFrame::Presentationを対応付ける。候補フレームには古い画面も含まれ得るため、全候補画像を保存し、明示的な画像確認があるものだけreview-score-rendering-frames.mjsで有効化する。DOM/rAFだけ・未確認画像・欠測は合格しない。空のreviewでは表示済みでもcoldMs=null/timingPass=falseになることを確認。

実アプリ小素材で、楽譜、描画中のfocus outline、Searchのprobe、離脱先の楽譜見出しを画像確認。確認済みの診断1試行はcold約143ms、操作3件約45/89/99ms（丸め前の値はcollector-reviewed-smoke.json）。5試行や改善後性能の代わりにはしない。原本では30秒後に未完了として終了し、約8.7MBのtraceと候補受領markを保持できた。描画中に受理されたnative Tabのhandlerが未実行であることも記録した。全5試行・全条件の正式な変更前計測はT005で実施する。

計測用コピーのbuildでは、HEADと一致する既存resource/[id]のparams型エラーがあり、コピーの型検査だけを分離した（ignoreBuildErrors、計測設定記録済み）。製品の型検査/build設定は未変更で、T032では通常の検証を実施する。Next buildの既存依存に関する停止通知も一度あり、同じbuildの再実行で完了。依存更新はしていない。

## T005進行中（2026-10-23 UTC）

変更前のモデル側96条件×5試行=480件を完了。原本60件は外側30秒で打切り、他7素材420件は正常完了、エラー0。親子共通hrtimeによるモデル開始からの下限を別記し、プロセス起動/変換分をモデル時間へ混同しない。全試行と最大/中央値、5件完了した条件の非悪化閾値max(旧最大×1.20,旧最大+20ms)をmeasurements/before-results.jsonへ仮固定。ブラウザー側は取得中で、T005はまだ未完了。計測器のhashは開始時から固定し、モデル終了後にブラウザーを直列起動した。製品コードは未変更。

## T005完了: 変更前の全条件基準

モデル・実Chromiumとも96条件×5試行=480件を直列取得。各系列で原本60件は30秒打切り、代表420件は完了、setup/action例外0。ブラウザー代表420件の楽譜表示フレームを全件画像確認し、84条件のcold非悪化閾値を固定した。代表cold最大199.063ms、中央値106.060ms。原本は下限だけで改善率を算出しない。全試行、モデルとbrowserそれぞれの閾値・条件・hashはmeasurements/before-results.json。

21枚のcontact sheetでfocus outline・楽譜・離脱先見出しを確認。入力欄は旧表示の混在を排除しきれないため正式基準では未測定のまま残した。離脱16件は対応presentation不足、4件は旧楽譜見出しのため採用しなかった。採用1240画像とstate/presentationイベント抽出をbefore-evidenceへ永続化し、元trace hashを保持。採用できた操作820件の最大150.117msで、変更前は100ms目標を満たさない。baseline取得完了と性能合格を区別しperformancePass=false。改善後は全操作の実測を必要とし、欠測を成功に変えない。

集計器のafter判定に、baseline全条件一致・5試行・有限閾値の必須検査を追加。全5回打切りの条件だけ閾値なしを許し、そこでも固定の絶対予算を必須にした。計測時計・入力受理・描画終了点と取得器は変更していない。製品実装の開始条件を満たしたのでT006へ進む。

## T006〜T009: 関連索引と協調drain

新規テストが実装前にmissing moduleで失敗することを確認してから実装。LayoutIndexは私有Score完成後に公開し、失敗する再構築では旧索引を破棄する。音符IDはtrack内、bar/staveは複合ID、chord/track/masterbarは単独IDとして重複検査。既存Beat比較、元配列順、持続音/ゼロ長の方向付き境界、丸めない小数beat、全beam level、別Score/再構築とexport非混入を照合した。索引は座標・幅を保持しない。既存getterの構築中fallbackを残し、従来filter返却に相当する配列は複製して呼出側変更を隔離。

同期drainとブラウザーdrainを分離。協調側は目標8ms、scheduler.yield機能検出と実setTimeout task fallback、単位前後/yield前後のabortを確認する。未完了iteratorはfinallyで閉じ、待機中のplatform yieldにもabortで即応し、timer/signal listenerを解放する。Promise.resolveだけの継続では実timerが進まないため、実timerが全単位完了前に実行される挙動を試験。

検証: Sheet・scheduler・controller計12ファイル46試験成功。別途Sheetと既存の臨時記号/タイ/TAB/打楽器/複数staff SVG計14ファイル29試験成功。型検査はテストのstubGlobal必須引数を修正して再実行する。これは基盤の確認であり、原本の性能改善・全描画保持・実画面操作の達成はまだ主張しない。

## モデル/Document/SVG実装と独立比較（T010〜T015）

T010の96条件テストは、新規importSteps/mountSteps/toDocumentStepsの欠落で先に失敗することを確認した。協調経路と同期経路を原本全体の独立Document/SVGへ照合する全96試験が成功（114.30s、性能合否ではない）。全glyph/source/座標/曲線/ページ寸法はJSON/SVG byte hashで比較し丸めなし。各経路で元候補/metadata/issue/validationのJSON不変と原本5,540音の独立意味hashを確認。後続のDocument/SVG内部ステップ化後も全条件比較を再実行する。

importScorePartsStepsで各modelの従来import/Unit検証を共用し、Core→Sheet→Engravingの重複graph生成を除去。音符/slots/beams/関連索引の生成内部でyieldし、未完成の索引/graphを外へ公開しない。同期APIは同じstepsをdrainする。LayoutPassは条件/row割当/space/orderの依存編集前後に破棄し、自然幅・末尾余白・横位置と静的staff高さを旧式のまま測定。タイで変わるrow高さ/縦位置は固定しない。

Documentはnote/chord/slot/stave/bar/row、stem/beam、タイanchorとink走査、曲線とpaginationを協調化。タイ/臨時記号のresolverは同期wrapperと共通stepsを使い、比較関数を保持するstable merge sortを用いる。既存Document/タイ60試験、notation/controller34試験に成功。SVGは再帰の各elementでyieldし同期toSVGと共用。ハイライトはTreeWalkerで準備し、未公開SVGの準備中に現行glyph callbackを変更せず、現在のpageだけactivate/deactivateする。SVG/同期steps40試験とbrowser adapter/scheduler/SVG46試験に成功。

T011でReact render中のSheet/Engraving同期importが実行される失敗を先に確認。ShowScoreはsource identity/版ごとの非同期schema検証とsnapshotを保持し、描画ready後のaudio準備と分離する。元3.1、警告確認、明示save、候補不変の試験を含むShowScore/ImportPreview11試験成功。描画readyとcanPracticeは別。実画面の原本保存/reloadと音声実機は未検証でT017以降が必要。

単独診断1試行: 原本Horizontal/1280×900/scale12でmodel 2,488.482ms（import718.511/mount826.684/document942.393ms）、SVG/JSDOM4,294.078ms。Document/SVGとも独立原本基準hashと一致。これは5試行・全条件・実ブラウザーの性能合格ではない。正式なモデル6.5s/ブラウザー12.5s/redraw6.5s/操作100msは不変。raw probeは/tmp/hakei-010-implement/model-probe.json、後続の正式結果で永続化する。

## T016: 画面と音声準備の私有ジョブ接続

SourceSnapshotは従来のSheet schemaで非同期境界の検証を行い、複製を深く凍結。Viewerは条件ごとに新しい私有Score/Document/detached全ページSVG/未公開bindingを作り、最新generationだけを一括公開する。layout effectで新入力/条件の旧jobを即時abortし、旧成功/失敗は世代照合で破棄。異なるsourceの旧SVGは非表示、同じsourceは更新表示中として維持。ページは先に生成したSVG/bindingを再利用し、現在pageだけ接続する。resize/debounce/observer・binding・未公開DOMを所有者で解放。loading/error/cancelled/retryは既存寸法を変えないoverlay。既存Viewport算定とページnav高さを保持。

ShowScoreのrender中からparse/import/toAudioを移し、source/版が変わると新しいsnapshotへ更新する。描画ready後の音声モデルは共通toAudioSteps/importStepsで協調生成し、従来のschema/Unit/再生可否検証と音符選択を保持。再描画中は新規再生を開始できず、元canPractice/canGameを変更しない。音源取得と描画readyは別状態。

旧凍結Sheet→Audio exportと新協調Engraving→Audio exportを8素材で比較し、原本を含む6素材のJSON byte hashが一致。原本の演奏用音符4,992件は旧値と一致し、表示/保存5,540件は保持。旧実装で再生非対応のsnareとempty-track由来のtriple_grand_staffの例外も同一（成功に変えない）。measurements/audio-equivalence.json。実音声/MIDI機器の確認とは区別する。

mount時のlayoutを最初のDocumentで一度だけ消費し、options/viewport/pass不一致では利用しない。条件変更/明示再構築/unmountで破棄。重複除去後の最終モデル共通経路でも原本を含む全96条件の同期/協調Document/SVGが独立基準と一致（122.12s、性能判定とは別）。音声モデル・Controller・ShowScore・Viewer4ファイル38試験成功、型検査成功。T017の原本実操作・T018の5試行性能は未検証。

## T017: 原本の実画面フロー・DB/Git一致

専用環境の実Chromiumで、新規PRIVATEリポジトリ作成→原本ファイル選択→プレビュー描画→入力focus/Tab→312件の警告を実チェック→保存→詳細表示→reloadを完了。プレビューのSVGに異なるsource IDが全5,540件揃った。原本3.1、警告312、canPractice/canGame=trueを保持。保存ボタンは全確認前disabled、全312確認後に明示クリックした。ページを操作でき、描画readyと音声準備は分離している。

保存後、同じテストActorでreadScoreサービスを使い、Git上のcandidate/metadata/issues/validationのcanonical hashがpreview応答と全て一致することを確認。DBのrevision dataHashとGit読込の検証も成功。DBにも元版3.1と312診断を投影、確認312件。全5,540音の独立意味hash e7a094…cfcを保存後にも確認。専用DB/Gitのscore-import/import-worker統合2ファイル14試験も成功（18.74s、worker再生成済み）。

measurements/us1-functional-results.jsonとsource/instrumentation manifest、us1-functional/の画像4枚に証拠を保存。画像はdebug=trueの別回帰として確認し、既存のdebug hover塗りも残す。T003の同一時計collectorで別採取した基本表示は約3秒へ到達しているが、離脱100ms超過があるため性能合格とはしていない。機能フローは性能時間を代替せず、T018は未完了。

最初の機能フローは/score/createに存在しないHeader Searchを検証器が探したため、操作スクリプトのselectorで失敗した。候補/描画の失敗ではない。実在する音符編集欄のfocus/Tabへ修正して全フローを再実行した。検証用DB停止による候補未受領の試測も性能から除外。collectorは候補受領前の期限超過をsetup failure、描画後をactions stageと区別するよう分類のみ補正した。候補開始・入力受理・表示終了の時計は変えていない。

## T018 継続測定: 同一改訂と不要な形式検証

保存済みid/revisionが同じRSC応答では不変GitデータのSourceSnapshotを再利用し、異なる改訂は新しい私有ジョブへ切り替える。完全Sheet候補をpartial専用schemaへ試行して全音符の不一致診断を生成する処理を、既存format識別子による分岐で除いた。完全/部分候補それぞれの従来schema検証は維持し、保存契約を変更しない。同一改訂の再生成JSON/new revisionと形式分岐の試験はredを確認後green。関連3ファイル32試験・型検査・lint成功。

変更版v3の単独診断では初回2,815.739ms、Tab35.954ms、入力73.357ms、離脱106.747ms。続く正式基本条件5試行はcold最大3,874.674ms/中央値3,539.942ms、15操作の最大235.962ms。文字入力2試行と離脱全5試行が100msを超過したため不合格。選択した全20提示フレームを目視確認し、表示/フォーカス/probe文字列/遷移先見出しの対応を確認した。欠測0・実行失敗0だが性能合格へ読み替えない。measurements/us1-attempt-v3/に全結果・レビュー・選択画像・gzip trace・実際の採取時source hashを保持する。

モデル単独5試行は全完了、1,755.862/1,842.840/1,718.882/1,818.216/1,879.883ms（最大1,879.883、中央値1,818.216ms）。モデル6,500msは全試行内。ブラウザーreload・全条件・操作予算は引き続き別途必須で、T018は未チェックのままとする。

離脱のトレースではDOM削除を含むReact処理に加えて、停止中もNoteHighlighterのRAFとブラウザーLayerizeが反復している。停止中は同じ経過時刻のハイライトを一度だけ適用し、再生中だけ従来と同じ比較/毎フレーム更新を実施する変更を追加。ScorePlayerからidle/playing/paused/stoppedを通知し、表示条件更新中もプレイヤーを保持して状態を失わない。音符の時間計算・音源・演奏イベントは変更していない。静的ハイライト試験のredを確認後、停止位置/再生再開/停止解除とプレイヤーのplay/pause/resume/stop呼出しの3試験成功。既存ShowScore/Viewerを含む26試験成功、型検査と関連lint成功。変更後の正式性能はまだ未判定。

一時的なDOM移動/先行削除/contain styleの診断は離脱予算を満たさず、製品へ採用していない。描画保持条件・全試行100msの目標・提示フレームの確認方法は変更しない。

モデル5試行のDocument/SVG hashを独立原本基準と照合し、全10比較が一致（us1-attempt-v3/model-equivalence.json）。ハイライトの連続更新停止だけでは単独診断の離脱133.480msで未達。さらに画面外のPixi鍵盤が反復描画してLayerizeを起こしているため、IntersectionObserverで非表示時のApplication tickerを止め、可視時には再開する。初回Canvas画像は明示描画し、スクロールで見える際の描画・鍵盤入力・音源は保持。observerと初期化中unmountも所有者で解放。関連5ファイル28試験成功、型検査成功。試験stubのlint scopeを修正して関連lint成功。最新の性能は再測定待ちであり、T018は未完了。

## T018 最新5試行: v5（未達）

measurements/us1-results.jsonに合否を集約。全20提示フレームを目視し、hash/Presentation IDを再検証。初回3,628.026/3,328.241/3,119.972/3,104.555/3,169.828ms、最大3,628.026・中央値3,169.828ms。描画中Tab最大63.757ms、文字入力最大83.125msで各5試行すべて100ms以内。離脱141.954/139.994/129.233/126.341/129.898msはすべて未達。実行失敗/打切り/欠測0でも性能不合格を維持。us1-attempt-v5/に全試行、全20レビュー画像、gzip trace、採取時source/instrumentationを保存した。

CPUプロファイルでは遷移時の大きなSVGを含むDOMのnative removeChild自体に約45msが集中。別診断としてSVG一括textContentクリア、will-changeによるlayer分離、文書navigationを調査したが、100msの達成根拠は得られず製品へ採用しない。文書navigationではcollectorのinput/state対応も失われるため計測成功には数えない。原本の記号省略/間引き・描画条件/操作予算の緩和は行っていない。

T018は未完了。今後はSVGの表示内容と公開契約を保持したまま、画面遷移のcommitに大規模DOM解放を集中させない所有・終了方式を調査する必要がある。reload5試行、US2/US3、全条件・最終回帰は未実施であり、T019以降を完了扱いにしない。

## T018 完了: 離脱100msの解消（2026-10-24、クライアント時刻）

`measurements/us1-results.json` が最新の基本条件の判定。対象は原本全体、Horizontal / 1280×900 / scale12 / advanced=true / debug=false。モデル、実ブラウザーcold、実reloadをそれぞれ単独5試行で採取し、追加で撤去中の入力を5試行確認した。目標・全試行判定・入力受理から正しい提示フレームまでの終了条件は変更していない。

| 項目 | 最大ms | 中央値ms | 予算ms | 合否 |
| --- | ---: | ---: | ---: | --- |
| model | 1,925.701 | 1,758.364 | 6,500 | 5/5 PASS |
| browser cold | 3,183.981 | 3,149.356 | 12,500 | 5/5 PASS |
| browser reload | 3,429.323 | 3,080.543 | 12,500 | 5/5 PASS |
| cold中のTab | 36.410 | 20.349 | 100 | 5/5 PASS |
| cold後の文字入力 | 66.311 | 54.799 | 100 | 5/5 PASS |
| cold後の離脱 | 89.743 | 78.975 | 100 | 5/5 PASS |
| reload後の文字入力 | 69.140 | 49.820 | 100 | 5/5 PASS |
| reload後の離脱 | 89.765 | 76.508 | 100 | 5/5 PASS |
| 撤去中の追加入力 | 49.291 | 29.169 | 100 | 5/5 PASS |

coldの離脱は89.743 / 78.975 / 77.673 / 73.635 / 81.655ms。reloadの離脱は89.765 / 76.260 / 76.508 / 74.233 / 76.579ms。追加系列の離脱も最大84.701ms、全5試行PASS。合計50入力の正しい提示フレームと15回の初回/reload表示を明示レビューした。入力の待ち行列時間を除外せず、枠線のないTab候補フレームは棄却して最初にfocus outlineが見えるフレームを採用。実行失敗・打切り・未計測0。追加系列は5/5で「追加入力直前に旧SVGが撤去中」「入力表示後に旧ownerが全て撤去完了」も成立した。

### 原因と採用した変更

route subtreeの一括削除では、大きなSVGを含むnative removeChildが約45msを占めていた。Viewerの所有SVGをbody直下の専用surfaceへ置き、placeholderで従来の位置・寸法を確保する。離脱時には世代無効化・abort・binding/observer解除・非表示・hit testing不可を直ちに完了し、物理DOMの撤去をidle優先の2ms単位に分割した。異なるViewerのDOMを処理しない。SVGの音符やページを省略する変更ではない。

入力の別の長い処理だった候補の全体schema検証は、既存sheetScoreSchemaそのものを専用Workerで実行する。postMessageの同期キャプチャで二重cloneを除き、終了/失敗/abortでWorkerとlistenerを解放する。同じsnapshotを受けるViewer/ValidatedScoreの不要な親由来の再描画、画面外Pixi鍵盤のpointer move/globalMove hit testも抑制した。検索候補の開閉アニメーションと、不透明背景Navbarのぼかしを停止し、検索機能・focus・音楽情報を維持する。

計測器のCPU profileでは、Playwright screenshot preparationのcollectRoots/querySelectorAllもSVG全体を走査していた。参考画像はCDP captureScreenshotで取得し、SVG公開はdata-layout直下に追加されたSVGのMutationRecord、操作状態は入力前に登録したnative DOM observerで記録する。時計の開始点・待ち行列・Presentationの終了点・画像レビュー・100ms予算は不変。同じ最終collectorを旧v5対照へ適用した離脱は132.510 / 135.566 / 136.829 / 135.251 / 159.769msで5/5 FAIL。計測器だけを軽くして旧版が合格するという結果ではない。旧対照と変更版のcollector/observer/action hashも一致する。

### 描画と音楽情報の保持

独立した旧計算から取得した全96条件のDocument/SVG比較を含む10ファイル135試験が成功（128.66s）。丸め・許容誤差の導入なし。今回のモデル5試行でも全5,540音を保持し、Document/SVGの全10hashが原本独立基準と一致した。`t018-leave/model-equivalence.json`。

追加の実画面比較では、同じSVGを元のin-flow配置とsurfaceに置いた全96条件で、SVG byte、実bbox/CTM、各text/line/rect/pathのcomputed paint/font styleが一致。これは配置方式の比較であり、独立旧rendererの比較の代用ではない。Bravuraロード後の192画像と12枚の対比較シートを保存し、全96の表示領域でclef・拍子/調号/臨時記号・音符/休符・連桁/タイ・段/ページ配置を目視した。記号の欠落・置換や配置/改行の変更は認められなかった。画面外の全要素/全ページは独立Document/SVG比較が担う。

**生PNGの完全一致とは区別する。** 合成レイヤー化によるraster差は68/96条件に残り、28/96条件は表示領域のRGBAも一致した。42条件は最大channel差1、残り26条件には曲線/glyph境界のより大きい差もあり、最大255（snare scale18）。rawの差分数・最大差・両画像をそのまま `t018-leave/surface/results.json` に保持し、pixel一致へ書き換えていない。契約§5の独立Document/SVGの全座標・構造と目視の確認を、PNG byte一致の主張に置き換えない。通常時の合成を外す、content-visibility/displayによる終了、終了時のみのpromotion/isolationも別診断したが離脱111〜134msで未達だった。full-viewportの合成原点変更も生pixel差の解消に至らず、いずれも製品には採用していない。spec.md・contracts/rendering.md・性能目標は変更していない。

原本の新規PRIVATEリポジトリ作成→プレビュー（異なるsource ID 5,540件）→312件の実チェック→明示保存→詳細→reloadを最新の実装で再実行して成功。元版3.1、警告312、確認312、canPractice/canGameを保持。保存後のreadScoreでcandidate/metadata/issues/validationのcanonical hash、独立音楽意味hash、DB dataHash/Gitの一致も成功。`t018-leave/workflow/` の結果・storage照合・画像4枚を参照。debug=trueの機能回帰は、debug=falseの正式性能と分けて記録する。実音声/MIDI機器の検証を行ったという意味ではない。

### 検証と証拠

変更箇所の9ファイル38試験成功、root型検査・対象lint・計測ツールlint・git diff --check成功。専用productionコピーのWebpack build成功。コピーだけで従来からのresource/[id] params型ゲートを分離しており、製品の型検査設定や依存は変更していない。rootの通常build全体が成功したという報告ではない。

`t018-leave/` に全試行JSON、明示レビュー、選択候補を含む画像、原本hash付き全trace（traces.tar.xz）、採取時source/instrumentation、actions、計測器コピーを保存。各フォルダーで `tar -xJf traces.tar.xz` を実行すると元のtrace名/hashに戻り、review-score-rendering-frames.mjsでレビュー記録を再検証できる。今回途中の未達5試行系列も `attempts/` に保持し、成功試行の選別で置き換えていない。以前のv3/v5未達記録も維持する。

以上をT018の基本条件の完了根拠とする。T019以降の全表示条件の正式性能・US2/US3・最終回帰は別タスクとして未完了を維持する。追加96条件の画面比較は、その全条件の正式5試行性能を代替しない。

終了時確認: 保存した85件のレビュー画像と全4系列のtrace hash、collector/observer一致、採取時manifestと現行製品sourceの対応を再検証して成功。保存したtextと展開traceにtest cookie/auth secret/DB URLが混入していないことも照合した。専用3108/3109 serverと専用PostgreSQLを停止した。継続タスクのための隔離source/検証データは残し、ユーザーの開発serverには触れていない。after_implement拡張hookはextensions.ymlがないため該当なし。

## US2 条件往復・境界値・共通描画経路（継続中）

T019/T020/T021/T024を確認した。同一Controllerで各素材の3方式×2幅×2倍率を順次変更し、初期条件へ復帰する追加試験は8素材すべて成功。各条件でLayoutPassが更新され、独立した旧実装の全Documentと全ページSVGのhashが一致し、同条件の再取得と候補/metadata不変も成功した。既存のLayoutPass更新実装で成立し、条件間のモデルキャッシュは追加していない。

既存の同期/協調96条件比較・原本の独立音楽意味比較・debug/highlightと上記Controller往復を含む4ファイル158試験が成功（138.55s）。臨時記号・タイ・TAB・打楽器・複数段の既存期待値とViewer/adapterの7ファイル34試験も成功（8.31s）。試験ログは `measurements/us2-checks/` に保存した。

Viewerでは改訂切替時に旧SVGを隠すこと、同snapshotの再表示、無効layoutからの回復、ページclamp、値を変更した後も非同期jobが最初のnested optionsを保持することを確認。resize通知だけで実寸が変わらない場合は再描画せず、Verticalは幅、Pageは幅と使用可能高の変更で新jobを開始する。必須scaleのundefined、無限/非正寸法、無効page/layout、負/非有限SVG paddingを拒否する。これらは旧幾何の計算を変えない。

ギャラリーは共通adapterへ接続し、fixture別の失敗隔離、既存debug/検証結果、全ページ、従来のPageを含む100px下paddingを保持する追加試験が成功した。T022の実ページ操作100msとT023の原本を含む実ギャラリー応答、T025の全条件正式測定は未完了のため、当該checkboxは残す。

### T025に向けた予備診断（正式合格ではない）

小素材の最初の実ブラウザー診断で、Worker起動を含むcoldが約150〜176msとなり、T005で固定した一部の非悪化閾値を超えた。閾値は変更せず、値全体が256要素以下、各文字列/キーが256文字以下のときだけ既存の同じschemaをタスク境界後に実行する経路を追加した。大きい未知フィールド、accessor、循環、原本等はWorker経路へ送る。同期捕捉とabort、Workerの解放、schema値の一致を試験した。

既存8素材を独立に診断したところ、原本とtriple_grand_staffはWorker対象のまま。残り6素材の上限判定・clone・同一schema検証各1,000回の最大は1.20〜5.01msだった（Nodeの診断であり正式browser合格の代替ではない）。原本の協調処理、保存形式、音楽意味や性能目標を変更していない。詳細は `us2-checks/us2-small-validation-cost.json`。

測定器には新generationかつreadyのDOM commitを待つ条件往復を追加した。操作中のTabでresize等の入力IDを取り違えない試験も成功。旧SVGが残っているだけでは完了にしない。最初の予備診断のPage4件は自動操作側のSelect selector不一致で30秒打切りになったため、不合格記録を保持してselectorを修正する。正式結果には流用しない。全条件cold5回/往復5回、対応フレームの明示目視、ページ100msと非悪化の成立前にT025を完了扱いにしない。

### US2 継続診断と再測定（2026-10-24）

T022の原本12条件×各1回の予備測定では、80件の提示フレームを明示レビューした。cold最大3,884.220ms、再描画最大4,666.417ms、ページ操作最大45.165ms、通常入力最大80.682ms。全12条件で元条件へ戻したSVG hashが一致した。これはT025の全素材各5試行を代替しない。結果・レビュー・画像・traceは `measurements/us2-attempts/us2-original-diagnostic-v8/` に保存した。

表示方式の旧Selectを開く操作自体が原本で100msを超えたため、同じ56px高・最大320px幅のHeroUI RadioGroupへ変更した。3方式を直接選択し、persisted enumは保持する。原本12条件の描画viewport寸法は旧Select時と一致した。実HeroUIのアクセシビリティ操作試験も成功。待機中は旧SVGを非表示・inertにして既存の完了高を維持し、最新条件の完成後に表示する。SVGの省略、座標変更、予算変更は行っていない。

その後のquarter_middle_c全12条件×5回では、最初の提示候補の時点で固定済み非悪化閾値を超える試行が7件あった。未レビューのため全試行を合格扱いにせず、`measurements/us2-attempts/us2-quarter-attempt-v8/attempt-status.json` と全trace/画像/採取ソースを保存した。この系列には往復後の検索・離脱が含まれないため、正式全操作の代替にも使わない。

小入力の判定は全体512ノード、文字列/キー256文字、配列長32以下に限定し、上限外は同じschemaのWorker検証へ送る。入力を同期捕捉した後、小入力のみ即時abort確認用のmicrotaskを挟み、不要な実タスク待機を除いた。長い描画の実タスクyieldは維持する。疎な配列によるschema診断増幅がWorkerへ送られる回帰を含む12試験が成功。Nodeでの既存7小素材各1,000回の診断は正式browser合格とは区別し、最大8ms以内という保証にはしない。原本はWorker対象のまま。

保持したハイライトを引き継いだ後、再生位置が範囲外でも赤色が残る回帰を再現した。新しいhighlighterが既存の着色を追跡し、停止時の保持と再開時の差分更新を両立するよう修正。Viewer/実方式コントロールを含む31試験、ShowScore/Gallery/SVG bindingの47試験が成功した。Gallery既存2試験は非同期完了とbody側の全ページを待つよう修正した。型・変更箇所lintも成功。ログは `measurements/us2-checks/`。音声/MIDI実機成功は主張しない。

現在、検索・離脱を含めたquarter_middle_cの全12条件×5回を再採取中。T023の原本ギャラリー実操作、T025の全96条件各5回・明示フレームレビュー・非悪化、後続US3/最終回帰は未完了のままとする。仕様・描画保持条件・性能目標を変更していない。

### T023 実ギャラリーの完了

既存のdev専用routeはproductionでは404になるため、同じソースの専用開発アプリを3110で起動して検証した。原本5,540音・1ページの表示が完了し、全18カードを確認。既存のMenuettのMUSICAL_INFORMATION_INCOMPLETEはカード内に隔離され、原本等の成功表示を妨げなかった。debugへの連続したnative CDP mouse入力2件のisTrustedを確認し、2件目は原本の旧surface撤去後・新surface未公開の待機中に受理された。最終debug状態は開始時へ復帰し、原本全音符の再表示・ブラウザー例外0も確認した。原本表示領域の記号・連桁・タイ・debug枠を目視し、生成成功を未登録の検証結果のpassへ書き換えていない。証跡は `measurements/us2-gallery/`。これは正式100ms時計の測定ではない。専用開発serverは停止済み。

T025の小素材60試行は、検証開始のlayout effect化後も狭幅Horizontal/scale18の1試行が下限116.874msで固定閾値112.894msを超えた。全試行の元条件SVGは一致したが性能合格にせず、`us2-attempts/us2-quarter-attempt-v10/` に保存した。続いてViewerのジョブ開始もlayout effectへ移した。重い処理の前の実タスクyieldと協調drainは保持し、関連34試験・型・lintが成功した。現在この版の専用production buildを準備中。

### 小素材の方式選択・狭幅予備測定

Viewerのjob開始をlayout effectへ移す変更は狭幅で悪化したため撤回した。60試行と採取ソースを `us2-attempts/us2-quarter-attempt-v11/` に保持する。方式選択の3つのHeroUI Radio子要素をHTMLのradio input/labelへ置き換え、HeroUI RadioGroupのグループ枠、同じ外形、3方式、checked state、独立group名・キーボード選択・focus表示を維持した。実コントロールを含む34試験、型・lintが成功。

狭幅Horizontal・倍率12/18を各5回、正式系列と分けた予備診断として採取した。80場面の明示画像レビューではcoldの待機表示5件、再描画の待機表示1件、検索文字が未反映の2件を棄却し、その次の提示フレームを採用した。cold最大108.286ms、再描画最大48.660ms、入力最大53.176ms。元条件へのSVG復帰10/10一致、cutoff/失敗/未計測0。音源取得前のcoldは黒い音符で完成した表示も含み、後刻の音声ハイライト開始をcold終了条件へ追加しない。これはT005の時計・基準を変更するものではない。

予備診断用manifestの倍率を1種類に絞った最初の自動操作は、往復先倍率がundefinedとなってcutoffした。自動操作の設定不備として中止し、倍率2種類を保持して再採取した。失敗ログと部分採取は隔離領域に保持し、製品の成功試行には含めない。全12条件の正式60試行はこの予備診断の後に実行中。T025は未完了のままとする。

### 段階をまたぐ協調予算の共有

方式選択の軽量化後も正式60試行の一部は固定非悪化閾値を超えた。予備診断を正式合格へ代用せず、`us2-attempts/us2-quarter-attempt-v12/` に全記録を保存した。

追加の調査で、build/layout/document/各page SVG/highlight接続ごとに別のdrainを開始するため、短い段階の時間が実タスクyieldなしに積み重なることを再現した。単調な注入時計と実yield境界を使った追加試験は修正前に16tickの連続処理で失敗し、1つの8tick予算を維持する修正後に成功。共通の既存generatorをyield*でつなぐ1本のdrainとし、原本の長い処理も段階をまたいで同じ8ms目標で実タスクyieldする。短いジョブの開始だけを無条件に別タスクへ送る待機は除いた。microtaskへ長い処理を移す変更ではない。

scheduler/Viewer/adapter/Galleryの42試験が成功。独立旧Document/SVGの全96条件とController往復を含む2ファイル119試験も成功（150.89s、通常回帰の実行時間であり正式性能値ではない）。型・変更箇所lintと専用本番ビルドも成功。前述の実ギャラリー操作はこのdrain統合前の結果であり、最終実装の実操作を完了済みとは主張しない。現在は統合版で狭幅予備診断を再測定している。性能予算・比較基準は変更していない。

### DOMとready表示の同時公開（検証中）

drain統合後の狭幅予備診断は、10件すべてで最初の提示候補が待機表示だった。画像上で完成した楽譜を初めて確認した候補1を明示レビューし、cold最大141.015ms（失敗）を `us2-attempts/us2-target-unified/cold-reviewed.json` に保存した。この系列の入力・再描画画像は未レビューで、coldだけのレビューを全操作成功とは扱わない。

SVGをbody側surfaceへ追加する処理とReactのready更新が別々に反映されていたため、最新世代の全ステップ完了後、flushSyncでready・onReady・onStatusChangeを同じReactコミットにまとめた。世代/abort確認、旧SVGの非表示、完成した全SVG、描画計算、性能時計は維持する。Viewer/実コントロール/ShowScore/adapterの40試験、型・lint、専用production buildが成功。現在、正しい画面の提示までの狭幅診断を再採取中。

### 初回の画面準備と残る非悪化診断（2026-10-24継続）

同時公開だけの版もcold最大148.491msで未達だった（cold10件を明示レビュー、入力/再描画は未レビュー）。`us2-attempts/us2-target-atomic/`。合成指定を外すCSS対照でも改善せず、その変更は製品へ採用していない（`us2-target-no-layer/`）。

CPU profile（採取自体に計測負荷があるため正式性能から除外）では、surfaceの位置/寸法同期と強制layout、SVG公開93.762msの直後109.08msでのWebGL context準備を確認した。空の初期surfaceではgeometry同期を省き、Page高さは同じ位置のplaceholderから測定する。鍵盤WebGL初期化は描画機会2回の後に送り、離脱時に待機frameを取り消す。1回目では初期化せず2回目の後に初期化すること、待機中離脱で初期化しないこと、既存offscreen停止/復帰/cleanupを試験した。音源は通常どおり取得し、音楽データや表示終了時計は変えない。これらだけの狭幅診断も一部未達であり、`us2-target-paint/` に残す。

旧版は初回HTMLに表示コントロールを含んだが、非同期化後は検証完了後に入力群をmountしていた。ScoreViewerをsource未確定の段階から用意し、検証済みsnapshotの到着後にも同じ入力DOMを再利用するよう変更した。未確定の間は楽譜jobを開始せず、音楽的利用を許可しない。フォームの取消/離脱は維持し、未開始のViewer jobの取消ボタンは無効にする。Page・倍率18を持つclient storeへのhydrationで旧server markupとの差を解決し、recoverable hydration error/attribute mismatchがないことを試験した。既存の警告文DOM構成は保持する。

入力値を変えない検証/ready通知でも入力群を4回再処理することを追加試験で再現し、イベント接続と入力JSXをViewer内で安定させて解消した。倍率を変えた時は入力群と新SVGが更新されることも確認。関連37試験が成功。これは音楽graph/描画パスの共有キャッシュではなく、単一Viewerの変更のないUI要素の再利用である。狭幅10試行はまだ一部未達で `us2-target-early-controls/` と `us2-target-stable-controls/` に保持した。

続くCSS対照では空surfaceのopacity/clipを開いたまま準備すると10件中8件で最初の提示候補に楽譜を確認できた（cold画像だけを確認、全操作の合格とはしない）。製品では空の初回surfaceのみpaint準備を維持し、inert/aria-hiddenを保持するprimeを追加した。既存SVGがある場合やretire後はprimeできない。追加試験は修正前に失敗、修正後にViewer/ShowScore/実コントロール/surfaceの44試験が成功。型・lintも成功。製品版の実測を再実行する。T025と全featureの合格は引き続き未確定。

### bounded snapshotの初回状態での捕捉

prime製品版の狭幅10試行でも、倍率18の2件が最初の候補の時点で固定閾値を超えた。`us2-attempts/us2-target-prime-product/` に採取ソース・全試行を保存し、合格扱いにしない。

大きい入力のWorker経路を維持しつつ、全体512ノード・各配列32・文字列/キー256以下の完全Sheetのみ、初回state initializerで同じschemaを用いてclone・検証・freezeする経路を追加した。Sheet/Engravingの同期importはしない。値上限外とpartialタグは従来の非同期処理へ送り、無効な小入力は安全なalertへ送る。計測のcandidate markはこの初回捕捉より前の位置を維持し、検証時間を時計から除外しない。

初回snapshotの非同期通知を省けることを修正前の失敗と修正後の成功で確認。同期/非同期のsnapshot内容一致、caller変更からの隔離、freeze、大きい値への不適用を含む22試験が成功。ShowScore/Viewer/実コントロール/adapterの46試験も成功。immutable id/revisionの再利用、改訂後の再検証、partial/打楽器の利用制限、同期model importをしない既存試験も維持した。

SSRの保存済みPage/倍率18では、hydration後のPageナビを含めてから最初のjobを開始する。非標準のnav高93pxとplaceholder top100pxを与えた追加hydration試験で、すべてのjobが正しいPage/scale/利用可能高を使用し、hydration errorがないことを確認した。初回Page寸法のfallbackを成功扱いにしない。型・lint・diff checkも成功。現時点のT025は未完了で、次はこの版の正式時計・画像による再測定を行う。

### bounded初回捕捉版の狭幅予備診断

同じ固定時計・Source/generation確認で狭幅Horizontal・倍率12/18を各5回再測定。80場面を明示レビューし、cold3件の待機候補を棄却して次の正しい提示フレームを採用した。cold最大106.233ms、再描画最大23.618ms、通常入力最大35.420ms。cutoff/失敗/未計測0、元条件へのSVG復帰10/10一致。両条件ともT005の固定非悪化閾値内だった。これは2条件の診断であり、全96条件各5回を合格にはしない。

入力群の再処理抑制とPage実寸・hydrationの回帰も維持し、型・lintが成功。現在、同じ製品sourceでquarter_middle_c全12条件×5回を検索・離脱も含めて正式採取中。画像処理・圧縮・build・単体試験はこの性能測定と重ねない。T025は全条件・全画像確認が終わるまで未完了を維持する。

### quarter全12条件の画像確認と最終提示通知の欠落

bounded初回捕捉版のquarter_middle_c全12条件×5回で、473場面を明示レビューした。cold60件の最大137.364ms、再描画120件の最大152.276ms、計測できた通常入力293件の最大89.891ms。coldは12条件ともT005固定非悪化閾値内、元条件へ戻したSVGも60/60一致。ただしPage/幅360の離脱10件中7件では最終画像候補に対応するPresentation通知がなく、合格試行は53/60に留まる。coldだけのsummary.unmeasurable=0を、全操作の計測成功と解釈しない。T025は未完了。

Page/幅360/倍率12/run3のcold候補0は、縮小比較画像では待機表示と読み違えていた。原画像と拡大表示で楽譜が既に見えることを再確認し、候補0（94.089ms）へレビューを訂正した。原トレース・画像・時計は変更していない。

未完了cohortを`measurements/us2-attempts/quarter-initial-capture-missing-tail/`へ、元collector・source/instrumentation記録・473件のレビュー・全画像・checksum付きtraces.tar.xzと共に保持した。離脱の欠落例ではstateからcapture markerまで62.045msで、その先のtraceが記録されず、最後のScreenshotに対応する提示通知を取得できていなかった。collector終了前に200msのtrace tailを追加する。候補画像のcapture markerによる範囲、入力時刻、Presentation時刻、性能閾値は変更しない。同じ12条件×5回を別出力へ再採取し、欠落を推定値で埋めない。

### trace tail修正後のquarter 60試行

終了通知の待機を加えたcollectorで同じ12条件×5回を再採取し、480場面を明示目視した。すべてのevidenceに対応するScreenshot/Presentationがあり、欠落0。cold60件の最大123.136ms、再描画120件の最大152.761ms、通常操作300件の最大88.749ms。離脱だけでも60件を確認し最大88.749msで100ms以内。cold全12条件がT005固定非悪化閾値内、条件往復後のSVGも60/60一致し、この素材の60試行はすべてtimingPass=true。1ページ素材なので複数ページ切替の性能証明とはしない。

`measurements/us2-scoped/us2-formal-quarter-tail/` に全画像・480レビュー・結果・条件別固定閾値比較・元トレースarchive・計測時runtime source・collectorを保存した。未完了だった先行cohortも残す。新規2cohortの全ファイル/展開archive memberについて、専用認証secret・DB接続値・cookie値の混入を検査し0件だった。collectorの構文/lintとdiff checkが成功。製品コードや描画保持条件、性能目標は変更していない。全8素材96条件のうち、この12条件分のみ完了したため、T025と全US2は未完了を維持する。

### 全480試行の採取と連桁素材の非悪化未達

同じ製品sourceとtrace-tail修正collectorで全8素材96条件×5回のブラウザー採取を完了。実行エラー0、欠落evidence0、条件往復の元SVG一致480/480。quarter以外の7素材は`measurements/us2-unreviewed/`に元結果・全画像・checksum付きtrace archive・計測source/instrumentation・collectorを保持した。元sourceはquarterのruntime-source archiveと同一。画像未確認の操作を性能PASSにしない。

beam-primaryのcold60画像を先に明示確認した結果、Horizontal/360x800/倍率12/run5が125.921msでT005固定閾値123.458msを超過。閾値を動かさずT025未完了。全480件の最初の候補時刻だけによる事前確認でこの超過を検出し、その後に該当画像を確認した。他素材も画像確認前の候補時刻だけで合格にしていない。

未達traceではSVG公開98.226msの後106.5msからReact scheduler taskが約9.86ms継続し、音源のparseは205.847ms以降だった。描画直後のaudio準備によるUI生成との競合を検証するため、toAudioSteps開始前に描画機会を挟むabortableな2回のrequestAnimationFrame待機を追加。音楽値・音声変換手順・SVG公開時計は変更しない。表示公開後、描画機会より先に音声準備が始まることをテストで再現し、変更後は2回目のframe後にだけ始まり、unmountやframe間abortで始まらない。関連50試験および追加取消を含む18試験、型・lintが成功。実測の改善は別の狭幅2条件×5回診断で確認する。計測用buildのみ既知のresource/[id]型gateを分離しており、root通常build成功の主張はしない。

### audio準備の描画待機後の狭幅診断

beam-primaryのHorizontal/360x800/倍率12・18を各5回再測定し、80場面を明示レビュー。cold最大106.174ms、再描画最大28.013ms、通常操作最大99.710ms。欠落/実行エラー0、元SVG復帰10/10一致、両条件とも固定非悪化閾値内、10試行すべてtimingPass=trueだった。`measurements/us2-scoped/us2-target-audio-paint/`に全画像・レビュー・時計・trace・runtime sourceを保存。これは修正対象の2条件の診断であり、修正後の全96条件の合格とはしない。T025は新sourceでの全条件再検証、モデル計測、debug/gallery/操作回帰を残す。

### 原本の条件往復後の操作未達とinert対照

全480試行の入力側も候補時刻で事前点検したところ、原本の条件往復後の離脱・一部検索に100ms超過があった。原本Horizontal/1280/12の例では離脱後39.37msから157.68msのUpdateLayoutTreeが発生し、73,151要素を再計算していた。既存T018の限定条件を、この条件往復後の操作成功へ拡張解釈しない。

音声準備の描画待機を含む同じproduction版で、原本基本条件・条件往復込みの通常版と、所有score surfaceのinert setterだけをfalseへ固定した診断用init script版を各5回比較した。離脱10場面を明示目視した結果、通常版は最大298.054ms・中央値272.123ms、対照版は最大96.667ms・中央値88.206ms。trace/画像/両collector/runtime sourceを`measurements/us2-scoped/us2-inert-baseline/`と`us2-inert-control/`へ保持した。対照版は製品合格ではない。他の操作とcoldは未レビュー。

独立基準の全96 SVG artifactを調べ、リンク・フォーム・foreignObject・tabindex・focusable/contenteditable=true・入力event属性がないことを確認した。製品ではscore graphicsだけのsurfaceにinertを設定する処理を外し、非表示時のclip-path:inset(100%)とaria-hidden=true、離脱時の即時clip/opacityとidle解放を維持する。SVG内容・座標・音楽値を変更しない。全子孫の継承状態を書き換えない追加試験が修正前に失敗し、変更後は55関連試験、型・lintが成功。既存の高さ保持・旧世代非表示・再表示禁止・空surface準備も維持した。実製品のブラウザー入力/ヒットテスト/Tab確認はこれから実行するため未検証をPASSにしない。

製品版の実Chromiumで原本を表示し、実際にhitできるglyphの座標を取得した後、native mouseで表示条件を変更。MutationObserverでloading中の旧SVGを捕捉し、DOM接続を維持したままclip=inset(100%)、aria-hidden=true、inert=false、同座標のelementFromPointが旧surface外であることを確認した。旧SVG内のfocusable要素は0、Tab後のfocusもsurface外、page error0。`measurements/us2-surface-interaction/results.json`とhelperに保持。これは機能確認であり性能の合格証拠ではない。初回helperはautomation後の確認時に既にreadyへ戻っておりloadingを捕捉できなかったため、native入力直後のDOM commitを観察する方法へ修正して確認した。

### 縦表示のLayerize負荷の切り分け

inertだけを外した製品版で原本60試行を採取したが、Verticalの検索/離脱はなお100msを超えた。狭幅・倍率12の例は検索時Layerize 172.44ms、離脱時169.50msで、旧inertによるUpdateLayoutTreeとは別の負荷だった。この失敗を合格扱いにせずbatch launcherを停止した。停止時に開始済みだったquarter/tripleの採取は完了させ、原本を含む180試行を保持した。

CSSだけの対照を1試行ずつ行った。transform/子SVG transform/isolationによる強制レイヤー化は改善せず、will-changeを外すと検索の候補時刻が約47msまで短縮したが、離脱は約111msで未達だった。opacity切替も抑える対照では検索55.146ms・離脱82.400msとなり、両画像の候補0でprobe入力/ホーム見出しを確認した。clipのみ変更する対照は改善せず、legacy clipの変更は製品に採用しない。これは各1回の診断であり、製品の5試行成功とはしない。

全対照のcollector/画像/traceと当時の製品runtime sourceを`measurements/us2-layer-research/`に保持した。製品ではsurfaceの常時will-change:opacityとopacityの切替だけを外し、既存clip-pathによる非表示、aria-hidden、保持寸法、idle解放は維持する。SVGコードや音楽値は変えない。合成指定を再追加しない回帰試験が変更前に失敗し、変更後はViewer/ShowScore/Gallery/surfaceの50試験、型・lintが成功。実製品の5試行と全描画比較はこれから確認するためT025は未完了。

### 小素材の非悪化と大きいSVGの合成負荷を両立する調整

一律flat版の原本Vertical/360x800/倍率12は5試行・40場面を明示確認し、検索最大57.960ms、離脱最大93.592ms、通常操作25件すべて100ms以内、cold最大3,876.949ms、再描画最大4,300.204ms、元SVG復帰5/5だった（`us2-scoped/us2-flat-vertical/`）。一方、quarter狭幅2倍率の10試行・80場面ではcold最大130.045msで固定非悪化閾値に未達の条件があった。`us2-flat-small/`のscopeTimingPass=falseを保持し、成功へ書き換えない。

独立Document/SVG比較とブラウザーgeometry比較を並行実行した確認は、117/119成功・2件120秒timeout、およびscreenshot準備の30秒timeoutで終了した。これを描画一致と解釈せず、同じ119比較をmaxWorkers=1で単独再実行し、timeoutを変更せず119/119成功を確認した。geometry helperのPlaywrightによる全SVG走査を伴うscreenshot準備は、idle状態を2描画機会待った後のCDP viewport PNG捕捉へ置き換える。geometry/paint/sourceの比較内容と性能目標は変更しない。

小さいSVGには従来の合成を維持し、大きいSVGだけflatにする。surfaceの初回は空なので軽い合成を用意し、SVG公開時はDOM要素を最大513個だけ調べ、512個を超えたらopacity切替とwill-changeを外す。SVG全体を同期走査せず、描画内容は変更しない。Viewerはglyph callbackによるgeometry読取りより前にこの準備を行い、commit時にも分類する。小/大の切替、上限付き走査、SVGの無変更とclip維持を試験した。51関連試験、surface単独8試験、型・lintが成功。新しい条件分岐版での性能は未検証なのでT025を未完了のまま再測定する。

### 上限付き合成判定版の実測レビュー（2026-10-26）

quarter Horizontal/360/倍率12・18を各5回、原本Vertical/360/倍率12を5回採取し、全120場面の提示画像を明示目視した。小素材のwarm focus 1場面、原本cold focus 4場面は候補0では枠が未表示であり、最初に枠が見える候補1を採用した。候補時刻だけで成功としない。全15試行で条件往復後のSVGが復元された。

小素材のcold最大119.091ms、再描画最大28.376ms、入力最大99.165ms。ただし倍率18の固定非悪化上限112.894msを超過したためscopeTimingPass=false。原本はcold最大4,105.473ms、再描画最大4,109.488ms、入力最大100.978ms。離脱のrun 2が100ms条件を超過したため、こちらもscopeTimingPass=false。`measurements/us2-scoped/us2-bounded-small/`と`us2-bounded-vertical/`にレビュー、画像、trace、当該runtime sourceと固定閾値の照合を保持した。既存の性能条件を変更せず、T025を未完了とする。

原本run 2の離脱traceでは、入力受信から23.348ms後に22.539msのLayerize、47.192ms後に32.388msのReact側FunctionCallを確認した。render adapterのdisposeは62.535〜63.133msであり、約0.598ms。旧inertの全子孫再計算を再導入せず、残るブラウザー合成処理を診断する。

同じ製品版の96条件比較は完了し、全96条件でSVG、座標・変換行列、計算済みpaint/fontスタイルが一致した。画素完全一致は全条件では成立しないため、この結果を画像の完全一致や性能の合格へ読み替えない。

### 残存負荷に対する追加調整

表示中surfaceのclipだけを外す対照は離脱101.099msで改善せず、採用しない。CPU profilerを有効にした診断では、原本のdisposeは支配的ではなく、小素材の初期処理にZodの検証コード生成が含まれていた。プロファイラ付き時間は通常条件の性能合格には使用しない。小さいと既に判定した入力だけ、同一schema.parseに`jitless:true`を渡す。全検証・refinement・出力・エラーを維持し、コード生成だけを省く。実行時Function生成が禁止された状態での検証試験が変更前に失敗、変更後に成功し、既存スキーマとの結果・エラー比較も成功した。大きい入力のWorker経路は維持する。

離脱済みsurfaceだけcontent-visibility:hiddenにするCSS対照では、原本Vertical/360/12の5試行の離脱最大97.025ms・中央値89.464ms。全5場面で候補0のホーム見出しを明示目視した。他の場面は未レビューであり、対照を製品合格にはしない。製品ではretire時のみ同指定を設定し、復帰しない旧SVGの内部レイアウトを省く。表示中・更新待機中のSVGには設定せず、従来の寸法保持・clip・aria-hidden・idle解放を維持する。追加試験の変更前の失敗を確認し、変更後は58関連試験、型・lint・diff checkが成功した。通常製品版での再測定は未実施のためT025は未完了。

追加対照・CPU診断・当該source manifestは`measurements/us2-bounded-diagnostics/`、96条件比較の全画像・結果は`measurements/us2-bounded-surface-comparison/`へ保持した。後者のviewport画素完全一致は24/96、SVG領域の画素完全一致は36/96であり、残りは目視確認を要する。

同96条件の全12比較シート・96対を明示目視し、表示viewport内の音符・記号・線・highlight・改行・切れ位置に差を認めなかった。各画像hashと行番号を`us2-bounded-surface-comparison/visual-review.json`へ記録した。これは表示viewportの比較であり、縮小シートを根拠に全ページの画素一致を主張しない。

### コード生成省略・離脱済み内部表示省略版の通常製品測定

診断用CSS/profilerを使わない通常collectorで、小素材Horizontal/360/12・18を各5回、原本Vertical/360/12を5回再採取し、全120場面を明示目視した。小素材の倍率18/run 2のcold候補0はloading、原本のcold focus全5場面の候補0は枠未表示だったため、それぞれ最初に正しい表示になる候補1を採用した。

小素材はcold最大91.347ms・中央値83.954ms、再描画最大24.620ms、入力最大38.245ms。両条件で固定非悪化上限を満たした。原本はcold最大3,561.602ms・中央値3,007.729ms、再描画最大3,906.738ms、入力最大82.170ms（離脱）。全15試行が絶対時間条件を満たし、条件往復後のSVGも15/15復元した。両scopeTimingPass=trueを`measurements/us2-scoped/us2-jitless-visibility-small/`と`us2-jitless-visibility-vertical/`に、画像・review・trace・runtime sourceとともに保持した。

これは限定3条件の確認であり、全96条件各5回、model cold5、gallery/debug/workflow、US3と最終検証は残る。T025とfeature全体のperformancePassは未完了/nullを維持する。通常production buildは計測専用コピーで既存Next型ゲートを分離したものであり、root production build成功とは主張しない。

### 全96条件・model cold各5回

現行修正版を固定した私有コピーで、全8素材×3方式×2幅×2倍率×5回、計480 fresh Node processのモデル計測を他のブラウザー・build・試験・圧縮処理と重ねず実行した。全480試行が完了し、各試行のDocument/SVG hashが既に確立した独立旧基準と一致した。不一致・打切り・実行失敗は0。model最大2,057.830msで、全96条件が6,500msの絶対上限と固定済みモデル非悪化上限を満たした。`measurements/us2-model-final/`に全結果・条件別比較・描画artifact・source/instrumentation manifest・runtime source・collectorとchecksumを保持した。

モデルの成功をブラウザー描画・操作の成功へ読み替えない。同じ修正版でブラウザー全96条件各5回を採取する。T025は引き続き未完了。

### 全ブラウザー条件へ拡張した際の再未達

通常collectorによる全96条件の採取中、原本Horizontal/1280/12のrun 5で描画中のキー入力115.016ms、Horizontal/1280/18のrun 4で離脱104.299msを検出した。採取を停止し、完了済み12試行と画像・trace・当該runtime sourceを`measurements/us2-scoped/us2-jitless-final-browser/`に保持した。cold focusと離脱の24場面を明示目視し、前者の失敗は候補0、後者の失敗も候補0で正しい画面を確認した。他の場面は未レビューであり、cold等の欠測を成功扱いしない。中断時の未完了試行は正式な5回へ加算しない。

キー入力の場面ではmain threadの初期Layoutが16.367ms、フォーカス状態のmarkが27.282ms、提示が115.016msだった。55.6msのEvaluateScriptはDedicatedWorker threadのもので、main threadの同期停止と混同しない。離脱側はLayerize 18.829msに加えて、viewport中央の大きいSVGのHitTestが15.712msかかった。

SVGのpointer-eventsだけをnoneにする対照では、親DIVまでのHitTestが22.173msとなる場面が残り、離脱候補108.441msを検出したため採用しない。SVG外に透明なHTML入力領域を置く対照では離脱5場面を明示目視し、最大90.263ms・中央値89.995ms。別の実ブラウザー機能確認で、原本Horizontal/VerticalのホイールによるscrollLeft/scrollTopが実際に640へ進み、スクロール範囲・SVGは不変、Tabはsurface外、page error0だった。対照の成功を製品成功へ読み替えず、大きいSVGだけで同方式を試験する。SVG・glyph・highlight callbackを変更しない。入力領域はaria-hiddenとし、native wheel/touchのscroll ownerは従来のsurfaceを維持する。大きい表示から小さい表示への変更で旧領域を除去し、縮小時に旧サイズがscroll boundsへ残らない追加試験は変更前に失敗、変更後に成功した。

原本保存画面の画面外の警告段落だけcontent-visibility:autoと1行分のintrinsic block sizeを設定するCSS対照では、初期Layoutの対象が1,389から453へ減り、Layoutは約16〜25msから約9〜10msへ短縮した。cold focusの5場面を明示目視し、最大50.390ms。警告を削除・要約せず、表示領域へ入った段落は既存の文言・組版で描画する方式を製品でも試験する。警告全件の保持と実表示は製品のブラウザーでこれから確認する。

対照のcollector/manifest/画像/traceと機能結果は`measurements/us2-horizontal-research/`へ保存した。変更後の関連59試験・型・lintが成功。型検査では一度、保存した計測器コピーがアプリ入力として検査され相対import不足で失敗したため、証拠ソースを既存方式の`.ts.txt`へ変更して再実行し成功した。製品ソースの型エラーを無視したものではない。非browserモデル271ファイルは全480試行の計測済みソースとbyte一致しており、モデル検証を保持できることを`us2-model-final/current-model-source-compatibility.json`へ記録した。通常製品のブラウザー性能は新しいsurface/警告処理で再検証するためT025は未完了。

### HTMLヒット領域・警告遅延レイアウトの通常製品確認

計測用コピーを現行ソースでbuildし、原本Horizontal/Verticalのnative wheelでそれぞれscrollLeft/scrollTop=640、SVGとスクロール範囲の不変、Tabのsurface外移動、page error0を確認した。`measurements/us2-hit-target-functional/`に保持。更新中の旧SVGもDOMに保持したままclip/aria-hiddenで入力対象から外れ、再びinertを使わないことを`us2-hit-target-interaction/`で確認した。

保存済み原本の警告は312段落すべて保持され、スクロール前後の全文が一致した。先頭・末尾へ実際にスクロールし、content-visibility:autoの段落が表示されることをAPIと画像の明示目視で確認し、`measurements/us2-warning-visibility/`へ記録した。これらは機能確認であり性能判定の代替ではない。保存画面の変更も追跡できるよう、source manifestに当該page.tsxとglobals.cssのhashを追加した。

再開時に専用server/DBが停止していたため10試行が候補受領前にsetup失敗となった。これは性能測定から除外し、`us2-hit-target-setup-recovery/`へ保持した。所有する3108番server・15439番test DBだけを復旧し、専用test sessionを更新して新規出力先で採取し直した。

通常collectorで原本Horizontal/1280/倍率12・18を各5回採取し、全80場面を明示目視した。cold focus 9場面、warm focus 5場面は候補0では枠が表示されていなかったため候補1を採用した。全10試行が成功し、cold最大5,678.518ms、再描画最大3,673.506ms、全入力最大82.647ms。以前未達だったcold keyboardは最大82.236ms、離脱は最大82.647ms。条件往復後のSVGは10/10一致した。`measurements/us2-scoped/us2-hit-target-horizontal-resumed/`に画像・review・trace・runtime source・合否を保持した。これは当該2条件の成功であり、全96条件の受入完了ではない。T025は未完了を維持する。

## 最新の全条件採取: 小素材の上限超過を確認

現行のHTMLヒット領域・警告遅延レイアウトを含む固定ソースで、通常の公開収集器、元の8素材・96条件各5回、条件往復・ネイティブ入力を実行した。再開時の出力は323/480試行で、収集プロセスも元のexec sessionも存在しなかった。終了原因は未確定で、意図的にSIGINT停止したとは記録しない。出力に収集失敗・cutoffはないが、未実施157試行と未レビュー画像を成功として扱わない。

明示目視3件を公開review CLIでSHAとframe source/sequenceに対応するPresentationへ照合した。部分matrixなのでafterフェーズの完全一致baselineゲートは拒否され、diagnosticとして記録し、固定非悪化値はbefore-results.jsonから別途そのまま比較した。

- simultaneous-strings / Page / 360×800 / scale12 / run2: cold129.384ms、固定非悪化124.1448msを超過。
- snare / Horizontal / 360×800 / scale18 / run4: cold273.111ms、固定非悪化114.7300msを超過。
- 同snare試行: 描画中Tabからhakeiフォーカス提示170.843ms、100msを超過。入力遅延140.5ms。

snareのトレースにはcandidate開始31.114ms前から230.197msのReact FunctionCallがあり、入力待ちと重なる。MinorGC15.269ms、Layout16.450msも観測した。ただしアプリ側のどの同期effect／描画処理が主因かは未特定で、React関数名だけを根本原因とはしない。次は失敗2条件の同期処理を限定プロフィールで特定する。製品コード・基準・性能目標はこの確認中に変更していない。T025は未完了、US3へ進めない。

別途、直前に終えた全96条件のsurface比較はSVG・bbox/CTM・paint/fontスタイル一致。96組すべてを目視し欠落・配置変化なし。viewportの完全pixel一致19/96、描画領域一致36/96で、pixel不一致を完全一致に読み替えない（measurements/us2-hit-target-final-surface-comparison/visual-review.json）。全ページDocument/SVGの保持は別の480モデル試行を参照する。

## 2026-10-27 JST: 同期検証のコード生成を抑制、旧基準との差分を分離

前回のsnare入力遅延と重なった230.197msのReact callbackを調査。100µs CPU samplingを加えた私有collectorで、ShowScoreのuseState初期化→capabilities→importCandidateSchema.safeParse→Zod compileのスタックを確認した。寸法取得の強制layoutも約13〜17ms。230ms全体は再現しておらず、単一根本原因と断定しない。初回診断の倍率往復先欠落による3件のaction cutoffは保持し、補正後の3件と区別する。診断時間は正式受入値に使わない。

製品修正はcapabilitiesに任意のparse contextを追加し、小素材のShowScore初期化だけjitless:trueを渡す。完全な既存schema/refinement・issues・機能可否・既定呼出は保持する。コード生成を禁止する試験は修正前に失敗、修正後に成功。capabilities/show-score/validate-sheet-scoreの3ファイル19試験、root tsc --noEmit、対象ESLint成功。私有webpack production build成功（従来の既存Next型ゲート分離設定を保持し、root production build成功とはしない）。

通常公開collectorで、snare Horizontal/360×800/scale18、simultaneous-strings Page/360×800/scale12をそれぞれcold5回・条件往復5回実行。全80場面を8枚の比較画像で明示目視し、公開review CLIが画像SHA・trace SHA・Presentation source/sequenceを検証した。TABの1ページ条件ではpage移動は発生しない。初回最大85.903ms、入力最大82.876ms、redraw最大27.070ms。固定非悪化値114.7300/124.1448msおよび100/6500ms上限に全件収まる。全96条件のafter評価は部分matrixなので行わず、固定値との限定比較として保存。

重要な別差分: 再ビルド時のsource manifest比較で、今回修正3ファイル以外に既存のengraving/geometry.tsとbarline.test.ts変更を検出。finalBarlineSeparationを使う終止線間隔の変更を保持しており、このターンでは編集していない。snare幅は前回201.528pxから現行201.168px、TABもSVG SHAが前回と異なる。これを保持成功と読み替えない。private routeでビルド済みcallsite1箇所だけ旧parse modeへ戻した診断対照では、現行とSVG/geometryが全10件一致し、今回のparse mode変更による差分がないことを確認。介入した対照の時間は受入に使用しない。

証拠はmeasurements/us2-scoped/us2-capabilities-targets/{scope-summary,preservation,source-differences}.jsonとmeasurements/us2-react-sync-diagnostic/に保持。利用者より終止線変更は「別作業」と回答あり。別作業の変更を保持し、今回の修正との因果比較は同じ終止線実装で行った。固定旧基準は更新せず、全96条件の描画保持を確認済みとはしない。T025未完了、T026以降へ進まない。描画保持条件・性能目標の緩和、stage/commitは行っていない。

## 全96条件の再採取: 336試行で固定非悪化上限を超過

通常公開collector、元fixtures.json、各5回・条件往復、前回のcapability jitless修正と別作業の終止線変更を含む同一productionコピーで開始。原本60、quarter60、triple60、cross-bar60、TAB60、snare36の計336試行を採取した。収集失敗・cutoffは0。TAB Page/360×800/scale18/run4の初回127.025msに対し、固定値は125.77080000042915ms。差1.254200msを丸めで除外せず失敗として扱う。明示目視した最初の候補0で正しい0/5 TAB記号・五線・終止線・配置・1/1を確認し、公開review CLIで画像/trace SHAとPresentation source/sequenceを照合した。

超過候補発見時に所有collector PID42125のみSIGINT停止。残り144試行は未実施。その他の候補値に時間上限超過は見つからないが、その全画像を確認していないため合格とはしない。原本を含む336試行すべての描画・入力受入が完了したという主張はしない。旧固定基準は変更せず、partial matrixはdiagnosticフェーズで記録した。原画像・全trace・ソース・収集器・明示reviewをmeasurements/us2-scoped/us2-capabilities-full-browserへ保持する。

該当traceではcandidate開始19.023ms前から103.080msのReact FunctionCall、開始後48.156msから11.316msのLayoutを観測した。前回の230ms停止全体も含め、原因のアプリ関数はまだ特定できていない。この継続では製品コード・仕様・上限を追加変更していない。別作業を分離する比較コピーの準備スクリプトは保存したが、比較コピーの作成・モデル再測定・全フレーム目視・gallery/debug/workflowは今回未実施。T025は失敗・未完了、T026以降へ進まない。

## T025初回超過の限定修正: 画面外パネルの初期レイアウトを削減

CPUプロフィールのアプリ側主要フレームはScoreViewerのmeasureViewportで、寸法取得が全体レイアウトを強制していた。旧ソースの通常5回では初回Layout154 objects/8.234〜9.583ms。main sectionへ遅延レイアウトCSSを注入した診断5回では133 objects/6.561〜7.172msとなった。cold最大値は診断CSS92.570ms、plain86.888msで単純には改善しておらず、時間のばらつき全体をCSSだけの原因と断定しない。プロファイル自体のオーバーヘッド、サービス停止による計測前失敗10件は別記し、受入値に含めない。

製品ではsrc/app/score/[id]/page.tsxの確認事項・履歴・編集案Cardとsrc/components/score-edit.tsxの編集Cardへcontent-visibility:auto / contain-intrinsic-block-size:auto 160pxを適用。DOM・本文・リンク・操作・音楽データは残し、ブラウザーが画面外のレイアウトを後回しにする。音楽モデル・終止線・SVG生成・入力/提示時刻の計測位置は変更していない。CSSのみの変更なので実装をなぞる単体試験を追加せず、実製品ブラウザーの表示/フォーカス/本文/SVG照合で検証した。

通常公開収集器でTAB Page/360×800/scale18のcold5回・条件往復5回を採取。40場面を6枚の比較画像で明示目視し、公開review CLIが画像/trace SHAとPresentationを確認。初回最大89.763ms、redraw最大27.577ms、入力最大97.616ms。固定非悪化125.7708msと100/6500msを全5件で満たす。1ページ条件なのでページ前後操作は未発生。修正前の同条件SVG SHA/geometryと5件すべて完全一致、往復復元5/5。source manifestの差分は上記2ファイルのみで、全音楽モデルと別作業のgeometry.tsはbyte不変。

原本Page/1280×900/scale18とTAB Page/360×800/scale18の実製品で全4sectionの本文不変、scrollでの可視化、リンク/ボタンへのfocus・native Tab、SVG不変・pageerror0を確認。原本312警告とTAB2警告の先頭/末尾をscroll表示し、12枚の画像を比較シートで目視した。危険なアーカイブ操作は実行していない。npx tsc --noEmit、対象ESLint、git diff --check成功。専用webpack production build成功は従来の型ゲート分離設定によるもので、root production build成功とは扱わない。

証拠: measurements/us2-scoped/us2-sections-tab18、us2-section-visibility、us2-section-layout-diagnostic。秘密値照合4,243ファイル/アーカイブメンバーで一致0。固定上限と失敗336試行の証拠は保持した。限定修正は成功したが、T025の全条件・独立比較・gallery/debug/workflowは未完了。

## パネル遅延レイアウト後の全条件再測定: 原本離脱の別上限超過

元fixtures.json・通常公開collector・同一productionソース・各5回/往復で再開。原本の20横表示試行と縦表示2試行を採取した時点で、Horizontal/360×800/scale18/run3の離脱100.584msを確認。最初の候補0から離脱先の楽譜見出しと一覧・リンクがreferenceに一致することを目視し、公開review CLIで画像/trace SHAとPresentationを照合した。100msを0.584ms超過した事実を丸めで除外せず保持する。

所有collector PID8227のみSIGINT停止。最終保存は22試行、収集失敗・cutoff0、未実施458。その他画像は未レビュー。cold値を正式に確定した全条件合格とはしない。TAB初回修正の5回・40場面成功（us2-sections-tab18）とは別の離脱失敗であり、初回修正を取り消さない。新たな製品変更・性能/描画保持条件変更は行っていない。

入力待ち18.1ms、入力後23.543msからLayerize26.280ms、入力後58.033msからReact scheduler FunctionCall24.495ms、目的画面DOM commitは入力後約82.762ms、正しい提示は100.584ms。旧SVGが目的画面のcommit前にLayerizeへ参加する可能性を次の調査対象にする。不可逆なretireを前倒しするのではなく、遷移失敗時に戻せる一時停止/復帰の回帰試験と原因検証から進める。実装・効果は未検証。

証拠はmeasurements/us2-scoped/us2-sections-full-browser。T025は未完了、T026以降は開始しない。冒頭とtasks.mdに次の具体作業と再開指示を更新した。

## 原本離脱超過の修正: 可逆な遷移待機とUIタスク優先度

ヘッダー4ヶ所のNext Link内へScoreNavigationStatusを置き、Next自身のuseLinkStatus.pendingを所有期間とするleaseを導入。各leaseは自分の待機だけを解放する。ScoreSurfaceは待機中だけcontent-visibility:hidden・clip・aria-hiddenで旧SVGを描画/レイアウト対象から外し、ノードやglyph購読を破棄しない。待機解除の復帰はmicrotaskへ遅延し、成功時に同じReact commitでretireした面を復帰させて余計なlayoutを起こさない。元画面が残る場合のみ可視性・ARIA・同一描画のscrollを復帰する。待機中に新描画が完了する場合も、一時的に正しい寸法を測定し、早期公開/ゼロ寸法固定/古いscrollの上書きを防ぐ。

最初の通常5回では離脱最大63.625msとなったが、明示目視でrun4の描画中Tabフォーカスが候補0では正しくなく、候補1の2,992.967msで初めて一致すると判定した。その試行はus2-scoped/us2-navigation-originalに失敗として保持する。候補値37.826msやhandler時刻への置換で合格にしない。

この追加調査で、scheduler.yieldの優先される継続が普通のUI更新を追い越し続ける経路を扱った。postTaskが使える場合は毎sliceをfreshなbackground taskとして再投入し、普通のUI更新を先に実行する。abort signal・独自yield・scheduler.yield/timerの従来fallbackは保持し、計算単位やslice上限・出力は変更していない。普通のUIが描画終了まで待たされる試験とbackground待機中のabort試験は修正前に失敗、修正後に成功。全関連8ファイル64試験、tsc --noEmit、対象ESLint成功。

最終ソースを通常公開collectorで原本Horizontal/360×800/scale18各5回・条件往復5回検証。6枚40行とcold-detail.pngを目視し、coldは警告の赤い休符まで一致する候補1を全5件で採用（候補0は黒）。hakei/debug枠、probe、離脱先の見出しも最初の正しい候補を明示選択し、公開review CLIが画像/trace SHAとPresentationを検証した。cold最大4,664.824ms、redraw最大4,170.960ms、全入力最大73.989ms、離脱最大72.775msで全件固定上限以内。離脱間のLayerize最大は1.120ms（元失敗26.280ms）。修正前SVG SHA/geometryと5/5一致、往復復元5/5。全非browser音楽モデルと別作業のgeometry.tsはsource manifestでbyte不変。

実ブラウザーではHome RSC応答を保持し、実Next Linkの待機で旧SVGが非表示・同一ノード/本文保持となることを確認。現在版へのnative操作で前の遷移を取り消し、同一SVG・scrollLeft640・scrollTop・描画世代・可視性が復帰することを確認した。後から古いHome応答を解放しても目的外の画面を公開しない。優先度修正前後とも成功。失敗/取消後にpendingが解除され元Viewerが残るケース、競合lease、成功時のretire、stale microtask、新描画完了時の寸法/scrollは単体・コンポーネント試験で確認。ブラウザーのhard network errorによるフルページ遷移失敗そのものは試験しておらず、今回の復帰機構の保証と混同しない。

証拠はus2-scoped/us2-navigation-priority-original、us2-navigation-priority-cancel。旧段階の失敗はus2-scoped/us2-navigation-original、取消確認はus2-navigation-cancelに保持。private production buildは従来の既存型ゲート分離設定の成功で、root production build成功とはしない。新規依存・DB schema・音楽データ・終止線・固定性能目標は変更していない。T025全体の全96条件・独立比較・gallery/debug/workflowは未完了で、次の手順は冒頭とtasks.mdへ更新した。
