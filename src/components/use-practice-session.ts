"use client";
import { useEffect, useRef, useState } from "react";
import * as Sheet from "@/s-core/models/sheet";
import "@/s-core/models/sheet/extensions/to-audio";
import * as Audio from "@/s-core/models/audio";
import { Controller } from "@/s-core/models/browser/audio/controller";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import { sheetScoreSchema } from "@/s-core/models/import/score-schema";
import { MidiRecorder } from "@/s-core/models/browser/midi-recorder";
import { PracticeClock } from "@/s-core/models/browser/practice-clock";
import {
  PracticeSession,
  type PracticeState,
} from "@/s-core/models/browser/practice-session";
import * as Practice from "@/s-core/models/practice";
import { Microseconds, TimeOffset } from "@/s-core/models/core/units";
import type { GameEvaluation } from "@/s-core/models/practice/game-evaluation";
import type { PracticeConditions } from "@/s-core/models/practice/contracts";
import { beginPractice, markPracticeRecording } from "@/app/actions/practice";
import type { AnalysisData } from "./practice-analysis";
import { usePracticeSubmission } from "./use-practice-submission";
import type { PracticeControlsProperties } from "./practice-controls";
interface PracticeSelection {
  trackId: number;
  startBar: number;
  endBar: number;
  tempoScale: number;
  calibrationMs: number;
}
export function usePracticeSession(
  properties: PracticeControlsProperties,
  data: ReturnType<typeof sheetScoreSchema.parse>,
  selection: PracticeSelection,
) {
  const { trackId, startBar, endBar, tempoScale, calibrationMs } = selection;
  const mode = properties.mode ?? "PRACTICE";
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [deviceState, setDeviceState] = useState("PERMISSION_REQUIRED");
  const [state, setState] = useState<PracticeState>("CREATED");
  const [soundfont, setSoundfont] = useState<Soundfont2>();
  const [analysis, setAnalysis] = useState<AnalysisData>();
  const recorder = useRef<MidiRecorder | null>(null);
  const session = useRef<PracticeSession | null>(null);
  const controller = useRef<Controller | null>(null);
  const mounted = useRef(true);
  const [game, setGame] = useState<GameEvaluation>();
  const [interrupted, setInterrupted] = useState(false);
  const submission = usePracticeSubmission({
    score: properties.score,
    mode,
    mounted,
    setAnalysis,
    setGame,
  });
  const {
    pending,
    setPending,
    message,
    setMessage,
    savedId,
    setSavedId,
    hasRetry,
    setHasRetry,
    bestNotice,
    setBestNotice,
    clearRetry,
    retrySave,
    save,
  } = submission;
  const active = state === "COUNTING" || state === "RECORDING";
  useEffect(() => {
    mounted.current = true;
    const midi = new MidiRecorder({
      onChange: () => {
        if (mounted.current) {
          setDevices(midi.devices);
          setDeviceState(midi.status);
        }
      },
      onInterrupt: (reason) => session.current?.interrupt(reason),
    });
    recorder.current = midi;
    // Capability state is read after construction, without requesting permission.

    setDeviceState(midi.status);
    const abort = new AbortController();
    fetch("/A320U.sf2", { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error("AUDIO_UNAVAILABLE");
        return response.arrayBuffer();
      })
      .then((bytes) => {
        if (!abort.signal.aborted && mounted.current)
          setSoundfont(Soundfont2.create(bytes));
      })
      .catch(() => {
        if (!abort.signal.aborted && mounted.current)
          setMessage("基準音を読み込めません。ページを開き直してください。");
      });
    return () => {
      mounted.current = false;
      abort.abort();
      session.current?.dispose();
      midi.dispose();
      controller.current?.unmount();
      recorder.current = null;
      session.current = null;
      controller.current = null;
      clearRetry();
    };
  }, [clearRetry, setMessage]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (active || hasRetry || pending) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const hide = () => {
      mounted.current = false;
      session.current?.dispose();
      recorder.current?.dispose();
      controller.current?.unmount();
      clearRetry();
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) location.reload();
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, [active, hasRetry, pending, clearRetry]);
  async function start() {
    if (hasRetry) return;
    const midi = recorder.current;
    if (!midi || !soundfont || !deviceId) return;
    setPending(true);
    setMessage("演奏の準備中です…");
    setAnalysis(undefined);
    setSavedId(undefined);
    setHasRetry(false);
    setGame(undefined);
    setInterrupted(false);
    setBestNotice(false);
    clearRetry();
    let player: Controller | undefined;
    try {
      const conditions: PracticeConditions = {
        trackId,
        rangeStartBar: startBar,
        rangeEndBar: endBar,
        tempoScale,
        calibrationUs: Math.round(calibrationMs * 1000),
        mode,
        ruleVersion: properties.rule.version,
      };
      const conditionModel = Practice.Conditions.import(conditions);
      const timelineModel = Practice.Timeline.create(data, conditionModel);
      const timeline = timelineModel.export();
      const evaluator = new Practice.Evaluator(
        timelineModel,
        conditionModel,
        properties.rule,
      );
      if (timeline.notes.length === 0) throw new Error("EMPTY_RANGE");
      player = new Controller(
        Sheet.Score.import(
          data as unknown as ReturnType<Sheet.Score["export"]>,
        ).toAudio(),
        soundfont,
        new Audio.Units.Gain(0.25),
      );
      controller.current = player;
      const resume = player.audioContext.resume();
      await midi.select(deviceId);
      await resume;
      if (!mounted.current) {
        player.unmount();
        return;
      }
      const clientSessionId = crypto.randomUUID();
      const setup = await beginPractice({
        clientSessionId,
        scoreId: properties.score.id,
        scoreRevisionId: properties.score.revisionId,
        conditions,
        deviceLabel:
          midi.devices.find((device) => device.id === deviceId)?.name ??
          "MIDI入力",
      });
      if (!mounted.current) {
        player.unmount();
        return;
      }
      if (!setup.ok) {
        setMessage(setup.error.message);
        player.unmount();
        return;
      }
      const recording = await markPracticeRecording({
        sessionId: setup.data.sessionId,
      });
      if (!mounted.current) {
        player.unmount();
        return;
      }
      if (!recording.ok) {
        setMessage(recording.error.message);
        player.unmount();
        return;
      }
      const clock = new PracticeClock(player.audioContext);
      const windowUs =
        mode === "GAME"
          ? properties.rule.goodWindowUs
          : properties.rule.practiceWindowUs;
      const audio = player;
      let lastProgress = -Infinity;
      const next = new PracticeSession({
        recorder: midi,
        clock,
        audio: audio.audioContext,
        document,
        play: (timeline, origin) =>
          audio.playTimeline(timeline, origin.contextTime),
        stopAudio: () => audio.stop(),
        onChange: () => {
          if (mounted.current) setState(next.state);
        },
        onProgress: (elapsed) => {
          if (
            mode !== "GAME" ||
            !mounted.current ||
            elapsed - lastProgress < 100_000
          )
            return;
          lastProgress = elapsed;
          const result = evaluator.evaluate(
            Practice.Performance.import(midi.events),
            {
              phase: "LIVE",
              elapsedUs: new TimeOffset(elapsed),
            },
          );
          if (result.game) setGame(result.game);
        },
        onFinish: (snapshot) => {
          const result = evaluator.evaluate(
            Practice.Performance.import(snapshot.events),
            {
              phase: snapshot.status,
              endedUs: new Microseconds(snapshot.endedUs),
            },
          );
          if (mounted.current) {
            setAnalysis(result.analysis);
            setInterrupted(snapshot.status === "INTERRUPTED");
            if (result.game) setGame(result.game);
          }
          audio.unmount();
          save(snapshot, {
            clientSessionId,
            conditions,
            deviceLabel:
              midi.devices.find((device) => device.id === deviceId)?.name ??
              "MIDI入力",
          });
        },
      });
      session.current = next;
      await next.start(
        timeline,
        windowUs + Math.max(0, conditions.calibrationUs),
        (4 * 60_000) / (data.tempos[0].value * tempoScale),
      );
      setMessage("4拍のカウントイン後に、楽譜に合わせて演奏してください。");
    } catch (error) {
      player?.unmount();
      if (mounted.current)
        setMessage(
          error instanceof Error && error.message === "EMPTY_RANGE"
            ? "この範囲には新しく打鍵する音符がありません。範囲を変更してください。"
            : "演奏を開始できませんでした。機器と音声の接続を確認してください。",
        );
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  async function connect() {
    setPending(true);
    try {
      await recorder.current?.connect();
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  return {
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
    ready: !!soundfont,
    savedId,
    hasRetry,
    bestNotice,
    start,
    connect,
    interrupt: () => session.current?.interrupt("MANUAL"),
    retrySave,
  };
}
