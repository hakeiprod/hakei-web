"use client";
import { prisma } from "@/prisma";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import * as Core from "@/s-core/models/core";
import "@/s-core/models/core/extensions/to-audio";
import * as Sheet from "@/s-core/models/sheet";
import * as SMUFL from "@/s-core/models/smufl";
import { useEffect, useMemo } from "react";
import { ScorePlayer } from "./score-player";
import { ScoreViewer } from "./score-viewer";
import { VirtualKeyboard } from "./virtual-keyboard";

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
      // TODO: mitt導入してもいいかも
      // eslint-disable-next-line react-hooks/immutability
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
