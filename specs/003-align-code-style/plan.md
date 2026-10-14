# Implementation Plan: 既存プロダクトの設計・コードスタイルへの整合

**Branch**: `chore/setup-spec-kit` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-align-code-style/spec.md`

Spec Kitが返す論理名は`003-align-code-style`。実際のGitブランチは上記を継続し、切り替えない。

## Summary

機能001の追加変更全体を各領域の既存設計と比較する。s-coreの練習処理は既存のクラス・値オブジェクト・import/exportに合わせ、Performanceが実時間イベントの原本、Timelineが期待値、Evaluatorが照合・分析・採点を所有する。画面とサーバーは共通入口を利用する。計算アルゴリズム、JSON、Git成果物、DB、認証・認可を維持する。方針・対象は[research.md](research.md)と[scope.md](scope.md)に記載する。

## Technical Context

**Language/Version**: TypeScript strict、Node.js 22（package.jsonの>=22 <23）。

**Primary Dependencies**: 現行Next.js 16.4.0、React 19.2.0、Zod 4、Prisma 6、Auth.js 5 beta、remeda、既存音楽パーサー。追加・更新なし。

**Storage**: 現行PostgreSQL/Prisma、楽譜版のGit、演奏イベント・結果のJSONを維持。マイグレーションなし。

**Testing**: Vitestのモデル・ブラウザー・コンポーネント検証とPostgreSQL/Git統合検証、tsc、ESLint、Next build。

**Target Platform**: 現行ブラウザーとNodeサーバー。Web MIDI/Web Audioの制約は機能001を継承。

**Project Type**: Web application with shared music models。

**Performance Goals**: 同じ環境・入力でscripts/benchmark-score-practice.tsの30回測定を前後比較。照合のInputPoolとワーカー分離を維持する。p95が悪化した場合は環境差と変更を切り分け、説明できない悪化を解消する。根拠のない一律閾値は追加しない。

**Constraints**: JSONキー・単位・順序・チェックサム入力を維持。判定規則や音符IDを変更しない。依存増加なし。生イベントの量子化なし。一般的なライブラリ仕様ではなく既存のプロジェクト設計を基準にする。

**Scale/Scope**: [scope.md](scope.md)の8領域。001の追加機能全体を評価し、実際の変更は必要箇所に限定。002メール認証、T079試用、既存の無関係な全面改修は対象外。

## Constitution Check

Phase 0開始前とPhase 1設計後の両方で評価した。

| 原則                    | 設計上の対応                                          | 前 / 後     |
| ----------------------- | ----------------------------------------------------- | ----------- |
| I 正確性・互換性        | Beat維持、Microseconds/TimeOffset、JSONと評価結果比較 | PASS / PASS |
| II 責務分離             | 純粋モデル・ブラウザー機器・UI・サーバーの境界を維持  | PASS / PASS |
| III 入力・保存の検証    | Zodを境界で維持、認可と取引・チェックサムを変更しない | PASS / PASS |
| IV 回帰検証             | 変更前の意味を固定し既存fixtureと境界事例で比較       | PASS / PASS |
| V 必要な範囲            | 領域別の変更判断、既存再利用、理由のある差異のみ      | PASS / PASS |
| VI 標準・ライブラリ優先 | 依存追加・独自認証なし。計算を既存モデルと統合        | PASS / PASS |

未解決事項・正当化が必要な憲章違反なし。読解レビューと回帰の実行は実装後の受け入れ条件であり、ここでは完了扱いにしない。

## Project Structure

### Documentation (this feature)

```text
specs/003-align-code-style/
├── spec.md
├── plan.md
├── research.md
├── scope.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── practice-api.md
│   └── compatibility.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/s-core/models/
├── core/units/                     # Microseconds、TimeOffsetを追加
├── practice/
│   ├── index.ts                    # 公開モデルをまとめる
│   ├── performance.ts              # 演奏原本、import/export
│   ├── conditions.ts               # 検証済み練習条件
│   ├── timeline.ts                 # Timelineモデル、期待値生成
│   ├── tempo-map.ts                # テンポ区間の累積時間
│   ├── evaluator.ts                # live/terminal評価の共通入口
│   ├── contracts.ts                # 外部DTO検証と互換型
│   ├── matching.ts                 # 内部の照合計算
│   ├── analyze.ts                  # 内部の分析計算
│   └── game-evaluation.ts          # 内部のゲーム計算
├── import/                         # 既存パーサー・変換を再利用
└── browser/                        # 既存Recorder/Clock/Sessionを維持
src/components/
├── practice-controls.tsx           # 条件入力と組み立て
├── use-practice-session.ts         # 機器とセッションのライフサイクル
└── use-practice-submission.ts      # 再送・送信結果の制御
src/server/                         # 認可・取引・Git・保存を維持
src/app/actions/                    # 認証・入力・結果の境界を維持
scripts/                           # benchmark、運用入口を維持
```

**Structure Decision**: 既存ディレクトリを利用する。新規ファイルは既存責務を所有するためにのみ設ける。partial importは不完全データ専用の表現を保ち、全サーバー処理をクラス化しない。

## Delivery Sequence

1. 現在の作業ツリーを変更前の基準にし、scopeの各領域で参照例・比較事例を記録する。新旧の同じ実装を互いの期待値にするテストではなく、固定された意味を比較する。
2. 時間値・TempoMap・Performance・Conditions・Timelineを作り、既存DTOと完全な往復互換性を確認する。
3. Evaluatorへliveと終了時の評価を集約し、入力順序・中断・和音・スコアを維持する。内部最適化は変更しない。
4. ブラウザー、サーバー、benchmarkを共通入口へ移行。移行中の委譲を削除し、旧入口の参照が残らないことを確認する。
5. practice-controlsからライフサイクルと送信制御を分離し、他領域はscopeの判断に沿って再利用・命名・境界の必要箇所を整える。
6. 関連検証、全体回帰、統合、型、lint、build、性能比較、保守担当者の読解レビューを記録する。

## Validation and Traceability

FR-001/002/003/010 → scopeと単位・再利用レビュー。FR-004/005 →公開契約と2課題の読解レビュー。FR-006/007 →原本往復と保存互換性。FR-008 →固定事例の照合・分析・採点。FR-009/011 →境界・中断・再送の既存統合検証。各SCの分母はscopeとquickstartの確定事例とし、失敗を除外しない。

## Complexity Tracking

憲章違反なし。既存の適切な関数を内部に維持することは、責務の明確なモデル設計と両立する。具体的な差異の理由はscopeに記録する。

## 分析後の補足

TempoMapは小数の絶対時刻を返し、Timelineが小数originを引いてから丸める。LIVE時刻は符号付き、終了時刻は非負。US3の履歴整理はUS2の履歴検証後に行い、並行作業の結果はreview-notes/T028.md〜T034.mdに保存してscope.mdへ直列統合する。
