# GitHub Actionsの保存統合テスト失敗修正（2026-10-21 JST）

GitHub Actions run 39535417425のDB統合テストで、tab/conflicting-string-input、tab/tuning-conflict、drum/percussion-to-standardの3件が失敗した（統合テスト206合格・3失敗）。

- 不完全候補を提案として再保存する際に、完全候補への昇格が表記矛盾で例外になっていた。完全スキーマのsafeParse成功時だけ昇格し、矛盾が残る場合は元のpartialと元情報を保持する。完全候補自体の厳密検証は変更しない。
- MusicXMLのinstrument参照がない打楽器にinstrumentId:undefinedを明示的に付けていた。未指定時はフィールドを省略して非JSON値を除き、既存の署名・JSON検証は維持する。

src/server/import-notation-regressions.test.tsでCIの3失敗をDBなしで再現し、修正前の失敗と修正後の合格を確認した。全回帰は115ファイル・877テスト合格。型検査・変更3ソースのlint・取り込みworkerビルドも合格。008の69件・009の119件の自動証跡を再生成した。

ローカルDB実行の保留は維持する。DB統合検証にはリポジトリの既存GitHub Actions専用PostgreSQLを利用し、修正コミットに対応するActions実行結果を参照する。構造化したpersisted/visual証跡や最終監査を、この通常テストの合格で自動的に完了扱いにはしない。

---

# push前のリモート統合検証（2026-10-21 JST）

origin/chore/setup-spec-kitの27403d0までの音部記号・拍子配置修正を競合なく統合した。統合後の全回帰は114ファイル・874テスト合格、型検査と統合対象6ソースのlintも合格。008の69件・009の119件の自動証跡を再生成し、入力・期待値・layout・現在ソース版の一致とfail/error 0件を確認した。現在fingerprint: 4983faeb956628f8f8dcc43ffeea9c28906ce2cfb0f660bc153d2324cb675125。

今回の統合は描画とテストの変更で、ルート・依存・ビルド設定の変更はない。本番build全体は統合直前の合格記録を下記に残し、統合後は全回帰・型検査・lintで確認した。ログは/tmp/notation-push-merge-tests.txt、/tmp/notation-push-merge-tsc.txt、/tmp/notation-push-merge-lint.txt。DB保留と形式的な目視証跡・最終監査の未完了は維持する。

---

# 最終レビュー・コミット前確認（2026-10-21 JST）

レビュー指摘3件の修正後、取り込み・保存スキーマ・演奏射影・譜表別設定・描画・UI・検証記録を再確認し、コミットを妨げる追加の問題は見つからなかった。基礎記号・タイ・臨時記号の008と、TAB／ドラムの009は共通モデル・描画変更を含むため、今回の変更としてまとめる。

- 全回帰は現在の修正に対する112ファイル・865テスト合格。
- 全変更103 TS/TSX/MTS/MJSのeslintは合格。型検査も合格。
- EMAIL_SERVER='' EMAIL_FROM='' npm run build は合格。既存SMTP環境条件を検証プロセス内だけで切り分け、設定ファイルは変更していない。worker生成・本番型検査・ページ生成を含む。実運用メール設定の検証ではない。
- 008の69件と009の119件すべてで入力・期待値・layout・現在ソースfingerprintの一致を再確認し、fail/errorは0件。
- git diff --checkは合格。コミット対象に秘密情報ファイル・一時ログ・ビルド成果物を含めない。

ログ: /tmp/final-notation-lint.txt、/tmp/final-notation-build.txt。DB統合検証は利用者指示により保留、全fixtureの形式的な目視証跡と最終監査は未完了のまま。Braveでの利用者確認申告は下記に記録している。コードのコミットは未実施の検証を合格にするものではない。

---

# コードレビュー指摘3件の修正（最新: 2026-10-21 JST）

1. 明示共有イベントの代表ノートを常に通常譜側に統一した。TAB側が配列で先でも、前後のイベントでstaveIdが変わらずタイを結合できる。入力の表示ノートは削除せず、練習上の保持時間1,000,000µsと継続元、音声変換時の代表IDを回帰確認した。
2. MusicXMLの音部記号を譜表番号ごとのMapに保持した。明示的なG/F等への変更を通常譜として反映し、TAB／打楽器から戻った通常音符の音高を維持する。種類が変わった場合に以前の線数・調弦を誤継承せず、同じTAB種類の途中弦数変更は既存の未対応規則を維持する。
3. 一方の音部記号変更で他方の設定を上書きしない。小節途中の状態変更を表示できるよう、小節境界で変わった音部記号と、通常譜へ戻る際の調号を描画する。

| 検証 | 結果 |
| --- | --- |
| npm test -- --run | PASS: 112ファイル / 865テスト |
| npx tsc --noEmit | PASS |
| 変更5 TSのeslint | PASS |
| npm run build:import-worker | PASS |
| runner --suite tab-drum | PASS: 119 fixtures（render100 / partial9 / reject10）、自動assertion946、fail/error 0 |
| runner --suite notation | PASS: 69 fixtures、自動assertion245、fail/error 0 |

新しい主条件はdrum/percussion-to-standard、tab/tab-to-standard、mixed/independent-clef-change、mixed/shared-tie-reorderedの4件。入力順を入れ替える単体テストと、JSON/Sheet往復・保存取得用期待値・Document/SVG・タイ接続先・誤接続の対照を追加した。変更前に4つの回帰条件が失敗し、変更後に通ることを確認した。

両suiteの全入力hash・期待値hash・layout・rendererRevisionを現在版と照合した。現在fingerprint: f5f2968baa9ec848a89cbfbb9a782c7970357969267e555b5a225725dce33db1。009のpersisted189 / visual100、008のpersisted39 / visual67はpending。DB実行保留と全件目視証跡の未完了を維持する。以前のBraveでの概略確認・追加3条件の問題なし申告は履歴として保持し、今回の追加4条件や新ソース版の目視確認には流用しない。今回のコード変更は取り込み・モデル・描画とそのテストで、ルート・依存・ビルド設定を変えていない。本番build全体は再実行せず、型検査とworkerビルドを実施した。

ログ: /tmp/tab-review-fixes-tests.txt、/tmp/tab-review-fixes-tsc.txt、/tmp/tab-review-fixes-lint.txt、/tmp/tab-review-fixes-worker.txt。DB統合テストは今回も実行していない。レビューで指摘した3件のコード修正は完了し、残る既存の保存・目視・最終監査タスクは未完了のまま維持する。

---

# Phase 8 検証（最新記録: 2026-10-21 JST）

T071を実装した。ドラムのnotations内で描画対応するtied以外の指定、およびgrace/play、未対応符頭装飾を非実行sourceNotationに保持し、対象track/barを持つ省略診断を返す。ロールや特殊奏法の新しい描画・再生規則は追加していない。時刻未確定の装飾音はpartialのまま保持する。既存の楽器対応・表示位置・音価とsourceNotationの64KiB合計制限を維持する。

## 利用者によるBraveでの概略確認

利用者は「とくに不具合はない」、使用ブラウザーは「Brave」、確認範囲は「だいたい全部見た」と申告した。目視した範囲で不具合なしという確認結果を記録する。確認fixtureの一覧、ブラウザー版、実行日時、確認時の入力・期待値・layout・ソース版は未特定。新たに追加した3条件の確認を含むとは扱わず、各visualChecklistの全件合格へ自動変換しない。確認時刻として記録更新日時を代入しない。

### 追加3条件の利用者確認（2026-10-21 JST記録）

追加したdrum/omitted-roll・drum/omitted-open-hihat・drum/omitted-graceの確認案内に対し、利用者から「問題ないように見える」と申告があった。追加3条件について、目視した範囲で問題は見当たらないという結果として記録する。使用ブラウザーは先の申告ではBraveであり、今回の返答では変更の申告はない。ブラウザー版・実行日時・確認時のソース版は未特定のまま保持する。全fixturesの形式的な目視証跡を満たしたとは扱わず、この追加3条件の再確認は不具合や変更がない限り求めない。DB実行保留は継続する。

## 今回の自動検証

| 検証 | 結果 |
| --- | --- |
| npm test -- --run | PASS: 111ファイル / 857テスト |
| npx tsc --noEmit | PASS |
| 変更2 TSのeslint | PASS、警告なし |
| npm run build:import-worker | PASS |
| runner --suite tab-drum | PASS: 115 fixtures（render96 / partial9 / reject10）、自動assertion895、fail/error 0 |
| runner --suite notation | PASS: 69 fixtures、自動assertion245、fail/error 0 |

全fixtureの入力hash・期待値hash・layout・rendererRevisionが現在版と一致し、失効は0件。現在fingerprint: 7da6834ee129481057da8c06a1ef606d71890bb180e1840aa7c525911915e720。009はpersisted178 / visual96、008はpersisted39 / visual67がpending。実DBは利用者指示により保留。Braveの概略確認とfixture別の証跡未完了を区別し、visual-results.jsonの合格記録は作成しない。

今回のログ: /tmp/tab-phase8-tests.txt、/tmp/tab-phase8-tsc.txt、/tmp/tab-phase8-lint.txt、/tmp/tab-phase8-worker.txt、/tmp/tab-phase8-suite.txt、/tmp/tab-phase8-regression-suite.txt。今回の変更は取り込み処理・テスト・fixturesで、ルート・依存・ビルド設定の変更はない。本番build全体は今回再実行せず、型検査とworkerビルドを実施した。以前の条件付き本番build結果は下記に履歴として残す。

T073の利用者申告記録とT074の自動検証・証跡更新部分を実施した。T072のDB実行、T073の最終版のfixture別確認、T074の最終監査は未完了。全74タスク中63完了で、既存の同じ検証残件を引き継ぐタスクも未完了を維持する。次は追加したdrum/omitted-roll・drum/omitted-open-hihatの基本表記と省略警告、drum/omitted-graceの描画不可・元情報保持を確認する。実施範囲を特定できる目視結果から記録し、DBは後日専用_test PostgreSQLを利用者が準備・許可した際に検証する。機能全体の検証完了は宣言しない。

---

# Phase 7 Convergence 検証（最新: 2026-10-20）

T064/T065/T066/T069を実装した。括弧付き／塗り指定のドラム符頭装飾は省略警告と元情報を保持する。未対応弦数の元譜表attributesをpartial.notation.sourceStavesへ保持し、昇格を抑止する。各note.sourceNotationとの合計64KiB上限を検証する。不正MIDI対応では元midi-instrumentも保持する。

同音異運指・同時弦・同時打音・複数声部は各音の情報と描画位置・数字・弦・符頭を独立判定し、対応要素だけの削除・誤表記・誤位置を不合格にする。括弧付き符頭、MusicXML調弦矛盾、JSON調弦矛盾の3 fixturesを追加した。実DBテストには診断の保存後一致も追加したが、実行は保留中である。

| 今回の検証 | 結果 |
| --- | --- |
| 全回帰 npm test -- --run | PASS: 111ファイル / 850テスト |
| npx tsc --noEmit | PASS |
| 変更5 TSのeslint | PASS、警告なし |
| npm run build:import-worker | PASS |
| git diff --check | PASS |
| 009 runner --suite tab-drum | PASS: 112 fixtures（render94 / partial8 / reject10）、自動assertion867、fail/error 0 |
| 008 runner --suite notation | PASS: 69 fixtures、自動assertion245、fail/error 0 |
| 実DB・実ブラウザー | 未実施。DBは利用者指示により保留。目視用ブラウザー環境なし |

両reportの全fixtureで入力hash・期待値hash・layout・rendererRevisionを現在値と照合した。現在ソースfingerprintはeb65a915857a98a07909300cb53b4b8a8f30a4fc287f57bc3c3e83e1ee1f49f4。009はpersisted168 / visual94、008はpersisted39 / visual67がpendingで、過去版の合格を流用していない。visual-results.jsonの合格記録は作成していない。

今回の全回帰ログ: /tmp/tab-convergence-tests.txt、型検査: /tmp/tab-convergence-tsc.txt、lint: /tmp/tab-convergence-lint.txt、worker: /tmp/tab-convergence-worker.txt。build全体の今回の再実行は行っていない（下記Phase 6の条件付きbuild記録とは区別する）。

全70タスク中62完了。T033/T045/T055/T058/T062/T067/T068/T070は必須証跡待ちとして未完了。T070の自動証跡更新・版照合は実施済みだが最終監査は未完了。次は実ブラウザーで両suiteの全必須条件とpreviewを確認して各visualChecklistを記録する。DBは後日専用_test PostgreSQLの実行を利用者が許可・準備した際にquickstartの手順で確認する。機能全体の完了は宣言しない。

---

# Implementation Validation

## 実装結果

譜表別の通常／TAB／打楽器設定、4/5/6線の配置と共通拍位置、弦・フレット・明示調弦の保持、数字列と譜線抜き、通常／×符頭、無音高位置と楽器対応、明示アンカーのタイと改行／改ページを実装した。

打楽器休符はrest:true/pitch:nullで保存モデルを往復し、打音用表記を要求しない。旧数値pitch付き休符を読み続ける。完全な通常非休符と音高不明の不完全候補を区別する。未対応情報はsourceNotationまたはpartial.notationに保持し、保存可能なpartialと拒否を別に扱う。

capabilitiesで表示と演奏を分離し、ドラム・音高不明TAB・共有関係不明の併記を演奏不可とする。明示共有関係だけを演奏射影で1打鍵にまとめ、表示ノートは削除しない。直接Audio/timelineの入口もガードする。新依存・DB migration・新HTTP endpoint・認証設定の変更はない。

## 実行結果

| 検証 | 結果 |
| --- | --- |
| npm test -- --run | PASS: 110ファイル・839テスト |
| npx tsc --noEmit | PASS（本番buildの型検査もPASS） |
| 変更73 TS/TSXのeslint | PASS、警告なし |
| npm run build | 既存開発用SMTP設定によりInvalid SMTP configurationで失敗 |
| EMAIL_SERVER='' EMAIL_FROM='' npm run build | PASS。検証用プロセスのみメール設定を無効化。worker生成を含む |
| git diff --check | PASS |
| 実保存・再取得・提案・マージのDB統合テスト | 未実施：利用者指示により保留。テスト作成・型検査済み |
| 実ブラウザーでのBravura形状・重なり・全ページ | 未実施：ブラウザー操作ツール・実行ブラウザーがない |

ビルドと同時に実行した全回帰で既存score-viewerのresizeテスト1件が5000msのタイムアウトとなった。ビルドと競合させず全回帰を再実行して839件合格を確認した。テストのタイムアウト値は変更していない。既存jsdomのcanvas.getContext未実装メッセージは合格した音声波形テストの出力。

通常buildのSMTPエラーは以前の008でも確認済みの環境条件。条件付きbuildは実運用メール設定の動作保証ではなく、設定ファイルや秘密情報を変更していない。

## fixtureと証跡

009は109件（render93、partial7、persisted拒否9）。通常譜008の69件を維持し、suite単位で自動結果の保存先を分離した。各suiteのloaderエラーは0件、全RunのrendererRevisionは最終ソースと一致した。

| Suite | 自動assertion合格 | fail/error | DB pending | visual pending |
| --- | ---: | ---: | ---: | ---: |
| tab-drum（009） | 735 | 0 | 118 | 93 |
| notation（008） | 245 | 0 | 39 | 67 |

保存拒否専用fixtureのunit test終了をDB検証合格と扱わず、persistedはpendingのまま。visual-results.jsonの成功記録は作成していない。SVGの実文字・codepoint・位置・線貫通・接続先の検証と、実ブラウザーの形状確認を区別する。

coverage.mdにFR-001–017、SC-001–006、全12受け入れ条件とfixture/assertion/taskを対応付けた。数・不在・誤位置・誤端点・譜線貫通の対照結果、実文字欠落・桁逆順・誤符頭の対照テストを実行した。

## 性能と再配置

benchmark-results.jsonは同じNode22・入力・配置で10回warmupと30回測定したモデル→Documentの比較。ブラウザーや初回ファイル取り込みの時間ではない。変更前は009開始時点の作業ソース（008の未コミット実装を含む）を保存して計測した。

| 既存入力 | 変更前中央値ms | 変更後中央値ms | 要素数／幅 |
| --- | ---: | ---: | --- |
| quarter_middle_c.json | 2.431 | 2.575 | 40 / 16.6（不変） |
| c_major_scale_up.json | 6.455 | 8.291 | 107 / 31.448（不変） |
| dotted_eighth_sixteenth_beam_hooks.json | 8.255 | 9.947 | 102 / 31.708（不変） |

新しいTAB・ドラム・混在・複数ページの4入力も連続layoutでページ寸法と要素数が不変。表記・境界確認に処理増分がある。一律の性能閾値や全楽曲の速度保証は設けない。タイ／共有イベントはMap・Set、保存境界の小節探索は二分探索と譜表Map、譜線抜きは区間sort/mergeを使い、新規の全音対全音探索を避けた。

## 残件と次の手順

58/63タスクを完了。T033/T045/T055は実ブラウザー目視、T058はDB実行、T062は必須証跡の最終完了待ちとして残す。自動検証済みの部分と環境依存の未実施を区別する。

次はnpm run dev後に/dev/notation/fixturesで009の93正常条件と変更で失効した008の67正常条件を目視する。各visualChecklistにブラウザー・確認者・入力/期待値/layout/rendererRevision・日時付きの結果を記録する。特にTABの数字と上下タイ、ドラムの符頭・声部、混在の拍位置・改ページを確認する。

専用の末尾_test PostgreSQLが後日用意された段階でquickstart.mdの統合テストと --suite tab-drum --persisted を実行する。今回は接続先の再要求や既存DBへの代替接続は行わない。

新nullable表現を旧クライアントへダウングレードして読めるとは保証しない。旧保存データの読み取りを維持し、一括書換えは行わない。ドラム専用再生・採点、運指生成、特殊奏法の再現などは後続候補。

次に $speckit-converge で実装と残件を照合できる。必須persisted/visualが未実施のため、機能全体の合格・完了は宣言しない。
