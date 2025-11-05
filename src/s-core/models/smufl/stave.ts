import * as Core from "../core";
import { filter, isTruthy, map, pipe } from "remeda";
import * as Sheet from "../sheet";
import * as SMUFL from "../smufl";
import { P, match } from "ts-pattern";

export class Stave extends Sheet.Stave {
  declare score: SMUFL.Score;
  get track() {
    return this.score.tracks.find((track) => track.id === this.trackId)!;
  }
  override get bar() {
    return super.bar as SMUFL.Bar;
  }
  override get notes() {
    return super.notes as SMUFL.Note[];
  }
  override get height() {
    return (this.track.staffDetails.$$["staff-lines"]?.[0]._ ?? 0) - 1;
  }
  override draw() {
    const handleLigature = (
      ligature: Sheet.Ligature<SMUFL.Glyph | Sheet.Glyph>
    ) => {
      ligature.glyphLists = ligature.glyphLists.map((glyphs) =>
        pipe(
          glyphs,
          map((glyph) =>
            match(glyph)
              .with(
                P.when((x): x is SMUFL.Glyph => x.constructor === SMUFL.Glyph),
                (glyph) => glyph
              )
              .with(
                P.when((x): x is Sheet.Glyph => x.constructor === Sheet.Glyph),
                (glyph) =>
                  match(glyph.type)
                    .with(Sheet.ElementType.Clef, () => {
                      const glyphName = SMUFL.Glyph.findClef(
                        this.resolveClefs()[0]!
                      );
                      return glyphName
                        ? new SMUFL.Glyph(glyphName, glyph.type, glyph.line)
                        : null;
                    })
                    .with(
                      Sheet.ElementType.Accidental,
                      () =>
                        new SMUFL.Glyph(
                          SMUFL.Glyph.find("standardAccidentals12Edo", (v) =>
                            v.toLowerCase().includes(
                              match(this.bar.keysignature.tonality)
                                .with(
                                  Core.Enums.Tonality.Major as 0,
                                  () => "sharp"
                                )
                                .with(
                                  Core.Enums.Tonality.Minor as 1,
                                  () => "flat"
                                )
                                .exhaustive()
                            )
                          ),
                          glyph.type,
                          glyph.line
                        )
                    )
                    .with(Sheet.ElementType.Barline, () => {
                      const glyphName = SMUFL.Glyph.findBarline(
                        this.bar.masterbar.isLast
                          ? { $$: { ["bar-style"]: [{ _: "light-heavy" }] } }
                          : this.bar.masterbar.barline
                      );
                      return glyphName
                        ? new SMUFL.Glyph(glyphName, glyph.type, glyph.line)
                        : null;
                    })
                    .otherwise(() => glyph)
              )
              .with(
                P.when(
                  (x): x is Sheet.Ligature => x.constructor === Sheet.Ligature
                ),
                handleLigature
              )
              .exhaustive()
          ),
          filter(isTruthy)
        )
      );
      return ligature;
    };
    super.draw();
    this.ligature = this.ligature && handleLigature(this.ligature);
  }
}
