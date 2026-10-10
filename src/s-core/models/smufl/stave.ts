import { P, match } from "ts-pattern";
import * as Sheet from "../sheet";
import * as SMUFL from "../smufl";

export class Stave extends Sheet.Stave {
  declare score: SMUFL.Score;
  declare word: Sheet.Word<SMUFL.Glyph>;
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
                .with(Sheet.ElementType.Accidental, () =>
                  this.keyAccidental(glyph.line),
                )
                .otherwise(() => glyph),
            )
            .with(P.instanceOf(Sheet.Ligature), (ligature) => {
              ligature.glyphLists = ligature.glyphLists.map((glyphList) =>
                glyphList.map((glyph) =>
                  match(glyph.type)
                    .with(Sheet.ElementType.Accidental, () =>
                      this.keyAccidental(glyph.line),
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
  private keyAccidental(line: number) {
    const glyph = new SMUFL.Glyph(
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
