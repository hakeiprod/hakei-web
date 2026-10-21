# Notation Contracts

## 取り込み・保存

既存preview/save/revalidate/readのAPI・workerを利用し新endpointは作らない。完全候補とpartial双方へ[data-model](../data-model.md)の表記を通す。MusicXMLはstaff-details/staff-lines/staff-tuning、clef、technical/string/fret、unpitched/display-step/display-octave、notehead、instrument参照、part-listのscore-instrument/midi-instrumentを読む。

外部midi-unpitchedの1..128を内部midiNote0..127へ、MIDI channel1..16を0..15へ境界で1回だけ変換する。譜面位置とMIDI番号は交換しない。未解決instrument参照は位置が完全なら描画を許可し演奏不可理由にする。無指定noteheadは通常符頭として扱い、未対応明示値をnormalへ黙って変更しない。

JSON不整合は保存前に拒否。XMLの値欠落・未対応は対象を保持し診断する。数値pitch／tuning矛盾を黙って修正しない。不正保存でscore revision／Git公開位置を部分更新しない。認証・署名・警告確認は既存経路を維持する。

## 表示・機能可否

previewとread結果のcandidateからcapabilitiesを導出し、既存validationとは別に扱う。UIは表示・再生・練習・ゲームそれぞれの可否理由を表示する。canRender=true/canPlayback=falseでもScoreViewerをマウントし、Audio.Score生成はしない。canPlay propの既定trueに依存せず、内部capabilitiesとのANDで許可する。サーバーpracticeと直接toAudio/timeline呼出しもガードする。

Core.keyRangeは有音高なしの場合nullを返し、鍵盤・ハイライトは空状態を扱う。Audio.Note importはnullを拒否。既存通常譜・MIDIの数値音高処理は変えない。TAB併記の演奏重複は明示共有関係のみ解決し、不明なら表示だけ許可する。

## 描画

譜表ローカルgeometryを唯一のy変換としてglyph・stem・ledger・beam・dot・tieに適用する。通常譜の従来位置を維持。譜表別ヘッダーの最大幅を使い、拍の共通slot位置を保つ。

TABは数字列Group(role=tab-fret, value/string/fretとsource identity)内に既存timeSig数字Glyphを並べる。列全体のinkとadvanceを幅計算前に確定する。DocumentのmetadataとSVG data-*へ同じ意味を出す。×符頭はnoteheadXBlack/Half/Wholeを音価に応じ使用する。4弦／6弦TAB記号は線数で選択する。

全発音表記は明示note-anchor（source、inkBounds、position）を持つ。タイはglyph名検索ではなくアンカーから生成し、TABの接続はtrack/stave/voice/string/fretと番号を区別する。pitch:nullのTABでも同じ運指・連続時刻で視覚タイを解決でき、演奏タイ意味は新設しない。既存complete/outgoing/incoming曲線と上下余白を再利用する。

数字との交差区間で該当譜線を分割する。背景色で隠す方式に依存しない。不要なTAB符頭・音高加線・調号・臨時記号、打楽器の調号・臨時記号を出さない。ドラムで表示位置が五線外なら必要な譜面位置の加線は表示する。


## 入力条件と期待する状態

| 入力条件 | 保持・保存 | 譜面表示 | 演奏 |
| --- | --- | --- | --- |
| 表記は完全、演奏対応のみ不明 | 完全Sheetとして保存可 | 可 | 不可、理由を表示 |
| 未対応奏法だけで基本表記は完全 | Sheetと非実行sourceNotationを保存、元情報保持 | 基本表記を表示し省略箇所を警告 | 既存意味を変更しない。奏法が演奏結果に影響する場合は不可と理由を表示 |
| 未対応符頭・弦数、必須表示情報欠落 | partial.notationと既知値・診断を保存可 | 不可、理由を表示。通常表記へ置換しない | 不可 |
| 通常音符の音高不明、開始／音価不明 | 既存partialとして保存可 | 不可、理由を表示 | 不可 |
| JSONの値域違反・相互矛盾 | 拒否、部分更新なし | 保存失敗理由を表示 | 不可 |

sourceNotationは任意の非実行JSON、上限64KiB/楽譜（UTF-8 JSON長）、元フィールドへの対応を保持する。外部値としてZodと既存の全入力サイズ制限で検証し、コードやDOMとして評価しない。partial.notationにも既存の全入力サイズ制限を適用する。未対応情報の保存後再取得と診断の保持を検証する。

## 音高nullと休符

完全候補の通常非休符は数値音高必須。不完全候補の通常音符は音高不明をnullとして保存できる。完全候補ではTAB／打楽器の完全な打音表記に加え、percussion譜表上のrest:trueにもpitch:nullを許可する。

打楽器休符は時刻・音価・声部・所属譜表を保持し、打音位置・符頭・楽器識別は不要。休符に打音用表記や非空タイを付けず、pitch:nullだけで休符と判定しない。旧数値pitch付き休符は読み取り・往復を維持する。音声・timelineは休符を除外してから発音用pitchを検証し、休符へ架空音高を補完しない。ドラム譜を今回演奏不可とする方針は維持する。


## レビュー修正後の代表選択・音部記号更新

明示共有ペアの演奏射影は通常譜側のノートidentityを代表とする。保存配列の順序で代表譜表を切り替えず、タイの継続キーと保持時間を維持する。表示・保存上の両ノートは保持する。MusicXMLのclefは譜表番号ごとに差分更新し、省略された他譜表の有効設定を保持する。明示的な通常音部記号への変更はstandardへ切り替え、その時点の音部記号と復帰時の調号を描画する。
