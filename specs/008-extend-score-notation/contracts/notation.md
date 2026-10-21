# Notation Contract

## 入出力

既存 preview/revalidate/save/read の HTTP・server action を使い、新 endpoint を設けない。候補 JSON に任意の [表記項目](../data-model.md) を追加する。外部入力の検証、署名対象、保存、再読込、編集経路は同じ項目を保持する。

| 入力 | 挙動 |
| --- | --- |
| MusicXML 2.0/3.0/3.1/4.0 score-partwise XML/MXL | pitch と音名を保持し、accidental と notations/tied を別々に抽出 |
| 旧 Sheet JSON | 新項目なしで受理、既存推定・ties fallback |
| 新 Sheet JSON | enum・範囲・演奏音高との整合性を検証し保持 |
| Core JSON / MIDI | 元の表記を捏造しない。現行の推定と継続音分割を維持 |
| 不完全候補 | 新項目を nullable 音楽情報と併存して保持し、修正・promotion 後も維持 |

原入力の表記矛盾は、矛盾した notatedPitch/explicitAccidental を完全候補として出力せず、表示診断を付けて表記の推定へ戻す。音楽値を確定できない場合は不完全候補とする。矛盾した原表記を正常に保持したと主張しない。

XML の type continue は視覚的連鎖、start/stop は両端として正規化する。placement/orientation が矛盾する場合は表示診断し任意の方向を正しいと主張しない。let-ring・破線・任意原譜制御点等の未対応形状は表示警告。通常タイの表示と音楽的意味は維持する。

## 描画契約

- Sheet の元情報は変更しない。notatedPitch がある場合はその音名・オクターブで位置を算出し、なければ既存推定を使う。
- 臨時記号の自動表示は小節状態に従い、明示指定は繰り返しでも保持する。括弧も glyph/寸法として配置する。
- 臨時記号は幅計算前に解決し、和音で隣接する記号の列を分ける。再描画で幅が累積しない。
- タイは glyph ではなく可変長 curve。両端の符頭に対応し、上下符幹・和音の一部・加線と衝突しない余白を設ける。
- Horizontal、Vertical、Page で確認する。system をまたぐと outgoing/incoming に分かれる。Page では全ページを描画し、bounds がページで切れない。
- タイ geometry の metadata に relation と両端 identity、segment kind を残す。SVG は既存 type/data-* と整合する属性で伝える。

## 診断

既存 ConversionIssue の id/code/severity/status/fieldPath/track/bar/message を使う。

| 条件 | 分類 | 利用可否 |
| --- | --- | --- |
| 対象表記を完全に保持・描画 | 省略警告なし | 既存判定 |
| 視覚的タイの欠落端点・曖昧さ・形状未対応 | WARNING: DISPLAY_TIE_UNRESOLVED / DISPLAY_INFORMATION_OMITTED | 音楽情報が揃えば許可 |
| 視覚と音楽タイの不一致 | WARNING: TIE_DISPLAY_MISMATCH | 音楽的 ties が正しければ許可 |
| 音楽的タイの端点不整合・曖昧な同時同音 | BLOCKING: UNMATCHED_TIE / AMBIGUOUS_TIE | 解決まで練習・ゲーム不可 |
| 表示記号未対応・表記矛盾の原入力 | WARNING: DISPLAY_INFORMATION_OMITTED / NOTATION_PITCH_MISMATCH | 音楽値を確定できる場合のみ許可 |
| 確定 JSON の音名と演奏音高が矛盾 | スキーマエラー | 保存拒否、部分更新なし |
| 微分音・不明な演奏音高 | 既存 MISSING_PITCH 等の BLOCKING | 既存の修正経路 |

新コードは既存の再検証で stale な診断が残らないよう分類する。警告の確認だけで音楽的 blocker を解決扱いしない。診断文は対象小節・音と次に必要な操作を示す。

## 保存・互換性

candidate の全任意項目を署名し score.json に保存する。読み取り後同じ表記・接続・描画を得る。署名確認前に旧 candidate へ default を追加しない。新変換の converterVersion のみ更新し、入力 formatVersion・旧署名の検証規則は維持する。
