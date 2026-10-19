# Fixture provenance

対象素材はこの機能のために独自作成した短い練習曲。CC0-1.0。Menuettや第三者の配布譜からの転記ではない。各版で異なる正常なtempo指示（2.0 sound / 3.0 quarter metronome / 3.1 eighth metronomeとoffset / 4.0 wordsとsound）、複数段・声部・和音・タイ・設定変更を持つ。版文字列だけを置換した素材ではない。公式のMusicXML score-partwise/voice/durationと各版の定義に沿う構成で作成し、DOCTYPEの版を一致させた。旧16素材は4.0として別に照合する。

期待値は手計算したexpected.json。四分音符=1拍。第1小節は3拍、次は2拍。C4/E4同時、D4は開始位置1拍で長さ2拍、下段C3は3拍。次小節のF4×2はタイ、下段は休符。tempo90→120、3/4→2/4、調号+1major→-1minor。実装の出力から正解を生成していない。

| 原本                                 | SHA256                                                           |
| ------------------------------------ | ---------------------------------------------------------------- |
| musicxml-versions/study-2.0.musicxml | a45856cdeeca4762aae3c5e985d8e3e0c5f6f52450faf492022bee13905b4b8c |
| musicxml-versions/study-2.0.mxl      | 51005493d25c6a575d9e7d058f347620ed6ee3816362ecf646661446cd955534 |
| musicxml-versions/study-3.0.musicxml | 5cc9a53bfed81bde8f56bc9d2233faadf41d9f836b751f9e1e40fb7f8eb5610f |
| musicxml-versions/study-3.0.mxl      | d1420dec33f5fea2db32632e51c78da52a76b1d3e998361da1f052f152976c71 |
| musicxml-versions/study-3.1.musicxml | ca4fd9d9398ff6eb07de9d6c521448a410a2e7cd416836cdac44fc87bc992ee4 |
| musicxml-versions/study-3.1.mxl      | f40d9d01291bcaf5843ce52b003c740e7a5bc09b909bbc82435dbfbde71dba73 |
| musicxml-versions/study-4.0.musicxml | 1d1fe2bc15aa505be6849266dd595477461d9893b486fe0d6b606359625c30c4 |
| musicxml-versions/study-4.0.mxl      | 4c762e68546c870ee00b88e8a49f7739a270e6f1d5a5092483c6f137eeac8b52 |

## Menuett（利用者提供の実ファイル）

- 原本: `src/s-core/fixtures/files/musicxml/Menuett_in_G-Dur_BWV_Anh._114.mxl`。利用者がこの検証のためfixturesへ追加したファイルをそのまま使用。重複コピーや別配布物の置換なし。
- SHA256: `2a4fb54e1229faa8d7268a804ab4f8c90f9704c544f1721e171be925c1d5ae1a`、4,407byte。
- MXL root: `lg-137602102.xml`。rootのversion属性は欠落、標準Recordare PUBLIC DOCTYPEがMusicXML3.0 Partwiseを明記。MuseScore2.0.0、encoding-date2015-03-15。埋込sourceは `http://musescore.com/score/713151`。rights表記なし。利用者提供fixtureとして検証し、独自作成CC0素材とは区別する。第三者の版面の再利用条件を推測してCC0等と表明しない。
- 独立期待値: XMLを別の標準XML読取でも確認。P1は32小節128音符、P2は32小節80音符、計208。各小節3拍、各パート96拍。divisions=2、3/4、調号fifths=1、テンポ指定無し（既存補完120をWARNINGで通知）。
- 先頭旋律: D5=74/start0/duration1、G4=67/start1/duration0.5、A4=69/start1.5/duration0.5、B4=71/start2/duration0.5、C5=72/start2.5/duration0.5。
- 先頭伴奏: B3=59とD4=62がstart0/duration2の和音、A3=57/start2/duration1。backup後のG3=55/start0/duration2は別声部2。
- 反復6か所はUNSUPPORTED_REPEAT/BLOCKING。印刷等の表示省略12件WARNING。版復元のINFO1件を残す。アップロード/確認/保存は可能だが、反復を無視した練習・ゲームを許可しない。
- 回帰: `src/s-core/models/import/menuett.test.ts` と既存manifest回帰、旧モデルとの全音符意味比較。元ファイル自体は書き換えていない。
