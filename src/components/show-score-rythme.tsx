"use client";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import * as Sheet from "@/s-core/models/sheet";
import * as Core from "@/s-core/models/core";
import { useEffect, useRef, useState } from "react";
import { RythmeGame } from "@/s-core/models/browser/rythme-game";
import { Button } from "@heroui/button";
import { useAtom } from "jotai";
import { masterVolumeAtom } from "@/store/master-volume";
import { Checkbox, CheckboxGroup } from "@heroui/react";
import { prisma } from "@/prisma";
import "@/s-core/models/core/extensions/to-audio";
import localFont from "next/font/local";
import { isNullish } from "remeda";

const bravura = localFont({
  src: [{ path: "../s-core/const/bravura/Bravura.woff" }],
});
export function ShowScoreRythme(properties: {
  score: NonNullable<Awaited<ReturnType<typeof prisma.score.findUnique>>>;
}) {
  const [rythmeGame, setRythmeGame] = useState<RythmeGame>();
  const [started, setStarted] = useState(false);
  const [masterVolume] = useAtom(masterVolumeAtom);
  const [trackIds, setTrackIds] = useState<number[]>([]);
  const [soundfont2, setSoundfont2] = useState<Soundfont2>();
  const reference = useRef<HTMLDivElement>(null);
  const scoreData = properties.score.data as unknown as ReturnType<
    Sheet.Score["export"]
  >;
  useEffect(() => {
    fetch("/A320U.sf2")
      .then((response) => response.arrayBuffer())
      .then((buffer) => setSoundfont2(Soundfont2.create(buffer)));
  }, []);
  useEffect(() => {
    if (!soundfont2) return;
    const rythmeGame = new RythmeGame(
      Core.Score.import({
        ...scoreData,
        notes: scoreData.notes.filter((note) => note.pitch !== -1),
      }).toAudio(),
      soundfont2,
      bravura.style.fontFamily
    );
    rythmeGame.audioController.masterGain.gain.value = masterVolume / 100;
    setRythmeGame(rythmeGame);
  }, [masterVolume, scoreData, soundfont2]);
  return (
    <>
      {!started && (
        <>
          <Button
            onPress={() => {
              setStarted(true);
              (async () => {
                if (isNullish(rythmeGame)) return;
                // TODO:　リファクタ
                rythmeGame.rythme.tracks = rythmeGame.rythme.tracks.filter(
                  (track) => trackIds.includes(track.id)
                );
                rythmeGame.rythme.notes = rythmeGame.rythme.notes.filter(
                  (note) => trackIds.includes(note.trackId)
                );
                rythmeGame.start();
                reference.current?.append(await rythmeGame.render());
              })();
            }}
          >
            start
          </Button>
          <CheckboxGroup
            label="Select Tracks"
            onChange={(trackIds) => setTrackIds(trackIds.map(Number))}
          >
            {scoreData.tracks.map((track) => (
              <Checkbox key={track.id} value={track.id.toString()}>
                {track.name} - trackId:{track.id}
              </Checkbox>
            ))}
          </CheckboxGroup>
        </>
      )}
      <div ref={reference} className={bravura.className} />
    </>
  );
}
