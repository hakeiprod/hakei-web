# TAB・ドラム譜の初期調査

静的調査で確認した現状。実際の表示成功は未確認。

| 経路 | 現状・根拠 | 必要な拡張 |
| --- | --- | --- |
| 譜表記号 | src/s-core/models/engraving/glyph.ts の findClef はTAB・percussionのglyphを返す | 記号だけで全体対応とせず、線数・音符配置を接続する |
| 譜表位置 | src/s-core/models/sheet/stave.ts の getClefScientificPitchNotation はTAB/percussionでwip例外 | 通常音高の位置計算とTAB/打楽器の位置計算を分ける |
| 音符位置 | src/s-core/models/sheet/note.ts のlineは通常音名・音部記号で計算 | 弦とフレット、無音高の表示位置を扱う |
| 取り込み | src/s-core/models/import/musicxml.ts はnote/pitchを中心に読み、staffDetailsを5線固定で生成 | technicalの弦・フレット、staff設定、unpitchedと楽器参照、符頭の保持を調査・実装する |
| 保存境界 | src/s-core/models/import/score-schema.ts は完全音符のpitchを必須とする。Sheet.NoteはCore.Noteを継承 | 無音高表記と演奏識別の境界設計、完全／不完全候補、promotion、保存・再取得すべてを検討する |
| 譜表設定 | src/s-core/models/engraving/stave.ts はtrack.staffDetailsから高さを決定 | 同一パート内の異種譜表と譜表別の線数・高さに対応する |
| 形式定義 | src/s-core/const/musicxml/4.0/musicxml.ts にTechnical、Unpitched、StaffDetails、StaffTuning、MidiInstrumentの定義がある | 型定義の存在と実処理の対応を区別する。楽器番号の外部1始まり／内部0始まりを設計時に確認する |
| 検証 | src/s-core/fixtures/notation/manifest.json と段階別評価器・開発一覧がある | 既存の仕組みを再利用し、TAB数字と弦・打楽器位置と符頭の意味的な期待値を追加する |

## 優先順位

1. P1: 譜表・表記・演奏情報の分離と全保持経路、TABの単音・ドラムの1打。
2. P1: 複数弦・声部・同時打音とリズム、誤描画を検出する最小fixtures。
3. P2（必須）: 混在・改行・改ページ、実保存取得と既存通常譜の回帰。
4. 後続: 特殊奏法、特殊符頭、他の弦数、運指生成、専用編集・採点。

計画時は008の実装を置き換えず拡張する。表示可能だが演奏情報不完全な入力を、現在の完全候補必須条件だけで描画不能にしない経路が主要な設計課題。


## 実装後の対応

譜表別staffSettings、TABの弦・フレットと数字列、unpitchedと打楽器対応、打楽器休符null、元表記の保存、部分候補の保持、譜表別の座標・高さ・共通冒頭幅、明示アンカーのタイ、譜線分割を追加した。Coreの数値音高は保持し、nullを許す消費箇所を監査した。演奏は純粋capabilitiesとAudio/timeline入口で制限する。

009の独立suiteは008のmanifest・report保存先と分離する。小さい入力と実文字・位置・対照結果を自動検証している。実際の保存取得DB検証と、Bravuraの実ブラウザー形状確認は未実施であり、この実装記録を成功証跡として代用しない。実行結果はvalidation.mdとverification-results.jsonに記録する。
