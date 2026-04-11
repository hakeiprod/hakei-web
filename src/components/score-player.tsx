"use client";
import * as Audio from "@/s-core/models/audio";
import * as BrowserAudio from "@/s-core/models/browser/audio";
import { masterVolumeAtom } from "@/store/master-volume";
import { Button, ButtonGroup } from "@heroui/button";
import { Navbar } from "@heroui/navbar";
import { SliderValue } from "@heroui/slider";
import { useMachine } from "@xstate/react";
import { useAtom } from "jotai";
import { FastForward, Rewind, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { createMachine } from "xstate";
import { ButtonPlayPause } from "./button-play-pause";
import { VolumeSlider } from "./slider-volume";

const machine = createMachine({
  initial: "idle",
  types: {} as {
    events:
      | { type: "PLAY" }
      | { type: "PAUSE" }
      | { type: "STOP" }
      | { type: "TICK" };
  },
  states: {
    idle: {
      on: {
        PLAY: { target: "playing", actions: "play" },
      },
    },
    playing: {
      on: {
        PAUSE: "paused",
        STOP: "stopped",
      },
    },
    paused: {
      entry: "pause",
      on: {
        PLAY: { target: "playing", actions: "resume" },
        STOP: "stopped",
      },
    },
    stopped: {
      entry: "stop",
      on: {
        PLAY: "playing",
      },
    },
  },
});
export function ScorePlayer({
  score,
  controller,
}: {
  score: Audio.Score;
  controller: BrowserAudio.Controller;
  onStop?: () => void;
  onPause?: () => void;
}) {
  const [state, send] = useMachine(
    machine.provide({
      actions: {
        play: () => controller.play(),
        pause: () => controller.pause(),
        stop: () => controller.stop(),
        resume: () => controller.resume(),
      },
    }),
  );
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
    if (value) send({ type: "PAUSE" });
    else send({ type: "PLAY" });
  }
  function handleStop() {
    send({ type: "STOP" });
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
        <ButtonPlayPause
          isPlaying={state.value === "playing"}
          onPress={handlePlay}
        />
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
