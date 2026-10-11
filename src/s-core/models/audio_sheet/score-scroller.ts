import * as Audio from "@/s-core/models/audio";
import * as Engraving from "@/s-core/models/document/engraving";
export class ScoreScroller {
  constructor(
    public smufl: Engraving.Score,
    public html: HTMLElement,
  ) {}
  noteOn(note: Audio.Note) {
    const element = this.html.querySelector(
      `.note[id="${note.id}"]`,
    ) as SVGGElement;
    element.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }
}
