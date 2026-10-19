# Research: MusicXML version compatibility

調査日: 2026-10-19。ローカル実装・旧履歴と公式一次資料を比較した。実装変更や試験成功の報告ではない。

## 1. 単一変換経路で対象4版を扱う

**Decision**: score-partwiseの2.0/3.0/3.1/4.0に限定して明示的に受理し、共通の音楽正規化を拡張する。

**Rationale**: 現行musicxml.tsはrootとversion=4.0を同時判定している。旧 `5c15943^:src/s-core/models/browser/importer.ts` はMXLのrootを読んで旧MusicXmlへ渡し、versionによる拒否はなかった。4.0型を参照していたことは入力が4.0限定であった証拠ではない。旧モデルにも安全性・音楽情報の欠落があるため、旧実装へ巻き戻す必要はない。

**Alternatives considered**: 版番号だけを4.0へ置換する方式は出所の偽装になる。4種類のパーサーや外部変換アプリは既存手段の重複と運用追加になる。無条件の全版許可は範囲と正確性を保証できない。

**Evidence**: [W3C 3.0変更履歴](https://www.w3.org/2021/06/musicxml40/version-history/30/)、[4.0変更履歴](https://www.w3.org/2021/06/musicxml40/version-history/40/)。版ごとに追加・非推奨要素があり、受入版と全機能対応は区別する。

## 2. versionと文書型の扱い

**Decision**: rootのversionを文字列として検証し元版に使う。欠落は標準PUBLIC DOCTYPEに対応版が明記される場合だけ復元し、それ以外は拒否。標準外部DOCTYPEはオフラインで扱い、内部subset/ENTITYは拒否する。PUBLICの版がrootと矛盾すれば不正入力とする。SYSTEMの共通DTD URLだけから版を推測しない。

**Rationale**: 公式のversion欠落時既定値は1.0であり4.0ではない。DOCTYPEは正常な旧版にも存在するが、取得を許す必要はない。現在のDOCTYPE除去は二重引用符に寄っているため、一重引用符と改行を含む正常例を安全性試験と対にする。

**Alternatives considered**: DOCTYPEを一律拒否すると互換性が落ちる。DTDのネット取得は安全要件とオフライン動作に反する。DTDやXSDの完全な実行時検証機構の追加は今回不要。構文解析と必要な値・参照・音楽意味の検証を維持する。

**Evidence**: [score-partwiseのversion属性](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/score-partwise/)、[公式Hello WorldとDOCTYPE](https://www.w3.org/2021/06/musicxml40/tutorial/hello-world/)。

## 3. 版より内容の意味を検証する

**Decision**: 共通のduration/divisions、backup/forward、chord、rest、tie、staff/partと設定変更を独立期待値で検証する。文字列声部は衝突しない内部数値IDへ対応させる。

**Rationale**: 公式voiceはstringであり、現行の整数限定は正常なラベルを拒否する。XML全体のparseNumbersでvoiceの`01`と`1`が同一化しないようにし、既存の数値voice/clef/beam表現も保持する。対応対象の声部を番号の見かけで統合してはならない。durationはdivision単位で、和音の後続音はcursorを進めない。

**Alternatives considered**: 全voiceをNumberにする案は情報を失う。Sheetのvoiceをstringへ変更する案は描画・採点・永続形式へ不要に波及する。文字列だけをBLOCKINGにする案は既存モデル内で対応できる範囲を狭める。

**Evidence**: [voice](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/voice/)、[duration](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/duration/)。旧和声記号functionと新numeral等は演奏音符とは別の表示機能であり、今回新しい演奏機能へ変換しない。

## 4. 元版の保存と過去データ

**Decision**: convertMusicXmlから実版を返し、既存metadata.formatVersionに設定する。既存string schema/Prisma列/Git settingsを再利用する。新しいconverterVersionはscore-import-v2、旧v1のデータ・署名は既存条件のまま受理する。

**Rationale**: 現行convert.tsの4.0固定を除けば、worker、署名、再検証、GitとDB投影はmetadata全体を既に扱える。署名はmetadata全体のhashに結びつく。version改変は引き続き拒否できる。MIDI/JSONにも同じschemaを使うためenumへ狭めない。

**Alternatives considered**: sourceVersion列や新しいartifact形式は重複。過去の4.0記録を推測修正すると原本がないのに履歴を書き換える。過去データは当時の記録として保持する。converterVersionは移行の強制条件にせず、結果を区別する出所情報とする。

**Local evidence**: import/contracts.ts、server/import-preview-token.ts、import-revalidate.ts、revision-validation.ts、score-import.ts、score-reader.ts、Prisma ImportMetadata。DB migration不要。

## 5. 未対応と拒否を伝える

**Decision**: 既存WARNING/BLOCKINGとpartial保存を維持し、未対応版・rootには区別できる定数エラーと案内を追加する。raw XML・パス・parser例外は返さない。実版と対応版案内は既存ImportPreviewへ表示する。

**Rationale**: 現行UNSUPPORTED_FORMATは版・構造を区別できず、import-http.tsの説明も一般的。workerは英大文字等のコードのみを渡せるため、新規の小さいエラー分類で足りる。ユーザーの警告確認はBLOCKINGの解消ではない。

**Alternatives considered**: parser例外をそのまま公開する方法は危険で分かりづらい。新しいエラー画面・APIの追加は不要。未対応演奏をWARNINGだけに下げる方法は音楽の正確性に反する。

## 6. MXL・ライブラリ・実行環境

**Decision**: xml2js/JSZip/Zodの既存構成とNode workerを利用し、MXL主楽譜の選択、全entry展開量集計、safePath、期限、heap、admissionを保持する。依存追加・更新はしない。

**Rationale**: 既存APIで構文解析・圧縮解除・入力検証を満たせる。音楽意味の保持はサービス固有の正規化として残す。複数rootfileを勝手に結合しない。現行JSZipの型にないinternalStream使用は既存実装であり、今回新しい内部依存を増やさない。

**Alternatives considered**: ブラウザーのXML取得や別のZIP処理への変更、無制限展開は不要。新しいフルスコア変換ライブラリの導入は現在の共通要素対応に対し過大。

**Evidence**: [W3C compressed MXL](https://www.w3.org/2021/06/musicxml40/tutorial/compressed-mxl-files/)、ローカルmxl.ts/import-limits.ts/import-worker.ts。インストール済みバージョンはplanのTechnical Context参照。

## 7. 回帰素材と完了依存

**Decision**: 各版の仕様に沿った実表現を持つXML/MXLと独立期待値を用意し、出所・利用条件・hashを記録する。版差以外が同じ対照例に加え、DOCTYPEや声部・設定等の例を用意する。旧16件のMXLとMenuett原本を別途確認する。

**Rationale**: 旧MXL16件は全件4.0だったため、それだけでは旧版の証明にならない。unsupported-version.musicxmlはroot=3.1に対しDOCTYPE=4.0の不一致素材であり、正常な3.1原本として流用しない。4版分の単純文字列置換だけで完了にしない。

**Alternatives considered**: 出所不明の同名ダウンロードを報告された原本とみなす方法は採用しない。原本未入手のMenuettを合成例で代替することもしない。独自作成例は独自作成と明示し、各対象版の公式定義との適合確認を記録する。

**Dependency update**: 利用者が原本をfixturesへ追加した。実版の根拠・出所記述・独立期待値をfixture-provenance.mdへ記録し、原本E2Eを実施する。版欠落の扱いの更新は次節参照。

## 8. 利用者提供のMenuett原本による限定判断の更新

**Decision**: root版が欠落し、標準PUBLIC DOCTYPEが対応版を明記する場合のみ復元してINFOを残す。

**Rationale**: 原本はMuseScore2.0.0出力、root版無し、Recordare MusicXML3.0 Partwiseの明示宣言。旧経路で読めた実ファイルを再現できた。一律欠落拒否ではFR-003/014を達成できないため、仕様FR-007/008と契約・タスクの限定例外を更新した。これは欠落時の標準既定版を3.0と主張するものではなく、明示されたPUBLIC宣言に基づく互換性方針。

**Alternatives considered**: 原本のversionを書き換える手順や、全欠落を4.0とみなす案は採用しない。SYSTEM URLだけからの推定、明示版の上書き、ENTITY/内部subsetの許可は引き続き禁止。
