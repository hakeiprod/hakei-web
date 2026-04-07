"use client";
import * as Audio from "@/s-core/models/audio";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import { masterVolumeAtom } from "@/store/master-volume";
import { Button, ButtonGroup } from "@heroui/button";
import { Navbar } from "@heroui/navbar";
import { SliderValue } from "@heroui/slider";
import { useAtom } from "jotai";
import { FastForward, Rewind, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonPlayPause } from "./button-play-pause";
import { VolumeSlider } from "./slider-volume";

export function ScorePlayer({
  score,
  controller,
}: {
  score: Audio.Score;
  controller: BrowserAudio.Controller;
  onStop?: () => void;
  onPause?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMute, setIsMute] = useState(false);
  const [masterVolume, setMasterVolume] = useAtom(masterVolumeAtom);
  const [previousVolume, setPreviousVolume] = useState(masterVolume);
  function handleChange(value: SliderValue) {
    controller?.setMasterGain(
      (Array.isArray(value) ? (value[0] ?? 0) : value) / 100,
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
