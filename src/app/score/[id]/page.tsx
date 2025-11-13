"use client";
import * as SMUFL from "@/s-core/models/smufl";
import * as Browser from "@/s-core/models/browser";
import * as Audio from "@/s-core/models/audio";
import { ScoreViewer } from "@/components/score-viewer";
import { Input } from "@heroui/input";
import { ChangeEvent, useRef, useState } from "react";
import { ScorePlayer } from "@/components/score-player";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";

export default function Score() {
  const [smufl, setSMUFL] = useState<SMUFL.Score>();
  const [audio, setAudio] = useState<Audio.Score>();
  const ref = useRef<HTMLDivElement>(null);
  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file) return;
      const smufl = (await new Browser.Importer().import(file))?.toSMUFL();
      const audio = smufl?.toAudio();
      setSMUFL(smufl);
      setAudio(audio);
      if (smufl && audio && ref.current) {
        const noteHighlighter = new NoteHighlighter(smufl);
        for (const note of audio.notes) {
          note.onNoteOn = () => {
            noteHighlighter.noteOn(note);
          };
          note.onNoteOff = () => {
            noteHighlighter.noteOff(note);
          };
        }
      }
    }
  };
  return (
    <>
      <Input type="file" onChange={handleChange} />
      <ScoreViewer score={smufl} ref={ref} />
      <ScorePlayer score={audio} />
    </>
  );
}
