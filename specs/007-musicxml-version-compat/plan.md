# Implementation Plan: MusicXMLの複数バージョン取り込みと旧importer互換性

**Branch**: `007-musicxml-version-compat`（実装開始時に006から分離） | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: `specs/007-musicxml-version-compat/spec.md`

setup-planが返すBRANCHはfeature解決名の007であり、実際のGitブランチ変更ではない。before/after_planフック設定はない。仕様・計画の参照は `.specify/feature.json` の007を使う。今回の作業はPhase 1設計までで、コード・依存・DBは変更しない。

## Summary

既存の単一MusicXML変換経路を拡張し、2.0/3.0/3.1/4.0のscore-partwiseをXML/MXLから取り込む。版だけで拒否する条件を、検証済みの対象版と文書構造の判定へ変更する。共通の音楽意味は同じSheet/partial形式へ正規化し、未対応表現を既存のWARNING/BLOCKINGと利用可否判定に接続する。元の版は既存metadata.formatVersionで署名・再検証・Git保存・DB投影まで保持する。バージョンの異なる4つのパーサー、旧importerへの巻き戻し、DB移行は行わない。

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict、Node.js 22（調査環境22.23.3）。

**Primary Dependencies**: 既存Next.js 16.4.0、React 19.2.0、xml2js 0.6.2、JSZip 3.10.2、Zod 4.6.7、HeroUI 2.x。インストール済み版を確認済み。追加・更新なし。XML/ZIPの構文解析は既存公開APIに任せ、サービス固有の音楽正規化のみ実装する。

**Storage**: 既存PostgreSQL/Prisma、Gitのscore/settings/diagnostics/validation成果物。元バージョンは既存文字列列を使用し、既存データの書換え・マイグレーションは不要。

**Testing**: Vitest 4.1.11、既存の単体・専用DB/Git統合試験、Testing Library、実ブラウザー操作。文書作成時にはアプリ試験を追加・実行せず、実装段階で下記の回帰を行う。

**Target Platform**: Linux Node worker/serverと既存ブラウザーImporter。パーサーの純粋な処理へDOM・DB・React依存を追加しない。

**Project Type**: Web application内の楽譜変換機能。

**Performance Goals**: 性能改善の別目標は設けない。既存10秒のworker期限と資源上限を維持し、上限付近の再現可能な楽譜で成功/期限通知を確認する。計測環境・素材サイズ・音数を証跡に残す。

**Constraints**: 入力5MiB、総展開20MiB/100件、10,000音、40,000拍の既存span制限、16段の既存制限、worker heap128MiB、利用者ごと1要求、全体既定4 workers（設定値最大16）を維持。管理設定で低くした入力/期限も尊重。本文読込期限と変換期限を区別。外部取得・危険なZIP path・内部実体を許可しない。

**Scale/Scope**: 対象4版×XML/MXLの8組、音楽意味の正規化、元版表示、拒否理由の案内、署名/保存の回帰。反復展開・新しい演奏表現・全要素実装・別文書構造・MIDI/JSON拡張・描画方式変更は範囲外。

## Constitution Check

Phase 0開始前とPhase 1設計後の両方で確認する。

| 原則         | 設計上の確認                                                                                       | 事前 | 設計後 |
| ------------ | -------------------------------------------------------------------------------------------------- | ---- | ------ |
| I 音楽データ | pitch/start/duration/voice/chord/tie/構成/設定の独立期待値、保存前後比較。過去成果物を再解釈しない | PASS | PASS   |
| II 責務分離  | importモデルで解析・正規化。worker/署名/保存/UIの既存境界を維持                                    | PASS | PASS   |
| III 入力検証 | XML/ZIPと候補の検証、署名metadata改変拒否、権限と安全制限を維持                                    | PASS | PASS   |
| IV 回帰検証  | 4版×2容器、版固有の実表現、旧素材、期待値、境界と実ファイルE2Eを計画                               | PASS | PASS   |
| V 必要範囲   | 単一経路の拡張。無関係なパーサー・描画・認証の変更なし                                             | PASS | PASS   |
| VI 標準機能  | xml2js/JSZip/Zodの既存公開APIを使用。音楽固有処理の比較判断をresearchへ記載                        | PASS | PASS   |
| VII HeroUI   | 既存ImportPreview/状態案内の文言・metadata表示に限定し、既存部品を使用                             | PASS | PASS   |

違反・例外・未解決の設計判断なし。Menuett原本を入手し、root版欠落・標準PUBLIC DOCTYPE=3.0を確認。互換性のためFR-008の限定復元を採用し、未知の版の推定や安全制限の緩和は行わない。

## Project Structure

### Documentation (this feature)

```text
specs/007-musicxml-version-compat/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── score-import.md
│   └── compatibility-matrix.md
└── checklists/requirements.md
```

tasks.mdは次の `$speckit-tasks` で生成する。

### Source Code (repository root)

```text
src/s-core/models/import/
  musicxml.ts / musicxml.test.ts
  convert.ts / convert.test.ts
  mxl.ts / mxl.test.ts
  contracts.ts / diagnostics.ts / diagnostics.test.ts / ties.test.ts
src/s-core/models/browser/importer.ts
src/s-core/models/files/musicxml/                       # 旧モデルの比較資料
src/s-core/models/files/musicxml/extensions/to-sheet.test.ts
src/s-core/fixtures/import/                            # 既存素材・manifestと追加する版別素材
src/s-core/fixtures/files/musicxml/                    # 旧由来の既存MXL16件
src/server/
  import-worker-entry.ts / import-worker.ts / import-worker.integration.test.ts
  import-http.ts / import-http.test.ts
  import-preview-token.ts / import-preview-token.test.ts
  import-revalidate.ts / import-revalidate.test.ts
  score-import.ts / score-import.integration.test.ts
  revision-validation.ts / score-reader.ts
src/app/api/score-import/preview/route.ts / route.test.ts
src/app/api/score-import/revalidate/route.ts
src/components/import-preview.tsx / import-preview.test.tsx
scripts/build-import-worker.mjs
```

**Structure Decision**: 上記は調査・回帰の接点を含む。全部を書き換える指示ではない。主変更はmusicxml/convert、拒否理由のHTTP変換、ImportPreviewの案内。既存のworker・署名・再検証・保存・読込は契約を維持し回帰で確認する。必要ならimport配下に小さいバージョン定義を置くが、独立フレームワークや汎用プラグイン機構は追加しない。

## Phase 0: Research

[research.md](research.md)に旧importer比較、公式の版・voice・duration・DOCTYPE/MXL、実バージョン経路、診断分類、素材と検証依存を記録した。技術的な未決事項は解消済み。現行unsupported-version素材はversion=3.1かつDOCTYPE=4.0であり、正常3.1の代用には使わない。

## Phase 1: Design

1. **版・構造・安全性**: XMLの構文/DOCTYPEを検証し、score-partwiseと明示versionの許可集合を判定する。許可集合以外と、標準PUBLIC DOCTYPEでも版を確定できない欠落は明確に拒否。標準外部DOCTYPEのみオフラインで扱い、内部subset/ENTITYは拒否。DOCTYPEのpublic版情報とroot版が食い違う場合も拒否し、SYSTEM URLから推測しない。root版が欠落し、標準PUBLIC DOCTYPEが対応版を明記する場合のみ、その版を採用してINFOを返す。単一引用符・改行も扱う。
2. **音楽情報**: 既存のduration/divisions、backup/forward、和音cursor、弱起、設定変更、タイの意味を保持する。文字列voiceを保持してからパート内で安定した非負整数IDへ対応させる。数値voiceの既存IDを予約し、別ラベルと衝突させない。`01`と`1`等の区別が解析前に失われないよう、汎用parseNumbersの適用範囲を調整し、clef/beam等が必要とする数値正規化の回帰も行う。旧モデルは比較のみに使う。
3. **元版と互換性**: convertMusicXmlが検証済みformatVersionを返し、convertScoreがmetadataへ渡す。共通の永続schemaをMusicXML enumで狭めない。新規変換のconverterVersionはscore-import-v2へ更新し、旧v1成果物・有効な旧署名を読み続ける。MIDI/JSONは変換識別子の更新以外の内容とformatVersionを変更しない。
4. **診断とUI**: [対応表](contracts/compatibility-matrix.md)と[入出力契約](contracts/score-import.md)に従い、WARNING/BLOCKING/拒否を区別。バージョン・構造エラーを安全な定数コードでHTTPへ伝え、受け入れる版と次の行動を案内する。UIに実際のMusicXML版を表示。解釈不能な演奏要素を黙って捨てない。
5. **検証**: 4版×XML/MXLの保存・再読込、音楽意味の比較、版固有の記法、署名改変、再検証、旧Git/DB成果物、上限・禁止入力、既存MIDI/JSONと旧16素材を確認する。Menuett原本は入手・利用条件・hash・期待値を記録後に一連の実操作を確認する。原本未入手は独立した未完了事項として残す。

設計成果物は[data-model.md](data-model.md)、[contracts/](contracts/score-import.md)、[quickstart.md](quickstart.md)。憲章の再評価は上表の通り全項目PASS。
