# Validation: HeroUI画面統一

## 開始時点

仕様006の実装。checklists/requirements.mdは16/16 PASS、読取専用で保持。既存差分は仕様006の設計文書のみ。既存アプリの認証・業務・音楽モデルを維持する。ブラウザー/実機は未確認。単体/統合/画面確認を区別して追記する。

## 基準と保持契約

12画面群・役割・既存状態の基準はui-inventory.mdとdata-model.md。HeroUI v2.8.10と既存テーマ/Providerを使用。submit type、name、enum選択、checkbox on/欠落、数値の空欄/null/0、同じpayload/key/遷移を保持する。native file・密な音符表・描画・details/confirmは限定例外。既存の空/失敗/確認/pending状態を保持する。既存ignore設定はnode_modules/生成物/env/ログを除外し、privateアプリのため.npmignoreは不要。フック設定なし。

## 変更前の主操作

| 群              | 役割/主操作                      | 初期値/保持条件                             |
| --------------- | -------------------------------- | ------------------------------------------- |
| 一覧/詳細       | 閲覧者、編集/管理者の編集導線    | 同じscore/revision/権限/リンク              |
| 作成/編集       | 編集者、file/変換/保存/提案      | 5MiB、形式、null/0、50行、payload/key       |
| 練習/ゲーム     | 演奏者、機器/track/条件/開始停止 | 選択なし、tempo/補正/単位、既存hook         |
| 履歴/結果       | 所有者、結果/削除確認            | 順序/cursor/対象/暫定と確定                 |
| リポジトリ/提案 | 管理/編集/閲覧、作成/共有/確定   | enum/default、canMerge on/欠落、期待version |
| 信頼度/運営     | 一般/運営、評価/規則/確認        | step any、理由2000、取消非送信              |

実ブラウザー名/版・幅・role別の実観測は実施後に記録し、ソース基準を実画面成功とはしない。

## 自動回帰（2026-10-18 UTC）

- 全単体: 73ファイル486件 PASS。s-coreの変換/描画/音声/練習・ゲーム評価を含む。既存canvas警告はjsdomの描画API未実装であり、実画面の成功証跡とはしない。
- 追加回帰: partial-score-editorのnull/0/小数/休符/50行ページ/送信、repository-create/membersのenum初期値・実popup・FormData/checkbox、proposal-actionsの権限/同一再試行key、user-trustの負小数と入力保持、practice-analysisの精度/未評価/中断。
- 既存import-preview/practice-controls/rhythm-gameのSelect試験はpopupを開いてoptionを選ぶ操作へ適応。score-viewerの既存専用入力mockは保持し、追加Buttonは実HeroUIを利用する。React Ariaのフォーカス用CSS.escapeだけjsdomへ補完した。
- `npx next typegen`、`npx tsc --noEmit`、変更tsxのESLint、`EMAIL_SERVER= EMAIL_FROM= npm run build`: PASS。サーバーページのCardは既存依存`@heroui/card`公開エントリーを使い、全ページをclient化せずclient境界を維持した。
- 専用PostgreSQL15・末尾`_test` DB・専用Gitルート・専用Mailpit（SMTP11025/API18025）で全統合: 19ファイル49件 PASS。認証/メール/権限/保存/提案/練習/バックアップ等を含む。試験DBと起動プロセスは終了時に削除/停止した。稼働DB/.envを変更していない。

## ブラウザー確認方法

Playwright/Chromium156.0.8078.4を一時領域だけに準備し、独立した本番サーバー3106、専用DB/Git、DBセッションfixtureで確認。これは実メール/OAuthログインの確認ではない。アプリの依存追加はない。12画面群を360px/1280pxで開き、HTTP状態・見出し・Tab到達・ページ幅を測定した。初回fixtureは追加休符に対応するテンポ範囲が不足して既存NoteHighlighterで例外になったため、4拍の完全fixtureへ交換した。対象外の音楽コードを修正して回避していない。

完全fixtureで判明した360pxの再生操作の横はみ出しを、Navbarの折返しとicon-only幅で修正。再生/停止/ミュートには識別名を付与し、仮想鍵盤は専用領域の横スクロールとした。最終の幅/操作結果は以下へ追記する。

## 操作確認と保持境界

Chromium実操作で、名前の必須検証、Select popupとFormData enum、Enterで1回のリポジトリ作成、checkboxの未選択時欠落/選択時on、削除確認のSpace/取消、分析details展開、負小数-0.125の評価保存、規則10.125の確認/取消/適用とpolicy version、目標20.125のconfirm取消/適用と保存スコアを確認した。部分楽譜はnull→0、開始0.125、長さ空欄、休符の無効入力、50行/51行の往復、説明と提出を確認。通常編集は音高0の下書き保存と提案詳細への遷移を確認した。

実ファイルchooserで同一JSONを2度選択して再変換でき、取消→再選択→確認済み楽譜保存→楽譜詳細へ遷移した。変換署名秘密値は試験プロセス内だけに設定し、preview tokenや秘密値を証跡へ出していない。練習の試験用MIDIはEventTargetの代替入力であり、実機MIDIではない。中断の最初の保存通信だけを試験ブラウザー内で失敗させ、再保存の送信内容・session/key/event batchが同一であることを比較した。

初期値・数値精度・入力保持・競合・無効/失敗・権限境界の詳細は各コンポーネント回帰と統合試験も併用する。スクリーンリーダー全機種、実機MIDI、本番SMTP/OAuth、OS依存の仕様005保留は未実施のまま。実装完了はこれらを実認証/実演奏成功とする主張ではない。

## 最終要件対応

| 要件               | 実装・証跡                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001/002、SC-001 | ui-inventory.mdの12画面群と横断/例外/対象外の分類。通常native操作の残存はfile chooserと開発用galleryのみ。編集tableとdetails/confirmは契約上の例外。未分類0。                |
| FR-003/009、SC-003 | 共通トークン、Card/Input/Select/Checkbox/Button/Table、共通リンク/見出し。実popup、Tab/Enter/Space/矢印/Escape、確認/取消。再生・ミュート・検索のアイコン名を補完。          |
| FR-004、SC-002     | US1のファイル再選択・変換/取消/保存、通常/部分編集、null/0/小数/休符/50行。import-preview/partial-score-editor/proposal-editor等の回帰と実保存。                             |
| FR-005、SC-002/005 | 練習/ゲームの条件、試験用MIDI、中断→保存失敗→同一内容で再試行、履歴/削除取消/分析。全s-coreとpractice統合もPASS。                                                            |
| FR-006、SC-002/005 | enum/checkboxの実FormDataとDB値、管理/編集/閲覧の制限、提案merge/reject/withdraw、競合時の説明保持・同一再試行payload/key。                                                  |
| FR-007、SC-002/005 | 規則の確認/戻る/適用、負小数の評価、confirm取消/適用、保存スコア20.125とpolicy version。trust回帰/統合を併用。                                                               |
| FR-008、SC-005     | 既存の空/認証待ち/権限不足/処理中/成功/失敗/競合/再試行の分岐を保持。文字の状態説明と既存disabled条件を維持。失敗/再試行/確認取消は実ブラウザー、各分岐は単体/統合でも確認。 |
| FR-010、SC-004     | 全12群×360px/1280px。実測ページ幅、キーボード到達と画面採取。表/楽譜/鍵盤は局所scroll、通常操作は折返し。結果はbrowser-results.json。                                        |
| FR-011/012         | 最終差分でsrc/server・src/s-core・prisma・src/auth.ts・認証経路・package/lock・.envに変更なし。ログイン/logout handlerも保持。                                               |
| FR-013             | 開発fixture3経路の本番404をChromiumで確認。既存score-viewer/galleryの描画回帰も通過。専用描画/音声ロジックは変更なし。                                                       |

全単体73ファイル486件、全統合19ファイル49件に加え、最後の表示調整後のheader/show-score/score-viewer再検証は3ファイル21件PASS。型/lint/buildは最終ソースでPASS。実機や本番認証等の未実施事項は上記のまま保持する。

画像確認で、360pxの密な編集表では入力の左右paddingに対して列が細くなり、数値が読みにくい点を修正した。3つの音符編集tableに局所的な最小幅を設け、表の外枠だけで横スクロールする。長い入力遅延補正は短いラベルと説明へ分け、前の入力との重なりを防いだ。未解決事項がない場合の空の装飾枠は表示しない。いずれも保存/変換/認可の処理は変更しない。

150セルの実HeroUIを扱う部分楽譜回帰はビルド並行時に既定5秒を超えたため、この試験だけ15秒の上限とし、ビルド終了後に全単体を再実行した。全体のtimeoutや検証内容を緩めていない。

## 初回実装の結果（T001〜T031）

31/31タスク完了。12画面群×2幅（24画面）のChromium受け入れ、27件の操作記録、認証済みVIEWERを含む役割別確認が通過した。意図しない全体横スクロール0、表示例外0、名前のないButton 0。画像で数値欄・ラベル・表見出しを確認し、最後の見出し位置調整後も24画面の表示を再確認した。[browser-results.json](browser-results.json)に一時IDを除いた結果を保存した。

最終差分・型/lint/build・全単体486件と全統合49件はPASS。試験サーバー/DB/Mailpitは停止・削除済みで、利用者の開発サーバー/DB/.envには触れていない。checklists/requirements.mdは16/16のまま変更なし。`.specify/extensions.yml`が存在しないためbefore/after_implementフックはなし。

次の点検コマンド: `$speckit-converge`。実機MIDI、本番SMTP/OAuth、仕様005の保留はこの完了数に取り込まない。

## Convergence修正の検証（T032・T033、2026-10-19）

T032では対象33個のButtonを操作名と照合した。主操作はprimary/solid、補助はdefault/bordered、取消はdefault/light、削除/却下等はdangerに統一した。メンバー更新、運営ルール有効化、スコア調整も主操作として揃えた。変更はcolor/variantだけで、type・handler・pending/isDisabled・FormData・payload/key・既存の確認手順は保持した。

T033では作成権限不足と編集権限不足の早期returnに、通常画面と同じmainの幅/余白、h1、共通トークンを使うrole=statusの案内を追加した。既存の権限判定・サーバー取得・認証redirect・文言の意味は保持した。保存先未選択時の外枠とも照合した。

- 全単体: 73ファイル486件PASS。既存の保存・取消・同一key再試行・数値保持・s-core回帰を含む。クラス名だけを確認する新しい単体テストは追加していない。
- 最終ソースのnext typegen、tsc --noEmit、対象tsxのESLint、本番build: PASS。
- 同じ隔離環境のChromium156.0.8078.4で12画面×360px/1280pxを再確認し、送信・確認取消・失敗再試行・提案確定等の既存操作が通過。VIEWERで作成/編集の拒否2経路×2幅を追加確認し、見出しと既存文言を表示、編集入力0、全体横スクロール0を確認した。
- 対象33ボタンの静的照合と実画面の操作区分を確認。通常24画面確認＋権限不足4画面確認、操作記録31件、表示例外0・名前のないButton 0。
- 認証/業務/音楽モデル/依存/.envへの変更なし。専用DB/Gitと試験プロセスは後片付け済み。表示修正のみのため全49件のバックエンド統合スイートは今回再実行せず、既存の結果と今回の実DBを使う画面回帰を区別する。

結果は[convergence-results.json](convergence-results.json)。T032/T033を完了し、現在33/33タスク完了。実行前後の拡張フック設定なし。実機MIDI/本番認証等の既存保留は維持する。次の点検コマンドは `$speckit-converge`。

## 利用不可画面の統一（T034、2026-10-19）

練習のcanPractice=falseとゲームのcanGame=falseの早期returnに、通常画面と同じmainの幅/余白、h1、共通トークンを使うrole=statusの案内を適用した。既存の文言の意味、認証redirect、revisionId付き読取、認可、利用可否判定を維持した。readEvaluationRuleは引き続き利用可能な分岐でだけ呼び、利用不可時に演奏/ゲーム部品を初期化しない。

- 関連既存回帰: practice-controls/rhythm-game/authenticated-contentの3ファイル9件PASS。今回は表示だけの変更のため、以前通過した全単体486件/全統合49件の再実行はしていない。
- next typegen、tsc --noEmit、対象2ページのESLint、本番build: PASS。
- 評価規則が0件の専用_test DBと専用Git、認証用DBセッションfixtureを使い、未解決の音高nullを持つ部分楽譜を用意した。Chromium156.0.8078.4でrevisionIdを指定し、練習/ゲーム×360px/1280pxの4ケースがHTTP200で見出しと既存文言を表示した。
- 全体横スクロール0、入力/開始ボタン/Canvas 0、MIDI要求0、SoundFont要求0、表示例外0。評価規則未設定でも表示できるため、利用不可時に規則読込へ進まないことを確認した。日本語フォントを使った画像でも案内の可読性を確認。
- 認証・業務・音楽モデル・依存・.envへの変更なし。検証用DBと試験プロセスは後片付け済み。実機MIDIや本番認証などの既存保留は維持する。

[unavailable-state-results.json](unavailable-state-results.json)に証跡を保存。T034を完了し、現在34/34タスク完了。拡張フック設定なし。次の点検コマンドは `$speckit-converge`。
