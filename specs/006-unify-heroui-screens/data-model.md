# Data Model: 既存値と一時UI状態の保持

新しいDB entity/列/migration/永続状態は追加しない。以下は既存部品が扱う値の契約であり、新しい共有モデルや汎用state machineを実装する指示ではない。

| 概念 | 既存の値・関係 | 保持条件 |
| --- | --- | --- |
| リポジトリ | name、visibility、editScope、repositoryId、accessVersion | nameの必須/最大200文字、PRIVATE/INVITED/PUBLIC、INVITED/ALL_USERS、期待versionを保持。 |
| メンバー操作 | userId、role、canMerge | VIEWER/EDITOR/ADMIN/REMOVEをそのまま送信。checkboxはチェック時on、未チェック時欠落。サーバーの権限判定は不変。 |
| 取込/修正 | 選択file、変換options、preview、issues、保存先 | 対応形式と5MiB制限、同一file再選択、入力保持、再検証、既存token/有効期限の扱いを維持。ログや表示へtokenを追加しない。 |
| 音符編集 | trackId、noteId、pitch、onset、duration、rest、page | 安定ID、整数音高0〜127、拍の小数、不明値null、休符の音高無効、50行ページングを維持。 |
| 編集提案 | summary、candidate、status、baseRevisionId、期待version/OID、key | 下書き/送信/確定操作の既存payloadと遷移を維持。競合時の入力と同一再試行keyを保持。 |
| 練習条件 | deviceId、trackId、startBar、endBar、tempoScale、calibrationMs、mode | trackIdの数値変換、開始/終了小節min1、テンポ0.25〜4/step0.05、補正-1000〜1000msを維持。全フィールドは実装時に現コードと照合する。 |
| 練習記録/分析 | sessionId、clientSessionId、revisionId、conditions、status、events、evaluation | 入力イベント、評価数値、暫定/確定、中断/完了、best、並び順、cursor、削除対象を維持。 |
| 信頼度 | targetId、value、rule、ruleId、policyVersion、reason | step=anyの数値精度、規則の各項目、理由最大2000文字、期待version、確認内容と取消を維持。 |

## 一時状態と遷移

- 通常フォーム: 初期/編集→既存検証→pending→成功または失敗。失敗は既存の値を保持し、再試行可能な場合に同じ意味の操作へ戻す。成功時のrefresh/clearを変更しない。
- 確認付き操作: 編集→確認→適用または取消。取消では送信しない。失敗時の確認内容保持、pending中の操作制限を維持する。
- 練習: 接続/選択→既存セッション開始→終了または中断→保存/再保存。実際の遷移はuse-practice-session等の既存hookが所有し、表示部品へ複製しない。
- 取込: file選択→変換→preview→修正/再検証→保存。失敗・取消・再選択の既存挙動を維持する。

## 検証ルール

空文字から0を生成する既存フィールドと、空文字からnullを生成する部分編集フィールドを区別する。共通の数値正規化関数を新設しない。required/min/max/step/name/defaultValueと選択肢の送信値をUI部品交換後にも確認し、検証やサーバースキーマ自体は変更しない。
