# Implementation Validation

## 実装した範囲

任意の元音名・明示臨時記号・視覚タイの保持、完全／不完全候補の整合性検証、promotion 往復、5種類の臨時記号と括弧、小節状態と声部共有、タイ曲線・改行／改ページの継続片、1条件ずつの fixtures と段階別判定、結果の失効・読み込み、開発用一覧を実装した。新規アプリ依存・DB migration はない。昇格先が曖昧な同音ユニゾンや、譜表情報なしの休符は NOTATION_PROMOTION_AMBIGUOUS を返し、元表記を不完全候補に保持する。

明示的に音高を修正した場合は元表記を再推定し NOTATION_REINFERRED を表示する。時刻・音価の修正だけなら元表記を維持する。原譜を再取り込みせず変更前の音名を復元したとは扱わない。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| 全単体回帰 npm test -- --run | PASS: 97ファイル・700テスト |
| 変更TS/TSX lint | PASS |
| npx tsc --noEmit | PASS |
| npm run build（worker含む） | PASS（EMAIL_SERVER='' EMAIL_FROM='' の検証用プロセス環境） |
| 実保存・取得のDB統合テスト | 未実施：TEST_DATABASE_URL 未設定。利用者が未実施として残すことを選択 |
| 実ブラウザーでの Bravura・形状・衝突・クリッピング | 未実施：このセッションには実ブラウザー操作ツール／実行環境がない |

jsdom が出す既存の canvas.getContext 未実装メッセージは音声波形側の既存テストからのもの。700件は合格。jsdom の SVG 構造・実際の文字コード・曲線 path・座標確認を、実ブラウザーの形状確認と同一視しない。

通常の npm run build は既存の開発用 SMTP 設定が本番の認証設定条件を満たさず Invalid SMTP configuration で停止した。設定ファイル・認証コードは変更せず、上記の2環境変数を空にしたプロセスだけで build を検証した。実運用のメール設定の検証結果ではない。開発専用の動的ファイル読込は production で実行しないようにし、全プロジェクトを出力へ取り込む tracing 警告も残っていない。

verification-results.json は69 fixtureの現行入力・期待値・レイアウト・ソース fingerprint に対応する自動結果。visual と persisted の未実施を含むため、これを機能全体の合格としない。実ブラウザー操作ツールとブラウザー実行環境がないため、visual-results.json の成功記録は作っていない。

## 再現と性能

[quickstart.md](quickstart.md) に手順、[coverage.md](coverage.md) に受け入れ条件の対応、[benchmark-results.json](benchmark-results.json) に同一入力・Node22での前後比較を記録する。10回の warmup、30回の計測、各試行で2回の連続 layout を実行し、中央値・要素数・幅の不変を比較した。測定はブラウザー描画時間ではなくモデル→Document の処理時間。小さい3入力だけの結果であり、全楽曲の速度保証ではない。

タイ接続は key による pending 索引、元音符・和音内 rank は Map、臨時記号は開始時刻のバッチと小節・調号のカーソル走査を使い、新たな全音対全音の探索を避ける。

同一環境の中央値は既存の3入力で 1.880→1.978ms、4.471→6.234ms、5.543→7.752ms。表記解決と検査に処理増分がある。要素数・幅は同じで、連続layoutによる増殖はない。一律の性能閾値や全楽曲の速度保証は設けていない。

## 残る検証と次の手順

1. 開発環境で npm run dev を実行し /dev/notation/fixtures の各正常条件を実ブラウザーで確認する。特に括弧・和音・改行・全ページのタイを確認する。
2. 契約に従って sourceHash / expectationHash / rendererRevision / layout / browser / reviewer / executedAt と各 visualChecklist の結果を visual-results.json に記録する。未検証の記録を pass にしない。
3. 専用 TEST_DATABASE_URL を用意できた段階で quickstart の統合テストと runner --persisted を実行する。今回は利用者指示で実行しない。
4. 上記を終えてから残る tasks.md の検証タスクと SC-001–006 を確認し、$speckit-converge で不足を再評価する。

現時点では必須 persisted/visual が未検証のため、機能全体の完了を宣言しない。
