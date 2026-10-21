# Data Model: TAB・ドラム

## StaveSettings（任意追加）

StaveのstaffSettings: { kind: standard | tablature | percussion, lineCount: integer, tuning?: [{ string, step, octave, alter }] }。参照identityはtrackId/barId/staveId。対応TABは4/6線、percussionは5線。standardは従来設定を維持。tuningは弦番号一意、step A..G、octave -1..9、alter -2..2、結果0..127。明示値だけ保持する。

MusicXMLのstaff-details numberは対象譜表へ適用し、後続小節の有効設定を取り込み時に展開する。原譜の線番号と弦番号を別に解釈し、tuningの最下線→低音弦とTAB string=1最上段の対応を反転して検証する。弦数の途中変更は診断対象。旧データは新項目を永続追加せずtrack.staffDetailsと既存clefをfallbackにする。

## Note（任意表記追加と音高の限定nullable化）

- tablature?: { string: integer 1..6, fret: integer 0..36 }。弦番号は対象staveの線数以下。
- percussion?: { displayStep: A..G, displayOctave: integer -1..9, notehead: normal | x, instrumentId?: nonempty string max200, midiNote?: integer0..127, midiChannel?: integer0..15 }。
- performanceEventId?: nonempty string max200。同一track内で明示共有と確認できた表示ノートだけの関連付け。元音符identityとは別。
- pitch: 0..127 | null。CoreのインスタンスはMidiNoteNumber | null、serializeは数値／null。完全候補の通常非休符には数値必須。完全TAB／percussionの非休符と、kind=percussionの譜表に所属する休符はnull可。不完全候補は通常音符も音高不明をnullで保持でき、開始位置・音価の不明も従来どおり保持する。完全候補の条件を不完全候補へ一律適用しない。旧数値pitch付き休符は読み取り・往復を維持する。

休符はrest:trueで判定する。打楽器譜の休符は所属譜表と時刻・音価・声部が完全ならpitch:nullでも完全候補となり、percussionの打音表記オブジェクトを要求しない。休符へtablature/percussionの打音表記、notatedPitch、explicitAccidental、performanceEventId、非空の音楽的／視覚的タイを付けない。打音はrest:falseと完全なpercussion表記を持つ。pitch:null単独では休符と判定しない。新規の打楽器休符はnullを用い、旧数値付き休符は自動正規化しない。

TABとpercussionの同時指定は禁止。stave種類と表記を一致させる。percussionはnotatedPitch/explicitAccidentalと両立させず、表示位置からpitchを生成しない。TABは元の数値pitchがあれば保持し、明示tuning・fretと揃う場合だけ整合性を検査する。tuningなしで標準調弦を捏造しない。同時刻同一track/stave/stringで異なるfretは保存拒否。XMLで不足があれば元情報と箇所をpartial／診断に残す。

## 完全／不完全と状態遷移

取り込み → 境界検証 → 表記・時刻が完全ならSheet → capabilities導出 → preview → 署名確認 → 再検証 → 原子的保存 → 取得 → 同一schema／capabilities → 描画。

音高nullでもTAB／percussionの打音表記と時刻が完全ならSheetへ昇格可能。打楽器譜の休符は打音表記なしでも、所属するpercussion譜表と時刻・音価・声部が完全なら昇格可能。通常音符の音高不明、開始／長さ不明、必要な弦・打音表示位置不明、未対応符頭・弦数はpartialとして保持し描画不可。入力の未対応情報はpartial.notationに構造化して保持し、元フィールドと診断を対応付ける。基本表記が完全な未対応奏法だけの場合はSheetを表示し、省略情報を任意の検証済みsourceNotation項目へ保持する。この項目はUTF-8 JSON長64KiB/楽譜以下、完全／不完全候補とSheet往復で保持する非実行JSONであり、表示・演奏の解決には使用しない。promotionのnotation付き／Core fallback両方で新項目を保持し、nullをCoreの音高推論へ流さない。修正は明示経路のみ。打楽器へのpitch修正で楽器対応を暗黙変更しない。

## Capabilities（非永続）

{ canRender, canPlayback, canPractice, canGame, reasons: [{ code, track?, bar?, fieldPath?, message }] }。candidateと診断から共通純粋関数で導出。preview/read/UIとAudio/timeline境界で同じ判断を利用する。既存revisionValidationはvalidatorVersion/canPractice/canGame/unresolvedIssueIdsのみ維持。

percussionを含む楽譜は今回canPlayback/Practice/Game=false。TABの非休符の音高nullと併記関係不明もfalse。休符のnullだけで演奏情報不足と判定しない。混在譜面を黙って一部のみ演奏しない。休符を除く音高が完全で併記のないTABは既存演奏射影を維持。明示performanceEventIdの共有組はtrack内、同時刻・音高・音価一致と一意な通常譜／TABの組を検証し、演奏射影で1件へまとめる。無関係な同音は結合しない。MusicXMLに共有根拠がない併記は推測結合せず不可理由を示す。

## Derived Geometry（非永続）

staffGeometry: lineCount、height=lineCount-1、位置変換、headerWidth。TAB y=string-1。ドラムyは表示step/octaveをト音譜表の位置基準（E4が最下線、F5が最上線）で解釈し、演奏pitchを参照しない。先行譜表とtrackの高さ・余白を累積する。

FretRun: value、digitGlyphs、scale、advance、inkBounds、note-anchor。上下符幹・旗・付点・tieはrun境界へ接続。StaffLineGapは該当弦とrun inkBoundsから導出し、重なり区間をsort/mergeして線分を生成する。

## Compatibility

旧Sheet JSON、旧署名、旧validationは継続して読む。旧値にdefault表記を書き戻さない。新変換はconverterVersion=score-import-v4、再計算validatorVersion=score-import-validation-v2。旧署名候補は署名検証前に補完しない。新nullable表現を旧アプリへダウングレードして読めるとは保証しないため、旧クライアントで新楽譜を開く制限を検証記録に記載する。DB migration・既存資料の一括書換えは不要。


## Convergence: 未対応譜表の保持

表示不可のpartial.notation.sourceStavesに、trackId/barId/staveIdと元attributesの非実行JSONを保持する。線数・調弦・clefの元属性を落とさず、layoutIncomplete=trueを維持する。sourceStavesと各note.sourceNotationの合計をUTF-8 JSON長64KiBで検証する。ドラムの括弧付き／filled指定の未対応符頭装飾は基本符頭を表示し、省略診断とnote.sourceNotationを残す。不正MIDI対応でpartialになる場合も元midi-instrumentをsourceNotation.sourceInstrumentへ保持する。
