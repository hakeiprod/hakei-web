"use client";
import { prisma } from "@/prisma";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import * as Sheet from "@/s-core/models/sheet";
import "@/s-core/models/sheet/extensions/to-audio";
import * as SMUFL from "@/s-core/models/smufl";
import { useEffect, useMemo, useState } from "react";
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
  const keyboard = useMemo(
    () => new Keyboard(audio.keyRange),
    [audio.keyRange],
  );
  const smufl = useMemo(() => SMUFL.Score.import(scoreData), [scoreData]);
  const controller = useMemo(() => {
    if (!soundfont2) return;
    const controller = new BrowserAudio.Controller(audio, soundfont2);
    // controller.emitter.on("stop", () => noteHighlighter.reset());
    return controller;
  }, [audio, soundfont2]);
  const noteHighlighter = useMemo(() => {
    if (controller) return new NoteHighlighter(smufl, controller);
  }, [controller, smufl]);
  useEffect(() => {
    noteHighlighter?.highlight();
    // for (const note of audio.notes) {
    //   note.emitter.on("noteOn", () => {
    //     noteHighlighter.noteOn(note);
    //     keyboard?.noteOn(note);
    //   });
    //   note.emitter.on("noteOff", () => {
    //     noteHighlighter.noteOff(note);
    //     keyboard?.noteOff(note);
    //   });
    // }
  }, [audio.notes, keyboard, noteHighlighter, smufl]);
  useEffect(() => {
    fetch("/A320U.sf2")
      .then((response) => response.arrayBuffer())
      .then((buffer) => setSoundfont2(Soundfont2.create(buffer)));
  }, []);
  return (
    <>
      <ScoreViewer score={smufl} />
      {controller && <ScorePlayer score={audio} controller={controller} />}
      <VirtualKeyboard keyboard={keyboard} />
    </>
  );
}
