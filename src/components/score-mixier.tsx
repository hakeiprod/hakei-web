import * as Audio from "@/s-core/models/audio";
import { ScoreMixierTrack } from "./score-mixier-track";
export function ScoreMixier({ score }: { score: Audio.Score }) {
  return (
    <>
      {score.tracks.map((track, index) => (
        <ScoreMixierTrack key={index} track={track} />
      ))}
    </>
  );
}
