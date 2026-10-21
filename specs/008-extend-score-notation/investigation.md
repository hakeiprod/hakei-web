# 現状調査と対象候補

調査: 2026-10-19、仕様記録: 2026-10-20。コードの静的確認。アプリケーション・ブラウザーのテストは今回未実行。

## 経路

- `src/s-core/models/browser/importer.ts` は `import/convert.ts` から現行の `import/musicxml.ts` を使い、候補を検証して Sheet を生成する。旧 `files/musicxml/extensions/to-sheet.ts` だけを根拠に対応状況を判断しない。
- `import/score-schema.ts` と `sheet/note.ts` は ties・記譜音価・付点・stem・beam を明示保持する。検証が未知項目を許可しても、モデル構築と export が保持する保証にはならない。
- `server/score-import.ts` は候補・署名・診断を検証して新規保存または提案へ渡す。`server/score-reader.ts` は Git の score.json を取得しハッシュを検証する。モデルの往復だけで実際の永続保存を代替しない。
- `engraving/note.ts`・`chord.ts`・`stave.ts` から `engraving/extensions/to-document.ts`、`document/extensions/to-svg.ts` に進む。

## 対応状況・根拠

| 表現 | 取り込み・モデル | 描画・他機能 | 分類／優先度 |
| --- | --- | --- | --- |
| 符頭・休符・付点 | 記譜音価・付点を保持 | note.draw と toDocument に出力あり | 基礎回帰 P1。全条件の実表示は未確認 |
| 符幹・旗・連桁・フック・加線 | stem・beam を保持 | toDocument と既存テストに出力・幾何確認あり | 小さい fixtures の対応整理 P1 |
| タイ | note/tie を抽出し Sheet.Note が保持・export/import | toDocument にタイ出力なし。Document 要素は group/glyph/line/rectangle。practice/timeline.ts にタイ連結あり | 描画欠落 P1。視覚的 tied 指定の保持も対象 |
| 音名・異名同音 | step/octave/alter から MIDI 音高を作り、元の3情報を候補に出していない | sheet/note.ts は音高と調号から位置を推定 | 情報欠落 P2。保存側だけでは回復不能 |
| 臨時記号 | 明示 accidental・括弧の保持経路なし | accidental に TODO: Natural。♯・♭・記号なしを推定 | 情報欠落・未実装 P2。小節状態も対象 |
| 音部・調・拍子・小節線 | 基本モデルあり | stave.ts と toDocument に出力あり | 基礎回帰 P1。全レイアウトは未確認 |
| スラー・連符表示 | 現行候補に対応関係の明示保持なし | toDocument に対応出力なし | 後続候補。タイと区別 |
| 強弱・奏法・装飾など | 一部は省略警告。全種類の検出保証なし | 現行出力に専用描画なし | 後続候補。演奏解釈と表示は別途定義 |

## fixtures の不足

- `src/s-core/fixtures/core/` には小さい符頭・付点・休符・和音・拍子・連桁等の楽譜がある。既存識別子を維持し活用する。
- `quarter_middle_c_tie.json` は開始3拍・長さ2拍の Core の1音。明示的な start/stop を持つ2音の保持確認を代替しない。
- `src/app/dev/load-score-fixtures.ts` と `src/components/score-fixture-gallery.tsx` は入力を描画し、SVG が返れば Rendered を表示する。fixture ごとの期待条件と合否はない。
- `engraving/extensions/to-document.test.ts` は有限座標、音符数、符頭、符幹、旗、連桁等の検証を含む。単なる smoke test しか存在しないわけではないが、タイ・ナチュラル等を個別に検出する範囲は不足する。

## 確定範囲

利用者が「基礎記号の回帰＋タイ＋臨時記号」を選択。P1 は基礎回帰とタイ、P2 は音名表記と臨時記号。P2 も今回の必須対象。スラー・連符表示・強弱・奏法等は後続候補。

## fixture の分割候補

- notehead/whole、half、quarter、eighth、16th。符頭確認と旗確認の主条件を分ける。
- rest/whole、half、quarter、eighth、16th。付点、符幹上下、旗上下、連桁、前後フック、上下加線、和音、音部・調・拍子・小節線は各主条件を分ける。
- tie/same-bar、cross-bar、chain、chord-member、voice-isolation、staff-isolation、part-isolation、system-break、page-break、visual-only、mismatch、missing-endpoint。
- accidental/sharp、flat、natural、double-sharp、double-flat、enharmonic-spelling、repeat-in-bar、reset-next-bar、explicit-cautionary、parentheses、octave-isolation、voice-sharing、staff-isolation、simultaneous-conflict。
- 主条件は1つとし、同じ入力を保持・描画要素・実表示の複数段階で確認してよい。改行・改ページに必要な長さは理由を添えて許容する。
- 各期待結果に記号の種類・数・位置関係・接続先・不在条件を記録する。目視など未実施の確認を自動合格扱いしない。
- 小節越えタイと臨時記号などの組み合わせは、単独確認とは別の回帰用として追加する。

仕様段階ではアプリケーション・fixtures 本体を変更しない。具体的な入力・期待値・検証方式・実行順は plan/tasks で定める。

## 実装開始時の確認

Node v22.23.3 と既存 Vitest を確認。既存 ignore 設定は node_modules/dist/build/coverage/環境変数・一時ファイルを対象にしており追加不要。初期 TEST_DATABASE_URL は未設定。表記境界・fixture 契約の未実装失敗を確認後、共通スキーマと promotion 保持を実装した。

## 実装後の対応

元音名・明示記号・括弧と視覚タイを任意追加し、現行 importer と partial promotion を接続した。タイ曲線・5種臨時記号・小節状態・全ページ表示、69件の細粒度 fixtures と実文字／path を検査する評価器を追加。自動回帰の実行結果は validation.md を参照。保存・取得と実ブラウザーは未確認なので、それらの対応を検証済みとは扱わない。
