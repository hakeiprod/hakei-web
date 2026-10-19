# Validation: MusicXML version compatibility

実施日: 2026-10-19。仕様007、専用ブランチ007-musicxml-version-compat。

## 結果と残る依存

MusicXML 2.0/3.0/3.1/4.0のXML/MXL、実版の保持、声部・音楽意味、安全な診断と取り込みを実装した。一般素材の回帰はPASS。**利用者が追加したMenuett原本でも、アップロード・確認・保存・再表示を確認済み。T013/FR-014/SC-004を完了した。** 直接原因はroot version属性の欠落で、標準PUBLIC DOCTYPEは3.0を明記していた。元ファイルを変更せず限定復元で対応し、同名の別配布物・合成譜で代替していない。

## 基準・環境・変更範囲

- 開始時チェックリスト16/16 PASS。読み取りのみで変更なし。拡張フック設定なし。
- Baseline全単体73ファイル486件、tsc、対象lint PASS。追加テストで27失敗/8成功を先に確認した。その後、4版・DOCTYPE・metadata・声部・設定診断・UIを変更した。
- Linux/Node22.23.3、既存依存と専用PostgreSQL15（127.0.0.1:15439）、毎回新規作成するhakei_007_xml_test DB、専用一時Git、独立Mailpitを使用。テスト後DB削除・DB/Mailpit/server停止・一時Git削除。稼働DB/.envは変更していない。
- node_modules/dist/build/coverage/.env/log等の既存ignore確認。private npm、Dockerfile/Terraform/Helmの追加変更なし。
- 新規依存、DB migration、認証、MIDI/JSONの変換意味、描画/音声/採点方式の変更なし。新規変換のconverterVersionはscore-import-v2、過去の値は読み続ける。

## 素材と意味保持

[fixture-provenance.md](fixture-provenance.md)に独自作成CC0の8素材の出所・hash・仕様への適合と手計算期待値を記録した。2.0のsound、3.0のquarter metronome、3.1のeighth metronome/offset、4.0のwords/soundを別々に表現しており、版文字列だけの置換ではない。

各版の音高/開始/音価/声部/段、同時和音、休符、タイ、tempo90→120、3/4→2/4、調号+1major→-1minorと適用位置が期待値に一致。弱起と次小節、数値/文字列voice、省略1・01と1・数値予約との衝突・パート別割当も検証した。旧MXL16件は全件4.0で、旧MusicXMLモデルと新経路の音符pitch/start/duration/restが一致した。これを旧版の検証件数には含めていない。

旧importerは5c15943以前のMXL経路で実行時版限定がなく、現行の4.0 guardとmetadata固定を今回解消した。安全性と明示的なBLOCKINGは旧実装へ巻き戻さず維持する。表示/和声の省略を警告し、移調・変則調弦は黙って別音高で演奏せずBLOCKINGとした。

## 自動回帰

- 全単体: **78ファイル552件PASS**。新規の版別/声部/旧素材/境界試験と既存s-coreの変換・描画・再生回帰を含む。jsdomのcanvas未実装警告は既存環境の制約であり、実描画成功の代用にしない。
- 全統合: **19ファイル52件PASS**を確認。8組の実worker→署名→保存→Git/DB→readScore、3.1の提案/マージ後保持を含む。元版だけの改変拒否、再検証の元metadata・初回expiry保持、旧v1の有効署名を確認。
- 型・変更箇所lint・本番build: PASSを確認。buildは既存手順の `EMAIL_SERVER= EMAIL_FROM= npm run build`（当該プロセスだけの設定）でworker bundleも再生成。最終追加した実Gitのv1/null/settings無しの読込試験も含め、型・lintと全統合19ファイル52件を再確認してPASS。
- 通信/保存失敗時の保持・同一key再試行は既存import-preview.test.tsxのFormCreateScore操作試験を再利用し、表示警告と元版のケースを追加した。不要な重複form-create-score.test.tsxは作っていない。

## ブラウザー

[実測JSON](browser-results.json)。Chromium156.0.8078.4、本番build、認証は専用DBセッションfixture。実機MIDI・実音声・本番認証/外部SMTPの成功を主張しない。

- 360px/1280pxそれぞれで実際にリポジトリを作成し、4版×XML/MXLの8組をアップロード、元版・音符数・利用可否を確認。Enterで保存し、保存後とreload後の詳細を表示。合計16ケースでHTTP200、元版/候補のDB/Git再読込一致、全体横スクロール0。360pxの保存後画面も目視確認した。
- 表示省略、既定テンポ補完、反復、音高欠落、非伝統的調号、移調、テンポ0、未知版、欠落版、timewise、ENTITYの11ケースで説明と利用可否/HTTPが一致。BLOCKING例は保存後のpractice/gameでも開始不可を確認した。
- ネットワーク失敗後の元ファイル保持→元ファイルから再変換→取消を実操作で確認。ブラウザーJSエラー0。
- リポジトリ名の最初の自動操作はラベルの完全一致でタイムアウトした。既存name属性を使って再試行し成功。アプリの動作修正は行っていない。

## 境界・安全性

[10,000音実測](boundary-results.json)。1,180,560byteの10,000音入力を実workerで**2,054ms**、既存heap128MiB/timeout10,000msの設定で正常変換した。計測は上記環境での1回の実測で、全入力への性能保証ではない。

モデル試験で10,000/10,001音、40,000/40,001拍、16/17段を確認。MXLは総展開20MiBちょうど/1byte超過、100/101件、未使用entryの集計、危険/encoded path、root欠落、破損を検証。通常外部DOCTYPEの一重/二重引用符・改行・PUBLIC/SYSTEMはオフラインで受け入れ、内部subset/ENTITY・宣言矛盾は拒否した。

既存統合で期限を1msへ下げた中断とlease解放、同一利用者/全体の排他を確認し、入力上限を低くした17byte拒否を追加した。本文読込期限とworker期限は区別し、設定値を緩和していない。既存認可・原子性・同一key再試行・保存失敗時に既存楽譜を部分更新しない回帰も全統合に含まれる。

## 要件・受入条件対応

| 要件/受入条件                  | タスク・証跡                                           | 結果                   |
| ------------------------------ | ------------------------------------------------------ | ---------------------- |
| FR-001、SC-001、US1/AC1        | T003〜T012、8組のmodel/worker/保存、16ブラウザーケース | PASS                   |
| FR-002、US3/AC1                | T008/T011/T022〜T026、案内と対応表/診断                | PASS                   |
| FR-003、SC-004の旧比較         | T001/T019、旧MXL16件と旧guard調査                      | PASS（原本も確認済み） |
| FR-004/005、SC-002、US2/AC1〜3 | T014〜T019、独立期待値/声部/設定境界/保存後比較        | PASS                   |
| FR-006、SC-003、US3/AC2        | T021〜T026、partial/反復/表示省略/確認後も利用不可     | PASS                   |
| FR-007、US3/AC3                | T005/T020/T023、415/422等の安全な案内とブラウザー      | PASS                   |
| FR-008                         | T006/T007/T010/T016/T029、元版・署名・提案・Git/DB     | PASS                   |
| FR-009/010、SC-005、US4/AC1    | T027/T028/T032、境界・禁止入力・実worker               | PASS                   |
| FR-011、US4/AC2                | T007/T029〜T032、再試行/取消/権限/原子性               | PASS                   |
| FR-012、SC-006、US1/AC3        | T019/T029/T033、旧成果物・既存全回帰                   | PASS                   |
| FR-013                         | T002/T003/T019/T033、出所/hash/独立期待値と回帰        | PASS                   |
| FR-014、SC-004の原本、US1/AC2  | T013、[Menuett原本の実測](menuett-results.json)        | PASS                   |

## 憲章とスコープ

I: 音楽意味・旧データ保持、II: 純粋モデルとworker/保存/UI境界維持、III: 入力/署名/認可/制限、IV: 独立期待値の回帰、V: 本機能に必要な変更のみ、VI: 既存xml2js/JSZip/Zod公開APIを使用、VII: 既存HeroUIへ案内を追加。新しい秘密情報・原本ログ・依存/生成schemaの手編集なし。実装後の完了チェックは原本を含めて行った。

## 最終状態

35/35タスク完了。Menuett原本も両幅で検証済み。仕様001の現行取り込み契約とdocs/development.mdの案内を007へ合わせた。整形・リンク・JSON・fixture hash・タスク書式・git diff --checkを最終確認する。次の点検コマンドは `$speckit-converge`。原本は利用者提供のファイルそのままで確認した。コミット・プッシュは今回実施していない。

## T013: Menuett原本の確認完了

[menuett-results.json](menuett-results.json)。SHA256はfixture-provenance.md参照。4,407byte、root versionなし、標準PUBLIC DOCTYPE=3.0、2パート208音符、各32小節/96拍。原因は4.0限定だけではなく欠落版の一律拒否だった。最初に原本テストの失敗を確認し、標準PUBLIC宣言からだけ復元する限定方針をFR-007/008と計画・契約に記録して実装した。未知版/SYSTEM URLだけ/DOCTYPEなしは拒否、明示版の矛盾は422、ENTITY拒否も維持する。版復元のINFO1件、表示省略WARNING12件、既定テンポ補完WARNING1件、反復BLOCKING6件。

新規リポジトリ作成後の原本アップロードHTTP200→元版と確認事項→確認して保存→再表示/reloadを360px/1280pxで実施し、Git/DB readbackの候補・元版・診断が一致。全体横スクロール0、ブラウザーJSエラー0。反復未展開のため保存後もpractice/gameは利用不可であることまで確認した。読み込み成功と練習可能を混同しない。

全単体78ファイル552件、型・lint・本番build PASS。新規原本の権利表記は埋込情報を記録し、利用者提供fixtureとして使用した。独自作成のCC0素材とは区別する。既存16件の旧比較に原本を追加して17件を照合、従来のplayable-only importer試験からは反復ブロッカーを持つ原本を分離し、専用テストでpreviewと保存時の利用可否を検証した。原本E2Eとは別に一般16ケース/診断11ケースも再実行してPASS。最終全統合19ファイル52件もPASS。途中のMailpit再起動ポート競合によるメール試験失敗は、試験ラッパーの終了待ちと起動確認を補って再実行し解消した。アプリの認証処理は変更していない。

## 開発環境の一時障害表示への対応

利用者の開発環境ではIMPORT_PREVIEW_SECRETが未設定で、原本のworker変換後の署名段階がIMPORT_SIGNING_SECRET_REQUIREDとなる設定を確認した。Git除外済み.env.localへ暗号学的乱数の署名キーを追加（値・tokenは出力/記録しない）。同じローカル設定で原本の実worker変換（3.0/208音符）→signPreview→verifyPreviewの成功を確認した。開発画面での再アップロードは利用者のセッションで再確認する。アプリコード・DB・原本への変更なし。
