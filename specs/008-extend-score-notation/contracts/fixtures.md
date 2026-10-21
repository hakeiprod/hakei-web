# Fixture Manifest and Verification Contract

配置先: `src/s-core/fixtures/notation/manifest.json`。既存 Core/MXL は入力参照で再利用し、既存識別子を変更しない。新 loader は manifest を明示読み込みし、manifest 自体を楽譜と解釈しない。

## Manifest v1

| 項目 | 契約 |
| --- | --- |
| version | 1 |
| fixtures[].id | 全体で一意の安定 ID |
| title / target | 利用者向け名称と主な確認対象1つ |
| requirementRefs | FR/US/SC の参照。網羅性検査に使用 |
| source | path（fixtures 配下限定）、format=CORE_JSON/SHEET_JSON/MUSICXML/MXL、由来・自作／許諾情報 |
| expectedOutcome | render / reject。必須 |
| requiredStages | 適用する stage の重複しない非空配列。assertions と一致させる |
| rejectionStage | reject のとき必須。import / persisted |
| layout | Horizontal/Vertical/Page、scale、viewportWidth/Height または pageLayout。境界入力は固定値必須 |
| sizeReason | 改行等で入力が大きい場合の理由 |
| assertions | 一意 ID、stage、kind、selector、expected。配列は空にしない |
| visualChecklist | 実ブラウザーで確認する表示項目と期待結果 |

stage は import / roundtrip / persisted / document / svg / visual。

- `expectedOutcome=render`: document と svg を必須とし、元表記・タイの正常条件では import/roundtrip/persisted も必須。visual は新規対象の全正常条件と基礎記号の代表表示条件で必須とする。境界・括弧・異名同音は独立 visual 条件にする。
- `expectedOutcome=reject`: rejectionStage と、それまでに検証する段階だけを requiredStages に記載する。import の拒否なら import の期待エラー・診断を、persisted の拒否なら保存試行の期待エラーと revision・公開 Git 状態の不変を検証する。保存成功・描画・目視は要求しない。reject で document/svg/visual を requiredStages に指定する manifest は不正とする。
- rejectionStage の捕捉した例外が期待エラーに一致すれば、その assertion は pass。拒否されない、別のエラー、予期しない例外は fail/error。拒否後の非適用段階は skipped と表示し、requiredStages の全 assertion が pass なら全体は合格にできる。
- BLOCKING 診断があっても partial を受け取り表示できるケースは、拒否ケースと混同しない。render として必要な診断・利用可否を検証する。保存拒否専用ケースを別 fixture に分ける。
- reject では requiredStages に rejectionStage を必ず含める。各必須段階に1件以上の assertion を置く（visual は visualChecklist の id 付き項目を assertion として扱う）。必要な段階の省略を coverage 検査で検知する。render の正常条件で persisted/visual が未実施なら全体を合格にしない。

selector は role/glyphName と source(trackId,noteId,staveId,barId) を基本とし、タイは両端 identity と relationId/segment kind を使う。DOM の child 順やランダム ID に依存しない。

### assertion kind

- `count` / `absent`: 種類・selector に一致する正確な数／0件。
- `value`: 意味上の情報を明示パスで比較。音名・alter・ties・診断・打鍵数など。
- `relativePosition`: 左右・上下・五線位置・最小間隔。staff space 単位の明示許容誤差。
- `tieEndpoints`: 対象の両端、接続片、座標の符頭との対応を比較。
- `bounds`: ページ内・正の幅・有限座標。これだけを主対象の合格条件にしない。

期待値は入力を見て定義し、実装から自動生成した値を無審査で正解にしない。各主条件には対応する欠落・誤種類・誤接続などの対照結果を与え、判定器が不合格を返すテストを持つ。対照結果はコピーに適用し原入力を変更しない。

## Result v1

fixtureId、assertionId、stage、status、expected、actual、message を持つ。status は pending/pass/fail/error/skipped。処理状態 loading/rendered/error は独立。rendered は pass を意味しない。

段階の合格は要求 assertion が全て pass のときのみ。fixture 全体は requiredStages が全て合格したときだけ pass。非適用 stage の skipped は合否に含めない。未実施 visual、環境不足の persisted は pending/skipped と表示し、overall pass にしない。実ブラウザー確認記録は fixture ID、入力・期待値のハッシュ、レイアウト、ブラウザー、日時、確認者、各結果、必要な画像を含む。rendererRevision は下記の現行値と一致必須。入力・期待値・レイアウト・実装・フォントが変わった記録は失効させ、再確認する。

## 結果ファイルと読み込み経路

両ファイルは実装時に生成・記録する。文書作成時に空の成功記録を作らない。

| ファイル | 生成元 | 読み込み先 |
| --- | --- | --- |
| `specs/008-extend-score-notation/verification-results.json` | `scripts/verify-notation-fixtures.ts` が専用テストの段階別出力を集約 | 開発用 `src/app/dev/load-score-fixtures.ts` |
| `specs/008-extend-score-notation/visual-results.json` | 実ブラウザー確認後に確認者が契約に沿って記録 | 同 loader |

結果ファイルは `{ version: 1, runs: [...] }`。各 run は runId、fixtureId、sourceHash、expectationHash、layout、rendererRevision、executedAt、results を持つ。visual run は browser と reviewer も必須。results は Result v1 の配列で、assertionId と visualChecklist の項目 ID に対応する。requiredStages と assertion 定義が expectationHash の対象に入る。

sourceHash は入力バイト列の SHA-256、expectationHash は期待値・主条件・適用段階の正規化 JSON の SHA-256。rendererRevision は Git HEAD のみを使わず、追跡／未追跡の現在のファイル内容から計算する SHA-256 とする。対象は `src/s-core/models/` のソース、`src/s-core/const/` のフォント・SMuFL・音楽理論を含む描画用定数、`src/components/` のソース、`src/app/` の開発用画面とスタイル、`package-lock.json`、`tsconfig.json`。パス順に整列しパス・バイト長・内容を含める。結果ファイル自体を含めず循環を避ける。変更検出を保証するため対象追加時は fingerprint の検査も更新する。

`src/s-core/models/fixtures/results.ts` は DOM・Node 非依存の純粋な集計と識別値比較を行う。ファイル読み書きと fingerprint 算出は `scripts/lib/notation-report.ts` と開発用サーバー loader に置き、モデルへ fs/crypto 依存を持ち込まない。

runner は対象 fixture と stage の実行結果を Node 用の一時ディレクトリに集め、欠落した結果を pending/skipped として明示する。今回要求した stage は過去の pass で補完しない。テスト失敗も出力し runner は非0終了する。DB がなく実行していない persisted を pass にしない。集約後は一時ファイルから rename して verification-results.json を原子的に更新する。通常の `npm test` で暗黙に証跡を書き換えない。

loader は両ファイルを Zod 検証し、fixtureId・sourceHash・expectationHash・layout・rendererRevision が現行値に一致する run の結果のみ採用する。各 stage は最新の実行を使い、過去の pass を後発 fail より優先しない。ファイル欠落は未検証、破損は明示的な読み込みエラー、識別値不一致は失効として未検証に戻す。gallery へは型検証した結果だけを渡し、ブラウザーから DB 操作を行わない。

visualChecklist は `{ id, expected }` の非空項目を使い、記録の各項目を安定 ID で結ぶ。要求された目視項目が1件でも未確認なら visual は未検証。閲覧するだけでレビューを自動作成しない。

## UI 契約

開発専用 `/dev/notation/fixtures` を追加し production では notFound とする。既存 `/dev/core/fixtures` と `/dev/mxl/fixtures` を維持する。対象・期待値・各段階・不一致理由を表示し、全ページを確認できる。core/mxl の metadata がない入力は未検証として表示する。

Zod で manifest を検証し、重複 ID、存在しない入力、範囲外 path、不正 selector、未知 stage、要求参照の未網羅を明確に失敗させる。テストで実行していない段階を UI で合格と偽装しない。DB 操作はサーバー統合テストからのみ実行する。

## 必須カバレッジ

FR-003 の各基礎条件、US2 の5受け入れ条件、US3 の4受け入れ条件に独立 assertion を割り当てる。具体的な分割候補は [investigation.md](../investigation.md)。同小節／小節越え／改行／改ページ、和音・声部・譜表・パート分離、各記号、注意喚起・括弧、小節内反復・境界リセット・オクターブ分離・同時矛盾を別主条件として保持する。MusicXML 共通表現は4版で import 保持を検証し、各対象群に MXL 入力と新旧 Sheet JSON の往復確認を設ける。

## 最小例（主対象は4分音符の符頭）

入力は `quarter_middle_c.json` を再利用する。以下は実装用の契約例で、実際の manifest 本体ではない。

```json
{
  "id": "notehead/quarter",
  "title": "4分音符の符頭",
  "target": "中央Cに黒い符頭が1個ある",
  "requirementRefs": ["FR-003", "US1/AC1", "SC-001"],
  "source": {
    "path": "core/quarter_middle_c.json",
    "format": "CORE_JSON",
    "provenance": "existing repository fixture"
  },
  "expectedOutcome": "render",
  "requiredStages": ["document", "svg", "visual"],
  "layout": { "type": "Horizontal", "scale": 12, "viewportWidth": 800 },
  "assertions": [
    {
      "id": "black-head-count",
      "stage": "document",
      "kind": "count",
      "selector": { "glyphName": "noteheadBlack", "source": { "trackId": 0, "noteId": 0 } },
      "expected": 1
    },
    {
      "id": "svg-head-count",
      "stage": "svg",
      "kind": "count",
      "selector": { "glyphName": "noteheadBlack", "source": { "trackId": 0, "noteId": 0 } },
      "expected": 1
    }
  ],
  "visualChecklist": [{ "id": "head-shape", "expected": "Bravuraの黒い符頭が中央Cの位置で欠けずに見える" }]
}
```

この例に符幹・加線があっても主条件にはしない。それらの検証は別 ID の fixture で行う。複数段階の同じ主条件は1つの fixture に収めてよい。

## 拒否ケースの例

音名と演奏音高が矛盾する Sheet JSON を保存しようとする fixture は、`expectedOutcome=reject`、`rejectionStage=persisted`、`requiredStages=[persisted]` とする。保存操作に渡す境界で期待するスキーマエラーが発生し、revision と公開 Git 状態が変化しないことを value assertion で確認する。前処理の converter に先に拒否させて保存拒否の証明としない。loader は入力・期待値と記録を提示し、拒否専用入力の描画を試行しない。
