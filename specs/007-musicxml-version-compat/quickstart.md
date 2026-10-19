# Quickstart Validation: MusicXML version compatibility

この手順は実装後の検証用。計画作成時点ではアプリ変更・新しい検証を実施していない。契約は[contracts/score-import.md](contracts/score-import.md)、対象内容は[対応表](contracts/compatibility-matrix.md)、保存形式は[data-model.md](data-model.md)参照。

## 1. 前提と素材

- Node.js22、既存依存を導入済みの環境を使う。新規環境では `npm ci` と `npx prisma generate` を実行する。
- [開発手順](../../docs/development.md)に従い、個人/本番と分離した末尾 `_test` DB、専用Gitルート、独立したMailpitを用意する。稼働DB/.envを試験用に書き換えない。
- 各版XML/MXLの素材と独立期待値・出所・利用条件を揃える。Menuettはユーザー報告の原本を入手して確認し、同名の別配布ファイルで置き換えない。
- version/構造、音符・声部・和音・タイ、設定変更、期待issues/利用可否、hashを記録する。原本未入手や実施不能は検証記録に未実施と残す。

## 2. 単体・型・lint・build

リポジトリルートで実行する。

```bash
npm test -- --run src/s-core/models/import
npm test -- --run src/s-core/models/files/musicxml/extensions/to-sheet.test.ts
npm test -- --run src/server/import-preview-token.test.ts src/server/import-revalidate.test.ts src/server/import-http.test.ts src/app/api/score-import/preview/route.test.ts src/components/import-preview.test.tsx
npm test -- --run
npx next typegen
npx tsc --noEmit
npx eslint src/s-core/models/import src/server/import-http.ts src/server/import-http.test.ts src/components/import-preview.tsx src/components/import-preview.test.tsx
EMAIL_SERVER= EMAIL_FROM= npm run build
```

実際に変更した別ファイルもlint対象へ追加する。buildの空メール設定はそのプロセスに限定し、開発用平文SMTPの本番拒否を避ける既存手順。認証設定の修正ではない。worker bundleはprebuildで再生成される。workerだけを検証する前にも `npm run build:import-worker` を実行する。

期待結果: 対象4版が成功し、真の未対応版/構造と不正入力は適切に拒否。全既存回帰が成功する。ケース数だけでなく音楽情報と元版の実値を比較する。

## 3. 専用DB/Git統合

専用環境の `TEST_DATABASE_URL`、`SCORE_GIT_ROOT`、試験用認証/署名/メール設定を開発手順に従って用意する。値や秘密を公開ログへ出さない。統合スイートはDB名が `_test` でない場合に拒否する。

```bash
npm run test:integration -- src/server/import-worker.integration.test.ts src/server/score-import.integration.test.ts
npm run test:integration
```

worker -> signed preview -> correction -> save -> Git settings/DB projection/readbackで、元版・候補・確認事項・利用可否を照合する。metadata改変は拒否、有効な旧v1成果物・metadata:null・設定成果物なしの旧revisionは従来通り読む。原子性と権限不足・再試行も確認する。

## 4. ブラウザー操作

1. 編集可能な利用者でログインし、新規リポジトリを作成する。
2. そのリポジトリの楽譜作成から、4版×XML/MXLの8組を順にアップロードする。書き出し直しやversionの手編集を行わない。
3. 元版の表示、対応版の案内、音符と設定、警告、利用可否を期待値と比較する。
4. 警告確認、音符の修正と再検証、取消、再アップロードを操作する。音楽上のBLOCKINGは確認チェックだけでは消えない。
5. 保存し、再表示と版情報、内容を比較する。演奏可能な例は表示・再生・練習/ゲームへの移動を確認する。利用不可例では開始できないことを確認する。機器や音声の代替を使った場合は証跡へ明記する。
6. Menuett原本で同じ新規リポジトリ作成後の一連の操作を実施する。実版、元ファイルhash、確認事項、保存結果、利用可否を記録する。
7. 対象外版、version欠落、timewise/opus、不正入力を入れ、対応範囲と次の行動が分かる案内を確認する。通信失敗・取消・再試行でも既存データが変化しない。

既存HeroUIを保ち、キーボード操作・状態案内の読み上げ、狭い画面で元版の表示が欠けないことも確認する。UI全体の再設計はしない。

## 5. 安全性と記録

外部DOCTYPEを持つ正常例（一重/二重引用符・改行・PUBLIC/SYSTEM）、内部subset/ENTITY、宣言不一致、危険なZIP path、複数rootfile、破損圧縮、総展開量/件数/入力/音数/span/期限の境界を確認する。ネットワーク取得はテスト用の制御で検知し、実データや秘密を外部送信しない。小さい制限値で分岐を検証するケースと、既定上限の実測を区別する。

実装時のvalidation.md等に、各SC/FR・素材・期待値・実測・環境・日時・未実施事項を対応付ける。Menuett原本の検証が未実施ならFR-014/SC-004は未完了とする。ライブラリの警告や単体成功を実音声・実機成功と扱わない。

## 次のコマンド

この計画から作業単位を作る:

```text
$speckit-tasks
```

その後 `$speckit-analyze` → `$speckit-implement` → `$speckit-converge`。

## Menuett原本による確認

原本はsrc/s-core/fixtures/files/musicxml/Menuett_in_G-Dur_BWV_Anh._114.mxlに利用者が追加済み。版属性を手編集せずアップロードする。3.0が標準DOCTYPEから復元されたINFO、208音符・2パートと警告を確認して保存する。再表示後も同じ元版と候補が保存されていることを照合し、反復6件がBLOCKINGのためpractice/gameは開始できないことを確認する。
