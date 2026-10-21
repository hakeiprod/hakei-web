import { staffY } from "../notation/staff-geometry";
import { staffSegments } from "../notation/tablature";
import { attachTies } from "../notation/ties";
import { barlineEndInset, chordStem, type StemGeometry } from "../geometry";
import type { LayoutGlyph } from "../layout/glyph";
import BravuraMetadata from "../../../const/bravura/bravura_metadata.json";
import * as Drawing from "../../document";
import * as Sheet from "../../sheet";
import * as Engraving from "..";
import type { PageLayout } from "../../sheet/page";
import { rowSpacing } from "../../sheet/row";

export interface ToDocumentOptions {
  debug?: boolean;
  pageLayout?: PageLayout;
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
  glyph: LayoutGlyph,
  source: Drawing.Source,
  includeSpace = true,
  offsetX = 0,
) {
  if (!(glyph instanceof Engraving.Glyph))
    throw new Error(
      "toDocument requires Engraving glyphs; draw the score first.",
    );
  const position = {
    x: glyph.x + (includeSpace ? glyph.spaceLeft : 0) + offsetX,
    y: staffY(glyph.line),
  };
  return glyphAtPosition(glyph, position, source);
}

function glyphAtPosition(
  glyph: Engraving.Glyph,
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

function ligatureToDocument(
  ligature: Engraving.Ligature,
  source: Drawing.Source,
) {
  return group(
    "ligature",
    ligature.glyphLists
      .flat()
      .map((glyph) =>
        glyphToDocument(
          glyph,
          source,
          glyph.type === Sheet.ElementType.Numerator ||
            glyph.type === Sheet.ElementType.Denominator,
        ),
      ),
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

function staveStems(stave: Engraving.Stave) {
  const stems = new Map<number, StemGeometry>();
  for (const chord of stave.chords as Engraving.Chord[]) {
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
  chord: Engraving.Chord,
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
          y: staffY(chord.line) - 0.5,
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
    const glyphs: Drawing.Element[] = [
      ...note.accidentalGlyphs.map((glyph) =>
        glyphToDocument(glyph, noteSource),
      ),
      ...(note.fretRun
        ? note.fretRun.digits.map((d) => {
            const x =
              chord.noteheadOffset + note.glyph.x + note.glyph.spaceLeft + d.x;
            const y =
              5 -
              note.line +
              (d.glyph.glyphBBox.y - d.glyph.glyphBBox.height / 2) * d.scale;
            return new Drawing.Glyph(
              d.glyph.codepoint,
              { x, y },
              {
                x: x + d.glyph.glyphBBox.x * d.scale,
                y: y - d.glyph.glyphBBox.y * d.scale,
                width: d.glyph.glyphBBox.width * d.scale,
                height: d.glyph.glyphBBox.height * d.scale,
              },
              d.glyph.glyphAdvanceWidth * d.scale,
              {
                role: "tab-digit",
                source: noteSource,
                glyphName: d.glyph.glyphName,
                fontScale: d.scale,
              },
            );
          })
        : [
            glyphToDocument(note.glyph, noteSource, true, chord.noteheadOffset),
          ]),
    ];
    const x = chord.noteheadOffset + note.glyph.x + note.glyph.spaceLeft;
    children.push(
      new Drawing.Group(glyphs, {
        role: note.fretRun ? "tab-fret" : "note",
        source: noteSource,
        ...(note.rest
          ? {}
          : {
              anchorRole: "note-anchor",
              anchorBounds: {
                x,
                y: staffY(note.line),
                width: note.glyph.glyphBBox.width,
                height: note.glyph.glyphBBox.height,
              },
            }),
        ...(note.tablature
          ? {
              tabValue: String(note.tablature.fret),
              string: note.tablature.string,
              fret: note.tablature.fret,
            }
          : {}),
      }),
    );
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
      { x: chord.noteheadOffset, y: 0 },
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
  bar: Engraving.Bar,
  masterbar: Engraving.Masterbar,
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
      line(
        masterbar.width - barlineEndInset(true) + thin / 2,
        thin,
        "barline-end-thin",
      ),
      line(masterbar.width - thick / 2, thick, "barline-end-thick"),
    );
  } else if (masterbar.isRowLast)
    lines.push(
      line(
        masterbar.width - barlineEndInset(false) + thin / 2,
        thin,
        "barline-end",
      ),
    );
  return group("barlines", lines, source);
}

function beamsToDocument(
  stave: Engraving.Stave,
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
      x: stave.headerWidth + beam.firstChord.slot.x + first.end.x,
      y: first.end.y + offset,
    };
    const end = {
      x: stave.headerWidth + beam.lastChord.slot.x + last.end.x,
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

function slotToDocument(
  slot: Engraving.Slot,
  stave: Engraving.Stave,
  source: Drawing.Source,
  debug: boolean,
  stems: Map<number, StemGeometry>,
) {
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
}

function staveToDocument(
  stave: Engraving.Stave,
  masterbar: Engraving.Masterbar,
  source: Drawing.Source,
  debug: boolean,
) {
  const stems = staveStems(stave);
  const word = group(
    "word",
    stave.word.glyphOrLigatureLists
      .flat()
      .map((element) =>
        element instanceof Engraving.Ligature
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
    uniqueSlots.map((slot) =>
      slotToDocument(slot, stave, source, debug, stems),
    ),
    source,
    { x: stave.headerWidth, y: 0 },
  );
  const staff = Array.from({ length: stave.height + 1 }, (_, y) => {
    const gaps: [number, number][] = [];
    for (const slot of uniqueSlots)
      for (const chord of slot.getTrackStaveChords(stave.trackId, stave.id))
        for (const note of chord.notes)
          if (note.fretRun && note.tablature?.string === y + 1) {
            const x =
              stave.headerWidth +
              slot.x +
              chord.noteheadOffset +
              note.glyph.x +
              note.glyph.spaceLeft;
            gaps.push([x - 0.15, x + note.fretRun.width + 0.15]);
          }
    return staffSegments(masterbar.width, gaps).map(
      ([a, b]) =>
        new Drawing.Line(
          { x: a, y },
          { x: b, y },
          engraving.staffLineThickness,
          { role: "staff-line", source },
        ),
    );
  }).flat();
  return group(
    "stave",
    [word, slots, ...staff, ...beamsToDocument(stave, source, stems)],
    source,
    { x: 0, y: stave.y },
  );
}

function masterbarToDocument(
  masterbar: Engraving.Masterbar,
  row: Engraving.Row,
  score: Engraving.Score,
  debug: boolean,
) {
  const source = { rowId: row.id, barId: masterbar.id };
  const children: Drawing.Element[] = [];
  if (debug)
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
                debug,
              ),
            ),
          ],
          trackSource,
        ),
      );
    children.push(group("track", bars, trackSource, { x: 0, y: track.y }));
  }
  return group("masterbar", children, source, { x: masterbar.x, y: 0 });
}

function rowToDocument(
  row: Engraving.Row,
  score: Engraving.Score,
  debug: boolean,
) {
  return group(
    "row",
    row.masterbars.map((masterbar) =>
      masterbarToDocument(masterbar, row, score, debug),
    ),
    { rowId: row.id },
    { x: 0, y: row.y },
  );
}

function paginateRows(
  rows: Drawing.Group[],
  systems: readonly Sheet.Row[],
  { width, height, margin }: PageLayout,
) {
  const pages: Drawing.Page[] = [];
  let elements: Drawing.Element[] = [];
  let y = margin;
  let pageWidth = width;
  let pageHeight = height;
  const finishPage = () => {
    pages.push(new Drawing.Page(pageWidth, pageHeight, elements));
    elements = [];
    y = margin;
    pageWidth = width;
    pageHeight = height;
  };
  for (const [index, row] of rows.entries()) {
    const system = systems[index];
    if (elements.length > 0 && y + system.height > height - margin)
      finishPage();
    elements.push(
      new Drawing.Group(row.children, {
        role: row.role,
        source: row.source,
        position: { x: margin, y },
      }),
    );
    // Keep a single oversized system visible rather than cropping it.
    pageWidth = Math.max(pageWidth, system.width + margin * 2);
    pageHeight = Math.max(pageHeight, y + system.height + margin);
    y += system.height + rowSpacing;
  }
  if (elements.length > 0 || pages.length === 0) finishPage();
  return pages;
}

/** Does not mount, redraw, mutate the score, or access browser APIs. */
export function toDocument(
  score: Engraving.Score,
  options: ToDocumentOptions = {},
) {
  if (score.tracks.length === 0 && score.notes.length === 0)
    return new Drawing.Document([
      new Drawing.Page(
        options.pageLayout?.width ?? 0,
        options.pageLayout?.height ?? 0,
      ),
    ]);
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
  for (const row of score.rows) {
    row.notationTop = 0;
    row.notationBottom = 0;
  }
  const rows = attachTies(
    score,
    score.rows.map((row) => rowToDocument(row, score, options.debug ?? false)),
  );
  if (options.pageLayout)
    return new Drawing.Document(
      paginateRows(rows, score.rows, options.pageLayout),
    );
  return new Drawing.Document([
    new Drawing.Page(score.width, score.height, rows),
  ]);
}
