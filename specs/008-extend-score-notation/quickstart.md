# Quickstart Validation Guide

実装済みの fixtures・テスト・開発 route の検証手順。自動検証と、未実施のDB・実ブラウザー確認を区別する。現在の実行結果は [validation.md](validation.md) を参照する。

## 前提

Node.js 22、Git CLI、既存依存を用意する。環境と専用 PostgreSQL 設定は `docs/development.md`。TEST_DATABASE_URL は末尾 `_test` の専用 DB。実ブラウザーで Bravura 読み込みを確認する。

```bash
npm ci
npx prisma generate
```

統合テストの初回は専用テスト DB に既存 migrations を適用する。シェルの DATABASE_URL がその専用テスト DB を指すことを確認して `npx prisma migrate deploy` を実行し、テストは TEST_DATABASE_URL で接続する。実装に新しい DB migration はない。

実装で依存関係は追加しない。fixtures の要件は [fixtures.md](contracts/fixtures.md)、表記・診断の期待値は [notation.md](contracts/notation.md) を参照する。

## 1. manifest と細粒度判定

`src/s-core/models/fixtures/` に、manifest 検証・カバレッジ・各 assertion・対照結果のテストを置く。

```bash
npm test -- --run src/s-core/models/fixtures
npm test -- --run src/s-core/models/import src/s-core/models/engraving
npm test -- --run src/s-core/models/document/extensions/to-svg.test.ts src/s-core/models/browser/score-svg.test.ts
npm test -- --run src/app/dev/load-score-fixtures.test.ts src/components/score-viewer.test.tsx
```

期待結果: 各主条件と FR/US の対応に漏れがなく、符頭・休符・タイ・臨時記号の種類／数／位置／接続先が一致する。対象を欠落・誤接続した対照結果は不合格となる。不完全候補の修正・昇格でも stem/beam と新表記情報が落ちない。jsdom は構造確認であり、フォントの見た目を証明しない。

## 2. 結果ファイルの生成と保存・取得

`scripts/verify-notation-fixtures.ts` で次を実行する。

```bash
node --import tsx scripts/verify-notation-fixtures.ts
node --import tsx scripts/verify-notation-fixtures.ts --persisted
```

前者は自動の非DB段階、後者はそれに専用DBの persisted 段階を追加して実行する。runner は結果を `specs/008-extend-score-notation/verification-results.json` へ原子的に出力する。DB 段階を省略した実行で persisted を合格にしない。テスト失敗は非0終了と段階別 fail/error、未実施は pending/skipped を記録する。通常の npm test はこの証跡を暗黙更新しない。

開発 loader が同ファイルと visual-results.json を読み、現行識別値に一致する結果だけを一覧へ渡す。ファイル欠落・破損・入力変更・描画ソースの未コミット変更・フォント変更をそれぞれ再現し、古い pass が残らないことを確認する。

### 保存・取得の個別検証

既存統合環境を用意し、追加済みのテストを実行する。

```bash
npm run test:integration -- src/server/score-notation.integration.test.ts src/server/score-import.integration.test.ts
```

convertScore → signPreview → saveImport → readScore を通し、取得した score.json を Sheet に読み込み、同じ document assertion を再実行する。タイ・音名・括弧の保持、新規と既存楽譜への取り込み提案・マージ、診断投影、旧データ／旧署名の互換性を確認する。拒否用 fixture は expectedOutcome=reject と rejectionStage を使う。期待するエラー・診断と revision/Git の不変を確認できたら合格で、非適用の描画・保存成功を要求しない。期待外のエラーや拒否されない場合は不合格。保存拒否ケースは converter の事前拒否で代替せず、保存境界まで渡して確認する。DB がなければ未検証と記録し、JSON 往復で代替したと主張しない。

## 3. 実表示

```bash
npm run dev
```

- `/dev/notation/fixtures` で主対象・期待値・段階別結果を確認する。Rendered のみや未実施 visual は合格ではない。
- 各新規正常条件でフォントの読み込み、記号の形状、符頭への接続、括弧、衝突、クリッピングを確認する。
- 固定レイアウトの Horizontal/Vertical/Page でタイを確認し、改行と全ページの両側に継続片があることを確認する。
- `/dev/core/fixtures` と `/dev/mxl/fixtures` の既存入力が表示でき、debug と再レイアウトを繰り返しても幅や要素が増殖しないことを確認する。
- アプリの実際の取り込み画面から代表タイ・異名同音・ナチュラル・括弧を取り込み、保存後に開き直して同じ表示を得る。診断対象の原因・対象箇所・利用可否を確認する。
- [結果契約](contracts/fixtures.md) に従って入力・期待値ハッシュ、現在の rendererRevision、レイアウト、ブラウザー、日時、確認者、各 visualChecklist ID の結果を specs/008-extend-score-notation/visual-results.json に記録する。描画コード・フォントだけを変更しても失効して未検証へ戻ることを確認する。画像だけを意味上の検証の代わりにしない。

## 4. 再生・練習・採点の回帰と最終チェック

```bash
npm test -- --run src/s-core/models/practice src/s-core/models/browser/audio src/s-core/models/import/ties.test.ts
npm test -- --run
npx tsc --noEmit
npm run build
```

加えて変更した TS/TSX に `npx eslint <変更ファイル...>` を実行する。Page route 追加と worker への取り込み変更があるため build を実施する。

期待結果: 対応タイは不要な再打鍵を増やさず、visual-only は演奏・採点に影響しない。音高・開始位置・音価・テンポ・拍子・調号・トラック構成・利用可否を保持する。既存エラー・DB等の環境不足は対象チェックと影響を記録し、未検証を合格扱いしない。

## 完了判断

SC-001–006 の対応条件が満たされ、各 required stage の実結果が確認できること。正常描画で必須の persisted/visual に未実施や失効がある場合は作業完了としない。reject は宣言した requiredStages の期待拒否・不変条件を全て満たせば合格とし、非適用段階の skipped は完了を妨げない。

実ブラウザーレビューでは、直前の verification-results.json から現行 fixture の識別値を参照できる。visual-results.json の run にはその識別値と browser/reviewer/日時を記録し、results は visualChecklist の実際に確認した項目だけとする。未実施の項目や persisted の合格を転記しない。
