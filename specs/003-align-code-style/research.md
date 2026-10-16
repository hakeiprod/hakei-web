# Research: 既存設計への整合

## 1. 整合の基準

- Decision: 音楽モデルは既存のデータ所有・操作・import/exportの設計に合わせる。画面は関数コンポーネント、サーバーは境界処理と明示的な依存引数を維持する。
- Rationale: `src/s-core/models/core/score.ts`、`sheet/track.ts`にはクラスと値オブジェクトがあり、`src/components/show-score.tsx`は関数コンポーネント。単一の書き方を全領域へ強制する根拠はない。
- Alternatives considered: 全関数のクラス化は不要な状態と抽象化を増やす。現状維持だけではpracticeの責務を追跡する負担が残る。

## 2. 演奏モデルと評価の入口

- Decision: `practice/index.ts`で公開するPerformance、Conditions、Timeline、Evaluatorを設ける。録音データの所有、条件検証、期待値生成、評価の組み立てを実際に担当させ、既存の計算を内部の関数として再利用する。
- Rationale: `practice/contracts.ts`は検証と型の集合で中心となるモデルがない。`components/practice-controls.tsx`と`server/practice.ts`は照合・中断マスク・分析・採点を各々組み立てている。これを共通の評価操作に集約する。
- Alternatives considered: Core.Scoreへ録音を保存すると未終了NOTE_ON、イベント順序、実時間の原本を表現しにくい。汎用Performance専用階層の新設は現時点の利用範囲に比べて広いため、practice内で開始する。

## 3. 時間単位と変換

- Decision: Core.ScoreのBeatを維持。既存NumericValueObjectを基に非負整数のMicrosecondsと符号付き整数のTimeOffsetを追加する。TempoMapはBeatからMicrosecondsを求める共通モデルとする。
- Rationale: `core/units/beat.ts`のtoSecondsは単一テンポ用。途中のテンポ変更の区間累積には`practice/timeline.ts`の実装が必要。SoundFontのSecondsはvalidateで値域を検査せず、ファイル固有の配置でもあるため今回の厳密な録音単位の基底にはしない。
- Alternatives considered: Beatへの負の補正値格納は不適切。秒経由の再計算は丸め差が生じる。双方向変換とtoAudio全体の置き換えは新機能・挙動変更になるため対象外。

## 4. 検証済みのデータと既存クラス

- Decision: 外部境界のZodスキーマを維持し、Timelineは検証済みSheetのエクスポートデータを独立して保持する。Core/Sheetの既存クラスは意味が一致する変換に再利用する。
- Rationale: DTOから単純にimportし直してexportすると派生値や既定値によって保存結果が変わり得る。partial candidateを完全なSheet.Scoreに変換して不明値を埋めることも許されない。
- Alternatives considered: 生JSONの全域のクラス化や検証廃止は互換性・信頼境界を壊す。

## 5. 評価規則と性能

- Decision: matchPerformanceの音高優先照合、InputPoolの最適化、同時刻の順序、gameの和音判定を維持。遅延補正と終了時刻は明示的な値とし、入力イベントを変更しない。
- Rationale: default-ruleの150/30/60ミリ秒、誤音・余分・未評価の意味は機能001の契約。内部の計算は同じ入力から同じ結果を返せばクラス設計とも両立する。
- Alternatives considered: 単純な全探索への変更や録音の量子化は性能・分析結果を変える。

## 6. 変更順序と回帰

- Decision: 変更前の結果を固定し、モデル、利用側、UI責務分離の順に段階的に移行。旧関数の薄い委譲は移行中のみ認め、最終的に旧入口の参照を除く。
- Rationale: 機能001の大量の未コミット差分を基準にする必要があり、HEADを変更前として比較すると機能そのものが存在しない。実装開始時の作業ツリーを基準に保存する。
- Alternatives considered: HEADとの一括スナップショット比較、保存形式の変更、依存の追加は本目的に不要。

## 調査の範囲

ローカルの実装と既存テストを根拠にした設計判断。既存依存のバージョン更新や新規ライブラリ採用はない。モデル領域とアプリ領域を調査エージェントに分担して既存の参照例を確認した。実装・実測・人による読解確認は後続で行う。
