"use client";
import { prisma } from "@/prisma";
import * as Audio from "@/s-core/models/audio";
import { RythmeGame } from "@/s-core/models/browser/rythme-game";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import * as Sheet from "@/s-core/models/sheet";
import "@/s-core/models/sheet/extensions/to-audio";
import { masterVolumeAtom } from "@/store/master-volume";
import { Button } from "@heroui/button";
import { Checkbox, CheckboxGroup } from "@heroui/react";
import { useAtom } from "jotai";
import localFont from "next/font/local";
import { useEffect, useRef, useState } from "react";
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
  const [rythmeGame, setRythmeGame] = useState<RythmeGame>();
  useEffect(() => {
    if (!soundfont2) return;
    const game = new RythmeGame(
      Sheet.Score.import(scoreData).toAudio(),
      soundfont2,
      bravura.style.fontFamily,
    );
    // The game owns browser resources and must be created after commit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRythmeGame(game);
    return () => game.dispose();
  }, [scoreData, soundfont2]);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/A320U.sf2", { signal: abort.signal })
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (!abort.signal.aborted) setSoundfont2(Soundfont2.create(buffer));
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) console.error(error);
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    rythmeGame?.audioController.setMasterGain(
      new Audio.Units.Volume(masterVolume).toGain(),
    );
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
                const canvas = await rythmeGame.render();
                if (canvas) reference.current?.append(canvas);
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
