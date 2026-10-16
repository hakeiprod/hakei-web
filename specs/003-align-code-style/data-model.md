# Data Model

本設計はメモリ内モデルの整理。DBテーブル、Git保存物、送信JSONの追加・変更はない。現在のPrisma PracticeSessionとブラウザーPracticeSessionは既存の別責務であり、新規に同名の純粋モデルを追加しない。

## Performance

- 所有: sequence、type、channel、pitch、velocity、relativeUsを持つイベント列の独立したコピー。
- 操作: static import(unknown)、export()。取得・出力はコピーとし外部変更が内部に波及しない。
- 検証: 現在のperformanceEventsSchemaを再利用。最大100000件、sequence厳密増加、時刻非減少、MIDI値域、NOTE_ON velocity>0、relativeUs上限1801200000。
- 不変条件: NOTE_OFF欠落も原本として保持。自動補完・量子化・並び替えなし。exportは現在のイベントJSONを返す。

## Conditions

- フィールド: 現在のtrackId、rangeStartBar、rangeEndBar、tempoScale、calibrationUs、mode、ruleVersion。
- 操作: static import(unknown)、export()。現在の条件スキーマを唯一の検証ルールとする。
- 単位: rangeは1起点の包含範囲、tempoScaleは正、calibrationUsは符号付きTimeOffset。既存値域±1000000を維持。

## 時間値とTempoMap

- Microseconds: 非負の安全な整数。録音・期待音の時刻や長さに使用。
- TimeOffset: 符号付きの安全な整数。補正、時間差、カウントイン、負になり得るcorrectedUsに使用。
- 既存NumericValueObjectを継承して単位を明示する。ただし非負値同士の差はTimeOffsetを返す明示的な操作とし、基底subtractによる負値拒否を誤用しない。
- TempoMap: startのBeatと正のtempo値の区間、正の倍率、区間累積時間。最初の区間start=0、開始位置重複なし。
- TempoMap.microsecondsAt(Beat)は有限な小数の絶対マイクロ秒を返す。区間の積算順序を維持し、この段階でMicrosecondsへの整数化をしない。
- Timelineは小数のorigin = map.microsecondsAt(開始小節の拍)を保持し、各端点でMath.round(map.microsecondsAt(beat) - origin)を計算してからMicrosecondsにする。絶対時刻とoriginを個別に丸めてから引くことは禁止する。期待音の開始は現行と同じMath.max(0, 丸めた相対開始時刻)、音価は丸めた相対終了時刻から開始時刻を引く。barsと全体durationも同じ相対端点の丸め順序を維持する。
- Evaluator contextのLIVE.elapsedUsはTimeOffset（符号付きの安全な整数）、COMPLETED/INTERRUPTED.endedUsはMicroseconds（非負の安全な整数）。カウントイン中の負のelapsedUsを0へ丸めたり拒否したりしない。

## Timeline

- 入力: 検証済みSheetのexport snapshotとConditions。原本を変更しない。
- 所有: 現在のbars、notes、durationUs、rangeStartBeat、rangeEndBeat、continuations。
- 操作: static create(score: unknown, conditions: Conditions)、export()。スキーマによる検証を維持。
- 期待音: noteId、trackId、barNumber、pitch、onsetUs、durationUs、chordId。休符を攻撃として採点せず、タイ継続や範囲境界を現在と同じように扱う。
- 制約: 対象トラック・小節存在、正の範囲、30分上限。Core.Score.createへの変換でSheetのタイや小節情報を落とさない。

## Evaluatorと評価結果

- 入力: Timeline、Performance、Conditions、信頼境界で選択されたEvaluationRule、評価段階と時刻。
- 操作: evaluate(performance, context)。MatchingResult、analysis、gameを既存のJSON形で返す。
- live: 現行の未確定判定を隠す規則を適用。completed/interrupted: 現行終了時の未評価規則を適用。具体的な条件と境界は呼び出し側から抽出して固定比較する。
- 正誤・誤音・欠落・余分の定義、同時刻の順序、和音の厳しい判定、ゲームの分母・コンボ・null値を変更しない。
- 原本やTimelineを変更せず、新しい結果を生成。algorithmVersionとruleVersionは維持。

## ライフサイクル

ブラウザーPracticeSessionのCREATED→COUNTING→RECORDING→COMPLETED/INTERRUPTEDとcleanupを維持する。Performanceは完了後の原本を所有し、機器の購読やDB保存は所有しない。送信の再試行は同一clientSessionId、イベント、条件、終了情報で行い、ハッシュ入力を変えない。

## 期待タイムラインの往復

Timeline.import(unknown)は生成済みの期待タイムラインDTOをstrict検証して独立コピーとして所有する。benchmarkと期待値の往復に利用し、サーバーはクライアントの期待値を受け入れずTimeline.createで楽譜版から再生成する。exportのキー・単位は従来と同じ。

Performanceはexportコピーを境界で使い、内部のmatch操作では原本を読み取り専用で照合する。MatchingResultを変更しても原本は変わらない。Evaluatorは独立した期待値snapshotを保持し、評価のたびにTimeline全体を複製しない。
