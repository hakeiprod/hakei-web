# Phase 0 Research

2026-10-20。ローカルコード・型・同梱形式定義を調査。実表示確認やテスト実行結果ではない。

## 1. 表記情報と互換性

**Decision**: Sheet.Note に任意の notatedPitch、explicitAccidental、visualTies を追加し、演奏音高と既存 ties は維持する。共通スキーマを完全候補、不完全候補、promotion、export/import で使う。

**Rationale**: `import/musicxml.ts` は step/octave/alter を MIDI 音高に変換して原表記を捨てる。`sheet/note.ts` はそこから表記を再推定する。`import/promote-partial.ts` は手動再構成のため、今回の項目に加えて既存 stem/beam の脱落も対象経路で防ぐ必要がある。

**Alternatives considered**: 生 XML 保存はモデル共通性と JSON 編集の意味を壊す。MIDI 音高のみから復元する案は異名同音を区別できない。Core 全体の変更は不要で、記譜は Sheet に置く。

## 2. 音楽的タイと視覚的タイ

**Decision**: 既存 ties は再生・練習・採点の根拠とし、visualTies は描画専用。視覚指定がなければ音楽的 ties を描画の fallback に使う。明示的な空配列は描画しない指定とする。

**Rationale**: 同梱 `src/s-core/const/musicxml/4.0/musicxml.xsd` の tied 定義は notated tie と tie sound を区別し、number を曖昧さ解消に使う。`practice/timeline.ts` と `import/diagnostics.ts` は track/voice/stave/pitch のキーを利用する。

**Alternatives considered**: tied を ties に上書きすると視覚指定だけで再打鍵抑制が変わる。単純な同音の最近傍接続は別声部や同時同音に誤接続する。曖昧な場合は診断し、勝手に連結しない。

start/stop/continue と番号・上下方向を対象とする。let-ring、破線、任意の原譜座標など今回保持しない形状指定は表示警告の対象。音楽的意味を勝手に付与しない。

## 3. 臨時記号と位置

**Decision**: 元の音名とオクターブで五線位置を決める。明示記号を優先し、自動記号は小節・譜表・同音名・同オクターブ単位の状態で解決する。開始時刻が同じ音は一括評価し、配列順に依存させない。

**Rationale**: Note.accidental に Natural の TODO があり、Engraving.Note.accidentalGlyph は消費されるが現行で生成されない。小節状態は単一 Note getter で完結しない。同一譜表の声部間共有とオクターブ・譜表間分離は今回の spec の方針に従う。

**Alternatives considered**: 全変化音へ常に記号を付ける案は不要表示とナチュラル欠落を解決しない。描画後の後付けは幅・衝突を壊す。

明示 natural と pitch alter が矛盾するような内容は、演奏音高を改変せず診断する。旧データの推定も同じ状態解決へ入力するが、原表記を新たに永続化しない。

## 4. 曲線・改行・ページ

**Decision**: Document に閉じた三次ベジェ帯の Curve を追加し、SVG adapter が path にする。タイ関係と各片の endpoint metadata を保持する。配置後の符頭座標で system 単位に作る。

**Rationale**: Document.Element.kind は group/glyph/line/rectangle のみ。toDocument の paginateRows は row 単位でページへ移す。先にタイの上下余白を計算し row 高さに含め、ページ割当後も同じ row 座標を使えば、ページ越えは system 越えの2片として処理できる。

**Alternatives considered**: SMuFL の固定長 glyph は任意長・分割に適さない。SVG を Engraving から直接生成すると DOM 非依存の境界を壊す。既存 renderer 全置換は範囲が大きい。新規ライブラリなしで必要な最小曲線だけを追加する。

## 5. fixtures と判定

**Decision**: 専用 notation manifest と loader を追加する。純粋な描画要素 assertion、jsdom SVG assertion、実保存取得 assertion、実ブラウザーの表示確認を分ける。既存 core/mxl gallery は継続する。

**Rationale**: `load-score-fixtures.ts` は Core JSON と MXL の列挙のみ。gallery の Rendered は SVG が返る意味に限られる。`to-document.test.ts` には既に意味ある幾何テストがあるため再利用する。Bravura のフォント描画・クリッピングは jsdom で証明できない。

**Alternatives considered**: 巨大な曲1つは原因を特定できない。スクリーンショットだけでは音符 identity や保存欠落が分からない。Playwright 導入は今回の必須要件を満たすために必要ではなく、既存依存＋明示的な目視記録で検証する。

## 6. 実保存とバージョン

**Decision**: saveImport → readScore の実経路を既存 withCollaboration で検証。新変換の converterVersion は score-import-v3 とし、旧 v1/v2 の候補・有効署名・保存楽譜を継続受理する。元の formatVersion は変えない。

**Rationale**: `server/score-import.ts` は署名・診断を検証し、Git の JSON と DB の revision を作る。`server/score-reader.ts` は Git から取得する。単なる stringify は保存検証ではない。任意 JSON 項目なので DB の列追加は不要。

**Alternatives considered**: 既存楽譜の一括再変換は元ファイルがなく原表記を回復できない。旧署名の候補を新仕様へ自動正規化すると署名が変わるため、署名確認前の補完は行わない。

## Research completion

技術的な未解決事項なし。配置の数値調整は対照 fixture と実表示で検証する実装作業であり、仕様の保留事項ではない。新規依存・外部サービス・DB マイグレーションなし。
