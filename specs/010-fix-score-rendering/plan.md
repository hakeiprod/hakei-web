# Implementation Plan: 大きな楽譜の描画無応答の解消

**Branch**: `develop`（setup-planの解決名は `010-fix-score-rendering`。ブランチ作成・切替なし） | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: `specs/010-fix-score-rendering/spec.md`

## Summary

既存Sheet/Engraving/Document/SVG経路を保ち、関連検索の索引化と描画パス単位の計測値再利用で反復計算を減らす。ブラウザーではモデル準備からSVG公開までを取消可能な協調ステップとして実行し、最新の描画世代だけを採用する。音楽情報・記号・配置・改行・ページ・ハイライト契約は保持する。原本によるプレビュー→警告確認→保存→再表示を実ブラウザーで検証する。今回はPhase 1設計までで、製品コード・依存・DB・007の成果物を変更しない。

## Technical Context

**Language/Version**: TypeScript5.9.3 strict、Node22.23.4、React19.2.0、Next16.4.0。

**Primary Dependencies**: 既存のRemeda、Jotai、HeroUI、Bravura、Vitest4.1.11/Testing Libraryを利用。Map、generator、AbortController、Performance、scheduler.yield（機能検出）/setTimeoutを利用し、新規ランタイム依存なし。

**Storage**: 保存済みSheet JSON・既存Git/Prisma成果物は変更しない。派生索引・配置計測・描画ジョブはメモリー内のみ、ジョブ終了時に破棄。新規DB表・migration・ブラウザーストレージなし。

**Testing**: 既存モデル/描画/ブラウザーSVG/UI試験、007の原本意味検証、専用DB/Git保存検証、実Chromium操作。時間の合否は単体のテストtimeoutではなく専用の単独ベンチマークで判定する。

**Target Platform**: 既存ブラウザー画面とLinux Nodeの純粋モデル。標準schedulerがない環境もフォールバックで動く。純粋モデルへDOM/React/Next/Prismaの依存を追加しない。

**Project Type**: Web applicationの描画性能修正。

**Performance Goals**: 参照環境は [baseline.json](measurements/baseline.json)。原本の単独準備約3.04秒を基礎に、モデル構築開始→Document完了は6,500ms以内、ブラウザー初回・再読込の候補受領→表示と操作可能は12,500ms以内、表示条件変更→更新は6,500ms以内。入力/取消/離脱/ページ切替への応答100ms以内（契約の入力受理→対応する画面表示、イベント処理開始前の待ち時間を含む）。各条件5試行の最大値で判定する。モデル構築・DOMを含まない基準測定からの予算配賦であり、達成済みの値ではない。[契約](contracts/rendering.md)で時計の境界・検証条件・既存譜の非悪化基準を固定する。

**Constraints**: 音楽意味の差0、既存描画の意図しない差0。入力5MiB・展開20MiB/100件・10,000音・変換10秒等の既存上限を維持。原本は5,540音/5,346和音/145小節/2パート各2段/1,497slot。長いモデル/DOMループは目標8msで協調実行し、1つのステップが長い場合はさらに細分化する。単なるPromiseラップは禁止。性能未達を音符や記号の間引きで解消しない。

**Scale/Scope**: 原本、既存小MXL、音名・臨時記号・タイ・連桁・TAB・打楽器の既存代表素材、3表示方式、360/1280幅、倍率12/18。モデル構築、レイアウト、Document、SVG、ハイライト、Viewerとその初期化境界が対象。新記譜・変換意味・音声合成方式・採点・認証・保存基盤・UI全体刷新は範囲外。

## Constitution Check

Phase 0前とPhase 1設計後に確認した。違反・例外なし。

| 原則 | 設計上の根拠 | 事前 | 設計後 |
| --- | --- | --- | --- |
| I 音楽情報 | 入力を不変としてジョブへ渡し、007の全音符期待値・保存前後一致と旧描画基準を照合 | PASS | PASS |
| II 責務分離 | 純粋なステップ/索引はモデル、時間・取消・DOM・画面状態はブラウザー/UI | PASS | PASS |
| III 入力検証 | 既存の候補検証・権限・署名を維持、表示ジョブは保存経路を持たない | PASS | PASS |
| IV 回帰検証 | 原本・既存譜の意味/Document/SVG/目視/実操作と独立ベンチマーク | PASS | PASS |
| V 必要範囲 | ジョブ所有と終了時解放、既存表示を維持して関連計算だけ改善 | PASS | PASS |
| VI 標準機能 | Map/generator/AbortController/標準task yield、Worker/新描画ライブラリとの比較をresearchへ記載 | PASS | PASS |
| VII HeroUI | 既存Viewerへ処理中・再試行・失敗の既存部品とrole=status/alertを追加 | PASS | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/010-fix-score-rendering/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/rendering.md
├── quickstart.md
├── measurements/baseline.json
├── measurements/baseline-probe.mts
└── checklists/requirements.md
```

tasks.mdは次のspeckit-tasksで生成する。

### Source Code (repository root)

```text
src/s-core/models/
  sheet/score.ts, slot.ts, chord.ts, stave.ts, bar.ts, masterbar.ts, row.ts
  sheet/controller.ts, layout-index.ts (new), render-steps.ts (new)
  engraving/controller.ts, score.ts, stave.ts, geometry.ts
  engraving/extensions/to-document.ts, notation/ties.ts
  document/extensions/to-svg.ts
  browser/render-score.ts (new), render-scheduler.ts (new)
  browser/bind-note-highlights.ts
src/components/
  show-score.tsx, score-viewer.tsx, score-fixture-gallery.tsx
  import-preview.tsx, form-create-score.tsx (existing lifecycle integration only)
scripts/benchmark-score-rendering.ts (new, Setup)
scripts/verify-score-rendering-browser.mjs (new, Setup; before/after measurement shared)
src/s-core/models/{sheet,engraving,browser}/...test.ts
src/components/{score-viewer,show-score,import-preview}.test.tsx
src/server/score-import.integration.test.ts (existing persistence regression)
```

**Structure Decision**: 既存モデルを再利用。上記は関連箇所であり全ファイルの変更指示ではない。モデル生成の共通ステップから同期/非同期をdrainし、別々の描画計算を二重実装しない。ShowScoreのrender中に重いSheet/Engraving importを残さない。純粋なconstructorへブラウザー時刻を埋め込まず、重い構築ループを共通builder/stepsへ移して既存同期importもそこを利用する。同期APIは既存のNode/小さい試験用に維持する。

## Phase 0: Research

[research.md](research.md)で関連全件検索、重複layout、UI同期初期化、取消境界、Document/SVGとハイライトの関係を調査した。原本と小素材を各3回計測し、方式と数値予算を確定した。観測打切りを完了値として扱わない。原本の完全な基準描画取得は実装前の必須ゲートであり、今回取得済みとは報告しない。

## Phase 1: Design

1. **基準を固定**: Setupでモデル/ブラウザー両方の計測ツールを用意し、入力受理から表示までの同一時計計測を固定してから変更前基準を取得する。ブラウザー機能の作成をUS1の検証段階まで遅らせない。製品編集前に現行ソース・フォントのchecksum付きコピー、原本/既存譜の旧Document/SVGを保存。遅い原本の採取は別プロセスのoffline試験で行い、未完了なら基準取得タスクを未完了にする。
2. **Scoreの索引**: notesByChordIdを再利用し、chordsByBeat、chordById、slotByChord、beamGroupsByStave、bars/stavesByCompositeKey等を構築。複合キーはtrack/bar/staveを含む。重複・境界・配列順・Beat比較を保持し、キャッシュはexportへ混入させない。
3. **描画パス**: natural widthsはglyph/clefを準備した後で計算。行頭の再clefが変わった小節は再測定。改行確定後のspaceで配置幅を更新し、slot/masterbar/rowの座標を既存の加算順で前から計算する。条件変更は新generationを作り、前パスを再利用しない。準備とlayoutの重複を結果同等性の確認後に除く。
4. **協調実行**: 構築、notation/tie解決、glyph/和音、各小節、Document要素、SVG要素、highlight接続を中断可能なステップにする。全件sort等の一括処理も計測し、応答予算を超える単位を残さない。ブラウザーに8ms目標のdrainとAbortSignal、同期利用に通常drainを提供。
5. **画面と所有**: [data-model](data-model.md)の世代状態機械を共有Viewer/ギャラリーへ接続。ShowScoreのaudio/Engraving初期化も同じ入力世代で遅延・協調化し、最新のScoreのglyphだけを音声highlightへ結ぶ。未接続SVGを最後に公開し、離脱/失敗で購読・timer・参照を解除する。
6. **回帰と性能**: [契約](contracts/rendering.md)の5試行、3方式×2幅×2倍率を検証。007の原本意味検証・署名/保存/再読込と実ブラウザー操作を再利用し、UI成功とモデル成功を分けて記録する。最終的に全単体・型・lint、必要な専用統合と本番buildを行う。

Phase 1成果物: [data-model.md](data-model.md)、[contracts/rendering.md](contracts/rendering.md)、[quickstart.md](quickstart.md)。未解決の仕様質問や技術選択はない。目標達成・原本の完全基準・実機音声の検証は今後の実装検証であり未実施。


### T004取得方法の実装時確定

無加速の原本全体取得が30分で打切りとなったため、research.mdの参照専用メモ化を独立同等基準として検証・採用した。旧getterを変更せず、不変入力の強制検査と全getter再計算一致、既存84条件での旧出力byte一致を根拠に原本12条件を取得した。製品向け索引・新しい配置計算から期待値を作らず、表示保持条件・数値予算・5試行条件も変更しない。

### T018での所有・入力処理の補足

SVGを保持するbody配下の専用surfaceと元の位置を確保するplaceholderを分ける。unmountは世代無効化・binding/observer解除・非表示を同期で完了し、物理DOMだけをidle優先の小さい単位で撤去する。source検証は従来schemaそのものを専用Workerで実行し、postMessage前の重複cloneを除く。実装詳細と対照測定方法はresearch.mdのT018節へ記録し、描画契約・予算・全試行判定は変更しない。


### T031で確認した音声準備の追加対象

実操作trace/CPU profileでUI待ちを増やしていた `src/s-core/models/audio/track.ts` のkeyRangeだけを追加対象とした。NonNegativeIntSchemaを保持してgetter呼出し内で同値検証を再利用し、最小/最大の選択を一走査にする。音域・同値の参照選択・空/不正値の扱い・音楽/保存/描画・合成方式を変更しない。根拠と旧処理対照はresearch.mdのT031節。性能は回数削減だけで判定せず、実操作各5回と最終性能検証で確認する。
