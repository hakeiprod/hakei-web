import { map, pipe } from "remeda";
import { match } from "ts-pattern";
import * as SMUFL from ".";
import * as Sheet from "../sheet";

export class Note extends Sheet.Note {
  declare score: SMUFL.Score;
  declare glyph: SMUFL.Glyph;
  declare dotLigature: Sheet.Ligature<SMUFL.Glyph>;
  get stave() {
    return super.stave as SMUFL.Stave;
  }
  draw() {
    super.draw();
    this.glyph = new SMUFL.Glyph(
      match(this.glyph.type)
        .with(Sheet.ElementType.Rest, () => SMUFL.Glyph.findRest(this.type))
        .with(Sheet.ElementType.Notehead, () =>
          SMUFL.Glyph.findNotehead(this.type),
        )
        .run(),
      this.glyph.type,
      this.glyph.line,
    );
    this.dotLigature.glyphLists = pipe(
      this.dotLigature.glyphLists,
      map(
        map(
          (glyph) =>
            new SMUFL.Glyph(
              SMUFL.Glyph.find("individualNotes", (v) => v.includes("Dot")),
              glyph.type,
              glyph.line,
            ),
        ),
      ),
    );
  }
  static import(data: ReturnType<Note["export"]>) {
    return new Note(super.import(data));
  }
}
