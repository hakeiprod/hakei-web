import { P, match } from "ts-pattern";
import * as SMUFL from ".";
import { Barline, Clef, NormalType } from "../../const/musicxml/4.0/musicxml";
import { BoundingBox } from "../boundingbox";
import * as Sheet from "../sheet";

export class Glyph<
  T extends keyof SMUFL.Glyphnames = keyof SMUFL.Glyphnames,
> extends Sheet.Glyph {
  glyphName;
  glyphBBox;
  glyphAdvancedWidth;
  glyphWithAnchor;
  get width() {
    return this.glyphBBox.width;
    // + this.glyphAdvancedWidth;
  }
  get height() {
    return this.glyphBBox.height;
  }
  get codepoint() {
    return Number.parseInt(
      SMUFL.Glyphnames[this.glyphName].codepoint.replace("U+", ""),
      16,
    );
  }
  constructor(
    glyphName: T,
    ...parameters: ConstructorParameters<typeof Sheet.Glyph>
  ) {
    super(...parameters);
    const { bBoxNE, bBoxSW } = SMUFL.getGlyphBBox(glyphName);
    this.glyphBBox = new BoundingBox(
      bBoxSW[0],
      bBoxNE[1],
      bBoxNE[0] - bBoxSW[0],
      bBoxNE[1] - bBoxSW[1],
    );
    this.glyphAdvancedWidth = SMUFL.getGlyphAdvanceWidth(glyphName);
    this.glyphWithAnchor = SMUFL.getGlyphWithAnchor(glyphName);
    this.glyphName = glyphName;
  }
  static find(
    type: keyof SMUFL.Ranges,
    predicate: (glyph: SMUFL.Ranges[typeof type]["glyphs"][number]) => boolean,
  ) {
    return SMUFL.Ranges[type].glyphs.find(predicate)!;
  }

  static findClef(clef: Clef) {
    return match(clef.sign![0]._)
      .with("G", () => "gClef" as const)
      .with("F", () => "fClef" as const)
      .with("C", () => "cClef" as const)
      .with("percussion", () => "unpitchedPercussionClef1" as const)
      .with("TAB", () => "6stringTabClef" as const)
      .with("jianpu", () => {
        throw new Error("wip");
      })
      .with(P.union("none"), () => null)
      .exhaustive();
  }

  static findRest(type: NormalType) {
    return match(type._)
      .with("breve", () => "restDoubleWhole" as const)
      .with("long", () => "restLonga" as const)
      .with("maxima", () => "restMaxima" as const)
      .with("whole", () => "restWhole" as const)
      .with("half", () => "restHalf" as const)
      .with("quarter", () => "restQuarter" as const)
      .with("eighth", () => "rest8th" as const)
      .with("16th", () => "rest16th" as const)
      .with("32nd", () => "rest32nd" as const)
      .with("64th", () => "rest64th" as const)
      .with("128th", () => "rest128th" as const)
      .with("256th", () => "rest256th" as const)
      .with("512th", () => "rest512th" as const)
      .with("1024th", () => "rest1024th" as const)
      .exhaustive();
  }

  static findNotehead(type: NormalType) {
    return match(type._)
      .with("breve", () => "noteheadDoubleWhole" as const)
      .with("long", () => "noteheadWhole" as const)
      .with("maxima", () => "noteheadWhole" as const)
      .with("whole", () => "noteheadWhole" as const)
      .with("half", () => "noteheadHalf" as const)
      .with(
        P.union(
          "quarter",
          "eighth",
          "16th",
          "32nd",
          "64th",
          "128th",
          "256th",
          "512th",
          "1024th",
        ),
        () => "noteheadBlack" as const,
      )
      .exhaustive();
  }

  static findBarline(type: Barline) {
    return match(type["bar-style"]?.[0]._)
      .with("light-heavy", () => "barlineFinal" as const)
      .with("light-light", () => "barlineDouble" as const)
      .with("heavy-light", () => "barlineReverseFinal" as const)
      .with("heavy-heavy", () => "barlineHeavyHeavy" as const)
      .with("tick", () => "barlineTick" as const)
      .with("short", () => "barlineShort" as const)
      .with("regular", () => "barlineSingle" as const)
      .with("dotted", () => "barlineDotted" as const)
      .with("dashed", () => "barlineDashed" as const)
      .with("heavy", () => "barlineHeavy" as const)
      .with("none", () => null)
      .exhaustive();
  }
  static findAccidental(type: Sheet.AccidentalType) {
    return match(type)
      .with(Sheet.AccidentalType.Sharp as 0, () => "accidentalSharp" as const)
      .with(Sheet.AccidentalType.Flat as 1, () => "accidentalFlat" as const)
      .with(
        Sheet.AccidentalType.Natural as 2,
        () => "accidentalNatural" as const,
      )
      .exhaustive();
  }
}
