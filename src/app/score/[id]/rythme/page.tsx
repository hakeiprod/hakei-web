"use client";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import * as SMUFL from "@/s-core/models/smufl";
import * as Browser from "@/s-core/models/browser";
import { Input } from "@heroui/input";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { NoteHighlighter } from "@/s-core/models/audio_sheet/note-highlighter";
import { RythmeGame } from "@/s-core/models/browser/rythme-game";
import { Button } from "@heroui/button";
import { useAtom } from "jotai";
import { masterVolumeAtom } from "@/store/master-volume";
import { Checkbox, CheckboxGroup } from "@heroui/react";

export default function Score() {
  const [soundfont2, setSoundfont2] = useState<Soundfont2>();
  const [smufl, setSMUFL] = useState<SMUFL.Score>();
  const [rythmeGame, setRythmeGame] = useState<RythmeGame>();
  const [started, setStarted] = useState(false);
  const [masterVolume, setMasterVolume] = useAtom(masterVolumeAtom);
  const [trackIds, setTrackIds] = useState<number[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file) return;
      const smufl = (await new Browser.Importer().import(file))?.toSMUFL();
      const audio = smufl?.toAudio();
      setSMUFL(smufl);
      if (smufl && audio && ref.current) {
        const noteHighlighter = new NoteHighlighter(smufl);
        for (const note of audio.notes) {
          note.onNoteOn = () => noteHighlighter.noteOn(note);
          note.onNoteOff = () => noteHighlighter.noteOff(note);
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
    if (smufl && soundfont2) {
      const rythmeGame = new RythmeGame(smufl.toAudio(), soundfont2);
      setRythmeGame(rythmeGame);
      rythmeGame.audioController.masterGain.gain.value = masterVolume / 100;
    }
  }, [smufl, soundfont2]);
  return (
    <>
      {!started && (
        <>
          <Button
            disabled={!smufl}
            onPress={() => {
              setStarted(true);
              (async () => {
                if (!rythmeGame) return;
                rythmeGame.start();
                // TODO:　リファクタ
                rythmeGame.rythme.tracks = rythmeGame.rythme.tracks.filter(
                  (track) => trackIds.includes(track.id)
                );
                rythmeGame.rythme.notes = rythmeGame.rythme.notes.filter(
                  (note) => trackIds.includes(note.trackId)
                );
                ref.current?.appendChild(await rythmeGame!.render());
              })();
            }}
          >
            start
          </Button>
          <Input type="file" onChange={handleChange} />
          <CheckboxGroup
            label="Select Tracks"
            onChange={(trackIds) =>
              setTrackIds(trackIds.map((trackId) => Number(trackId)))
            }
          >
            {smufl?.tracks.map((track) => (
              <Checkbox key={track.id} value={track.id.toString()}>
                {track.name} - trackId:{track.id}
              </Checkbox>
            ))}
          </CheckboxGroup>
        </>
      )}
      <div ref={ref} />
    </>
  );
}
