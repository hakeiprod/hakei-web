# Implementation Plan: 楽譜描画の基礎回帰・タイ・臨時記号

**Branch**: `fix/issue-51-barline-clearance` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Input**: `specs/008-extend-score-notation/spec.md`

セットアップが返した BRANCH `008-extend-score-notation` は feature の識別に使用する値。実際の Git ブランチは上記で、今回ブランチの作成・切り替えは行わない。仕様ヘッダーの旧ブランチ名は作成時点の記録。

## Summary

現行の Sheet を拡張して元の音名・明示臨時記号・視覚的タイを任意項目として保持する。音楽的タイの既存 ties は維持する。臨時記号を小節単位で解決して幅計算前に配置し、配置確定後の符頭座標からタイ曲線を生成する。Document と SVG の既存経路を延長する。

細粒度 fixtures に主条件と段階別の期待値を付け、取り込み・モデル往復・実保存取得・描画要素・SVG・実ブラウザーの確認を分ける。SVG 生成の成功を記号の合格と扱わない。具体的な契約は [data-model.md](data-model.md)、[notation.md](contracts/notation.md)、[fixtures.md](contracts/fixtures.md) に定義する。

## Technical Context

**Language/Version**: TypeScript strict（package.json: ^5）、Node.js >=22 <23。

**Primary Dependencies**: 既存 Next.js 16.4.0、React 19.2.0、Zod ^4.4.3、xml2js ^0.6.2、JSZip ^3.10.1、同梱 Bravura/SMuFL、HeroUI ^2.8.5。新規依存なし。API の使用可否はリポジトリの型と既存使用箇所で確認する。

**Storage**: 既存 Git score.json と診断・設定ファイル、Prisma/PostgreSQL の既存投影。任意 JSON 項目を追加し DB マイグレーションは不要。

**Testing**: Vitest ^4.0.6、jsdom 27.1.0、Testing Library、専用 PostgreSQL を使う既存統合ハーネス。実ブラウザーで Bravura とページ境界を目視確認。Playwright の新規導入は含めない。

**Target Platform**: Node サーバーと既存 SVG 対応ブラウザー。モデルは DOM 非依存。

**Project Type**: Next.js Web アプリケーションと音楽ドメインモデル。

**Performance Goals**: 一律の時間閾値は設けない。同じ実行環境・入力・レイアウトで前後を比較し、タイ接続は索引、臨時記号は時刻別走査を使う。既存10,000音制限内で全音対全音の探索を避ける。

**Constraints**: MusicXML 2.0/3.0/3.1/4.0 score-partwise XML/MXL、旧 JSON 互換、既存署名・認可・入力制限を維持。視覚的タイから再打鍵意味を生成しない。

**Scale/Scope**: FR-003 の基礎記号全条件、タイの単独・境界・不正条件、5種類の臨時記号と表記・状態条件。スラー等の後続候補は対象外。P1/P2 とも必須。

## Constitution Check

研究前の gate と設計後の gate を確認。未解決事項・正当化が必要な違反なし。

| 原則 | 設計の対応 | 研究前 | 設計後 |
| --- | --- | --- | --- |
| I 正確性・互換性 | 音楽値は維持、表記は任意追加、旧資料は既存推定、明示診断 | PASS | PASS |
| II 責務分離 | Sheet に意味、Engraving に配置、Document に曲線、DOM は SVG adapter | PASS | PASS |
| III 境界検証 | 共通 Zod を完全／不完全候補に適用、音高整合性、署名・原子的保存を維持 | PASS | PASS |
| IV 回帰 | 小さい fixtures、段階別 assertion、対照入力、実保存取得・実ブラウザー確認 | PASS | PASS |
| V 必要範囲 | 既存 renderer を延長、無関係な画面・音声・認証の変更なし | PASS | PASS |
| VI 既存機能優先 | 既存 XML/ZIP/Zod/SMuFL/SVG を利用。可変長タイの最小曲線要素だけ追加 | PASS | PASS |
| VII UI | 確認一覧の Card/Button/Table/Chip 等は既存 HeroUI を優先 | PASS | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/008-extend-score-notation/
├── spec.md
├── investigation.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── notation.md
│   └── fixtures.md
└── checklists/requirements.md
```

`tasks.md` は次の $speckit-tasks で生成する。

### Source Code (repository root)

```text
src/s-core/models/
├── import/{musicxml,score-schema,contracts,promote-partial,diagnostics,convert}.ts
├── sheet/{note,score,controller}.ts
├── sheet/notation/             # 新規: 共通表記型、検証可能な接続・臨時記号解決
├── engraving/{note,chord,controller}.ts
├── engraving/extensions/to-document.ts
├── document/{element,index,curve}.ts   # curve.ts 新規
├── document/extensions/to-svg.ts
├── fixtures/                   # 新規: manifest 型・段階別判定、DOM 非依存
├── browser/score-svg.test.ts
└── practice/{timeline,matching,game-evaluation}*.ts  # 主に回帰テスト
src/s-core/fixtures/notation/    # 新規 manifest と最小入力・期待値
src/app/dev/load-score-fixtures.ts
src/app/dev/notation/fixtures/page.tsx  # 新規開発専用入口
src/components/score-fixture-gallery.tsx
src/server/score-notation.integration.test.ts  # 新規、既存 harness 利用
```

**Structure Decision**: 現行の import → Sheet → Engraving → Document → SVG を維持する。表記解決と fixture 判定を純粋な関数に分け、React やサーバー依存をモデルに入れない。追加ファイル名は tasks で固定する。

## Phase 0: Research

[research.md](research.md) に選択理由・却下案・ローカル根拠を記録した。調査対象は保持・タイ意味の分離、曲線とページ境界、fixtures と永続保存検証。技術的な未解決事項なし。

## Phase 1: Design

1. **共通表記と境界**: 任意 notatedPitch / explicitAccidental / visualTies を完全・不完全候補と Note の import/export に追加。promotion の手動組み立ても更新する。JSON の矛盾は境界で拒否し、音楽情報の不明な取り込みは既存 partial と診断に残す。
2. **基礎 fixtures と判定**: manifest に1主条件、意味上の selector、期待値、レイアウトを記述。既存 Core/MXL fixtures はパス参照して識別子を維持し、メタデータ JSON を楽譜と誤認しない専用 loader を作る。
3. **臨時記号・位置**: 元表記を優先して五線位置を決め、調号と時刻別の小節状態を純粋処理で解決する。glyph と括弧の幅を chord/slot の配置前に含める。現在 accidentalGlyph の消費箇所はあるが代入経路がないため、♯・♭の基礎描画も確認対象に含める。
4. **タイ**: 音楽的 ties は既存診断・timeline に維持。視覚的接続を別解決し、符頭境界・和音・符幹方向から曲線と上下の余白を決める。余白込みで row 高さとページ割当を確定してから、各 system 内の曲線を Document へ出す。改行／改ページは継続2片とし全ページを gallery で確認する。
5. **統合と利用者表示**: 保存署名と revision 投影は既存 API を使い、新 endpoint は追加しない。表示警告と音楽的 blocker を区別。loader は新 manifest 入力を現行 converter に通し、処理と検証状態を一覧表示する。
6. **検証**: FR/US → fixture → assertion の追跡表で未網羅を検出する。jsdom の構造検証と実ブラウザーの見た目を分ける。実保存取得後に同じ描画 assertion を再実行し、音楽 timeline の回帰を比較する。

## Validation and Handoff

[quickstart.md](quickstart.md) の順で単体・SVG・実保存取得・ブラウザー確認を行い、最後に全回帰・型検査・変更箇所 lint・build。文書作成段階ではアプリテスト未実行。今回の成果は設計文書のみ。次は $speckit-tasks。

## Complexity Tracking

憲章違反なし。新しい汎用 renderer／解析ライブラリは導入しない。既存の glyph と直線だけでは任意距離・継続タイの形状を表せないため、限定された三次曲線要素を Document に追加する。
