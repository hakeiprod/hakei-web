# PRに含める検証証拠

[最終集計](measurements/final-results.json)、[全ブラウザー試行](measurements/final/browser-results.json)、[モデル比較](measurements/final/model-comparison.json)、[US3](measurements/us3-results.json)、固定済み変更前基準、回帰試験が直接読む独立Document/SVGをコミット対象とする。選択したファイルの一覧・サイズ・SHA256は[published-evidence.json](published-evidence.json)に記録した。

生trace、網羅的なJPEG/PNG、診断用source archiveは約5.1GBあるためローカルに保持し、通常のGit履歴へ追加しない。GitHubへupload済みとは主張しない。最終の3 archiveの識別・SHA256は[archives.json](measurements/final/archives.json)を参照する。過去のvalidation/JSON内で示すraw画像・trace・archiveへのリンクはローカル証拠への参照であり、PRのcheckoutだけでは開けない場合がある。必要時は元workspaceに保持した同じhashのarchiveをレビューする。

回帰試験に必要な固定基準と素材はコミットされるため、生traceの取得や再計測を行わず通常の全単体試験を実行できる。性能の全96条件の結果は既存収集値を保持し、PR用のファイル整理やテストworker数の設定を製品の再測定と読み替えない。
