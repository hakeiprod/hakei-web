# 外部・永続契約の互換性

機能001の[contracts](../../001-score-practice-platform/contracts/)を既存契約として維持する。

- 既存ルート・Server Action名・入力・ActionResult・ステータスを維持する。
- PerformanceEventBatch.events、checksum、submissionHash、comparisonKeyの入力、イベント順序、キー、単位を維持する。新モデルのフィールドやブランドを混入させない。
- PracticeSessionの固定版・規則・条件、EvaluationResultのsummary/perNote/perBar、scoreとnull値、履歴と達成条件を維持する。
- 音楽の版管理はGitを維持し、canonical JSON、artifact、CAS、receipt、lease、prepare/adopt/publishとrecoveryの順序を変えない。
- インポート原本、partial candidate、問題一覧、preview期限、確認・再検証、形式対応・時間/サイズ制限を維持する。
- 外部入力検証、権限、freeze、削除・再計算、失敗時の取引を維持する。
- DB migration、保存データ書き換え、converterVersion/algorithmVersion/ruleVersion更新は本整理では行わない。

既存の固定事例との違いを検出した場合は互換性失敗として扱う。既知の不具合を修正する場合は別仕様・別の変更として説明し、本仕様の成功として扱わない。
