"use client";
import {
  CardBody,
  Card,
  Button,
  SelectItem,
  Select,
  Input,
  Link as HeroLink,
} from "@heroui/react";

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
    <Card
      aria-label="演奏記録"
      as="section"
      className="min-w-0 overflow-visible border border-divider bg-content1"
    >
      <CardBody className="min-w-0 space-y-4 p-4 sm:p-6">
        <h2 className="text-xl font-semibold">
          {mode === "GAME" ? "リズムゲーム" : "MIDI演奏の記録"}
        </h2>
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
        <Button
          onClick={connect}
          isDisabled={active || pending || deviceState === "UNAVAILABLE"}
          type="button"
          color="default"
          variant="bordered"
          className="max-w-full whitespace-normal"
          isLoading={pending}
        >
          MIDI入力を接続
        </Button>
        <div className="min-w-0">
          <Select
            onChange={(event) => setDeviceId(event.target.value)}
            isDisabled={active || pending}
            label="入力機器"
            variant="bordered"
            labelPlacement="outside"
            selectedKeys={String(deviceId) === "" ? [] : [String(deviceId)]}
            placeholder="入力を選択"
            className="min-w-0"
          >
            {devices.map((device) => (
              <SelectItem key={String(device.id)}>{device.name}</SelectItem>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <Select
            onChange={(event) => setTrackId(Number(event.target.value))}
            isDisabled={active || pending}
            label="対象トラック"
            variant="bordered"
            labelPlacement="outside"
            selectedKeys={String(trackId) === "" ? [] : [String(trackId)]}
            disallowEmptySelection
            className="min-w-0"
          >
            {data.tracks.map((track) => (
              <SelectItem key={String(track.id)}>
                {track.name || `トラック${track.id + 1}`}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <Input
            type="number"
            min={1}
            onChange={(event) => setStartBar(Number(event.target.value))}
            value={startBar == null ? "" : String(startBar)}
            label="開始小節"
            variant="bordered"
            labelPlacement="outside"
            className="min-w-0"
            isDisabled={active || pending}
          />
        </div>
        <div className="min-w-0">
          <Input
            type="number"
            min={1}
            onChange={(event) => setEndBar(Number(event.target.value))}
            value={endBar == null ? "" : String(endBar)}
            label="終了小節"
            variant="bordered"
            labelPlacement="outside"
            className="min-w-0"
            isDisabled={active || pending}
          />
        </div>
        <div className="min-w-0">
          <Input
            type="number"
            min={0.25}
            max={4}
            step={0.05}
            onChange={(event) => setTempoScale(Number(event.target.value))}
            value={tempoScale == null ? "" : String(tempoScale)}
            label="テンポ比"
            variant="bordered"
            labelPlacement="outside"
            className="min-w-0"
            isDisabled={active || pending}
          />
        </div>
        <div className="min-w-0">
          <Input
            type="number"
            min={-1000}
            max={1000}
            onChange={(event) => setCalibrationMs(Number(event.target.value))}
            value={calibrationMs == null ? "" : String(calibrationMs)}
            label="入力遅延補正（ms）"
            description="正の値は記録時刻から差し引きます。"
            variant="bordered"
            labelPlacement="outside"
            className="min-w-0"
            isDisabled={active || pending}
          />
        </div>
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
        <Button
          onClick={start}
          isDisabled={
            active ||
            pending ||
            hasRetry ||
            !ready ||
            !deviceId ||
            deviceState === "UNAVAILABLE"
          }
          type="button"
          color="primary"
          variant="solid"
          className="max-w-full whitespace-normal"
          isLoading={pending}
        >
          演奏を開始
        </Button>
        {active && (
          <Button
            onClick={interrupt}
            type="button"
            color="default"
            variant="bordered"
            className="max-w-full whitespace-normal"
          >
            演奏を中断
          </Button>
        )}
        <p
          role="status"
          className="empty:hidden rounded-lg bg-default-100 p-3 text-sm text-foreground"
        >
          {message}
        </p>
        {hasRetry && !pending && (
          <Button
            onClick={retrySave}
            type="button"
            color="primary"
            variant="solid"
            className="max-w-full whitespace-normal"
          >
            同じ記録の保存を再試行
          </Button>
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
          <p
            role="status"
            className="empty:hidden rounded-lg bg-default-100 p-3 text-sm text-foreground"
          >
            達成: この条件の自己ベストを更新しました。
          </p>
        )}{" "}
        {savedId && (
          <HeroLink
            href={`/practice/${savedId}`}
            className="rounded-small text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            保存した記録を見る
          </HeroLink>
        )}
      </CardBody>
    </Card>
  );
}
