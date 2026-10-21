# Implementation Plan: TAB譜・ドラム譜

**Branch**: 既存ブランチを維持 | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Input**: specs/009-tab-drum-notation/spec.md。setup-planのBRANCH=009-tab-drum-notationはfeature識別値であり、ブランチ切替はしない。

## Summary

既存の import → Sheet → Engraving → Document → SVG を拡張する。譜表別の種類・線数、TABの弦・フレット、無音高打楽器の表示位置・符頭と楽器対応を保存する。完全候補の構造を維持し、完全候補では、完全なTAB／打楽器の打音表記と、打楽器譜の休符にpitch:nullを許可する。不完全候補の通常音符も音高不明をnullで保持できる。表示と演奏の可否を分け、架空の音高を補わない。

TABは同梱数字glyphを並べた数字列を描き、譜線を境界で分割する。ドラムは既存の通常／×符頭を使用する。譜表の座標変換、異種譜表の縦配置と冒頭幅を解決し、数字列を含む明示アンカーにタイを接続する。

## Technical Context

**Language/Version**: TypeScript strict、Node >=22 <23。

**Primary Dependencies**: 既存Next.js16.4.0、React19.2.0、Zod4、xml2js、JSZip、Bravura/SMuFL、HeroUI。新規依存なし。採用APIは既存コード・ローカル型定義から確認した。

**Storage**: 既存Gitのscore.jsonと診断・validation、Prisma/PostgreSQL投影。任意JSON追加と限定的なnull許可。DB migration不要。

**Testing**: 既存Vitest/jsdom、専用DB統合ハーネス、実ブラウザーで形状確認。新ブラウザーライブラリを導入しない。

**Target Platform**: Nodeサーバー、SVG対応ブラウザー。純粋モデルにDOM/DB/React依存を追加しない。

**Project Type**: Next.jsアプリと音楽ドメインモデル。

**Performance Goals**: 既存10,000音・入力サイズ・区間上限を維持。同時刻／譜表／弦のMapを用い、重複検出・線分割で全音対全音探索を避ける。同じ入力・環境・配置で時間・要素数と再配置不変を比較し、一律閾値は置かない。

**Constraints**: XML/MXLのMusicXML2.0/3.0/3.1/4.0 score-partwiseと新旧Sheet JSON。既存署名・認可・原子的保存を維持。ドラム演奏・専用採点、運指生成は追加しない。

**Scale/Scope**: 6弦／4弦TAB・フレット0–36、5線ドラム9楽器・通常／×符頭、リズム、通常譜との混在・同一パート併記・改行改ページ。全3ストーリー必須。

## Constitution Check

| 原則 | 研究前の方針 | 設計後 |
| --- | --- | --- |
| I 正確性・互換性 | 表示位置と演奏識別を分離、旧データを維持 | PASS: nullは実際の欠如。推測運指・架空音高なし |
| II 責務分離 | 既存モデル責務を維持 | PASS: 純粋capabilitiesとgeometry、DOMはadapter |
| III 入力・永続検証 | Zodと既存保存境界 | PASS: 相互参照・値域検査、署名前改変なし、DB列変更なし |
| IV 回帰 | 小さいfixturesと対照結果 | PASS: 全保持段階・文字実体・位置・実ブラウザーを分離 |
| V 必要範囲 | 既存rendererを延長 | PASS: nullable化は無音高保持に必要。影響する消費箇所を限定監査 |
| VI 既存機能優先 | 同梱glyph・既存検証／保存 | PASS: 数字列は既存Group/Glyphで構成、新汎用描画基盤なし |
| VII HeroUI | 既存確認一覧・preview拡張 | PASS: 状態・操作は既存HeroUIを使用 |

DB未実施は利用者指定の検証保留であり、SC-002達成や全体完了を意味しない。008の未検証証跡も引き継ぐ。

## Project Structure

### Documentation (this feature)

```text
specs/009-tab-drum-notation/
  spec.md, investigation.md, plan.md, research.md, data-model.md, quickstart.md
  contracts/notation.md, contracts/fixtures.md
  tasks.md                     # 次のspeckit-tasksで生成
```

### Source Code (repository root)

```text
src/s-core/models/
  core/{note,score}.ts
  core/extensions/generate-beams.ts
  sheet/{note,stave,track,score,chord}.ts
  sheet/notation/{schema,ties,accidentals,capabilities,staff-settings}.ts
  sheet/extensions/to-audio.ts
  import/{score-schema,contracts,musicxml,promote-partial,diagnostics,convert}.ts
  engraving/{note,chord,stave,geometry,controller}.ts
  engraving/notation/{staff-geometry,tablature,ties}.ts
  engraving/extensions/to-document.ts
  document/{element,group}.ts
  document/extensions/to-svg.ts
  fixtures/{manifest,evaluate,prepare,results,tab-drum}.ts
  browser/evaluate-fixture-svg.ts
  audio/note.ts
  practice/timeline.ts
src/s-core/fixtures/tab-drum/{manifest.json,tab/,drums/,mixed/}
src/components/{import-preview,show-score,score-fixture-gallery}.tsx
src/app/dev/load-score-fixtures.ts
src/app/dev/notation/fixtures/page.tsx
src/app/score/[id]/{page.tsx,practice/page.tsx}
src/server/{score-reader,revision-validation,import-revalidate,practice}.ts
src/server/score-tab-drum.integration.test.ts
scripts/lib/notation-report.ts
scripts/verify-notation-fixtures.ts
```

**Structure Decision**: 008の既存経路を再利用し、009 suiteを追加。新HTTP endpoint、DB migration、生成MusicXML型の手編集はしない。名称とテストの割当はtasksで固定する。

## Phase 0: Research

[research.md](research.md)に2つの読み取り調査の判断を統合。nullable音高、演奏ガード、譜表別配置、数字列と譜線、fixture suite分離を解決済み。

## Phase 1: Design

1. 共通Zodで譜表設定とTAB／打楽器表記を検証。Core.Noteのpitchをnullableにし、Core.Score.keyRange等の利用箇所を監査。完全な通常発音音符とCore JSON入力の数値必須は維持し、不完全候補の音高不明を拒否しない。打楽器譜の休符はrest:trueと譜表種別で識別し、打音表記を要求しない。
2. MusicXMLから譜表設定・弦／フレット・無音高位置・符頭・楽器対応を抽出。完全／不完全候補、promotion、編集再検証、JSON往復で保持する。
3. capabilitiesを候補から導出し、描画可能な完全Sheetを演奏不可でも表示。既存永続validationの形は維持する。ドラムを既存ピアノ経路へ渡さない。
4. 譜表別geometryで位置と高さ、先行譜表・トラック累積位置を計算。小節冒頭のヘッダー最大幅を共有して拍をそろえる。
5. TAB数字列の確定幅とアンカー、譜線分割、タイ接続。通常／×符頭と明示ドラム位置、既存リズムを接続する。
6. 既知suite設定で008/009のmanifest・テスト・結果パスを分離。全主条件の肯定／対照・保存・実表示を段階別に確認。表示不可の保存可能な不完全候補はfixture outcome=partialで期待保持と診断を確認する。最終コード・版更新後に両suiteの自動検証と失効した目視条件を再実行して現在版の証跡を記録する。

契約は[data-model.md](data-model.md)、[notation.md](contracts/notation.md)、[fixtures.md](contracts/fixtures.md)。

## Validation and Handoff

[quickstart.md](quickstart.md)に従い実装後に検証する。今回は計画文書のみで、アプリテスト・DB・目視は実行していない。次は $speckit-tasks → $speckit-analyze → $speckit-implement。

## Complexity Tracking

憲章違反なし。nullable化は無音高を偽装せず保存するために必要。新candidate形式／別rendererは既存表示・署名経路を二重化するため採用しない。数字列は既存Group/Glyphで表現し、汎用Textレイアウト・新フォント依存は導入しない。
