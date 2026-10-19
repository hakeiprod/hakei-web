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
import { SliderVolume } from "./slider-volume";

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
        PLAY: { target: "playing", actions: "play" },
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
  const [isMute, setIsMute] = useState(controller.isMute);
  const [masterVolume, setMasterVolume] = useAtom(masterVolumeAtom);
  function handleChange(value: SliderValue) {
    controller.setMasterGain(new Audio.Units.Volume(value as number).toGain());
  }
  function handleChangeEnd(value: SliderValue) {
    if (value) setIsMute(false);
    else setIsMute(true);
  }
  function handleMute() {
    controller.setMute(!controller.isMute);
  }
  function handlePlay() {
    if (state.matches("playing")) send({ type: "PAUSE" });
    else send({ type: "PLAY" });
  }
  function handleStop() {
    send({ type: "STOP" });
  }
  useEffect(() => {
    controller.emitter.on("changeMute", setIsMute);
    const handleMasterGain = (value: Audio.Units.Gain) =>
      setMasterVolume(value.toVolume().value);
    controller.emitter.on("changeMasterGain", handleMasterGain);
    return () => {
      controller.emitter.off("changeMute", setIsMute);
      controller.emitter.off("changeMasterGain", handleMasterGain);
    };
  }, [controller, setMasterVolume]);
  return (
    <Navbar
      height="auto"
      classNames={{ wrapper: "h-auto min-w-0 flex-wrap gap-3 px-0 py-3" }}
    >
      <ButtonGroup isDisabled={!score} className="max-w-full">
        <Button isIconOnly aria-label="巻き戻し">
          <Rewind />
        </Button>
        <Button isIconOnly aria-label="早送り">
          <FastForward />
        </Button>
        <Button isIconOnly aria-label="停止" onPress={handleStop}>
          <Square />
        </Button>
        <ButtonPlayPause
          isPlaying={state.value === "playing"}
          onPress={handlePlay}
        />
      </ButtonGroup>
      <SliderVolume
        isMute={isMute}
        sliderProps={{
          value: masterVolume,
          onChange: handleChange,
          onChangeEnd: handleChangeEnd,
        }}
        muteButtonProps={{
          onPress: handleMute,
        }}
      />
    </Navbar>
  );
}
