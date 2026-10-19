# UI Contract: 表示と操作の統一

対象は[対象一覧](../ui-inventory.md)の通常利用12画面群。対応要件は[仕様](../spec.md)。新API/認証経路/DB契約は追加しない。

## 部品の対応

| 既存用途 | 使用する既存部品/表現 | 不変条件 |
| --- | --- | --- |
| 実行・送信・取消 | HeroUI Button | submitはtype=submit、他はtype=button。pending/既存条件をisDisabledへ、処理中表示はisLoading。同一処理にclick/pressを二重接続しない。 |
| text/number/理由 | Input type=text/number、Textarea | name/value/defaultValueとonChange変換、min/max/step/required/maxLengthを保持。新しい丸め・空値正規化を入れない。既存native検証の必要箇所はisRequiredとvalidationBehavior=nativeを明示し同じinvalid時に送信しないことを確認。 |
| 単一選択 | Select/SelectItem | name、既存enum/IDと等しいitem key、初期選択、clear不可の条件を保持。FormDataに表示名や重複値を送らない。未選択deviceIdはselectedKeys空集合で表現し、空文字keyのitemで代用しない。 |
| checkbox | Checkbox | isSelected/onValueChange、名前と値on、未チェック時の欠落、disabledを保持。既存コードがfalse等を明示送信している場合はその契約を保持。 |
| 情報群/状態 | Card、見出し、説明、role=status | 状態文字列と永続的な結果表示を保持。警告/失敗/完了を色だけで区別しない。 |
| 閲覧用表 | Table/Header/Column/Body/Row/Cell | 表/列の名前、順序、安定したキー、数値精度を維持。新規の行選択/並べ替え/仮想化を追加しない。 |
| 遷移 | 既存Next LinkとHeroUI Link/Buttonの適切な組合せ | href/query/callback、修飾キークリック、戻る/進むを維持。遷移のためだけにProvider全体を変更しない。 |

Selectのdisabled中のhidden select/項目送信については、対象フォームで作るFormDataの結果を必ず確認する。pending中にsnapshotを再取得して以前のpayloadを欠落させる実装は行わない。既存送信前のsnapshotとhandlerを維持する。

## 保持する例外と根拠

| 対象 | 理由/扱い |
| --- | --- |
| ネイティブfile input | files、accept、同一file再選択とブラウザーchooserの既存動作を保持。周辺のラベル/説明/ボタン/フォーカスを統一。 |
| 密な音符編集table | 音楽のセル編集・caption/見出し・休符・null・既存ページングが主目的。表の意味構造と既存フォーカス順を保持し、適合するセル入力はHeroUI化する。 |
| 楽譜SVG/Canvas、仮想鍵盤、演奏レーン | サービス固有の表現であり一般UI部品では代替しない。寸法・イベント・時刻・音高を保持。 |
| details/summary | 詳細展開の意味構造とキー操作を標準機能で実現済み。余白/色を揃え、独自Accordionを作らない。 |
| 既存inline確認/globalThis.confirm | 適用/取消の既存契約を保持。新規Modalフローを追加しない。 |
| Auth.js標準画面・redirect | 仕様005と憲章VIに従い保持。独自フォームを復活させない。 |

例外は上記用途に限定する。通常ボタンや通常text入力を例外として放置しない。追加の例外が必要なら対象/不足要件/保持理由/検証結果を計画・対象一覧へ明記してレビューする。

## 画面・フォーカス・イベント

- ページ外枠、見出し階層、節、主要/補助/取消/削除の規則はplanの共通トークンを使用。適用済みの再生/音量等は同じテーマを保持する。
- server pageのDB取得と権限分岐を保持し、画面全体をuse clientへ移さない。関数をserver/client境界へ追加で渡さない。
- 入力名は既存の日本語labelまたはaria-labelで識別可能とする。caption/th/列名を消さない。
- Tab/Shift+Tab、Enter/Space、選択肢の矢印/Escape、確認/取消を実操作する。入力部品操作が演奏打鍵にならず、演奏入力がフォーム送信にならない。
- 幅360px/1280pxで通常操作は折返し可能とし、密な表/楽譜はmin-w-0と局所overflow領域で扱う。ページ全体の意図しない横スクロールを防ぐ。
- 既存のheaderリンクを狭幅で隠して終わりにしない。wrap等で到達性を確保し、ログイン/logoutのhandlerは保持する。

## 回帰の必須観測

1. 初期値と実選択後のFormData/payload一致（name、visibility、editScope、role、canMergeを含む）。
2. submit/Enterが1回だけ実行され、取消/ページ送り等は送信しない。pending中の再実行は既存条件どおり拒否。
3. 数値の空欄/null/0/小数/負数/境界値と不明音符の意味を保持。
4. 保存失敗/競合/再試行で同じ内容・key、確認取消で変更なし。
5. 認証・権限・ルート・楽譜値・演奏/採点/信頼度結果が不変。

純粋な見た目は実ブラウザーで観測し、部品のクラス名一致だけの試験を追加しない。
