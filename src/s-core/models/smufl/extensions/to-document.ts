import BravuraMetadata from "../../../const/bravura/bravura_metadata.json";
import * as Drawing from "../../document";
import * as Sheet from "../../sheet";
import * as SMUFL from "..";

export interface ToDocumentOptions {
  debug?: boolean;
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
  return glyphAtPosition(glyph, position, source);
}

function glyphAtPosition(
  glyph: SMUFL.Glyph,
  position: Drawing.Point,
  source: Drawing.Source,
  role = "glyph",
) {
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
      role,
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

interface StemGeometry {
  direction: "up" | "down";
  start: Drawing.Point;
  end: Drawing.Point;
  flag?: { glyph: SMUFL.Glyph; position: Drawing.Point };
}

function chordStem(chord: SMUFL.Chord): StemGeometry | undefined {
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
  const flagName =
    !chord.beamGroup && SMUFL.Glyph.findFlag(notes[0].type, direction);
  const flag = flagName
    ? new SMUFL.Glyph(flagName, Sheet.ElementType.Flag, 0)
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

function staveStems(stave: SMUFL.Stave) {
  const stems = new Map<number, StemGeometry>();
  for (const chord of stave.chords as SMUFL.Chord[]) {
    const stem = chordStem(chord);
    if (stem) stems.set(chord.id, stem);
  }
  // Use the primary beam's slope for every stem in its group, including inner chords.
  for (const beam of stave.beamGroups.filter((beam) => beam.level === 0)) {
    const first = stems.get(beam.firstChord.id);
    const last = stems.get(beam.lastChord.id);
    if (!first || !last) continue;
    const x1 = beam.firstChord.slot.x + first.end.x;
    const x2 = beam.lastChord.slot.x + last.end.x;
    const y1 = first.end.y;
    const y2 = last.end.y;
    for (const id of beam.chordIds) {
      const stem = stems.get(id);
      const chord = stave.chords.find((chord) => chord.id === id);
      if (!stem || !chord) continue;
      const x = chord.slot.x + stem.end.x;
      stem.end.y = x2 === x1 ? y1 : y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
    }
  }
  return stems;
}

function chordToDocument(
  chord: SMUFL.Chord,
  source: Drawing.Source,
  debug: boolean,
  stem?: StemGeometry,
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
  if (stem)
    children.push(
      new Drawing.Line(stem.start, stem.end, engraving.stemThickness, {
        role: "stem",
        source,
      }),
    );
  if (stem?.flag)
    children.push(
      glyphAtPosition(stem.flag.glyph, stem.flag.position, source, "flag"),
    );
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

function beamsToDocument(
  stave: SMUFL.Stave,
  source: Drawing.Source,
  stems: Map<number, StemGeometry>,
) {
  const spacing = engraving.beamThickness + engraving.beamSpacing;
  return stave.beamGroups.flatMap((beam) => {
    const first = stems.get(beam.firstChord.id);
    const last = stems.get(beam.lastChord.id);
    if (!first || !last) return [];
    const offset = (first.direction === "up" ? 1 : -1) * beam.level * spacing;
    const start = {
      x: stave.word.width + beam.firstChord.slot.x + first.end.x,
      y: first.end.y + offset,
    };
    const end = {
      x: stave.word.width + beam.lastChord.slot.x + last.end.x,
      y: last.end.y + offset,
    };
    if (beam.firstChord.id === beam.lastChord.id) {
      const hook = beam.firstChord.beam?.find(
        (value) => Number(value.$?.number) - 1 === beam.level,
      );
      const length = hook?._ === "backward hook" ? -1 : 1;
      const primary = stave.beamGroups.find(
        (value) =>
          value.level === 0 && value.chordIds.includes(beam.firstChord.id),
      );
      const primaryFirst = primary && stems.get(primary.firstChord.id);
      const primaryLast = primary && stems.get(primary.lastChord.id);
      const width =
        primary && primaryFirst && primaryLast
          ? primary.lastChord.slot.x +
            primaryLast.end.x -
            primary.firstChord.slot.x -
            primaryFirst.end.x
          : 0;
      const slope =
        width && primaryFirst && primaryLast
          ? (primaryLast.end.y - primaryFirst.end.y) / width
          : 0;
      end.x += length;
      end.y += length * slope;
    }
    return [
      new Drawing.Line(start, end, engraving.beamThickness, {
        role: "beam",
        source,
      }),
    ];
  });
}

function staveToDocument(
  stave: SMUFL.Stave,
  masterbar: SMUFL.Masterbar,
  source: Drawing.Source,
  debug: boolean,
) {
  const stems = staveStems(stave);
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
            chordToDocument(
              chord,
              { ...source, chordId: chord.id },
              debug,
              stems.get(chord.id),
            ),
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
    [word, slots, ...staff, ...beamsToDocument(stave, source, stems)],
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
