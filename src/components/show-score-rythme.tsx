"use client";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import * as Sheet from "@/s-core/models/sheet";
import { useEffect, useMemo, useRef, useState } from "react";
import { RythmeGame } from "@/s-core/models/browser/rythme-game";
import { Button } from "@heroui/button";
import { useAtom } from "jotai";
import { masterVolumeAtom } from "@/store/master-volume";
import { Checkbox, CheckboxGroup } from "@heroui/react";
import { prisma } from "@/prisma";
import "@/s-core/models/sheet/extensions/to-audio";
import localFont from "next/font/local";
import { isNullish } from "remeda";

const bravura = localFont({
  src: [{ path: "../s-core/const/bravura/Bravura.woff" }],
});
export function ShowScoreRythme(properties: {
  score: NonNullable<Awaited<ReturnType<typeof prisma.score.findUnique>>>;
}) {
  const [started, setStarted] = useState(false);
  const [masterVolume] = useAtom(masterVolumeAtom);
  const [trackIds, setTrackIds] = useState<number[]>([]);
  const [soundfont2, setSoundfont2] = useState<Soundfont2>();
  const reference = useRef<HTMLDivElement>(null);
  const scoreData = properties.score.data as unknown as ReturnType<
    Sheet.Score["export"]
  >;
  const rythmeGame = useMemo(() => {
    if (!soundfont2) return;
    return new RythmeGame(
      Sheet.Score.import(scoreData).toAudio(),
      soundfont2,
      bravura.style.fontFamily
    );
  }, [scoreData, soundfont2]);
  useEffect(() => {
    fetch("/A320U.sf2")
      .then((response) => response.arrayBuffer())
      .then((buffer) => setSoundfont2(Soundfont2.create(buffer)));
  }, []);
  useEffect(() => {
    rythmeGame?.audioController.setMasterGain(masterVolume / 100);
  }, [masterVolume, rythmeGame?.audioController, scoreData, soundfont2]);
  return (
    <>
      {!started && (
        <>
          <Button
            onPress={() => {
              setStarted(true);
              (async () => {
                if (isNullish(rythmeGame)) return;
                rythmeGame.start(trackIds);
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
