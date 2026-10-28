import { measure } from "../sheet/layout-pass";
import { staffGeometry } from "./notation/staff-geometry";
import { barlineEndInset, chordInkRight } from "./geometry";
import { LayoutGlyph } from "./layout/glyph";
import { P, match } from "ts-pattern";
import * as Sheet from "../sheet";
import * as Engraving from "./";

export class Stave extends Sheet.Stave {
  declare score: Engraving.Score;
  word = new Engraving.Word();
  get endPadding() {
    return measure(
      this.score.layoutPass,
      this,
      "engraving/stave.ts:endPadding",
      () => {
        // Measure natural positions so page justification cannot feed back into
        // the minimum width or make repeated layouts grow.
        let width = 0;
        let inkRight = 0;
        let trailingAdvance = 0;
        for (const slot of this.slots) {
          const chords = slot.getTrackStaveChords(this.trackId, this.id);
          for (const chord of chords)
            inkRight = Math.max(inkRight, width + chordInkRight(chord));
          if (chords.length > 0)
            trailingAdvance = Math.max(
              ...chords.map((chord) => chord.glyphAdvanceWidth),
            );
          width += slot.minWidth;
        }
        // Use the final note/rest's SMuFL advance as the trailing gap, after any
        // ink overhang and the actual barline footprint have been accounted for.
        return (
          Math.max(0, inkRight - width) +
          trailingAdvance +
          barlineEndInset(this.bar.masterbar.isLast)
        );
      },
    );
  }
  get headerWidth() {
    return measure(
      this.score.layoutPass,
      this,
      "engraving/stave.ts:headerWidth",
      () => {
        return Math.max(
          0,
          ...this.score.staves
            .filter((s) => s.barId === this.barId)
            .map((s) => s.word.width),
        );
      },
    );
  }
  override get width() {
    return measure(
      this.score.layoutPass,
      this,
      "engraving/stave.ts:width",
      () => {
        return super.width + this.headerWidth + this.endPadding;
      },
    );
  }
  override get minWidth() {
    return measure(
      this.score.layoutPass,
      this,
      "engraving/stave.ts:minWidth",
      () => {
        return super.minWidth + this.headerWidth + this.endPadding;
      },
    );
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
  override get height(): number {
    return measure(
      this.score.layoutPass,
      this,
      "engraving/stave.ts:height",
      () => {
        return staffGeometry(this).height;
      },
    );
  }
  override get slots() {
    return super.slots as Engraving.Slot[];
  }
  draw() {
    const previousStave = this.prev;
    const clef = this.resolveClefs()[0];
    const previousClef = previousStave?.resolveClefs()[0];
    const clefChanged =
      previousStave &&
      (clef?.sign?.[0]._ !== previousClef?.sign?.[0]._ ||
        clef?.line?.[0]._ !== previousClef?.line?.[0]._ ||
        (this.staffSettings?.kind ?? "standard") !==
          (previousStave.staffSettings?.kind ?? "standard"));
    if (this.bar.masterbar.isRowFirst || clefChanged)
      this.word.append([
        new LayoutGlyph(
          Sheet.ElementType.Clef,
          this.resolveClefs()[0]?.line?.[0]?._ ?? 0,
        ),
      ]);
    if (
      (this.bar.masterbar.isFirst ||
        (previousStave &&
          (previousStave.staffSettings?.kind ?? "standard") !== "standard")) &&
      (!this.staffSettings || this.staffSettings.kind === "standard")
    ) {
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
                      this.staffSettings?.kind === "tablature"
                        ? this.staffSettings.lineCount === 4
                          ? "4stringTabClef"
                          : "6stringTabClef"
                        : this.staffSettings?.kind === "percussion"
                          ? "unpitchedPercussionClef1"
                          : Engraving.Glyph.findClef(this.resolveClefs()[0]!)!,
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
    // Percussion clefs have no pitched staff-line anchor. Center their SMuFL
    // ink bounds on the staff instead of using MusicXML's optional line.
    for (const element of this.word.glyphOrLigatureLists.flat())
      if (
        element instanceof Engraving.Glyph &&
        element.glyphName === "unpitchedPercussionClef1"
      )
        element.line =
          5 -
          this.height / 2 -
          element.glyphBBox.y +
          element.glyphBBox.height / 2;
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
