# Implementation Plan: 楽譜の共同メンテナンスとMIDI練習・リズムゲーム

**Branch**: `chore/setup-spec-kit`（実際のGitブランチ。Spec Kitの論理FEATUREは001-score-practice-platform） | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: `specs/001-score-practice-platform/spec.md`

## Summary

既存のNext.jsアプリと音楽モデルを拡張し、楽譜の版・編集案・マージ権限、
MIDI演奏の記録と分析、個人の履歴とゲーム判定を段階的に追加する。
MusicXML・MIDI・楽譜JSONの取り込みをs-coreの共通変換契約にまとめる。
MIDIは元の時刻を保持する方法と指定単位への整列をプレビューで選べる。
元ファイルは変換中だけ保持し、保存後は変換済み楽譜・設定・警告だけを残す。
投票は実装しない。全ユーザー編集では運営設定の信頼度基準、招待限定では明示的な権限でマージする。
Gitで候補コミットを準備し、DBで認可・版索引・採用先端・実績を同時確定する。Git refは回復ジョブで同期する。
音楽情報と表示情報を区別し、分析・ゲーム・基準再生に同じ純粋な演奏タイムラインを利用する。

本成果物は設計であり、アプリケーション変更、DBへの適用、タスク生成は行わない。

## Technical Context

**Language/Version**: TypeScript strict、React 19.2、Next.js 16.4.0。
実装検証はCIと同じNode.js 22へ揃える。Dev ContainerはNode.js 22へ更新済み。

**Primary Dependencies**: サーバーのGit CLI（実行時依存）とNode.js標準child_process。 既存のAuth.js v5 beta・Prisma Adapter、Prisma 6.18、Zod 4、
HeroUI、XState、Jotai、xml2js、JSZipを維持し、SMF解析はmidi-file 1.2.4の公開APIを使用する（binary-parserは他の既存形式で維持）。新しい状態管理・描画基盤は導入しない。認証UIはnext-authの組み込み画面、署名はNode.js標準cryptoを使う。

**Storage**: 永続ボリューム上のbare Gitで本文・履歴、PostgreSQL/Prismaでコミット索引・編集案状態・権限・演奏記録・信頼度台帳。
楽譜データは既存のSheet.Score.export形式をGitの版付きJSONで保持し、生成Prisma/Zodを直接編集しない。

**Testing**: Vitest 4・Testing Library、純粋モデルのフィクスチャ、実PostgreSQLでの認可・競合試験、
対応ブラウザーとMIDI機器による手動シナリオ。Node環境テストとjsdomを用途別に選ぶ。

**Target Platform**: HTTPS上のWebアプリ。MIDI演奏はWeb MIDI対応デスクトップブラウザーで検証する。
未対応環境では閲覧・編集・履歴を利用可能にし、MIDIの利用不可を表示する。

**Project Type**: Next.js App Routerの単一Webアプリ。Server Components、Server Actions、
既存の認証Route Handlerと同一アプリ内の取り込みRoute Handlerを使い、独立したAPIサーバーは追加しない。

**Performance Goals**: 製品SLOは未指定。設計検証の暫定目標は、Node.js 22・4CPU/8GB・ローカルDBと
10,000期待音/50,000入力イベントのデータで分析p95 2秒以内、一覧50件の取得p95 500ms以内。
各30回の計測で環境・サイズ・結果を記録する。採点の±30msは入力時刻の判定幅であり、通信遅延目標ではない。
未達時は索引・走査範囲・UIブロックを調査して再測定し、製品SLOとしては扱わない。

**Constraints**: 信頼度未設定時の全ユーザー編集マージを拒否する。
演奏中の記録・判定は通信往復に依存させず、保存時にサーバーが再検証・再計算する。
古い版の結果を新しい版で再評価しない。
未解決の演奏情報を持つ版では、サーバーも練習・ゲームの開始と結果保存を拒否する。
元ファイルや整列前の別コピーをDB・オブジェクトストレージに保存しない。MIDI機器・OAuth資格情報は運用環境の前提条件。

**Scale/Scope**: 初版の6利用者シナリオ、24要件、13成功基準。
初期の設計上限は楽譜JSON/演奏アップロード各5MiB、セッション100,000入力イベント、30分（正の入力補正と判定幅の末尾待機を追加）、
一覧1回50件。取り込み元5MiB、MXL展開総量20MiB・100エントリー、
変換対象10,000音、処理時間10秒を初期防御上限とする。期限超過は中止して一時データを解放する。
MXLのサイズ申告だけを信用せず実展開量にも上限を適用する。上限は運用設定で調整し、超過時に明示的エラーを返す。製品の確定上限ではない。
同時アクセスの保証値は設けず、2人の同時マージと設定・権限変更の競合を必須検証する。

## Constitution Check

_GATE: Phase 0前およびPhase 1後に評価。_

| 原則                         | 設計上の根拠                                                                               | 調査前 / 設計後 |
| ---------------------------- | ------------------------------------------------------------------------------------------ | --------------- |
| I. 音楽データの正確性        | 既存JSON保持、不変の版、単位変換、テンポ積分、非破壊変換、未対応診断、明示的MIDI整列テスト | PASS / PASS     |
| II. 責務分離                 | s-coreの純粋モデル、browserの機器接続、serverの認可・DB、componentsのUI                    | PASS / PASS     |
| III. 入力・永続データの検証  | Zod境界、全入口の認可、OCC、入力形式/容量/展開量検証、明示的移行                           | PASS / PASS     |
| IV. 回帰検証                 | 音楽フィクスチャ、時刻・機器の代替、DB競合、権限境界、実機検証                             | PASS / PASS     |
| VI. 標準機能とライブラリ優先 | Git CLI、next-auth、Zod、Prisma、標準cryptoの公開APIを利用                                 | PASS / PASS     |
| V. 変更範囲と寿命            | 既存UI再利用、段階公開、購読・音声解放、独立APIや投票の追加なし                            | PASS / PASS     |

認証設定なし、既存の無認可アクセスは実装前提の不足として計画に含める。
既存データの所有者を推測しない。運営による移行確認が完了するまで未管理データは公開しない。
正当化を必要とする憲章違反はない。Phase 0は[research.md](research.md)、Phase 1は以下の設計で完了。

## Project Structure

### Documentation (this feature)

```text
specs/001-score-practice-platform/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── server-actions.md
│   ├── midi-evaluation.md
│   ├── score-import.md
│   └── git-versioning.md
└── checklists/requirements.md
```

`tasks.md`は後続のspeckit-tasksで生成する。

### Source Code (repository root)

```text
prisma/schema.prisma, migrations/        # 実装時に拡張
src/auth.ts, prisma.ts                   # 既存認証・DB接続
src/server/                             # 認可・Gitアダプター・採用/回復・信頼度・履歴
src/app/repositories/, practice/, admin/ # 新規: リポジトリ・練習結果・運営画面
src/app/score/                           # 表示・作成・取り込みプレビューを認可経路へ統合
src/app/api/score-import/preview/        # 新規: 原本を永続保存しない変換入口
src/app/actions/                        # 小さな検証済みServer Action
src/components/                         # 既存viewer/playerと新規編集案・分析UI
src/s-core/models/core/, sheet/, document/, audio/ # 既存モデル
src/s-core/models/import/                # 新規: 形式選択・変換診断・整列
src/s-core/models/practice/              # 新規: 純粋なtimeline/matching/evaluation
src/s-core/models/browser/               # 機器選択・記録・セッション時刻
src/s-core/fixtures/                     # 既存と新規の境界データ
src/server/**/*.test.ts                  # Node + PostgreSQL統合試験
```

**Structure Decision**: 単一アプリ内で既存の責務を維持する。
環境依存の認可・DBをsrc/serverへ置き、純粋な音楽処理にReact/Prisma依存を追加しない。

## Complexity Tracking

憲章違反なし。追加の独立サービス・イベント基盤・自動マージ・投票機構は不要。

## Delivery and Validation

1. 基盤: 認証、運営ロール、認可サービス、Git操作記録・共通採用/回復・停止点検証を完成してから既存Scoreを保全移行し、設定・監査を準備する。
2. P1: 閲覧、作成・基本編集、編集案、共有スコープ、マージ、版と履歴、MusicXML/MIDI/JSON取り込み・警告・修正後の再検証を通す。
3. P2: 純粋タイムライン、MIDI記録、分析、サーバー再評価、履歴・削除・自己ベストを通す。
4. P3: ゲーム判定、コンボ、版付きルール、達成表示、実機検証を通す。

FR-001〜005はリポジトリ・編集案、FR-006〜010はMIDI/分析、FR-011〜013は個人履歴、
FR-014〜015はゲーム、FR-016はエラー契約、FR-017は信頼度設定と台帳、FR-018〜024は取り込み契約と変換診断で対応する。
SC-001〜013の検証経路は[quickstart.md](quickstart.md)に記載する。

## Deployment Preconditions

OAuthクライアント、AUTH_SECRET、IMPORT_PREVIEW_SECRET（変換候補署名用）、専用検証DBと本番DB、HTTPS、最初の運営担当者、Git実行環境・永続ディスク・回復worker・DB/Gitの組バックアップ、
運営が確認した信頼度設定、未管理Scoreの公開方針を配置前に設定する。
数値設定をテスト用の値で本番へ自動登録しない。これは設計上の未解決事項ではなく運用入力である。

## Import Design

形式別の純粋な変換器は[取り込み契約](contracts/score-import.md)に従う。
初版の認定対象はMusicXML 4.0 score-partwise、SMF 1.0 format 0/1 PPQN、
既存CoreパラメーターJSONおよび保存済みSheet export JSON。
対応できないバージョン・構造を「全MusicXML対応」と扱わない。
JSONは構造を識別して変換し、曖昧な混合構造を拒否する。

処理は検出→境界検証→形式解析→音楽データ正規化→MIDI整列→診断→プレビュー。
ワーカーで隔離し、期限超過・中止で終了する。保存前の修正は認証付き再検証Route Handlerで候補の署名を再発行する。保存Actionは変換結果の署名と現在の権限を検証する。
変換方式を変更した場合は元Fileから再プレビューし、前の整列結果から再整列しない。
元データはブラウザーの変換中のメモリとサーバー処理中のメモリだけに存在する。
一時ファイル、キューのpayload永続化、監査ログへの元データ記録は行わない。

警告の確認と演奏可能性は別。BLOCKINGの診断は確認しても解除せず、修正した版を再検証する。
不完全な変換はknownな音楽情報と未解決フィールドを変換済みの候補として保存し、
既存Sheetモデルへ不明な音高・時刻を捏造して渡さない。閲覧は既知の部分と欠落マーカーを表示する。
基準再生も不明箇所を通常の音として再生せず、修正を促す。

## Git Versioning

[Git版管理契約](contracts/git-versioning.md)を採用する。
GitとDBに跨る原子性は主張しない。準備objectをpin→DB採用確定→main同期の状態機械で回復する。
権限と信頼度はDB確定時に検査する。更新後はその操作の履歴と実績を巻き戻さず、同期だけを再試行する。
採用本文はDBのcommitOidから読む。Git履歴やbranch名そのものを認可の根拠にしない。

共通採用エンジンと復旧モデルは基盤フェーズで完成する。US2の信頼度/編集案は拡張境界へ接続する。バックアップはgit-versioning.mdのmaintenance gateとcheckpoint manifestに従う。
