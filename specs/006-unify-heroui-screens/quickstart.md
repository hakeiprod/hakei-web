# Quickstart Validation: HeroUI画面統一

本書は実装後の検証ガイド。実施結果・環境・未実施事項は[validation.md](validation.md)を参照。[UI契約](contracts/ui-consistency.md)と[対象一覧](ui-inventory.md)を参照する。

## 1. 準備

- Node22と既存lock、アプリに必要な開発DB/AUTH_SECRET/SCORE_GIT_ROOTを用意する。稼働DBや既存.envを書き換えない。
- 閲覧者、編集者、リポジトリ管理者、運営者の検証用アカウントと既存の最小fixtureを用意する。検証用の公開/限定楽譜、完全/部分楽譜、履歴、下書き/送信済み/競合提案を使う。
- 開発ログインは仕様005のMailpit手順を再利用する。Auth.js標準画面を今回のHeroUI対象としない。
- 変更前に操作/表示値・送信値の基準を記録し、変更後と比較する。公開画面と権限不足分岐も対象とする。

```bash
npm ci
npx prisma generate
npm run dev
```

## 2. 自動回帰

```bash
npm test -- --run --maxWorkers=2
npx next typegen
npx tsc --noEmit
EMAIL_SERVER= EMAIL_FROM= npm run build
```

変更したtsxファイルを列挙して`npm run lint -- <変更ファイル>`を実行する。プレースホルダーの文字列をそのままshellへ貼り付けない。既存practice-controls/practice-history/proposal-editor/trust-admin/import-preview/score-viewer/header等の試験を実際の部品操作に合わせて更新する。FormDataを使うフォームにはname/初期値/選択/checkboxの保持を確認する必要最小限の挙動試験を用意する。

DB統合は専用の末尾_test DBと専用SCORE_GIT_ROOT、個人受信箱から独立したMailpitを使い、[開発手順](../../docs/development.md)に従って準備完了を確認する。

```bash
export TEST_EMAIL_SERVER=smtp://127.0.0.1:11025
export TEST_MAILPIT_URL=http://127.0.0.1:18025
# TEST_DATABASE_URLとSCORE_GIT_ROOTは専用領域へ事前設定
npm run test:integration
```

上記buildは開発用平文SMTPの本番検証拒否を避けるため、そのプロセスだけメール入口を無効にする。認証設定や秘密ファイルを変更する手順ではない。今回のUI変更で依存更新を行わない。必要になった場合だけ採用理由とaudit差分を再評価する。

## 3. 実ブラウザーの操作シナリオ

各行を360pxと1280pxで確認し、マウス/タッチだけでなくキーボードでも主要操作を実行する。

| 対象           | 操作                                                                        | 期待結果                                                                  |
| -------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 共通/一覧      | header、検索、一覧→詳細→過去版、空一覧                                      | 同じリンク先と内容。狭幅でも全導線が到達可能。                            |
| US1取込        | 対応file選択、容量超過、同一file再選択、MIDI条件、preview、取消/再検証/保存 | 既存制約とpayload。ラベル・状態・pendingが識別可能。                      |
| US1/3編集      | 不明音符の空欄、0、小数、休符、50行ページ、説明、下書き/送信                | null/0と音楽値を保持し、送信やページ操作を取り違えない。                  |
| US2練習/ゲーム | 機器/track/範囲/tempo/補正を選び開始・終了・中断                            | 条件・単位・入力イベント・結果が同じ。入力focus時に演奏打鍵と干渉しない。 |
| US2結果/履歴   | 暫定/確定/中断/自己ベスト、分析展開、cursor、削除取消/確定                  | 数値・順序・削除対象が同じ。取消時に送信しない。                          |
| US3共有        | 作成、visibility/editScope、role/canMerge、メンバー更新                     | 初期選択とenum/checkbox値を保持し、役割別操作範囲は変わらない。           |
| US3提案        | submit/merge/reject/withdraw、理由、競合、再確認                            | 同じkey/version/payload、権限、失敗時入力保持。                           |
| US4信頼度      | 評価値、ruleの小数/負数/理由、確認・適用・取消、調整                        | 精度/理由/結果/権限を保持し、二重送信なし。                               |
| 波及確認       | 既存再生/音量、ビューア、開発fixture                                        | 操作・描画は不変。開発画面が本番非公開のまま。                            |

既存の読込/空/権限不足/pending/成功/入力失敗/通信失敗/競合/再試行分岐を確認する。再現に使うのは試験用mockまたは許可された検証環境であり、実サービスのデータ破損や本番障害を起こさない。

## 4. アクセシビリティと幅

- 名前/label/エラー関連、Tab順序、可視focus、Enter/Spaceの1回実行、Selectの矢印/Escape、確認/取消を確認。
- 色を除いても状態と操作の意味が分かることを確認。新しいModalや自動focus移動を追加しない。
- 360px/1280pxで操作の欠落/重なりと意図しない全体横スクロール0。密な表と楽譜は指定領域内でスクロールできる。
- Selectはhidden selectの値だけを書き換える確認で終わらず、実際のpopupから選び、FormDataと結果を確認する。

## 5. 証跡と完了判定

実装時にvalidation.mdへ対象12画面群、role、状態、幅、操作方法、期待値/実測、例外理由、FR/SC、実施日を記録する。ブラウザー名/版も記録する。テスト・型/lint/buildの結果と手動結果を分ける。

SC-001は対象一覧の100%分類/統一または例外記録、SC-002は全USの同じ入力/結果、SC-003はキーボード到達と名前/focus、SC-004は2幅の欠落/重なり0、SC-005は既存状態の保持へ対応する。FR-001〜013も各画面/操作の証跡へ対応付ける。

ブラウザーや実MIDI等が使えない場合は未実施と明記し、jsdom成功で実外観/実機成功と扱わない。仕様005の本番SMTP/OAuth/OS依存の保留は今回の完了と分離して維持する。

## 6. 実施記録と次のコマンド

仕様006の実装、自動回帰、専用DB/Mailpit、Chromiumの2幅検証を実施した。既存.envを書き換えず、ブラウザー/ライブラリ/日本語フォントは試験用の一時領域だけに用意した。DBセッションfixtureとMIDI代替を使う画面検証であり、本番認証や実機演奏の証跡にはしない。[validation.md](validation.md)と[browser-results.json](browser-results.json)を参照。

実装後に仕様との差分を再点検するコマンド:

```text
$speckit-converge
```
