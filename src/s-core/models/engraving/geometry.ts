import type { Chord } from "./chord";
import { Glyph } from "./glyph";
import type * as Drawing from "../document";
import * as Sheet from "../sheet";
import BravuraMetadata from "../../const/bravura/bravura_metadata.json";

const engraving = BravuraMetadata.engravingDefaults;

export interface StemGeometry {
  direction: "up" | "down";
  start: Drawing.Point;
  end: Drawing.Point;
  flag?: { glyph: Glyph; position: Drawing.Point };
}

export function chordStem(chord: Chord): StemGeometry | undefined {
  const direction = chord.stem?._ ?? "none";
  const notes = chord.notes.filter((note) => !note.rest);
  if (direction === "none" || notes.length === 0) return;
  if (direction === "double")
    throw new Error("toDocument does not support double stems yet.");
  const up = direction === "up";
  const points = notes.map((note) => {
    const glyph = note.glyph;
    const anchor = glyph.getAnchor(up ? "stemUpSE" : "stemDownNW");
    const anchorX =
      anchor?.[0] ??
      (up ? glyph.glyphBBox.x + glyph.glyphBBox.width : glyph.glyphBBox.x);
    // The anchors describe a corner of the stem rectangle; SVG lines use its centre.
    return {
      x:
        glyph.x +
        glyph.spaceLeft +
        anchorX +
        (up ? -engraving.stemThickness / 2 : engraving.stemThickness / 2),
      y: 5 - glyph.line - (anchor?.[1] ?? 0),
    };
  });
  const x = (up ? Math.max : Math.min)(...points.map((point) => point.x));
  const y = (up ? Math.max : Math.min)(...points.map((point) => point.y));
  const noteheadY = notes.map((note) => 5 - note.glyph.line);
  // Span the whole chord, then extend from the outer notehead by the nominal length.
  const flagName = !chord.beamGroup && Glyph.findFlag(notes[0].type, direction);
  const flag = flagName
    ? new Glyph(flagName, Sheet.ElementType.Flag, 0)
    : undefined;
  // SMuFL flags are registered at a nominal stem length of 3.5 staff spaces.
  const length = flag ? 3.5 : 3;
  const endY = up
    ? Math.min(...noteheadY) - length
    : Math.max(...noteheadY) + length;
  const geometry: StemGeometry = {
    direction,
    start: { x, y },
    end: { x, y: endY },
  };
  if (flag) {
    const anchor = flag.getAnchor(up ? "stemUpNW" : "stemDownSW");
    geometry.flag = {
      glyph: flag,
      position: {
        x: x - engraving.stemThickness / 2 - (anchor?.[0] ?? 0),
        y: endY,
      },
    };
    // Extend the primitive to the flag's attachment height, leaving its baseline fixed.
    geometry.end.y -= anchor?.[1] ?? 0;
  }
  return geometry;
}

/** Leftmost painted edge of the ending barline, measured from the bar end. */
export function barlineEndInset(isLast: boolean) {
  return isLast
    ? engraving.thickBarlineThickness * 2 + engraving.thinBarlineThickness / 2
    : engraving.thinBarlineThickness;
}

function glyphRight(glyph: Glyph, includeSpace = true) {
  return (
    glyph.x +
    (includeSpace ? glyph.spaceLeft : 0) +
    glyph.glyphBBox.x +
    glyph.glyphBBox.width
  );
}

/** Rightmost painted edge in the chord's local coordinates. */
export function chordInkRight(chord: Chord) {
  const edges = chord.notes.flatMap((note) => [
    glyphRight(note.glyph),
    ...(note.accidentalGlyph ? [glyphRight(note.accidentalGlyph)] : []),
    ...note.dotLigature.glyphLists
      .flat()
      .map((glyph) => note.dotLigature.x + glyphRight(glyph as Glyph, false)),
  ]);
  edges.push(
    ...chord.legerlinesLigature.glyphLists
      .flat()
      .map(
        (glyph) =>
          chord.legerlinesLigature.x + glyphRight(glyph as Glyph, false),
      ),
  );
  const stem = chordStem(chord);
  if (stem) edges.push(stem.end.x + engraving.stemThickness / 2);
  if (stem?.flag) {
    const { glyph, position } = stem.flag;
    edges.push(position.x + glyph.glyphBBox.x + glyph.glyphBBox.width);
  }
  return Math.max(0, ...edges);
}
