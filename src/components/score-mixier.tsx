import * as Audio from "@/s-core/models/audio";
import { Slider } from "@heroui/react";
import { Switch } from "@heroui/switch";
export function ScoreMixier({ score }: { score: Audio.Score }) {
  return (
    <>
      {score.tracks.map((track, index) => (
        <div key={index}>
          {track.name}
          <Switch onValueChange={(value) => track.setMute(value)}>Mute</Switch>
          <Switch defaultChecked>Active</Switch>
          <Slider>Volume</Slider>
        </div>
      ))}
    </>
  );
}
