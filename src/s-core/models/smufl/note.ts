import { P, match } from "ts-pattern";
import * as SMUFL from ".";
import * as Sheet from "../sheet";

export class Note extends Sheet.Note {
  declare score: SMUFL.Score;
  get stave() {
    return super.stave as SMUFL.Stave;
  }
  draw() {
    const handleLigature = (ligature: Sheet.Ligature) => {
      ligature.children = ligature.children.map((glyphs) =>
        glyphs.map((glyph) =>
          match(glyph)
            .with(
              P.instanceOf(Sheet.Glyph),
              (glyph) =>
                new SMUFL.Glyph(
                  match(glyph.type)
                    .with(Sheet.ElementType.Accidental, () =>
                      SMUFL.Glyph.findAccidental(this.accidental!)
                    )
                    .with(Sheet.ElementType.LegerLine, () =>
                      SMUFL.Glyph.find("staves", (v) => v === "legerLine")
                    )
                    .with(Sheet.ElementType.Rest, () =>
                      SMUFL.Glyph.findRest(this.type)
                    )
                    .with(Sheet.ElementType.Notehead, () =>
                      SMUFL.Glyph.findNotehead(this.type)
                    )
                    .with(Sheet.ElementType.Stem, () =>
                      SMUFL.Glyph.find("stems", (v) => v.includes("stem"))
                    )
                    .with(Sheet.ElementType.Dot, () =>
                      SMUFL.Glyph.find("individualNotes", (v) =>
                        v.includes("Dot")
                      )
                    )
                    // .with(Sheet.GlyphType.Flag, (type) => new SMUFL.Glyph(type))
                    .run(),
                  glyph.type,
                  glyph.line
                )
            )
            .with(P.instanceOf(Sheet.Ligature), handleLigature)
            .exhaustive()
        )
      );
      return ligature;
    };
    super.draw();
    this.ligature = handleLigature(this.ligature);
  }
  static import(data: ReturnType<Note["export"]>) {
    return new Note(super.import(data));
  }
}
