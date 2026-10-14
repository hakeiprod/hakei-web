"use client";
import { useMemo, useState } from "react";
import { sheetScoreSchema } from "@/s-core/models/import/score-schema";
import type { EvaluationRule } from "@/s-core/models/practice";
import { usePracticeSession } from "./use-practice-session";
import { PracticeAnalysis } from "./practice-analysis";
import { GameResult } from "./game-result";
export interface PracticeControlsProperties {
  score: {
    id: number;
    repositoryId: string;
    revisionId: string;
    data: unknown;
  };
  rule: EvaluationRule;
  mode?: "PRACTICE" | "GAME";
}
export function PracticeControls(properties: PracticeControlsProperties) {
  const data = useMemo(
    () => sheetScoreSchema.parse(properties.score.data),
    [properties.score.data],
  );
  const mode = properties.mode ?? "PRACTICE";
  const [trackId, setTrackId] = useState(data.tracks[0]?.id ?? 0);
  const [startBar, setStartBar] = useState((data.masterbars[0]?.id ?? 0) + 1);
  const [endBar, setEndBar] = useState((data.masterbars.at(-1)?.id ?? 0) + 1);
  const [tempoScale, setTempoScale] = useState(1);
  const [calibrationMs, setCalibrationMs] = useState(0);
  const {
    devices,
    deviceId,
    setDeviceId,
    deviceState,
    state,
    pending,
    message,
    analysis,
    game,
    interrupted,
    active,
    ready,
    savedId,
    hasRetry,
    bestNotice,
    start,
    connect,
    interrupt,
    retrySave,
  } = usePracticeSession(properties, data, {
    trackId,
    startBar,
    endBar,
    tempoScale,
    calibrationMs,
  });
  return (
    <section aria-label="演奏記録">
      <h2>{mode === "GAME" ? "リズムゲーム" : "MIDI演奏の記録"}</h2>
      <p>
        基準: 版{properties.score.revisionId.slice(0, 8)}・判定ルール
        {properties.rule.version}。
        {mode === "GAME"
          ? "成功±60ms・最高判定±30ms。和音はすべての音高が必要です。"
          : "音高と±150msのタイミングを評価します。"}
      </p>
      <p>
        MIDI入力:{" "}
        {deviceState === "UNAVAILABLE"
          ? "このブラウザーはMIDI入力に対応していません。楽譜は閲覧できます。"
          : deviceState === "PERMISSION_REQUIRED"
            ? "接続を許可してください。"
            : deviceState === "DISCONNECTED"
              ? "機器が接続されていません。"
              : "接続可能"}
      </p>
      <button
        disabled={active || pending || deviceState === "UNAVAILABLE"}
        onClick={connect}
      >
        MIDI入力を接続
      </button>
      <label>
        入力機器
        <select
          value={deviceId}
          disabled={active || pending}
          onChange={(event) => setDeviceId(event.target.value)}
        >
          <option value="">入力を選択</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        対象トラック
        <select
          value={trackId}
          disabled={active || pending}
          onChange={(event) => setTrackId(Number(event.target.value))}
        >
          {data.tracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.name || `トラック${track.id + 1}`}
            </option>
          ))}
        </select>
      </label>
      <label>
        開始小節
        <input
          type="number"
          min={1}
          value={startBar}
          disabled={active || pending}
          onChange={(event) => setStartBar(Number(event.target.value))}
        />
      </label>
      <label>
        終了小節
        <input
          type="number"
          min={1}
          value={endBar}
          disabled={active || pending}
          onChange={(event) => setEndBar(Number(event.target.value))}
        />
      </label>
      <label>
        テンポ比
        <input
          type="number"
          min={0.25}
          max={4}
          step={0.05}
          value={tempoScale}
          disabled={active || pending}
          onChange={(event) => setTempoScale(Number(event.target.value))}
        />
      </label>
      <label>
        入力遅延補正（ms、正の値は記録時刻から差し引きます）
        <input
          type="number"
          min={-1000}
          max={1000}
          value={calibrationMs}
          disabled={active || pending}
          onChange={(event) => setCalibrationMs(Number(event.target.value))}
        />
      </label>
      <p>
        状態:{" "}
        {state === "COUNTING"
          ? "カウントイン"
          : state === "RECORDING"
            ? "録音中"
            : state === "COMPLETED"
              ? "演奏完了"
              : state === "INTERRUPTED"
                ? "中断"
                : "準備"}
      </p>
      <button
        disabled={
          active ||
          pending ||
          hasRetry ||
          !ready ||
          !deviceId ||
          deviceState === "UNAVAILABLE"
        }
        onClick={start}
      >
        演奏を開始
      </button>
      {active && <button onClick={interrupt}>演奏を中断</button>}
      <p role="status">{message}</p>
      {hasRetry && !pending && (
        <button onClick={retrySave}>同じ記録の保存を再試行</button>
      )}
      {game && (
        <GameResult
          game={game}
          provisional={!savedId}
          interrupted={interrupted}
        />
      )}{" "}
      {analysis && (
        <PracticeAnalysis analysis={analysis} provisional={!savedId} />
      )}{" "}
      {bestNotice && (
        <p role="status">達成: この条件の自己ベストを更新しました。</p>
      )}{" "}
      {savedId && <a href={`/practice/${savedId}`}>保存した記録を見る</a>}
    </section>
  );
}
