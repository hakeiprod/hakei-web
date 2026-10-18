# Implementation Plan: 認証UIのHeroUI統一

**Branch**: `chore/setup-spec-kit`（実Gitブランチ） | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: `specs/004-heroui-auth-ui/spec.md`

setup-planのBRANCHはローカルfeature指定から得た`004-heroui-auth-ui`。Gitブランチは作成・変更せず、実ブランチを上記に記録する。

## Summary

登録、確認、再設定、変更、追加の表示を既存HeroUI v2に統一する。既存のZod検証、authOperation、AbortController、ConfirmationLink、next-auth公開APIとサーバー認可を維持する。共通の表示枠と結果表示のみを薄い合成部品にし、画面ごとの認証フローは各コンポーネントに残す。新規依存・DB変更・標準ログイン画面の置換は行わない。

## Technical Context

**Language/Version**: TypeScript strict、React 19.2.0、Node.js 22系（既存engines）

**Primary Dependencies**: Next.js 16.4.0 App Router、既存@heroui/react 2.8.5系（lockfile固定版）、Tailwind CSS 4、next-auth 5.0.0-beta.32、Zod 4。既存公開APIのみを利用する。

**Storage**: 新規なし。既存Prisma/PostgreSQL認証データを変更しない。入力値と確認リンクは現在のメモリー寿命を維持する。

**Testing**: Vitest 4、Testing Library、jsdom、既存認証統合テスト。実ブラウザーで320px/1280px・キーボード・支援技術・自動入力を確認する。

**Target Platform**: 既存Webブラウザー、Linux/Dev Container。SSRは既存App Router、操作部分はclient component。

**Project Type**: 既存WebアプリのUI改修。

**Performance Goals**: 追加の認証通信・必須手順・入力項目を増やさない。処理中は直ちに識別可能にする。一律の速度目標は追加しない。

**Constraints**: 15〜128 Unicodeコードポイント、秘密の非永続化、明示POST、全端末失効、共通案内、GitHub条件表示、320pxで横スクロールなし。新規ライブラリ・テーマ変更なし。

**Scale/Scope**: 5画面種別、共有確認画面のVERIFY/RESET/ADD_PASSWORD、登録再送、account/security内の戻りリンク。標準ログイン、外部OAuth、Header、音楽モデルは対象外。

## Constitution Check

Phase 0開始前に憲章v1.2.0の全原則を評価しPASS。Phase 1完了後も次の設計によりPASS。例外はない。

| 原則              | 事前 / 設計後 | 根拠                                                                 |
| ----------------- | ------------- | -------------------------------------------------------------------- |
| I 音楽データ      | PASS / PASS   | s-core・楽譜・演奏データを変更しない                                 |
| II 責務分離       | PASS / PASS   | 表示はcomponents、認証・DBは既存server。共通表示へ認証分岐を移さない |
| III 入力・秘密    | PASS / PASS   | 既存Zod・サーバー検証・fragment除去・一時メモリー管理を再利用        |
| IV 回帰検証       | PASS / PASS   | 既存意味テストにUI境界の回帰を追加。文書作成時はリンク・構文のみ確認 |
| V 最小変更        | PASS / PASS   | 5画面と対象内リンク、表示合成部品、関連テストに限定                  |
| VI 標準ライブラリ | PASS / PASS   | Auth.js標準画面/API維持。追加依存・独自認証なし                      |
| VII HeroUI        | PASS / PASS   | Input/Button/Link/Card/Alertを既存Provider/テーマで使用              |

## Project Structure

### Documentation (this feature)

```text
specs/004-heroui-auth-ui/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/auth-ui.md
```

`tasks.md`は次のspeckit-tasksで生成する。

### Source Code (repository root)

```text
src/components/
├── auth-panel.tsx                 # 新規: Cardによる表示枠のみ
├── auth-feedback.tsx              # 新規: Alertによる結果表示のみ
├── auth-home-link.tsx             # 新規: server pageから使うclientの戻りリンク
├── email-registration.tsx
├── auth-confirmation.tsx
├── password-reset.tsx
├── password-change.tsx
├── password-addition.tsx
├── *.test.tsx                     # 上記の既存テストを拡張
├── confirmation-link.ts           # 維持、秘密を表示部品へ渡さない
├── auth-operation.ts              # 維持
└── use-auth-submission.ts         # 維持
src/app/
├── auth/{register,confirm,reset}/page.tsx  # 既存配置を維持
├── account/security/page.tsx      # 対象内の戻りリンクのみHeroUIへ
├── providers.tsx                 # 既存HeroUIProviderを再利用
└── globals.css                   # 既存テーマを再利用
```

**Structure Decision**: 既存配置と関数コンポーネントの流儀を維持する。新規の2部品は表示だけを合成し、入力や送信の汎用フレームワークを作らない。nativeのsection/h1/formは意味構造であり、独自の入力・ボタンの代替ではない。既存formの送信セマンティクスを保持し、HeroUI Formによる別の検証状態は導入しない。

## Phase 0: Research

[research.md](research.md)に既存公開API、バリデーション、アクセシビリティ、回帰検証の決定と比較案を記録した。未解決事項なし。

## Phase 1: Design

- [data-model.md](data-model.md): 新規永続モデルなし。既存の入力・送信・確認状態と表示の対応。
- [contracts/auth-ui.md](contracts/auth-ui.md): 部品対応、画面別操作と不変条件、FR/SCへの検証対応。
- [quickstart.md](quickstart.md): 自動検証と実画面の確認手順。

実装順は、既存テストの基準確認→共通表示→登録/再設定→目的別確認→変更/追加→回帰・画面検証とする。各段階で既存処理を保ちながら表示を置換する。SMTP・実OAuth・初見試用の既存保留は引き継ぎ、UI試験で完了扱いにしない。

## Complexity Tracking

憲章違反なし。既存HeroUIの合成で要件を満たせるため、独自入力部品やデザインシステムの例外は不要。

## Implementation Note

account/securityのserver componentから@heroui/reactの一括exportを直接読み込むとcreateContextエラーになるため、対象リンクの表示だけをclient componentのAuthHomeLinkへ配置する。サーバーの認可・データ取得は移動しない。AuthFeedbackは更新を読み上げられるよう常設のrole=status/aria-live=politeの内側でAlertを合成し、二重のassertive通知を避ける。
