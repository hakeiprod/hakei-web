"use client";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import * as SMUFL from "@/s-core/models/smufl";
import * as Browser from "@/s-core/models/browser";
import * as Audio from "@/s-core/models/audio";
import { Input } from "@heroui/input";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";
import { useAtom } from "jotai";
import { masterVolumeAtom } from "@/store/master-volume";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import { RythmeGame } from "@/s-core/models/browser/rythme-game";
import { Button } from "@heroui/button";

export default function Score() {
  const [controller, setController] = useState<BrowserAudio.Controller>();
  const [recorder, setRecorder] = useState<RythmeGame>();
  const [soundfont2, setSoundfont2] = useState<Soundfont2>();
  const [smufl, setSMUFL] = useState<SMUFL.Score>();
  const [audio, setAudio] = useState<Audio.Score>();
  const [started, setStarted] = useState(false);
  const [masterVolume, setMasterVolume] = useAtom(masterVolumeAtom);
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
  useEffect(() => {
    fetch("/A320U.sf2")
      .then((res) => res.arrayBuffer())
      .then((buf) => setSoundfont2(Soundfont2.create(buf)));
  }, []);
  useEffect(() => {
    if (!controller && audio && soundfont2) {
      const controller = new BrowserAudio.Controller(audio, soundfont2);
      controller.masterGain.gain.value = masterVolume / 100;
      setController(controller);
    }
  }, [audio, soundfont2]);
  useEffect(() => {
    if (smufl && controller) {
      const rythmeRecorder = new RythmeGame(smufl, controller);
      setRecorder(rythmeRecorder);
      const svg = rythmeRecorder.keyboard.render();
      const test = rythmeRecorder.render();
      (async () => {
        if (test) ref.current?.appendChild(await test);
      })();
      // if (!ref.current?.hasChildNodes() && svg) ref.current?.appendChild(svg);
      // if (svg) ref.current?.appendChild(svg);
    }
  }, [controller, started]);
  return (
    <>
      {!started && (
        <>
          <Button
            disabled={!smufl}
            onPress={() => {
              recorder?.start();
              setStarted(true);
            }}
          >
            start
          </Button>
          <Input type="file" onChange={handleChange} />
        </>
      )}
      {started && <div ref={ref} />}
    </>
  );
}
