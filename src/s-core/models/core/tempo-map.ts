import Metadata from "./metadata.json";
import type { Tempo } from "./tempo";
import { Beat } from "./units/beat";
import { Tempo as TempoValue } from "./units/tempo";
import { Seconds } from "../files/soundfont2/units/seconds";

/** Absolute score time. Each tempo applies until the next tempo change. */
export class TempoMap {
  private readonly segments: { beat: number; seconds: number; bpm: number }[];

  constructor(
    tempos: readonly Tempo[],
    defaultTempo = new TempoValue(Metadata.defaultValue.tempos.value),
  ) {
    this.segments = [{ beat: 0, seconds: 0, bpm: defaultTempo.value }];
    for (const tempo of tempos.toSorted(
      (a, b) => a.start.value - b.start.value,
    )) {
      const previous = this.segments.at(-1)!;
      const beat = tempo.start.value;
      const segment = {
        beat,
        seconds:
          previous.seconds + ((beat - previous.beat) * 60) / previous.bpm,
        bpm: tempo.value.value,
      };
      // Multiple changes at the same beat use the last supplied tempo.
      if (beat === previous.beat)
        this.segments[this.segments.length - 1] = segment;
      else this.segments.push(segment);
    }
  }

  beatToSeconds(beat: Beat): Seconds {
    const segment = this.segments.findLast(
      (segment) => segment.beat <= beat.value,
    )!;
    return new Seconds(
      segment.seconds + ((beat.value - segment.beat) * 60) / segment.bpm,
    );
  }

  durationToSeconds(start: Beat, end: Beat): Seconds {
    return this.beatToSeconds(end).subtract(this.beatToSeconds(start));
  }
}
