"use client";
import { prisma } from "@/prisma";
import * as Audio from "@/s-core/models/audio";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import * as Sheet from "@/s-core/models/sheet";
import "@/s-core/models/sheet/extensions/to-audio";
import * as SMUFL from "@/s-core/models/smufl";
import { masterVolumeAtom } from "@/store/master-volume";
import { getDefaultStore } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { ScoreMixier } from "./score-mixier";
import { ScorePlayer } from "./score-player";
import { ScoreViewer } from "./score-viewer";
import { VirtualKeyboard } from "./virtual-keyboard";

export function ShowScore(properties: {
  score: NonNullable<Awaited<ReturnType<typeof prisma.score.findUnique>>>;
}) {
  const [soundfont2, setSoundfont2] = useState<Soundfont2>();
  const scoreData = properties.score.data as unknown as ReturnType<
    Sheet.Score["export"]
  >;
  const audio = useMemo(
    () => Sheet.Score.import(scoreData).toAudio(),
    [scoreData],
  );
  const keyboard = useMemo(() => new Keyboard(audio.keyRange), [audio]);
  const smufl = useMemo(() => SMUFL.Score.import(scoreData), [scoreData]);
  const [controller, setController] = useState<BrowserAudio.Controller>();
  useEffect(() => {
    if (!soundfont2) return;
    const next = new BrowserAudio.Controller(
      audio,
      soundfont2,
      new Audio.Units.Volume(getDefaultStore().get(masterVolumeAtom)).toGain(),
    );
    next.mount();
    // The controller owns browser resources and must be created after commit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setController(next);
    return () => next.unmount();
  }, [audio, soundfont2]);
  useEffect(() => {
    if (!controller) return;
    const highlighter = new NoteHighlighter(smufl, controller);
    highlighter.highlight();
    return () => highlighter.stop();
  }, [controller, smufl]);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/A320U.sf2", { signal: abort.signal })
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (!abort.signal.aborted) setSoundfont2(Soundfont2.create(buffer));
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) console.error(error);
      });
    return () => abort.abort();
  }, []);
  return (
    <>
      <ScoreViewer score={smufl} />
      {controller && <ScorePlayer score={audio} controller={controller} />}
      <ScoreMixier score={audio} />
      <VirtualKeyboard keyboard={keyboard} />
    </>
  );
}
