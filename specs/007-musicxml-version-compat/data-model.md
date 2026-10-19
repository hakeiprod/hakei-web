# Data Model: MusicXML version compatibility

## Source document（変換中のみ）

| 項目                      | 制約・意味                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| bytes / sourceName / mime | 既存入力。内容・拡張子・MIMEの整合検証を維持                                                                   |
| root                      | score-partwiseのみ。timewise/opus等は対象外                                                                    |
| formatVersion             | rootまたは標準PUBLIC DOCTYPEの明示文字列2.0/3.0/3.1/4.0。DOCTYPEでも確定できない欠落・未知・対象外を補完しない |
| document declaration      | 標準外部DOCTYPEをオフラインで処理。内部subset/ENTITY、矛盾する明示版は拒否                                     |
| container                 | XMLまたはMXL。MXLはcontainerの主楽譜を選び、全entryを予算内で検査                                              |

元データは既存の所有期間だけ保持し、DB/Gitへの原本アップロード保存や新しいログを追加しない。MusicXML変換の戻り値は既存candidate/issuesに検証済みformatVersionを加え、外側のconvertScoreがmetadataを構築する。

## Normalized candidate（既存モデル）

Sheetまたはconverted-partial-v1を維持する。notesのpitch/start（partialはonset）/duration/end/rest/voice/staveId/chordId/ties、tracks/masterbars/bars/staves、tempos/timesignatures/keysignaturesを同じ単位と意味で扱う。版ごとに別の永続スコア型を作らない。

voiceラベルはXML解析で字句を保持し、パート単位の一時対応表で非負整数IDへ正規化する。同じラベルは同じID、異なるラベルは異なるID。既存の正規の非負整数表記はそのIDを優先して予約し、その他のラベルは衝突しない空きIDへ対応する。省略voiceは従来の1と同じ扱い。`01`と`1`等を別ラベルとして保持する。これは一時変換状態であり、新DBテーブルやSheet schema変更は不要。

音高・時刻・長さを確定できない場合は既存nullable項目とBLOCKINGを使う。演奏順等の出所依存の不確定さは通常編集や確認だけで解消した扱いにしない。記譜の数値・文字列正規化の変更時はclef/beam/stem等の既存意味を保持する。

## ImportMetadata（既存成果物）

| 項目             | 新規取り込み                                  | 過去データ                     |
| ---------------- | --------------------------------------------- | ------------------------------ |
| format           | MUSICXML。MIDI/CORE_JSON/SHEET_JSONは従来通り | 従来値を保持                   |
| formatVersion    | MusicXML元版をそのまま記録                    | 当時の値を再推測・上書きしない |
| converterVersion | score-import-v2                               | 旧v1等の文字列を読み続ける     |
| options          | 既存PRESERVE。MusicXMLでQUANTIZEは拒否        | 従来通り                       |
| sourceName       | 既存のbasenameのみ                            | 従来通り                       |

共有のimportMetadataSchemaは既存の文字列制約を維持する。新規MusicXMLの許可集合は変換境界で検証する。MIDIのSMF-1.0、JSONの1や過去converterVersionを排除しない。validatorVersionは今回の診断規則が変わる場合だけ既存の版管理方針で更新し、過去validation成果物を自動再計算しない。

## ConversionIssue / RevisionValidation（既存）

severityはINFO/WARNING/BLOCKING、statusはUNRESOLVED/RESOLVED、位置はfieldPath/track/bar。表示省略と音楽上の不確定さを分離する。未解決BLOCKINGまたはpartialはcanPractice/canGame=false。acknowledgementは同意記録であり、validationの制限解除ではない。

## 保存・署名と関連

```text
source -> MusicXML conversion(actual version, candidate, issues)
       -> convertScore(metadata, validation)
       -> worker validation -> signed preview
       -> optional correction/revalidation(same metadata, same initial expiry)
       -> saveImport(acknowledgements + actor/repository permission)
       -> Git score/settings/diagnostics/validation + DB projections
       -> score reader / proposal / display / practice eligibility
```

candidate/issues/metadata全体を既存署名に結び付ける。versionだけの改変も拒否する。Git settings.jsonとPrisma ImportMetadata.formatVersionの一致を確認する。再検証・提案経由も元版を保持し、既存のmutation keyと原子性を維持する。

schema変更・移行・原本保管用エンティティは追加しない。settings無しの過去revisionとmetadata:nullも従来通り読める。

## Regression fixture（試験用記録）

既存fixtures/import/manifest.jsonの方式を拡張し、原本の相対パス、source/version/container、出所・利用条件、hash、期待する音高/開始/音価/声部関係/和音/タイ/構成/設定変更、期待issuesと利用可否を記録する。必要なら詳細期待値を隣接JSONへ置く。実装から期待値を自動採取して正解にしない。

Menuett原本は利用者追加のfixtures/files/musicxmlにあるファイルを参照し、出所・rights記述の有無・hashをfixture-provenance.mdに記録する。manifestから原本を参照し、重複コピーや同名別素材で代替しない。原本E2Eを省略しない。

## 版欠落の限定復元

原本Menuettはroot version無し、標準PUBLIC DOCTYPE=3.0。実版の根拠をDOCTYPEまで含める。元version属性が無い場合だけ対象版を採用し、MUSICXML_VERSION_FROM_DOCTYPE INFOを署名・保存対象のissuesへ残す。新しいmetadata列は追加せず、版の由来も過去データと同じ診断成果物へ保存する。明示版の優先と矛盾拒否を維持する。
