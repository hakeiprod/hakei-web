"use client";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import * as Sheet from "@/s-core/models/sheet";
import * as Audio from "@/s-core/models/audio";
import { useEffect, useRef, useState } from "react";
import { RythmeGame } from "@/s-core/models/browser/rythme-game";
import { Button } from "@heroui/button";
import { useAtom } from "jotai";
import { masterVolumeAtom } from "@/store/master-volume";
import { Checkbox, CheckboxGroup } from "@heroui/react";
import { prisma } from "@/prisma";

export function ShowScoreRythme(props: {
  score: NonNullable<Awaited<ReturnType<typeof prisma.score.findUnique>>>;
}) {
  const [rythmeGame, setRythmeGame] = useState<RythmeGame>();
  const [started, setStarted] = useState(false);
  const [masterVolume] = useAtom(masterVolumeAtom);
  const [trackIds, setTrackIds] = useState<number[]>([]);
  const [soundfont2, setSoundfont2] = useState<Soundfont2>();
  const ref = useRef<HTMLDivElement>(null);
  const scoreData = props.score.data as unknown as ReturnType<
    Sheet.Score["export"]
  >;
  useEffect(() => {
    fetch("/A320U.sf2")
      .then((res) => res.arrayBuffer())
      .then((buf) => setSoundfont2(Soundfont2.create(buf)));
  }, []);
  useEffect(() => {
    if (!soundfont2) return;
    const rythmeGame = new RythmeGame(
      Audio.Score.import({
        ...scoreData,
        notes: scoreData.notes.filter((note) => note.pitch !== -1),
      }),
      soundfont2
    );
    rythmeGame.audioController.masterGain.gain.value = masterVolume / 100;
    setRythmeGame(rythmeGame);
  }, [soundfont2]);
  return (
    <>
      {!started && (
        <>
          <Button
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
          <CheckboxGroup
            label="Select Tracks"
            onChange={(trackIds) =>
              setTrackIds(trackIds.map((trackId) => Number(trackId)))
            }
          >
            {scoreData.tracks.map((track) => (
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
