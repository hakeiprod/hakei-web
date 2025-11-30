"use client";
import * as SMUFL from "@/s-core/models/smufl";
import * as Sheet from "@/s-core/models/sheet";
import * as Audio from "@/s-core/models/audio";
import { prisma } from "@/prisma";
import { ScoreViewer } from "./score-viewer";
import { ScorePlayer } from "./score-player";
import { VirtualKeyboard } from "./virtual-keyboard";
import { useEffect, useMemo } from "react";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";

export function ShowScore(props: {
  score: NonNullable<Awaited<ReturnType<typeof prisma.score.findUnique>>>;
}) {
  const scoreData = props.score.data as unknown as ReturnType<
    Sheet.Score["export"]
  >;
  const audio = useMemo(
    () =>
      Audio.Score.import({
        ...scoreData,
        notes: scoreData.notes.filter((note) => note.pitch !== -1),
      }),
    []
  );
  const smufl = useMemo(() => SMUFL.Score.import(scoreData), []);
  const keyboard = useMemo(() => new Keyboard(audio.pitchRange), []);
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
  }, []);
  return (
    <>
      <ScoreViewer score={smufl} />
      <ScorePlayer score={audio} />
      <VirtualKeyboard keyboard={keyboard} />
    </>
  );
}
