import * as Drawing from "../../document";
import type { Score } from "../score";
import { resolveTies } from "../../sheet/notation/ties";
interface Anchor {
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
function addCurve(
  curves: Drawing.Curve[][],
  side: number,
  metadata: Omit<Drawing.TieMetadata, "part">,
  row: number,
  start: Drawing.Point,
  end: Drawing.Point,
  part: Drawing.TieMetadata["part"],
) {
  if (end.x - start.x < 0.1) return;
  const arch = side * Math.min(1.2, Math.max(0.55, (end.x - start.x) * 0.12));
  curves[row].push(new Drawing.Curve(start, end, arch, { ...metadata, part }));
}
/** Add ties after horizontal layout, then reserve vertical room before pagination. */
export function attachTies(score: Score, rows: Drawing.Group[]) {
  const anchors = new Map<string, Anchor>();
  for (const [index, row] of rows.entries()) {
    const visit = (elements: readonly Drawing.Element[], x = 0, y = 0) => {
      for (const element of elements) {
        if (
          element.anchorRole === "note-anchor" &&
          element.anchorBounds &&
          element.source?.noteId !== undefined
        ) {
          const b = element.anchorBounds;
          anchors.set(`${element.source.trackId}:${element.source.noteId}`, {
            row: index,
            x: x + b.x,
            y: y + b.y,
            width: b.width,
            height: b.height,
          });
        }
        if (element instanceof Drawing.Group)
          visit(
            element.children,
            x + element.position.x,
            y + element.position.y,
          );
      }
    };
    visit(row.children);
  }
  const sourceNotes = new Map(
    score.notes.map((note) => [`${note.trackId}:${note.id}`, note]),
  );
  const chordRanks = new Map<string, number>();
  for (const chord of score.chords) {
    const notes = chord.notes
      .filter((note) => !note.rest)
      .toSorted((a, b) => a.line - b.line);
    for (const [rank, note] of notes.entries())
      chordRanks.set(`${note.trackId}:${note.id}`, rank);
  }
  const unpitchedIds = new Set(
    score.notes.filter((n) => n.percussion).map((n) => `${n.trackId}:${n.id}`),
  );
  const ink = rows.map(() => ({ top: 0, bottom: 0 }));
  for (const [index, row] of rows.entries()) {
    const visit = (elements: readonly Drawing.Element[], y = 0) => {
      for (const element of elements) {
        if (element instanceof Drawing.Group)
          visit(element.children, y + element.position.y);
        else if (
          element instanceof Drawing.Glyph &&
          (element.role === "tab-digit" ||
            unpitchedIds.has(
              `${element.source?.trackId}:${element.source?.noteId}`,
            ))
        ) {
          ink[index].top = Math.max(
            ink[index].top,
            -(y + element.bounds.y) + 0.1,
          );
          ink[index].bottom = Math.max(
            ink[index].bottom,
            y +
              element.bounds.y +
              element.bounds.height -
              score.rows[index].height +
              0.1,
          );
        }
      }
    };
    visit(row.children);
  }
  const curves = rows.map(() => [] as Drawing.Curve[]);
  const notes = score.notes.map((note) => note.export());
  for (const relation of resolveTies(notes).relations) {
    const startNote = relation.startNote,
      endNote = relation.endNote;
    const a = anchors.get(`${startNote.trackId}:${startNote.id}`),
      b = anchors.get(`${endNote.trackId}:${endNote.id}`);
    if (!a || !b) continue;
    const source = sourceNotes.get(`${startNote.trackId}:${startNote.id}`)!;
    const side = relation.placement
      ? relation.placement === "above"
        ? -1
        : 1
      : source.stem?._ === "down"
        ? -1
        : 1;
    const rank = chordRanks.get(`${source.trackId}:${source.id}`) ?? 0;
    const offset = side * (0.55 + Math.max(0, rank) * 0.25);
    const metadata = {
      relationId: relation.id,
      startNote: { trackId: startNote.trackId, noteId: Number(startNote.id) },
      endNote: { trackId: endNote.trackId, noteId: Number(endNote.id) },
    };
    if (a.row === b.row)
      addCurve(
        curves,
        side,
        metadata,
        a.row,
        { x: a.x + a.width + 0.05, y: a.y + offset },
        { x: b.x - 0.05, y: b.y + offset },
        "complete",
      );
    else {
      addCurve(
        curves,
        side,
        metadata,
        a.row,
        { x: a.x + a.width + 0.05, y: a.y + offset },
        { x: score.rows[a.row].width - 0.1, y: a.y + offset },
        "outgoing",
      );
      addCurve(
        curves,
        side,
        metadata,
        b.row,
        { x: 0.2, y: b.y + offset },
        { x: b.x - 0.05, y: b.y + offset },
        "incoming",
      );
    }
  }
  return rows.map((row, index) => {
    const system = score.rows[index];
    const musicalHeight = system.height;
    const top = Math.max(
      0,
      ink[index].top,
      ...curves[index].map((c) => -c.bounds.y + 0.1),
    );
    const bottom = Math.max(
      0,
      ink[index].bottom,
      ...curves[index].map(
        (c) => c.bounds.y + c.bounds.height - musicalHeight + 0.1,
      ),
    );
    system.notationTop = top;
    system.notationBottom = bottom;
    const children = [...row.children, ...curves[index]];
    return new Drawing.Group(
      top > 0
        ? [new Drawing.Group(children, { position: { x: 0, y: top } })]
        : children,
      {
        role: row.role,
        source: row.source,
        position: { x: row.position.x, y: system.y },
      },
    );
  });
}
