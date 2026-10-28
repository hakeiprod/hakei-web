# Quickstart: 描画無応答修正の検証

現行の実行手順。完了状況と最新結果は[validation.md](validation.md)冒頭、取得済みの独立旧描画基準は[reference-manifest.json](measurements/reference-manifest.json)を参照する。原本基準・変更前計測・現行ソースの最終全条件検証は完了。[最終集計](measurements/final-results.json)と[全体回帰](measurements/us3-final/t032-summary.json)を参照する。

## 1. 前提と基準の固定

- Node22、既存依存を利用する。新規依存は追加しない。[007の原本記録](../007-musicxml-version-compat/fixture-provenance.md)と原本hashを照合する。
- 現行renderer・Bravura・入力のchecksum付きコピーを製品変更前に固定する。旧描画基準は[契約](contracts/rendering.md)のoffline手順で取得し、未完了をPASSにしない。
- [baseline.json](measurements/baseline.json)は今回のNode基準、[007ブラウザー証跡](../007-musicxml-version-compat/naitoobunaitsu-browser-results.json)は既存無応答の証拠。これらは改善後の成功ではない。
- モデル用・実ブラウザー用の両計測ツールは変更前/変更後で共用する。固定済み変更前の全試行・非悪化閾値はbefore-results.jsonから参照し、再取得した改善後の時間で上書きしない。
- 小素材・既存代表の変更前5試行と非悪化閾値を先に固定する。計測時に他のビルド・テスト・描画を動かさない。

今回の観測を再実行する場合（repo rootから）:

```bash
node --import tsx specs/010-fix-score-rendering/measurements/baseline-probe.mts quarter_middle_c.mxl
node --import tsx specs/010-fix-score-rendering/measurements/baseline-probe.mts naitoobunaitsu-bitomario.mxl
```

プローブは純粋な調査用で製品APIではない。getter計数があり、原本layoutは15秒で打切る。新しい実装の公式合否は以下の専用ベンチマークで判定する。

## 2. 実装後の自動検証

```bash
npm test -- --run src/s-core/models/import/naitoobunaitsu.test.ts
npm test -- --run src/s-core/models/engraving src/s-core/models/browser
npm test -- --run src/components/score-viewer.test.tsx src/components/show-score.test.tsx src/components/import-preview.test.tsx
npm test -- --run
npx tsc --noEmit
npx eslint src/s-core/models/sheet src/s-core/models/engraving src/s-core/models/browser src/components/score-viewer.tsx src/components/show-score.tsx src/components/score-fixture-gallery.tsx
EMAIL_SERVER= EMAIL_FROM= npm run build
```

新しく変更したファイルもlintへ追加する。buildのメール設定はこのコマンドだけに限定する。同期/協調両経路のDocument/SVG同等性、境界/重複、世代取消、条件往復、ハイライト接続のcleanup、待機・失敗・retryを確認する。

モデル用・ブラウザー用計測ツール（どちらも変更前・改善後で共用）:

```bash
node --import tsx scripts/benchmark-score-rendering.ts --manifest specs/010-fix-score-rendering/measurements/fixtures.json --runs 5 --output /tmp/score-rendering-results.json
node scripts/verify-score-rendering-browser.mjs --manifest specs/010-fix-score-rendering/measurements/fixtures.json --runs 5 --base-url http://localhost:3107 --output /tmp/score-rendering-browser-results.json
```

`fixtures.json`、T004の独立旧描画基準、T005の変更前全96条件×5試行は取得済み。承認済みの別作業による終止線変更はreference-with-separate-barline-manifest.jsonで別に識別し、既存基準は保持する。出力は全試行のstage時間、最大値/中央値、cutoff/error、環境とchecksumを含む。原本model6.5秒、ブラウザーcold12.5秒/redraw6.5秒、操作100msを[契約](contracts/rendering.md)の境界で判定する。モデル時間をブラウザーの完成時間と読み替えない。

## 3. 実ブラウザーと保存

[開発手順](../../docs/development.md)に従って、稼働環境から分離した末尾 `_test` DB、専用Git、認証/署名設定とブラウザーを用意する。稼働DB/.envやユーザーのサーバーを変更しない。NextのOriginとURLのホストを一致させ、007で遭遇したlocalhost/127.0.0.1不一致を避ける。

1. 新規リポジトリで原本を選択。候補受領からプレビュー公開・操作可能までを記録し、元版3.1、5,540音、312警告を確認する。
2. 表示中に入力・取消・離脱を投入し、実操作への応答を測定する。入力受理・処理開始・状態反映・表示フレームを契約の同一時計へ対応付け、待ち行列の時間を含める。requestAnimationFrameだけで表示完了を判定せず、欠測は計測不能として記録する。再試行、A→B切替と遅いA完了、失敗も制御し、現在の画面と保存データが変わらないことを確認する。
3. 取消後に原本を再度選び、警告確認→保存→詳細画面→reloadを最後まで操作する。DB/Git読込で候補・元版・診断・validationを007と同じ方法で照合する。
4. 横/縦/ページ×360/1280幅×scale12/18を各5試行。表示条件往復、ページ数が減る場合のclamp、反復による余白増加・重複なしを確認する。
5. 既存小素材・臨時記号・連桁・タイ・複数段・TAB・打楽器代表でも構造/座標と目視を比較。現在のSVGへ再生ハイライトが結び、ページ切替/再描画後も購読が重複しないことを確認する。
6. フォント事前ロード・音源取得条件を記録。実音声/実機MIDIの未検証を明記し、代替環境で実機成功を主張しない。

保存の回帰は専用環境で既存コマンドも実施:

```bash
npm run test:integration -- src/server/score-import.integration.test.ts src/server/import-worker.integration.test.ts
```

## 4. 合否・記録と終了処理

[契約](contracts/rendering.md)の全FR/SC/9受入シナリオ対応表へ実測・比較結果を紐付ける。性能試行の打切り・基準未取得・未実施・実操作未完了をPASSへ置き換えない。記録に秘密・session token・原本本文を含めない。検証用server/browser/DBを止め、専用一時データを削除する。

T001〜T035の実装・検証は完了。最終状態とレビュー前の確認事項はtasks.mdとvalidation.md冒頭を参照。

## 計測器の追加引数

モデル用: `--source-root /tmp/.../reference` で固定ソースを指定する。`--offline` は30分の参照取得で、通常30秒の性能測定から分離する。`--fixture <manifest内ID> --first-condition` は1素材・最初の条件に限定する。`--references /tmp/.../drawings` はDocumentとSVGのgzipを保存する。参照専用メモ化の `--memoized-reference` はT004で検証した独立同等基準の取得経路で、`--offline` との併用が必須。取得結果を性能値へ混ぜない。

ブラウザー用: Playwrightは検証環境へ用意し、`--playwright-module /absolute/path/to/playwright/index.mjs` または `PLAYWRIGHT_MODULE` で指定する。`--browser-path` は任意。`--storage-state /tmp/private-state.json` と `--actions /tmp/actions.json` を利用できる。actionsはupload（selector/path）、click（selector）、fill（selector/value）、goto（path）、任意のexpect（表示確認selector）の配列。出力先は私有一時領域に置く。状態markと画面フレームの対応を確認するまではtimingPass=nullであり、収集完了を性能合格と扱わない。全条件の実施状況・フレーム確認記録はvalidation.mdと各measurement集計を参照する。


### T004の独立同等基準の再検証

`measurements/reference-manifest.json`に固定ソース・入力・フォント・参照専用helperのhashと全96条件の圧縮前後hashを保存した。`reference-helper.ts.txt`は取得時のhelperそのもの。`reference-equivalence.json`は既存7素材×12条件のbyte全体一致（正規化なし）を記録する。原本は別の`target-memoized.json`で全12条件・5,540音・getter再計算・入力不変を記録する。性能試行ではない。

再取得の手順は、固定ソースで7代表を `--runs 1 --references <old-dir>`、同じ条件を `--runs 1 --offline --memoized-reference --references <memo-dir>` で実行した後、以下で比較する。代表manifestはfixtures.jsonの原本以外7素材、表示条件は変更しない。

```bash
node scripts/verify-score-rendering-reference.mjs --original <old-results.json> --memoized <memo-results.json> --manifest <representatives.json> --source-manifest specs/010-fix-score-rendering/measurements/reference-manifest.json --original-artifacts <old-dir> --memoized-artifacts <memo-dir> --output /tmp/reference-equivalence.json
node --import tsx scripts/benchmark-score-rendering.ts --manifest specs/010-fix-score-rendering/measurements/fixtures.json --runs 1 --offline --memoized-reference --fixture naitoobunaitsu-bitomario --source-root <frozen-source> --references <target-dir> --output /tmp/target-reference.json
```


### 実アプリの変更前/改善後計測

専用DB/Gitに登録したfixtureと保存済みscore URLの対応をJSONのscores配列（fixture/path）で渡す。`--score-routes <routes.json>`で全表示条件、`--fixture <id> --first-condition`で動作確認だけを実行できる。`--font-url <Bravuraの静的URL>`でネット取得を事前warm、`--source-manifest`と`--instrumentation-record`で固定ソースと測定用markだけの差を記録する。FONTCONFIG_FILE、PLAYWRIGHT_BROWSERS_PATH、必要なLD_LIBRARY_PATHは検証用環境に限定する。`--actions`には描画後入力・離脱などの実操作を指定する。通常30秒の外側期限は候補受領に合わせて開始し、停止時もtraceを回収してからcontextを終了する。

画像確認は`review-score-rendering-frames.mjs --input <collected.json> --reviews <reviews.json> --phase before --output <reviewed-before.json>`で反映する。reviewはtrial、tag、frameSequence、frameSource、screenshotSha256、matchesExpectedState=true、reasonを含む明示的な画像確認記録。単なるDOM観測・rAF・推測のimage一致でreviewを作らない。原本や未確認は欠測/打切りのまま残す。改善後は`--phase after --baseline <reviewed-before.json>`を渡し、変更前に固定した閾値と比較する。diagnosticの1試行を正式5試行の合格へ読み替えない。

### T018の離脱測定

入力時刻にはブラウザーのevent timestampを用い、state commitだけで合格にせず、正しい表示を含む最初のPresentationを明示的に画像レビューする。`--actions`の`observeState`は同じ期待DOM状態を入力前に登録して観測する。`--reload`はprewarm後に新しいdocumentのreloadだけを測る。参考画像はCDPで採取し、計測区間内にPlaywrightの全DOM screenshot preparationを走らせない。旧版対照と変更版には同じcollector/action-state observerを使い、hashを記録する。

離脱後の追加入力では`whilePresent`で旧SVGがまだ撤去中であることを確認し、`afterCaptureAbsent`で所有DOMの撤去完了も別に確認する。この待ち時間を離脱や追加入力の提示時間に置き換えない。

### 待機・失敗・取消・遅い旧世代の実操作検証

`--lifecycle`は私有productionコピーの制御ページ専用。製品routeへ待機/失敗gateを追加しない。実Header/ShowScore/音声準備を残し、原本と小素材各5回、待機→取消→retry→失敗→retry→遅いA成功/失敗中のB切替→待機中離脱を実行する。制御ページとadapter差分、製品ソースhash、収集器、trace/JPEGを同じ試行へ紐付ける。`--fixture`はmanifest内の原本/quarterのみ。`RENDER_LIFECYCLE_PROFILE=1`は診断専用で正式性能と混ぜない。

画像reviewの再利用は、同一素材/表示条件/操作で既に明示目視されたJPEGとの**SHA256 byte一致**に限る。新しいtraceのsource/sequence/Presentation・入力clock対応は毎回検証する。未一致の画像は目視する。遅い候補を採用するときは保守的な画像付き上限として記録し、最初のフレームと断定しない。上限超過なら前の候補を確認し、目標を変えない。

専用コピーは通常build（型エラー無視なし）を使用する。`resource/[id]`のparams型はNext16のPromiseに合わせる。検証対象のバンドラーとフォント/音源のprewarm条件をbefore/afterで揃え、同時にbuild・単体試験・別の描画測定を動かさない。
