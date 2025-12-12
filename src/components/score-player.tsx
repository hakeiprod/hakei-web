"use client";
import * as Audio from "@/s-core/models/audio";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import { masterVolumeAtom } from "@/store/master-volume";
import { Button, ButtonGroup } from "@heroui/button";
import { Navbar } from "@heroui/navbar";
import { SliderValue } from "@heroui/slider";
import { useAtom } from "jotai";
import { FastForward, Rewind, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ButtonPlayPause } from "./button-play-pause";
import { VolumeSlider } from "./slider-volume";

export function ScorePlayer({ score }: { score: Audio.Score }) {
  const [soundfont2, setSoundfont2] = useState<Soundfont2>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMute, setIsMute] = useState(false);
  const [masterVolume, setMasterVolume] = useAtom(masterVolumeAtom);
  const [previousVolume, setPreviousVolume] = useState(masterVolume);
  const controller = useMemo(() => {
    if (!soundfont2) return;
    const controller = new BrowserAudio.Controller(score, soundfont2);
    controller.onChangeMasterGain = (value) => setMasterVolume(value);
    controller.onPlayEnd = () => setIsPlaying(false);
    return controller;
  }, [score, setMasterVolume, soundfont2]);
  function handleChange(value: SliderValue) {
    controller?.setMasterGain(
      (Array.isArray(value) ? (value[0] ?? 0) : value) / 100
    );
  }
  function handleChangeEnd(value: SliderValue) {
    if (value) setPreviousVolume(value as number);
    else setIsMute(true);
  }
  function handleMutePress() {
    setMasterVolume(isMute ? previousVolume : 0);
    setIsMute(!isMute);
  }
  function handlePlay(value: boolean) {
    setIsPlaying(!value);
    if (value) controller?.pause();
    else controller?.play();
  }
  function handleStop() {
    setIsPlaying(false);
    controller?.stop();
  }
  useEffect(() => {
    fetch("/A320U.sf2")
      .then((response) => response.arrayBuffer())
      .then((buf) => setSoundfont2(Soundfont2.create(buf)));
  }, []);
  useEffect(() => {
    controller?.setMasterGain(masterVolume / 100);
  }, [controller, masterVolume]);

  return (
    <Navbar>
      <ButtonGroup isDisabled={!score}>
        <Button>
          <Rewind color="white" />
        </Button>
        <Button>
          <FastForward color="white" />
        </Button>
        <Button onPress={handleStop}>
          <Square color="white" />
        </Button>
        <ButtonPlayPause isPlaying={isPlaying} onPress={handlePlay} />
      </ButtonGroup>
      <VolumeSlider
        value={masterVolume}
        isMute={isMute}
        sliderProps={{
          value: masterVolume,
          onChange: handleChange,
          onChangeEnd: handleChangeEnd,
        }}
        muteButtonProps={{
          onPress: handleMutePress,
        }}
      />
    </Navbar>
  );
}
