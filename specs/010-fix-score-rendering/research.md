# Research: 大きな楽譜の描画無応答

2026-10-22。仕様010のPhase 0。製品コード・依存・DBは変更せず、現行モデルの読取と一時的な計測を実施した。UI/描画ライフサイクル調査を研究エージェントへ委任し、以下へ統合した。

## 1. 基準測定と目標の確定

**Decision**: [測定値](measurements/baseline.json)と[再実行用プローブ](measurements/baseline-probe.mts)を保存。原本と小素材を各3回、別の描画処理・単体スイートと重ねず順次実行した。Node22.23.4/Linux、i9-10900K、20 logical CPUs、約8.27GB、cgroup CPU/memory制限なし。横表示・scale12・1280×900、debug=false/advanced=true。

原本のprepareNotesは1,504.7〜1,563.2ms、prepareScoreは1,475.2〜1,500.5ms。両段階の合計最大は3,038.4ms。layoutは3回とも15,000msで観測打切り、完了値は得ていない。打切りまでにslot.chordsが6,473〜6,823回呼ばれ、その都度全5,346和音を検索する。Chord.startもnotesから計算される。全件検索の反復が改善候補という根拠はあるが、完全なCPUプロファイルや特定getterの支配率はまだない。

小素材quarter_middle_c（2音）の準備→layout→toDocument合計は約9.9〜10.8ms。原本のモデル構築・変換・DOM・paintは今回の段階時間に含まれない。プローブのgetter計数には上乗せがあり、製品の精密な性能値と扱わない。007のブラウザー20秒無応答は別の実測証拠。HTTP9,095msは競合を含むため目標計算へ使わない。

**Rationale**: 既に準備だけで約3秒なので、根拠なく「全体100ms」等を要求しない。準備最大の2倍をモデル描画予算（切上げ6,500ms）、4倍をブラウザー全描画予算（切上げ12,500ms）とする。これは索引化・重複準備削減・協調分割で狙う工学的な予算で、達成を測定済みという意味ではない。画面応答100msは小素材のモデル経路約10msに対して10倍の余裕を設けた独立の操作予算とし、協調処理の目標8ms/chunkで余地を確保する。全体時間と操作応答は別指標で検証する。詳細な採否は [測定契約](contracts/rendering.md) に固定した。

**Alternatives considered**: 20秒/45秒の打切りを正確な基準時間とする案、変換10秒期限の流用、モデルの時間をそのままブラウザー完成時間とする案は却下。改善後に都合よく閾値を変更しない。未達なら設計を修正して再検証し、仕様を勝手に緩めない。

## 2. モデル索引と一回のレイアウト

**Decision**: Score内の関連検索をインスタンス単位の索引へ置き換え、描画パス内の幅・末尾余白・累積座標を段階ごとに計算する。元の配列順、Beat.equalの比較規則、Event.isOverlappedの半開境界とゼロ長イベントの扱いを保持する。単に開始小節へ1対1に分類して、境界をまたぐ要素を落とさない。

**Rationale**: sheet/slot.tsの全和音filter、stave/bar/masterbarの全件参照と再帰x、engraving/stave.tsのendPaddingが同じ関連・幅を繰り返し求める。既にScore.notesByChordIdという局所索引があり、同じモデル責務内で拡張できる。mountとtoDocumentの両方でlayoutする現状も、同じ結果を確認したうえで一度のprepare/layout/space/order/snapshotへ整理する。

**Alternatives considered**: グローバルな楽譜キャッシュ、永続化した派生座標、記号の簡略化、新しい描画ライブラリは不要。描画数式・浮動小数の加算順・改行判定を変える最適化は採用しない。

## 3. 応答性と所有期間

**Decision**: 索引化に加えて、既存計算を順序を保持したステップへ切り出し、ブラウザー側が協調実行する。モデル構築、音符準備、レイアウト、タイ・Document生成、SVG生成、ハイライト接続まで対象にする。ステップの同期drainは既存API/テスト向けに残す。ブラウザーの非同期drainは時間予算とAbortSignalを受け、実タスクへ制御を返す。

**Rationale**: ShowScoreのuseMemo内のSheet/Engraving構築・toAudioと、ScoreViewer effect内のmount/toDocument/toSVGがすべて同期である。Viewerだけ遅延実行しても初期化で停止する。Promise.resolveやReactの優先度変更で同期処理を包むだけでは取消イベントを処理できない。[MDN scheduler.yield](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield) は実タスクへ継続を譲るが利用可能ブラウザーが限られるため、機能検出し、未対応環境はsetTimeout(0)へフォールバックする。AbortSignalは各継続前後に自前確認し、yield自体が常に取消可能とは仮定しない。

**Alternatives considered**: Workerへの全面移動は、Documentのinstanceof描画とglyphのハイライトcallbackを維持するためDTO/復元を追加する必要がある。[structured clone](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) は関数とprototypeを保持しない。今回は同じモデル・Document・SVGを保つ協調分割を選ぶ。目標未達時にWorkerを無断で追加せず、測定結果を根拠に本計画を再評価する。

## 4. 描画ジョブと表示の一貫性

**Decision**: 各Viewerの描画世代とAbortControllerで最新ジョブを特定。各ジョブに私有の可変Score、派生索引、controller、Document、未接続SVG、購読解除処理を持たせる。入力の候補・metadata・診断は変更しない。完了かつ最新世代の場合だけSVGとハイライト接続を一括公開する。別楽譜への切替時は旧譜を非表示にし、同一楽譜の再描画中は既存表示を「更新中」として維持できる。失敗時には更新失敗と再試行を表示し、異なる条件の旧表示を最新結果と誤認させない。

**Rationale**: 途中のScoreを公開すると音声ハイライトや新しい世代が未完成glyphへ触れる。ジョブ単位の所有なら取消時に安全に捨てられる。音声データ準備も描画と同じ入力世代へ結び、描画準備中は再生開始を待機させるが、音楽的なcanPractice判定を書き換えない。

**Alternatives considered**: DOMを直接少しずつ置換する方法、古いジョブの完了順に採用する方法、可変Scoreを複数ジョブで共有する方法は不採用。

## 5. 既存描画の基準と回帰

**Decision**: 製品変更前に現行ソースのchecksum付きコピーを試験用に固定し、別プロセスで既存同期rendererのDocument/SVG基準を採取する。遅い原本基準の採取は対話性能試験と分け、最大30分の外側観測枠と進捗を持つoffline検証にする。途中で終わらなければ未取得とし、実装完了を認めない。新実装の出力を基準に差し替えない。

基準は音楽意味、Documentの記号・source ID・座標・タイ形状・ページ寸法、SVG構造/目視で分けて確認する。原本以外の既存fixtureは小さいものから基準を取得する。座標比較は要素順・数値値が一致することを原則とし、フォントfamilyの生成名やXML属性順だけを正規化する。原本の一部だけの比較を全体成功に代用しない。

**Rationale**: 既存svg/engraving/score-viewerテストはDOM構造と配置を既に検証しており利用できる。描画でモデルを変更しないことは007の全音符ハッシュと候補全体の比較で独立に検証する。

**Alternatives considered**: スクリーンショットだけで音楽意味も保証する案、速くなった出力をそのまま期待値とする案、原本を短縮した素材だけで全体を代替する案は不採用。

## 未決事項の扱い

技術選択・測定対象・数値予算・比較基準の取得方法は確定した。原本基準の取得、実ブラウザーでの改善後達成、実機音声の成功はまだ実施していない。これらは実装時の必須検証であり、計画作成の成果と取り違えない。新規依存・DB移行・保存形式変更はない。

## 実装時の基準取得調査（検証後に採用）

変更前の無加速の全原本描画は30分で打切り。計測器には `--offline --memoized-reference` という**参照専用**の経路を、以下の検証後に独立同等基準として採用した。通常の性能測定でこのフラグを指定すると拒否する。製品コードの変更や、改善後の実装から作る期待値ではない。

候補の根拠は、旧getterの元関数をそのまま呼び出して結果だけを保持すること。構築完了後に不変な関連の検索結果を保持し、layout/space/order完了後のDocument変換区間だけ幅と横位置を保持する。数式・比較・配列順・加算順を置き換えない。タイが変えるrowのnotationTop/Bottomと高さ・縦位置は保持対象から除く。利用したgetterを再度元関数で計算し、参照/配列要素順/数値のObject.is一致と入力export不変を検証する。

採用前に必要な確認: 旧実装の無変更出力を取得できる全代表・全表示条件でDocument/SVG全体hashが一致すること、関連配列を変更するconsumerがないこと、Document区間で保持対象の依存状態が変わらないこと、原本全体でも再計算一致を完了すること。いずれか未確認・不一致なら同等基準として扱わずT004を未完了に保つ。取得状況と採否はvalidation.mdへ記録する。


**採用の根拠**: 既存7素材の全84条件で無変更旧実装とDocument/SVGのbyte全体一致。さらにDocument区間の全到達モデル入力（Map/Set mutatorを含む）を変更禁止とし、保持したgetterを元関数で再計算して全件一致を検証した。例外はタイのrow.notationTop/Bottomのみで、これに依存する縦位置・高さは保持対象に含まない。横幅/横位置の元依存グラフを変えず、元関数の同じ加算順をそのまま使う。原本全12条件でも再計算一致・入力不変・5,540音保持が成立した。これにより、新実装の出力を期待値に用いず、凍結した旧計算から原本全体の参照を得られた。全96条件の成果物とhashはmeasurements/reference-manifest.jsonへ固定。時間値は参照取得専用で性能の合否には使わない。実行結果はvalidation.mdに記録。

## T018: 離脱のクリティカルパス

トレースで、Reactのroute subtreeから大規模SVGを一括削除するnative removeChildに約45msを確認した。購読解除だけでは提示までの100msを満たさなかったため、SVGの所有期間をroute subtreeから分離する。Viewerのplaceholderは従来の位置・幅・高さを保持し、body直下の専用surfaceへ同じSVGを置く。離脱時に世代を無効化し、イベント/observerを解除して非表示・hit testing不可へ切り替え、その後の物理DOM撤去はidle priorityの2ms単位で行う。別Viewerの所有者と混同せず、終了Promiseで撤去完了も検証する。離脱の計測終了を撤去開始へ変更しない。

独立Document/SVGの全体比較に加え、元のin-flowコンテナーとsurfaceでSVG・実際のbbox/CTM・各描画要素のcomputed paint/font styleを比較する。Bravuraロード済み画像は別に目視する。opacityの合成レイヤー化により生PNGのアンチエイリアス端に差が生じる可能性があるため、生のピクセル差も隠さず保持する。数値座標の丸めやSVGの差を許容する変更は行わず、契約の比較条件は変更しない。

同一snapshotのViewer/ValidatedScoreをmemo化し、RSC再取得や音声準備に伴う親の再描画で大きな描画木を再処理しない。初期候補はpostMessageの同期キャプチャを利用して重複cloneを除き、従来と同じsheetScoreSchemaによる検証を専用Workerへ移す。Workerは成功/失敗/abortで必ずterminateし、Node等のWorker非対応環境ではclone後に同じschemaを使う。DOM/SVGや音楽情報の計算を別Worker実装へ置き換えるものではない。

画面外のPixi鍵盤ではtickerだけでなく不要なpointer move/globalMoveのhit testも停止し、再表示時に元設定へ戻す。click・物理鍵盤・MIDIの接続は保持する。

入力計測のDOM状態確認にPlaywrightの重いselector queryを反復すると、その確認処理自体が提示を遅らせることを確認した。同じ期待状態を入力前に登録したMutationObserver/native event後microtaskで記録する。ブラウザー受理時刻、待ち行列時間、最初の正しいPresentationの終了点と100ms予算は維持し、旧v5対照にも同じcollectorを適用する。最初の候補フレームに旧見出しが残る場合は採用せず、明示的な画像レビューを必要とする。

さらにCPU profileで、計測区間内のPlaywright screenshot preparation（collectRoots/querySelectorAll）がSVG全体を走査していたことを確認した。画像の採取はCDP Page.captureScreenshotへ変更し、traceのPresentation ID/スクリーンショットとの対応と明示レビューは維持する。svg-boundの監視もdocument全体のquerySelector反復をやめ、data-layout直下へ追加されたSVGのMutationRecordで同じ公開時点を記録する。製品の終了点を早める変更ではなく、計測器自身の同期走査を除く変更として記録し、旧実装の対照にも同一版を再適用する。

検索候補の開閉アニメーションとNavbarの背景ぼかしも大規模SVG表示中の合成処理に重なっていた。検索は同じAutocomplete/検索API/キーボード操作のまま開閉アニメーションを止め、既に不透明背景を持つNavbarのぼかしを無効にする。楽譜のglyph・配置・ページ・音声処理は変更しない。これは楽譜の簡略化ではなく周辺UIの装飾処理の削減であり、実画面で検索・focus・遷移を再検証する。

### US2実装時の操作コントロールと検証開始

原本の大きなHorizontal SVGを表示した状態で方式Selectを開くと、popupを合成する処理だけで100msを超えた。CSS合成境界の調整だけでは解消しなかった。方式コントロールを同じ高さ・最大幅のHeroUI RadioGroupへ置換し、3方式の直接選択にした。旧コントロールと原本12条件の描画viewport寸法が同じであり、方式復帰後のSVGも一致した。完成済みSVGを簡略化する代替策は採らない。

小素材ではWorker起動と検証開始待機が固定済み非悪化閾値に影響した。schema自体を変更せず、全値を走査して512ノード・配列長32・文字列/キー長256の境界を満たす場合だけmain threadで検証し、それ以外はWorkerへ送る。開始時に同期捕捉し、直後のabortはmicrotaskで受ける。長い描画の実タスクyieldと8ms目標は維持する。1,000回のNode診断には8ms超の試行もあり、判定境界による全実行時間保証とは扱わない。ShowScoreの検証開始はlayout effectへ移し、ブラウザーの初回paint後まで開始を待たせない方法を測定中。仕様・数値閾値・旧描画基準の変更ではない。


### T031実操作で見つかった音声準備の音域計算（2026-10-28 JST）

原本/小素材の正式各5回を採取した初回シリーズで、原本の最初の操作は最初の候補フレームから371.622ms、小素材も106.184msを観測した。原本のinputDelayは291.8ms、React scheduler callbackのFunctionCallは281.6msで、対応する表示を確認する以前から100ms達成は不可能な試行。失敗データは捨てず別シリーズとして保持する。CPU profileでAudio.Track.keyRangeの反復safeParse/firstByがホットスポットとなっていた。

同じ数値音高の検証をgetter呼出し内のMapに限って再利用し、既存NonNegativeIntSchemaを使ったまま、一回の走査で最小/最大を選ぶ。比較は厳密な<と>で先頭の同値オブジェクトを保持し、旧firstByの両方向と一致させる。空/有効値なしは従来通りTypeError。Mapは呼出しの外に保存せず、音符配列が変わった後の古い結果を返さない。音高・時間・音色・音源/合成方式・描画/保存形式を変更するものではなく、二次的な音声準備で発生するUI停止の除去としてAudio.Trackを必要最小限の追加変更対象にする。

旧処理を独立した期待値にした境界/同値参照/不正値/5,540音の反復検証回数、正式MXL両素材の全Audio.export不変を検証。単体の回数削減を100ms成功と呼ばず、製品修正後のT031実操作と必要なT033の性能再検証は別に行う。検証用補助表示のReact state更新がHeader等まで再描画していた点も分離し、補助表示の変更だけでは製品の性能改善と扱わない。入力時計・表示フレーム判定・固定目標は不変。
