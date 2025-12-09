"use client";
import * as SMUFL from "@/s-core/models/smufl";
import * as Sheet from "@/s-core/models/sheet";
import * as Core from "@/s-core/models/core";
import { prisma } from "@/prisma";
import { ScoreViewer } from "./score-viewer";
import { ScorePlayer } from "./score-player";
import { VirtualKeyboard } from "./virtual-keyboard";
import { useEffect, useMemo } from "react";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";
import "@/s-core/models/core/extensions/to-audio";

export function ShowScore(properties: {
  score: NonNullable<Awaited<ReturnType<typeof prisma.score.findUnique>>>;
}) {
  const scoreData = properties.score.data as unknown as ReturnType<
    Sheet.Score["export"]
  >;
  const audio = useMemo(
    () =>
      Core.Score.import({
        ...scoreData,
        notes: scoreData.notes.filter((note) => note.pitch !== -1),
      }).toAudio(),
    [scoreData]
  );
  const smufl = useMemo(() => SMUFL.Score.import(scoreData), [scoreData]);
  const keyboard = useMemo(
    () => new Keyboard(audio.keyRange),
    [audio.keyRange]
  );
  useEffect(() => {
    const noteHighlighter = new NoteHighlighter(smufl);
    for (const note of audio.notes) {
      note.onNoteOn = () => {
        noteHighlighter.noteOn(note);
        keyboard?.noteOn(note);
      };
      note.onNoteOff = () => {
        noteHighlighter.noteOff(note);
        keyboard?.noteOff(note);
      };
    }
  }, [audio.notes, keyboard, smufl]);
  return (
    <>
      <ScoreViewer score={smufl} />
      <ScorePlayer score={audio} />
      <VirtualKeyboard keyboard={keyboard} />
    </>
  );
}
