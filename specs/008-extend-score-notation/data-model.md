# Data Model

## 永続 Sheet.Note の任意追加

既存 id/trackId/staveId/voice/pitch/start/duration/end/ties 等は維持する。

| 項目 | 型・制約 | 意味 |
| --- | --- | --- |
| notatedPitch | { step: A..G, octave: 整数 -1..9, alter: 整数 -2..2 } | 元の音名。結果の演奏音高は0..127 |
| explicitAccidental | { kind: sharp/flat/natural/double-sharp/double-flat, cautionary?: boolean, parentheses?: boolean } | 明示記号。未指定は自動判定で、natural と区別 |
| visualTies | 任意配列。各要素 { type: start/stop/continue, number?: 整数1..16, placement?: above/below, orientation?: over/under } | 視覚的タイ。未指定は ties fallback、空配列は表示抑止 |

音符 identity は `trackId:noteId`。連結キーは track/stave/voice/pitch と、あれば visual number。休符は音名・臨時記号・タイを持てない。各配列・文字列は境界で上限を設け、無制限な関係データを受理しない（visualTies 最大32件／音符）。

### Validation

- `(octave + 1) * 12 + stepSemitones + alter === pitch`。音楽値が確定済みの候補で必須。不完全候補は pitch が null の間、整合性比較を保留する。
- 明示記号の変化量と notatedPitch.alter が矛盾する完全データは拒否する。原ファイルの unsupported 表示は別途診断し、演奏音高を変えない。
- number・方向・enum は共通 Zod で検証。重複する同種同番号の指定は拒否または入力診断とする。
- 旧 JSON に任意項目を補完して再保存しない。新項目があるデータだけその値を出力する。
- `partialNoteSchema`、notation付き promotion、Core fallback、Sheet.Note ctor/serialize/import、converter の両出力を網羅する。promotion では既存 stem/beam も保持する。

## 導出 TieRelation（永続化しない）

| 項目 | 意味 |
| --- | --- |
| id | 両端 identity と number から安定して生成する文字列 |
| startNote / endNote | trackId/noteId の対 |
| origin | visual または musical-fallback |
| placement | above/below。明示指定優先、未指定は符幹・和音の位置から決定 |

start は pending、stop は同キーの pending と接続、continue は終点と次始点に正規化する。接続は原則 `start.end == end.start` の既存時間許容誤差内。複数の候補・重複・不整合は曖昧さ診断とし、任意の候補を選ばない。音楽的 ties の接続も上書きで同時同音を見逃さないよう診断する。視覚だけの異名同音は MIDI pitch が同じ場合に接続してよい。別声部・譜表・パート間は今回自動接続しない。

音楽的タイと視覚指定の不一致は表示警告とし、音楽的 ties 自体が不整合なら既存 BLOCKING を維持する。visualTies から timeline を作らない。

## 導出 AccidentalDecision（永続化しない）

note identity、resolved spelling、表示 kind または none、括弧、明示／自動、使用した小節状態を持つ。キーは track/stave/bar/step/octave。時刻順の各バッチで処理し、同時音の配列順に依存させない。同時刻の同音名が異なる変化量を持つ場合、各音に必要な記号を示し、以後の状態を不確定として次の出現にも記号を出す。音名・音高が確定できない場合は診断する。調号変更で基準状態を更新する。

小節を越えて継続中のタイ終点には、原譜で明示されていない限り再度の記号を出さない。その終点だけで次の独立打鍵の臨時記号を省略しない。

## Document.Curve / TieSegment

Curve は start/end と2本の三次曲線の制御点、fill、bounds を持つ閉じた帯。kind=curve、role=tie。geometry は staff space、全座標有限、bounds は塗りの全体を含む。DOM や楽譜モデルへの参照なし。

TieSegment は relationId、両端 note identity、part=complete/outgoing/incoming、rowId/pageIndex に対応する。Document metadata は start/end の track/note を保持し SVG に data 属性として伝える。片方が次 system にある場合も両端 identity は保持する。

形状は符頭境界から少し離した端点を使い、上下の曲率と最小間隔を制限する。複数和音タイは別の高さを確保する。row の上・下余白を先に計算しページ寸法に反映する。再 layout 時に再計算し、楽譜へ座標を書き戻さない。

## Fixture と結果

[fixtures.md](contracts/fixtures.md) を契約とする。入力と期待値は別管理し、実装の出力から期待値を自動承認しない。処理状態と各段階の検証状態は別々に持つ。

- Fixture: `expectedOutcome: render | reject`、`requiredStages: stage の重複しない非空配列`、reject では `rejectionStage: import | persisted` が必須。正常描画と期待拒否の合格条件を分ける。拒否後の非適用段階に描画・保存成功を要求しない。
- VerificationRun: version=1 の runs 配列の各項目は runId、fixtureId、sourceHash、expectationHash、layout、rendererRevision、executedAt、results。VisualRun は browser・reviewer も必須。visualChecklist は安定した id と expected を持つ。
- 証跡は `verification-results.json` と `visual-results.json` から開発用 loader が読み、現行の入力・期待値・レイアウト・rendererRevision が一致した結果だけを使用する。欠落は未検証、破損は読み込みエラー、失効は未検証に戻す。詳細な出力先・生成元・集約規則は fixtures 契約を正とする。
- rendererRevision は Git HEAD ではなく現在の実装・フォント・設定ファイル内容の SHA-256。未コミット／未追跡の変更も検出する。fs/crypto・原子的なファイル出力は Node 用 adapter、比較と集計は純粋モデルに置く。

## 互換性・移行

追加項目は全て任意で、Sheet JSON の既存形式と DB スキーマは維持する。旧音高からの推定は従来の fallback。新変換のみ converterVersion=score-import-v3。旧 v1/v2 保存資料・署名を拒否せず、再取り込みは利用者の明示操作時のみ。サーバーの署名・ハッシュ・認可・診断投影は既存経路を使う。
