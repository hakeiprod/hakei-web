import { LayoutGlyph } from "./layout/glyph";
import { P, match } from "ts-pattern";
import * as Sheet from "../sheet";
import * as Engraving from "./";

export class Stave extends Sheet.Stave {
  declare score: Engraving.Score;
  word = new Engraving.Word();
  override get width() {
    return super.width + this.word.width;
  }
  override get minWidth() {
    return super.minWidth + this.word.width;
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
      const keysignatureLigature = new Engraving.Ligature(
        (this.bar.keysignature as Engraving.Keysignature).ligature.glyphLists,
      );
      this.word.append([keysignatureLigature]);
    }
    const previous = this.bar.prev?.timesignature;
    const current = this.bar.timesignature as Engraving.Timesignature;
    if (
      !previous ||
      previous.numerator !== current.numerator ||
      previous.denominator !== current.denominator
    ) {
      this.word.append([new Engraving.Ligature(current.ligature.glyphLists)]);
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
                .with(Sheet.ElementType.Accidental, () =>
                  this.keyAccidental(glyph.line),
                )
                .otherwise(() => glyph),
            )
            .with(P.instanceOf(Engraving.Ligature), (ligature) => {
              ligature.glyphLists = ligature.glyphLists.map((glyphList) =>
                glyphList.map((glyph) =>
                  match(glyph.type)
                    .with(Sheet.ElementType.Accidental, () =>
                      this.keyAccidental(glyph.line),
                    )
                    .otherwise(() => glyph),
                ),
              );
              const accidental = ligature.glyphLists
                .flat()
                .find((glyph) => glyph.type === Sheet.ElementType.Accidental);
              // Apply the first accidental's SMuFL advance once before the key
              // signature, without adding it between consecutive accidentals.
              if (accidental instanceof Engraving.Glyph)
                ligature.spaceLeft = accidental.glyphAdvanceWidth;
              return ligature;
            })
            .exhaustive(),
        ),
    );
  }
  private keyAccidental(line: number) {
    const glyph = new Engraving.Glyph(
      this.bar.keysignature.accidental > 0
        ? "accidentalSharp"
        : "accidentalFlat",
      Sheet.ElementType.Accidental,
      line,
    );
    // Key signatures already arrange consecutive accidentals in their ligature.
    // Adding the advance again doubles the gap between them.
    glyph.spaceLeft = 0;
    return glyph;
  }
  static import(data: ReturnType<Stave["export"]>) {
    return new Stave(super.import(data));
  }
}
