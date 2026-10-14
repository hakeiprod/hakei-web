# Practiceモデルの公開契約

## 入口

`src/s-core/models/practice/index.ts`から名前付きexportし、既存Core/Sheetと同様に`import * as Practice`で利用できる。

| モデル      | 操作                                                                    | 出力・責務                                   |
| ----------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| Conditions  | static import(unknown)、export()                                        | 現在の条件DTOとの検証済み往復                |
| Performance | static import(unknown)、export()                                        | 原本イベント配列との検証済み往復             |
| Timeline    | static create(score: unknown, conditions: Conditions)、export()         | 現在の期待タイムラインDTO                    |
| Evaluator   | constructor(timeline, conditions, rule)、evaluate(performance, context) | matching、analysis、game（PRACTICEではnull） |

contextは`phase: LIVE / COMPLETED / INTERRUPTED`と、LIVEのelapsedUsまたは終了時のendedUsを持つ判別可能な型。現在のUIのlive未評価規則とserverのinterrupted未評価規則をそれぞれ維持し、別の意味の時刻を共用しない。具体的な境界条件を現行呼び出し側から移して回帰で確認する。

## 入出力の境界

unknown入力は既存のstrict Zodで検証。DB・API・Git・ハッシュへはexportしたプレーンDTOのみを渡し、クラスや値オブジェクトを渡さない。型名の変更で既存JSONのキーやenumを変えない。

内部のmatching/analyze/game関数は保持できるが、アプリ側はEvaluatorから利用する。移行中の旧入口は共通モデルに委譲し、二重の採点実装を作らない。移行終了時にアプリ・benchmarkの旧入口参照を除く。

## 信頼境界

サーバーは楽譜版・権限・保存済み規則・送信の整合性を自身で検証してEvaluatorに渡す。ブラウザー結果を保存の根拠にしない。評価モデルは認証、DB、Git、DOM、React、Web Audioに依存しない。

## 例外

既存エラーコード、入力拒否、空の範囲の扱いを維持する。モデル化を理由に拒否済みの不正入力を受け入れない。

## 時刻と未評価の境界

- LIVEはelapsedUs: TimeOffset（符号付きの安全な整数）、COMPLETED/INTERRUPTEDはendedUs: Microseconds（非負の安全な整数）を必須とし、phaseごとの入力を区別する。カウントイン中の負のelapsedUsを許可する。
- LIVEとINTERRUPTEDは、照合後のstatusがMISSEDで、note.onsetUs + windowUs > elapsedUsまたはendedUsの場合だけUNASSESSEDにする。等号は未評価にしない。COMPLETEDはこのマスクを適用しない。正解・誤音の判定をマスクで変更しない。
- TempoMapは小数の絶対マイクロ秒を返し、Timelineが小数の練習開始originを引いた後に端点をMath.roundする。丸め済みの絶対時刻同士を引く方式へ置き換えない。

## 期待タイムラインの往復

Timeline.import(unknown)は生成済みの期待タイムラインDTOをstrict検証して独立コピーとして所有する。benchmarkと期待値の往復に利用し、サーバーはクライアントの期待値を受け入れずTimeline.createで楽譜版から再生成する。exportのキー・単位は従来と同じ。

## 原本の照合操作

Performance.match(expected, window: Microseconds, calibration: TimeOffset, duration: Microseconds)は、所有する原本を内部の照合計算へ読み取り専用で渡し、新しいMatchingResultを返す。原本を公開せず、繰り返す評価でexportコピーを作らない。Evaluatorが判定規則・未評価マスク・分析・採点を組み立てる。

Timeline.importで小節情報のない生成済み期待値を扱う場合、分析の小節一覧は期待音のbarNumberから導出する。楽譜から作る通常のTimeline.createは既存のbarsを使用する。
