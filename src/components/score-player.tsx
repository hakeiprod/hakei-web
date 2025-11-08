"use client";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import * as Audio from "@/s-core/models/audio";
import { Navbar } from "@heroui/navbar";
import { ButtonPlayPause } from "./buttn-play-pause";
import { Button, ButtonGroup } from "@heroui/button";
import { FastForward, Rewind, Square } from "lucide-react";
import { VolumeSlider } from "./slider-volume";
import { useEffect, useRef, useState } from "react";
import Soundfont2 from "@/s-core/models/files/soundfont2";
import { SliderValue } from "@heroui/slider";
import { useAtom } from "jotai";
import { masterVolumeAtom } from "@/store/master-volume";

export function ScorePlayer({ score }: { score?: Audio.Score }) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [controller, setController] = useState<BrowserAudio.Controller>();
  const [soundfont2, setSoundfont2] = useState<Soundfont2>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMute, setIsMute] = useState(false);
  const [masterVolume, setMasterVolume] = useAtom(masterVolumeAtom);
  const [previousVolume, setPreviousVolume] = useState(masterVolume);
  function handleChange(value: SliderValue) {
    setMasterVolume(value as number);
    if (controller)
      controller.masterGain.gain.value =
        (Array.isArray(value) ? (value[0] ?? 0) : value) / 100;
  }
  function handleChangeEnd(value: SliderValue) {
    if (value) setPreviousVolume(value as number);
    else setIsMute(true);
  }
  function handleMutePress() {
    setMasterVolume(!isMute ? 0 : previousVolume);
    setIsMute(!isMute);
  }
  function handlePress(value: boolean) {
    setIsPlaying(!value);
    if (!value) controller?.play(audioContextRef.current?.currentTime ?? 0);
    else controller?.pause();
  }
  useEffect(() => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    fetch("/A320U.sf2")
      .then((res) => res.arrayBuffer())
      .then((buf) => setSoundfont2(Soundfont2.create(buf)));
  }, []);
  useEffect(() => {
    if (!controller && score && soundfont2 && audioContextRef.current) {
      const controller = new BrowserAudio.Controller(
        score,
        audioContextRef.current,
        soundfont2
      );
      controller.masterGain.gain.value = masterVolume / 100;
      setController(controller);
    }
  }, [score, soundfont2, audioContextRef]);

  return (
    <Navbar>
      <ButtonGroup isDisabled={!score}>
        <Button>
          <Rewind color="white" />
        </Button>
        <Button>
          <FastForward color="white" />
        </Button>
        <Button>
          <Square color="white" />
        </Button>
        <ButtonPlayPause isPlaying={isPlaying} onPress={handlePress} />
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
