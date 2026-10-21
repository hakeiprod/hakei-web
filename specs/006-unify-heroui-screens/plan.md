# Implementation Plan: アプリ画面のHeroUI統一

**Branch**: `chore/setup-spec-kit` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: 仕様006、[ui-inventory.md](ui-inventory.md)、憲章v1.3.0。

**Status**: 実装・自動回帰・Chromiumの2幅画面検証完了。証跡と実機MIDI/本番認証等の未実施事項はvalidation.mdを参照。

setup-planが返す`006-unify-heroui-screens`は仕様識別子。実際のブランチは上記であり、作成・切替しない。

## Summary

通常利用12画面群の一般操作・情報表示を、導入済みHeroUI v2と既存テーマに統一する。データ取得を行うページはサーバー側、対話部品は現在のクライアント境界を維持する。既存のイベント処理、FormData、数値変換、権限分岐を移さず、表示と操作部品の接続だけを変更する。

既存のButton/Input/Textarea/Select/Checkbox/Card/Link/Tableを公開APIで直接再利用する。送信ボタンのtype、選択キー、checkboxの送信値、数値の空入力、pendingを明示的な保持契約とする。独自デザイン基盤・汎用フォームラッパー・状態管理・依存追加は行わない。ファイル入力、専用楽譜描画、密な音符編集表、ネイティブ詳細展開/確認は必要性を記録して保持する。

## Technical Context

**Language/Version**: 既存TypeScript strict、Node22、React19.2.0、Next.js16.4.0 App Router。

**Primary Dependencies**: lock上@heroui/react2.8.10、button2.2.32、input/select2.4.33、number-input2.0.23、table2.2.32、checkbox2.3.32、card2.2.28、link2.2.26。Tailwind4と既存src/hero.ts/globals.css/Providersを維持。最新サイトのv3 APIへ移行しない。公開入口からのみimportし、内部ファイルに実行時依存しない。

**Storage**: 既存Prisma/PostgreSQL/Gitをそのまま使用。schema、migration、サーバー操作、保存モデルの追加・変更なし。

**Testing**: Vitest4.1.11/jsdom・Testing Libraryの既存UI/音楽モデル試験、専用DB統合、next typegen/tsc、変更箇所eslint、通常build。実ブラウザーで360px/1280pxとキーボードを確認。外観の確認をjsdomやimport検索だけで代用しない。

**Target Platform**: 既存デスクトップ/モバイルブラウザー。開発環境/CI/音楽入力の対応範囲は変更しない。

**Project Type**: 既存WebアプリのUI統一。

**Performance Goals**: 操作欠落/意図しないデータ差0。既存の編集50行ページング、遅延読込、描画/演奏ループを維持し、無制限の表描画や追加データ取得を導入しない。一律の新しい速度閾値は設定しない。

**Constraints**: 認証/認可・業務遷移・API・データ変換・採点・再生・ルートURLは不変。標準認証画面、空の仮画面、開発専用画面の全面改修なし。既存の依存評価や実機未確認項目を解消済みとは扱わない。

**Scale/Scope**: 通常利用12画面群と共有部品。4ストーリーを段階的に実施。範囲の正本はui-inventory.md。

## Constitution Check

調査前の範囲確認とPhase 1後の設計確認を分けて評価した。いずれも設計の適合であり、実装試験の成功ではない。

| 原則          | 調査前 | 設計後 | 根拠                                                                                                                |
| ------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| I 音楽データ  | PASS   | PASS   | 専用描画/音楽モデルは保持。null/0、小数、音高、拍、単位の変換を維持。                                               |
| II 責務分離   | PASS   | PASS   | src/appとsrc/componentsの表示を変更。サーバーページの認可/取得をクライアントへ移さない。                            |
| III 入力/秘密 | PASS   | PASS   | 検証・送信payload・サーバー認可は不変。FormDataの保持を実操作で検証。秘密/DB/schema変更なし。                       |
| IV 回帰       | PASS   | PASS   | 挙動が変わりやすいsubmit/選択/空入力/再試行/確認/キー操作をテスト。純粋な余白変更を検査するだけの試験は追加しない。 |
| V 最小変更    | PASS   | PASS   | 新規依存/汎用ラッパー/テーマ切替なし。専用UIと既存確認を保持。                                                      |
| VI 標準機能   | PASS   | PASS   | HeroUI公開APIと既存のform/Next Link/confirm/detailsを使用。Auth.js標準画面を維持。                                  |
| VII UI一貫性  | PASS   | PASS   | 適合する通常部品に既存HeroUIを使用。ファイル/密な音符表などの維持理由をresearchとUI契約に記録。                     |

憲章の例外申請は不要。標準の意味的要素を保持する判断は、デザインシステムを自作する許可ではない。

## Project Structure

### Documentation (this feature)

```text
specs/006-unify-heroui-screens/
├── spec.md
├── ui-inventory.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/ui-consistency.md
├── quickstart.md
└── checklists/requirements.md
```

tasks.mdは次のspeckit-tasksで生成し、validation.mdは実装時に実施結果を記録する。今回作成しない。

### Source Code (repository root)

```text
src/app/
├── page.tsx                         # /scoreも再利用する一覧
├── layout.tsx / globals.css / providers.tsx
├── score/[id]/{page.tsx,edit/page.tsx,practice/page.tsx,rythme/page.tsx}
├── score/create/page.tsx
├── practice/{history/page.tsx,[id]/page.tsx}
├── repositories/{page.tsx,[id]/proposals/[proposalId]/page.tsx}
├── trust/page.tsx
└── admin/trust/page.tsx
src/components/
├── header.tsx / authenticated-content.tsx
├── form-create-score.tsx / import-preview.tsx / partial-score-editor.tsx
├── show-score.tsx / score-edit.tsx / score-viewer.tsx
├── practice-controls.tsx / practice-history.tsx / practice-analysis.tsx / game-result.tsx
├── repository-create.tsx / repository-members.tsx
├── proposal-editor.tsx / proposal-actions.tsx
├── user-trust.tsx / trust-admin.tsx
└── 対応する既存・必要最小限の挙動テスト
src/hero.ts                         # 既存設定を参照
```

**Structure Decision**: 既存ファイルへ直接適用する。mainの共通規則は`mx-auto w-full max-w-7xl px-4 py-6 sm:px-6`を基準、節はspace-y/gap、情報群はCard、説明はtext-foreground/text-default-500等の既存トークンを使う。描画領域に影響する全table/input/svgのグローバル上書きはしない。共通クラスのためだけに新しいコンポーネント階層は作らない。

## Phase 0: Research

[research.md](research.md)で既存版とv2公式資料、フォーム・入力・表・ルーティングの保持条件を調査した。スキルの指定に従い読み取り専用の調査エージェントへ公開型と既存イベントの照合を依頼し、結果を統合した。未解決の設計判断は0。実ブラウザーでの最終合否は実装後に確認する。

## Phase 1: Design

- [data-model.md](data-model.md): 既存データの値・型と一時UI状態、送信前後の不変条件。
- [contracts/ui-consistency.md](contracts/ui-consistency.md): 部品/submit/入力/選択/表/状態/キー操作/例外の契約。
- [quickstart.md](quickstart.md): 役割別の操作、画面幅、状態、コマンドと証跡。

### 実施順と境界

1. 基準画面・状態・送信値を確認し、共通トークン/操作種別/例外一覧を固定する。既存Providerは維持。ヘッダーの狭幅確認を含める。
2. US1: 一覧/詳細の外枠、取込/修正/保存の通常操作を統一する。部分編集表のcaption/行列見出し/ページ位置は維持する。
3. US2: 練習/ゲーム/結果/履歴。既存セッションhookを変更せず、保存再試行の同じkey/データと、入力フォーカス時の演奏キー非干渉を検証する。
4. US3: リポジトリ/提案。FormDataのdefault/enum/checkboxと、期待version/key/payload/権限を維持する。US1とproposal-editorを共有するため同一ファイルは直列編集する。
5. US4: 信頼度/運営。確認と取消、数値精度、理由、同じ操作の再試行を維持する。
6. 全12画面群の状態・狭幅・キーボード・役割別導線を確認し、変更した操作の回帰と全体回帰/型/lint/buildを記録。残る標準要素は例外理由と対応要件を一覧へ追記する。

Buttonは主操作primary/solid、補助default/bordered、取消default/light、削除dangerを基準とする。重大操作は色だけに頼らず既存の日本語名と確認を残す。新しい確認手順・Toastだけの結果・Modal・保存フローを追加しない。

## Complexity Tracking

追加の抽象化・認証例外・データ移行なし。既存部品で満たせない範囲はUI契約の限定した保持対象に列挙し、それ以外へ拡張しない。
