# 画面・部品調査一覧

調査日: 2026-10-19。基準はソース上の利用状況。全画面のブラウザー確認を実施した一覧ではない。HeroUI importの有無だけで完成度を判定せず、通常操作、情報表示、専用描画の責務を区別する。仕様は[spec.md](spec.md)。

## 通常利用画面の対象

| 画面群・経路                                         | 主な部品/ソース                                                              | 現状と対象                                                                                             | 対応                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------- |
| 楽譜一覧 `/`、`/score`                               | src/app/page.tsx、src/app/score/page.tsx                                     | `/score`はホームを再利用。見出し・一覧・空状態・リンクのまとまりを統一。                               | US1 / FR-003・004      |
| 楽譜詳細 `/score/[id]`                               | src/app/score/[id]/page.tsx、show-score.tsx、score-edit.tsx                  | 情報表、削除等の編集操作、変換案内、履歴/提案/練習導線。楽譜本文の描画は保持。                         | US1 / FR-003・004      |
| 楽譜取込 `/score/create`                             | form-create-score.tsx、import-preview.tsx                                    | 標準file入力、select、button、変換結果のtable/checkbox、確認/戻る/保存操作。ファイル選択の制約を保持。 | US1 / FR-004・008      |
| 楽譜編集 `/score/[id]/edit`                          | partial-score-editor.tsx、proposal-editor.tsx、form-create-score.tsx         | 編集表のinput、select、textarea、検証/保存/提出操作。数値や音符の意味・制約を維持。                    | US1・US3 / FR-004・006 |
| 練習 `/score/[id]/practice`                          | practice-controls.tsx、show-score.tsx                                        | 機器/入力モード選択、数値・チェック入力、開始/終了/中断/再保存と状態表示。                             | US2 / FR-005           |
| リズムゲーム `/score/[id]/rythme`                    | rhythm-game.tsx → practice-controls.tsx、game-result.tsx                     | 練習共通操作と結果表示。既存の`rythme`というURLは変更しない。                                          | US2 / FR-005           |
| 練習履歴 `/practice/history`                         | practice-history.tsx                                                         | リスト、条件、ページ送り、詳細導線、削除/取消/確認操作。                                               | US2 / FR-005           |
| 練習結果 `/practice/[id]`                            | practice-analysis.tsx、game-result.tsx、practice-history.tsx、show-score.tsx | 分析表、詳細展開、確定/暫定/中断/自己ベスト表示、削除確認と戻る導線。                                  | US2 / FR-005・008      |
| リポジトリ `/repositories`                           | repository-create.tsx、repository-members.tsx、src/app/repositories/page.tsx | name入力、公開/編集範囲select、役割select、権限checkbox、保存操作、作成先導線。                        | US3 / FR-006           |
| 提案詳細 `/repositories/[id]/proposals/[proposalId]` | proposal-actions.tsx、show-score.tsx、ページ本体                             | 理由textarea、承認/却下/再確認操作、状態・差分・現在版への導線。                                       | US3 / FR-006           |
| 信頼度 `/trust`                                      | user-trust.tsx                                                               | 対象/値入力、保存、結果表示、運営画面への既存導線。                                                    | US4 / FR-007           |
| 運営信頼度 `/admin/trust`                            | trust-admin.tsx                                                              | 規則のinput/textarea、確認/適用/取消、対象/調整値/理由、pending表示。                                  | US4 / FR-007           |

通常利用は12画面群。各群の空/読込/エラー/権限不足など、現在存在する分岐も同じ対象に含む。全ての画面に存在しない状態を新規実装する要求ではない。

## 横断部品と既存の基準

| 分類                | ファイル                                                                                             | 判断                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 既存テーマ/Provider | src/hero.ts、src/app/globals.css、src/app/providers.tsx、src/app/layout.tsx                          | 既にHeroUIのテーマとProviderが存在する。既存基盤を参照し、別テーマ/別デザイン基盤へ置換しない。                                                          |
| ヘッダー/検索       | header.tsx、input-serch.tsx                                                                          | Navbar/Button/AutocompleteはHeroUI使用済み。通常リンク、余白、狭幅での操作を横断確認する。ログイン/logout処理は保持。                                    |
| 再生/ミキサー       | score-player.tsx、button-play-pause.tsx、slider-volume.tsx、score-mixier-track.tsx、score-mixier.tsx | Button/Slider/Switch等は既にHeroUI利用。音量/再生/選択の意味とイベントを維持し、表示が影響を受ける場合だけ検証。既存のファイル名はこの仕様で改名しない。 |
| 楽譜ビューア        | score-viewer.tsx                                                                                     | NumberInput/Select/Switchは使用済みだが、標準buttonが残る。設定と表示モードの通常操作だけを統一対象とする。                                              |
| 認証状態の表示境界  | authenticated-content.tsx                                                                            | 必要な案内の外観は共通規則で確認できるが、利用者一致判定・状態制御を変更しない。                                                                         |
| 情報の詳細展開      | practice-analysis.tsx、game-result.tsx                                                               | table/details/summary等は意味・キーボード操作・可読性で評価する。標準要素という理由だけで置換しない。                                                    |

## 保持する専用UI・例外候補

- show-score.tsx / score-viewer.tsxの楽譜描画、virtual-keyboard.tsxの仮想鍵盤、show-score-rythme.tsxの演奏レーンを保持する。音高・タイミング・拍・再生・打鍵・判定は対象外。
- 数値/文字列を編集する表の内容と順序は保持する。音符や楽譜の編集を一般的な表に合わせて作り直さない。
- ファイル選択は標準ファイル入力の保持を許容する。ラベル・説明・disabled/pending・同一ファイル再選択を含めて整合性を確認する。
- 情報表、details/summary、通常リンクの最終的な部品選定は計画で決める。適切な既存部品がない場合は機能・アクセシビリティを保持した例外理由を記録する。

## 調査済み・通常利用の完了条件から外す画面

| 経路                                                                  | ソース                                  | 理由                                                                                                    |
| --------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/api/auth/[...nextauth]` と標準signin/verify-request/error等         | src/app/api/auth/[...nextauth]/route.ts | UIの独自実装ではなくAuth.js handler。憲章VI/仕様005の標準画面方針を維持。                               |
| `/auth/register`、`/auth/reset`、`/auth/confirm`、`/account/security` | 対応するpage.tsx                        | 標準signinへの固定redirectのみ。新しいフォームを追加しない。                                            |
| `/dev/core/fixtures`、`/dev/mxl/fixtures`                             | score-fixture-gallery.tsxと各page.tsx   | 開発専用。標準debugボタンや相互リンクが残る。共通部品変更による回帰だけ確認し、今回の必須置換から外す。 |
| `/dev/score-fixtures`                                                 | src/app/dev/score-fixtures/page.tsx     | 開発galleryへのredirect。本番非公開を維持。                                                             |
| `/resource`、`/user`                                                  | 各page.tsx                              | 空のコンテナまたは空画面。新規機能は作らない。共通ヘッダー等の波及範囲のみ確認。                        |
| `/resource/[id]`                                                      | src/app/resource/[id]/page.tsx          | リソース名のみを返す既存の簡易表示。新たな詳細機能は追加しない。共通テーマへの波及のみ確認。            |

## 調査方法と限界

- 全page.tsxとsrc/componentsの通常操作要素・HeroUI importを横断検索し、画面から参照される部品を確認した。
- 旧仕様004は独自認証画面の履歴であり、今回の通常アプリ画面統一で復活させない。
- 見た目の合否、狭幅、フォーカス、読み上げ、実機MIDIはソース検索だけでは判定していない。計画段階で画面状態と検証方法を定める。

## 実装後の分類

通常利用12画面群の外枠・見出し・リンクと、各行で挙げた通常操作を変更済み。入力/選択/確認/状態表示を既存HeroUI v2とテーマへ揃えた。閲覧用表はshow-score/practice-analysisでHeroUI Tableを利用し、安定キー・列順・行選択なしを保持した。通常操作の未分類は0件。

| 分類     | 最終実装                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 変更済み | 12画面群、Header/AuthenticatedContent、取込・編集・練習・履歴・共有・提案・信頼度の通常操作                                      |
| 既存利用 | Theme/Provider、Autocomplete、NumberInput、音量Slider/Switch、楽譜描画設定                                                       |
| 保持例外 | native file、音符編集table、details/summary、inline確認/confirm、SVG/Canvas/鍵盤/演奏レーン。根拠はcontracts/ui-consistency.md。 |
| 対象外   | Auth.js標準画面、認証redirect、dev fixture、resource/userの空画面。上記一覧を維持。                                              |

再生/ミキサーへの波及確認で、360pxの再生Navbarに折返しとアイコン名を追加した。ButtonPlayPauseとSliderVolume、検索Autocompleteの開閉/消去は既存handlerのまま名前/表示を補い、VirtualKeyboardは描画を変更せず専用の横スクロール領域を付けた。認証・データ取得・音楽モデル・描画/再生処理・依存は変更していない。実観測と残る確認は[validation.md](validation.md)。
