import * as Core from "../core";
import { Ligature } from "./ligature";
import { Glyph } from "./glyph";
import { ElementType } from ".";
import { pipe } from "remeda";
import musicTheory from "../../const/music-theory.json";
import { PitchClassName } from "../core/units";
import { match } from "ts-pattern";

export class Keysignature extends Core.Keysignature {
  ligature = new Ligature(undefined, { type: "keysignature" });
  draw() {
    this.ligature.append(
      ...this.accidentalPitchClasses.map((pitchClass) => [
        new Glyph(
          ElementType.Accidental,
          pipe(pitchClass.toPitchClassName(this.tonality).toneIndex, (n) => {
            return (
              match(this.tonality)
                .with(Core.Enums.Tonality.Major as 0, () =>
                  n < new PitchClassName("A").toneIndex
                    ? n + musicTheory.diatonicScale.length
                    : n
                )
                .with(Core.Enums.Tonality.Minor as 1, () =>
                  n < new PitchClassName("F").toneIndex
                    ? n + musicTheory.diatonicScale.length
                    : n
                )
                .exhaustive() / 2
            );
          })
        ),
      ])
    );
  }
}
