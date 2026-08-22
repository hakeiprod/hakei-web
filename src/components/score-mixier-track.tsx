import * as Audio from "@/s-core/models/audio";
import { SliderValue, Switch } from "@heroui/react";
import { useEffect, useState } from "react";
import { SliderVolume } from "./slider-volume";

export function ScoreMixierTrack({ track }: { track: Audio.Track }) {
  const [isMute, setIsMute] = useState(false);
  const [volume, setVolume] = useState(track.gain.toVolume());
  function handleChange(value: SliderValue) {
    track.setGain(new Audio.Units.Volume(value as number).toGain());
  }
  function handleMute() {
    track.setMute(!track.isMute);
  }
  useEffect(() => {
    track.emitter.on("changeMute", setIsMute);
    track.emitter.on("changeGain", (value) => setVolume(value.toVolume()));
    return () => {
      track.emitter.all.clear();
    };
  }, [track.emitter]);
  return (
    <>
      {track.name}
      <Switch defaultChecked>Active</Switch>
      <SliderVolume
        isMute={isMute}
        muteButtonProps={{
          onPress: handleMute,
        }}
        sliderProps={{
          value: volume.value,
          onChange: handleChange,
          label: "Volume",
        }}
      />
    </>
  );
}
