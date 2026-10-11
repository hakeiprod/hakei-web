import { LayoutGlyph } from "./layout/glyph";
import { P, match } from "ts-pattern";
import * as Core from "../../core";
import * as Sheet from "../../sheet";
import * as Engraving from ".";

export class Stave extends Sheet.Stave {
  declare score: Engraving.Score;
  word = new Engraving.Word();
  override get width() {
    return super.width + this.word.width;
  }
  get track() {
    return this.score.tracks.find((track) => track.id === this.trackId)!;
  }
  override get bar() {
    return super.bar as Engraving.Bar;
  }
  override get notes() {
    return super.notes as Engraving.Note[];
  }
  override get height() {
    return (this.track.staffDetails["staff-lines"]?.[0]._ ?? 0) - 1;
  }
  override get slots() {
    return super.slots as Engraving.Slot[];
  }
  draw() {
    if (this.bar.masterbar.isRowFirst)
      this.word.append([
        new LayoutGlyph(
          Sheet.ElementType.Clef,
          this.resolveClefs()[0]?.line?.[0]?._ ?? 0,
        ),
      ]);
    if (this.bar.masterbar.isFirst) {
      const keysignatureLigature = new Engraving.Ligature();
      keysignatureLigature.glyphLists = (
        this.bar.keysignature as Engraving.Keysignature
      ).ligature.glyphLists;
      this.word.append(
        [keysignatureLigature],
        [(this.bar.timesignature as Engraving.Timesignature).ligature],
      );
    }

    this.word.glyphOrLigatureLists = this.word.glyphOrLigatureLists.map(
      (glyphOrLigatureList) =>
        glyphOrLigatureList.map((glyphOrLigature) =>
          match(glyphOrLigature)
            .with(P.instanceOf(LayoutGlyph), (glyph) =>
              match(glyph.type)
                .with(
                  Sheet.ElementType.Clef,
                  () =>
                    new Engraving.Glyph(
                      Engraving.Glyph.findClef(this.resolveClefs()[0]!)!,
                      glyph.type,
                      glyph.line,
                    ),
                )
                .with(
                  Sheet.ElementType.Accidental,
                  () =>
                    new Engraving.Glyph(
                      Engraving.Glyph.find("standardAccidentals12Edo", (v) =>
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
                .otherwise(() => glyph),
            )
            .with(P.instanceOf(Engraving.Ligature), (ligature) => {
              ligature.glyphLists = ligature.glyphLists.map((glyphList) =>
                glyphList.map((glyph) =>
                  match(glyph.type)
                    .with(
                      Sheet.ElementType.Accidental,
                      () =>
                        new Engraving.Glyph(
                          Engraving.Glyph.find(
                            "standardAccidentals12Edo",
                            (v) =>
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
