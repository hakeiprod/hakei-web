import * as Sheet from "@/s-core/models/sheet";
import { ScorePlayer } from "@/components/score-player";
import { ScoreViewer } from "@/components/score-viewer";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";
import { VirtualKeyboard } from "@/components/virtual-keyboard";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import { KeyeventConnecter } from "@/s-core/models/keyboard_input/keyevent-connecter";
import { MidiinputConnecter } from "@/s-core/models/keyboard_input/midiinput-connecter";
import { prisma } from "@/prisma";
import "@/s-core/models/sheet/extensions/to-smufl";
import "@/s-core/models/core/extensions/to-audio";
import { notFound } from "next/navigation";

export default async function Score(props: PageProps<"/score/[id]">) {
  const score = await prisma.score.findUnique({
    where: { id: Number((await props.params).id) },
  });
  if (!score) return notFound();
  const scoreData = score.data as unknown as ReturnType<Sheet.Score["export"]>;
  // const smufl = sheet.toSMUFL();
  // const audio = sheet.toAudio();
  // new KeyeventConnecter(keyboard);
  // new MidiinputConnecter(keyboard);
  // if (smufl && audio) {
  //   const noteHighlighter = new NoteHighlighter(smufl);
  //   for (const note of audio.notes) {
  //     note.onNoteOn = () => {
  //       noteHighlighter.noteOn(note);
  //       keyboard?.noteOn(note);
  //     };
  //     note.onNoteOff = () => {
  //       noteHighlighter.noteOff(note);
  //       keyboard?.noteOff(note);
  //     };
  //   }
  // }
  return (
    <>
      <ScoreViewer score={scoreData} />
      <ScorePlayer score={scoreData} />
      <VirtualKeyboard score={scoreData} />
    </>
  );
}
