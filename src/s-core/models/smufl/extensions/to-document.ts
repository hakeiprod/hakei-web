import BravuraMetadata from "../../../const/bravura/bravura_metadata.json";
import { Score } from "../score";
import * as Drawing from "../../document";
import * as Sheet from "../../sheet";
import * as SMUFL from "..";

export interface ToDocumentOptions {
  debug?: boolean;
}

declare module ".." {
  interface Score {
    /** Convert a drawn, laid out and ordered score into a detached snapshot. */
    toDocument(options?: ToDocumentOptions): Drawing.Document;
  }
}

const engraving = BravuraMetadata.engravingDefaults;

function group(
  role: string,
  children: Drawing.Element[],
  source: Drawing.Source = {},
  position?: Drawing.Point,
) {
  return new Drawing.Group(children, { role, source, position });
}

function glyphToDocument(
  glyph: Sheet.Glyph,
  source: Drawing.Source,
  includeSpace = true,
) {
  if (!(glyph instanceof SMUFL.Glyph))
    throw new Error("toDocument requires SMUFL glyphs; draw the score first.");
  const position = {
    x: glyph.x + (includeSpace ? glyph.spaceLeft : 0),
    y: 5 - glyph.line,
  };
  return new Drawing.Glyph(
    glyph.codepoint,
    position,
    {
      x: position.x + glyph.glyphBBox.x,
      y: position.y - glyph.glyphBBox.y,
      width: glyph.glyphBBox.width,
      height: glyph.glyphBBox.height,
    },
    glyph.glyphAdvanceWidth,
    {
      role: "glyph",
      source,
      classList: glyph.classList,
      glyphName: glyph.glyphName,
    },
  );
}

function ligatureToDocument(ligature: Sheet.Ligature, source: Drawing.Source) {
  return group(
    "ligature",
    ligature.glyphLists
      .flat()
      .map((glyph) => glyphToDocument(glyph, source, false)),
    source,
    { x: ligature.x, y: 0 },
  );
}

function debugBounds(
  bounds: Drawing.Bounds,
  source: Drawing.Source,
  color: string,
  data: object,
) {
  return new Drawing.Rectangle(bounds, color, 0.1, {
    role: "debug-bounds",
    source,
    label: JSON.stringify(data),
  });
}

function chordToDocument(
  chord: SMUFL.Chord,
  source: Drawing.Source,
  debug: boolean,
) {
  const children: Drawing.Element[] = [];
  if (debug)
    children.push(
      debugBounds(
        {
          x: 0,
          y: 5 - chord.line - 0.5,
          width: chord.width,
          height: chord.height,
        },
        source,
        "blue",
        chord.export(),
      ),
    );
  for (const note of chord.notes) {
    const noteSource = { ...source, noteId: note.id };
    const glyphs: Drawing.Element[] = [glyphToDocument(note.glyph, noteSource)];
    if (note.accidentalGlyph)
      glyphs.unshift(glyphToDocument(note.accidentalGlyph, noteSource));
    children.push(group("note", glyphs, noteSource));
  }
  children.push(
    group(
      "dots",
      chord.notes.map((note) =>
        ligatureToDocument(note.dotLigature, { ...source, noteId: note.id }),
      ),
      source,
    ),
    group(
      "ledger-lines",
      [ligatureToDocument(chord.legerlinesLigature, source)],
      source,
    ),
  );
  const direction = chord.stem?._ ?? "none";
  if (!chord.notes.some((note) => note.rest) && direction !== "none") {
    if (direction === "double")
      throw new Error("toDocument does not support double stems yet.");
    const x =
      direction === "up"
        ? chord.noteheadsLigature.width
        : chord.noteheadsLigature.x + chord.glyphAdvanceWidth;
    const y = 5 - chord.line;
    const length = direction === "up" ? -chord.stemLength : chord.stemLength;
    children.push(
      new Drawing.Line(
        { x, y },
        { x, y: y + length },
        engraving.stemThickness,
        { role: "stem", source },
      ),
    );
  }
  return group("chord", children, source);
}

function barlinesToDocument(
  bar: SMUFL.Bar,
  masterbar: SMUFL.Masterbar,
  source: Drawing.Source,
) {
  const thin = engraving.thinBarlineThickness;
  const thick = engraving.thickBarlineThickness;
  const line = (x: number, width: number, role: string) =>
    new Drawing.Line({ x, y: 0 }, { x, y: bar.height }, width, {
      role,
      source,
    });
  const lines = [line(thin / 2, thin, "barline-start")];
  if (masterbar.isLast) {
    lines.push(
      line(masterbar.width - thick * 2, thin, "barline-end-thin"),
      line(masterbar.width - thick / 2, thick, "barline-end-thick"),
    );
  } else if (masterbar.isRowLast)
    lines.push(line(masterbar.width - thin / 2, thin, "barline-end"));
  return group("barlines", lines, source);
}

function beamsToDocument(stave: SMUFL.Stave, source: Drawing.Source) {
  if (stave.beamGroups.length === 0) return [];
  const stemGlyph = new SMUFL.Glyph(
    SMUFL.Glyph.find("stems", (name) => name.includes("stem")),
    Sheet.ElementType.Stem,
    0,
  );
  return stave.beamGroups.flatMap((beam) => {
    const first = beam.firstChord as SMUFL.Chord;
    const last = beam.lastChord as SMUFL.Chord;
    const direction = first.stem?._ ?? "none";
    if (direction === "none") return [];
    if (direction === "double")
      throw new Error("toDocument does not support double stems yet.");
    const up = direction === "up";
    const offset = up
      ? -stemGlyph.glyphBBox.height + engraving.beamThickness * 2
      : stemGlyph.glyphBBox.height - engraving.beamThickness / 2;
    const spacing = engraving.beamThickness + engraving.beamSpacing;
    return [
      new Drawing.Line(
        {
          x:
            stave.word.width +
            first.slot.x +
            (up ? first.right : first.left + first.glyphAdvanceWidth),
          y: offset + (5 - first.line - beam.level) * spacing,
        },
        {
          x:
            stave.word.width +
            last.slot.x +
            (up ? last.right : last.left + last.glyphAdvanceWidth),
          y: offset + (5 - last.line - beam.level) * spacing,
        },
        engraving.beamThickness,
        { role: "beam", source },
      ),
    ];
  });
}

function staveToDocument(
  stave: SMUFL.Stave,
  masterbar: SMUFL.Masterbar,
  source: Drawing.Source,
  debug: boolean,
) {
  const word = group(
    "word",
    stave.word.glyphOrLigatureLists
      .flat()
      .map((element) =>
        element instanceof Sheet.Ligature
          ? ligatureToDocument(element, source)
          : glyphToDocument(element, source),
      ),
    source,
  );
  // A sustained note may add the same beat to multiple masterbars.
  const seenBeats = new Set<number>();
  const uniqueSlots = stave.slots.filter((slot) => {
    if (seenBeats.has(slot.beat.value)) return false;
    seenBeats.add(slot.beat.value);
    return true;
  });
  const slots = group(
    "slots",
    uniqueSlots.map((slot) => {
      const children: Drawing.Element[] = [];
      if (debug)
        children.push(
          debugBounds(
            { x: 0, y: 0, width: slot.width, height: slot.height },
            source,
            "green",
            slot.export(),
          ),
        );
      children.push(
        ...slot
          .getTrackStaveChords(stave.trackId, stave.id)
          .map((chord) =>
            chordToDocument(chord, { ...source, chordId: chord.id }, debug),
          ),
      );
      return group("slot", children, source, { x: slot.x, y: 0 });
    }),
    source,
    { x: stave.word.width, y: 0 },
  );
  const staff = Array.from(
    { length: stave.height + 1 },
    (_, y) =>
      new Drawing.Line(
        { x: 0, y },
        { x: masterbar.width, y },
        engraving.staffLineThickness,
        { role: "staff-line", source },
      ),
  );
  return group(
    "stave",
    [word, slots, ...staff, ...beamsToDocument(stave, source)],
    source,
    { x: 0, y: stave.y },
  );
}

/** Does not mount, redraw, mutate the score, or access browser APIs. */
export function toDocument(
  score: SMUFL.Score,
  options: ToDocumentOptions = {},
) {
  if (score.tracks.length === 0 && score.notes.length === 0)
    return new Drawing.Document([new Drawing.Page(0, 0)]);
  if (
    score.masterbars.length > 0 &&
    (score.rows.length === 0 ||
      score.masterbars.some((bar) => bar.rowId === undefined))
  )
    throw new Error(
      "toDocument requires a laid out score; mount and order its controller first.",
    );
  if (score.notes.some((note) => !note.glyph))
    throw new Error("toDocument requires a drawn score; draw its notes first.");
  const rows = score.rows.map((row) =>
    group(
      "row",
      row.masterbars.map((masterbar) => {
        const source = { rowId: row.id, barId: masterbar.id };
        const children: Drawing.Element[] = [];
        if (options.debug)
          children.push(
            debugBounds(
              { x: 0, y: 0, width: masterbar.width, height: masterbar.height },
              source,
              "red",
              masterbar.export(),
            ),
          );
        for (const track of score.tracks) {
          const trackSource = { ...source, trackId: track.id };
          const bars = track
            .getMasterbarBars(masterbar.id)
            .map((bar) =>
              group(
                "bar",
                [
                  barlinesToDocument(bar, masterbar, trackSource),
                  ...bar.staves.map((stave) =>
                    staveToDocument(
                      stave,
                      masterbar,
                      { ...trackSource, staveId: stave.id },
                      options.debug ?? false,
                    ),
                  ),
                ],
                trackSource,
              ),
            );
          children.push(
            group("track", bars, trackSource, { x: 0, y: track.y }),
          );
        }
        return group("masterbar", children, source, { x: masterbar.x, y: 0 });
      }),
      { rowId: row.id },
      { x: 0, y: row.y },
    ),
  );
  return new Drawing.Document([
    new Drawing.Page(score.width, score.height, rows),
  ]);
}

Score.prototype.toDocument = function (options) {
  return toDocument(this, options);
};
