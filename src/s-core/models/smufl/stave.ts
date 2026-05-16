import { P, match } from "ts-pattern";
import * as Core from "../core";
import * as Sheet from "../sheet";
import * as SMUFL from "../smufl";

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
    return (this.track.staffDetails["staff-lines"]?.[0]._ ?? 0) - 1;
  }
  override get slots() {
    return super.slots as SMUFL.Slot[];
  }
  draw() {
    super.draw();
    this.word.glyphOrLigatureLists = this.word.glyphOrLigatureLists.map(
      (glyphOrLigatureList) =>
        glyphOrLigatureList.map((glyphOrLigature) =>
          match(glyphOrLigature)
            .with(P.instanceOf(Sheet.Glyph), (glyph) =>
              match(glyph.type)
                .with(
                  Sheet.ElementType.Clef,
                  () =>
                    new SMUFL.Glyph(
                      SMUFL.Glyph.findClef(this.resolveClefs()[0]!)!,
                      glyph.type,
                      glyph.line,
                    ),
                )
                .with(
                  Sheet.ElementType.Accidental,
                  () =>
                    new SMUFL.Glyph(
                      SMUFL.Glyph.find("standardAccidentals12Edo", (v) =>
                        v.toLowerCase().includes(
                          match(this.bar.keysignature.tonality)
                            .with(Core.Enums.Tonality.Major as 0, () => "sharp")
                            .with(Core.Enums.Tonality.Minor as 1, () => "flat")
                            .exhaustive(),
                        ),
                      ),
                      glyph.type,
                      glyph.line,
                    ),
                )
                /* .with(Sheet.ElementType.Barline, () => {
                  const glyphName = SMUFL.Glyph.findBarline(
                    this.bar.masterbar.isLast
                      ? { $$: { ["bar-style"]: [{ _: "light-heavy" }] } }
                      : this.bar.masterbar.barline,
                  );
                  return glyphName
                    ? new SMUFL.Glyph(glyphName, glyph.type, glyph.line)
                    : null;
                }) */
                .otherwise(() => glyph),
            )
            .with(P.instanceOf(Sheet.Ligature), (ligature) => {
              ligature.glyphLists = ligature.glyphLists.map((glyphList) =>
                glyphList.map((glyph) =>
                  match(glyph.type)
                    .with(
                      Sheet.ElementType.Accidental,
                      () =>
                        new SMUFL.Glyph(
                          SMUFL.Glyph.find("standardAccidentals12Edo", (v) =>
                            v.toLowerCase().includes(
                              match(this.bar.keysignature.tonality)
                                .with(
                                  Core.Enums.Tonality.Major as 0,
                                  () => "sharp",
                                )
                                .with(
                                  Core.Enums.Tonality.Minor as 1,
                                  () => "flat",
                                )
                                .exhaustive(),
                            ),
                          ),
                          glyph.type,
                          glyph.line,
                        ),
                    )
                    .otherwise(() => glyph),
                ),
              );
              return ligature;
            })
            .exhaustive(),
        ),
    );
  }
  static import(data: ReturnType<Stave["export"]>) {
    return new Stave(super.import(data));
  }
}
