# Research: TAB・ドラム

## 1. 無音高と完全候補

**Decision**: Core.Note.pitchをMidiNoteNumber | nullへ拡張し、Sheetの完全候補は既存構造を維持する。完全候補のnullは完全TAB／打楽器の打音表記と打楽器譜の休符で許可。不完全候補の通常音符の音高不明もnullとして保持する。休符はrestで識別し、旧数値付き休符は維持する。Coreの通常JSON入力は数値必須のまま。

**Rationale**: sheet/note.tsとsheet/score.tsがCoreを継承し、import/score-schema.tsは数値必須。無音高を0/60で埋めると誤演奏になる。nullの消費箇所を型検査で検出し、Core.keyRangeの空集合、音名・加線・beam・tie・timelineをガードする。

**Alternatives**: 新complete形式は「formatがあればpartial」という各境界を複雑化。別rendererは保存と描画を二重化。pitch用ジェネリック追加は既存継承の複雑化に比べ利点が少ない。

## 2. 表示と演奏の可否

**Decision**: 純粋なcapabilities導出でcanRender/canPlayback/canPractice/canGameと理由を返す。既存永続validationはstrictな現行形を保持しcanPractice/Gameを保守的に算出する。ドラムは演奏識別を保存するが今回の再生・練習・ゲームを不可とし、TABは数値音高と一意な演奏イベントがある場合だけ既存経路を使う。

**Rationale**: server/revision-validation.tsはvalidationをDBへspreadする。表示可能な無音高をpartialのままにするとshow-score.tsxが譜面を表示しない。完全候補で表記を保持し表示し、音声変換前に拒否する。

**Alternatives**: validation列追加は今回不要。UIだけの無効化は内部呼び出しで誤演奏を防げない。

## 3. 譜表と配置

**Decision**: track共通staffDetailsを旧データfallbackとして残し、各staveの有効設定を優先。geometryを譜表別に解決し、縦位置は先行要素の累積。小節ヘッダー幅は各譜表の最大値を共有。

**Rationale**: engraving/stave.tsはtrackの高さ、sheet/stave.tsは自分の高さ×ID、sheet/track.tsは現在の高さの加算、to-document.tsとgeometry.tsは5線固定。単にTAB記号を出しても音符と譜表がずれる。

**Alternatives**: track単位の種類追加では同一パートの通常譜＋TABを表現できない。

## 4. 数字列と符頭

**Decision**: 同梱BravuraのtimeSig0..9を一定scaleの数字runとしてGroup/Glyphで構成し、文字値と個々のcodepoint・advance・ink境界を記録する。0..36を桁ごとに組み立てる。初期scale=0.6、桁間隔0.05 staff space、全体を弦中心へ配置。数値幅はフォントメタデータから確定し、shapeは目視で検証する。譜線はrunのink境界＋0.15staff spaceで区間分割する。

**Rationale**: Document.Glyphは単一文字だがGroupで列を作れる。guitarString系はフレット数字専用ではない。背景の矩形は後描画の譜線に貫通されるため、背景色に依存しない線分割を使う。4stringTabClef/6stringTabClef、通常とnoteheadXBlack/Half/Wholeは同梱済み。

**Alternatives**: ブラウザー既定fontのTextは幅が実行環境で変わる。新font・汎用Textエンジンは不要。glyph生成済み定義は編集せず既存APIで使用する。

## 5. タイと併記

**Decision**: 符頭文字名依存を明示note-anchorへ置換。TABは数字全体のアンカーと弦／フレットキーを使う。通常譜との併記は表示ノートを削除せず、明示共有関係だけを演奏射影で1イベントへまとめる。対応不明なら表示を許可し演奏を不可にする。

**Rationale**: engraving/notation/ties.tsはnoteheadというglyph名しか見ない。同時刻同音だけの重複排除は正当なユニゾンを失う。

**Alternatives**: onset/pitchだけの推測結合、元ノートの削除は採用しない。

## 6. fixturesと証跡

**Decision**: 既存suite=notation（008、既定値）にtab-drum（009）を追加する。suite名は既知のallowlistからmanifest/report/testを解決し、任意ファイルパスは受け付けない。結果は各featureへ分離。入力・期待値・layout・全描画ソース／フォントのfingerprint照合を継続。

**Rationale**: notation-report.ts、runner、notation.test.ts、load-score-fixtures.tsの008固定を変更する必要がある。009実行で008結果を上書きしない。再利用した描画ソース変更で008の旧結果が失効するのは正しい動作。

**Alternatives**: runner／評価器を複製すると失効規則と誤描画検知が分岐する。

調査はローカルコード・同梱形式定義による読み取りのみ。実表示・DB成功の証跡ではない。未解決の設計質問なし。
