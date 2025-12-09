import * as Audio from "@/s-core/models/audio";
import * as SMUFL from "@/s-core/models/smufl";
export class ScoreScroller {
  constructor(
    public smufl: SMUFL.Score,
    public html: HTMLElement
  ) {}
  noteOn(note: Audio.Note) {
    const element = this.html.querySelector(
      `.note[id="${note.id}"]`
    ) as SVGGElement;
    element.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }
}
