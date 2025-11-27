import * as Sheet from "@/s-core/models/sheet";
import { ScoreViewer } from "@/components/score-viewer";
import { ScorePlayer } from "@/components/score-player";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";
import { VirtualKeyboard } from "@/components/virtual-keyboard";
import { Keyboard } from "@/s-core/models/browser/keyboard";
import { KeyeventConnecter } from "@/s-core/models/keyboard_input/keyevent-connecter";
import { MidiinputConnecter } from "@/s-core/models/keyboard_input/midiinput-connecter";
import { prisma } from "@/prisma";
import "@/s-core/models/sheet/extensions/to-smufl";
import "@/s-core/models/core/extensions/to-audio";

export default async function Score(props: PageProps<"/score/[id]">) {
  const score = await prisma.score.findUnique({
    where: { id: Number((await props.params).id) },
  });
  if (!score) return <>no score</>;
  const sheet = Sheet.Score.create(score.data as Sheet.Parameter);
  const smufl = sheet.toSMUFL();
  const audio = smufl?.toAudio();
  const keyboard = new Keyboard(smufl!.pitchRange);
  // new KeyeventConnecter(keyboard);
  // new MidiinputConnecter(keyboard);
  if (smufl && audio) {
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
  }
  return (
    <>
      <ScoreViewer score={smufl} />
      <ScorePlayer score={audio} />
      <VirtualKeyboard keyboard={keyboard} />
    </>
  );
}
