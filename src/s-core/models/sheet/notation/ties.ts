import { drainSteps, sortSteps } from "../render-steps";
import type { VisualTie } from "./schema";
export interface TieNote {
  id: number | string;
  trackId: number;
  staveId?: number;
  voice?: number;
  pitch: number | null;
  start: number;
  duration: number;
  rest?: boolean;
  ties?: readonly string[];
  visualTies?: readonly VisualTie[];
  tablature?: { string: number; fret: number };
}
export interface TieRelation {
  id: string;
  startNote: TieNote;
  endNote: TieNote;
  origin: "visual" | "musical-fallback";
  placement?: "above" | "below";
}
export interface TieProblem {
  note: TieNote;
  code: "DISPLAY_TIE_UNRESOLVED" | "TIE_DISPLAY_MISMATCH";
  message: string;
}
export const tieIdentity = (note: Pick<TieNote, "trackId" | "id">) =>
  `${note.trackId}:${note.id}`;
export function resolveTies(notes: readonly TieNote[]) {
  return drainSteps(resolveTiesSteps(notes));
}
export function* resolveTiesSteps(notes: readonly TieNote[]) {
  const pending = new Map<
    string,
    { note: TieNote; tie: VisualTie; origin: TieRelation["origin"] }[]
  >();
  const relations: TieRelation[] = [];
  const problems: TieProblem[] = [];
  const problem = (
    note: TieNote,
    message: string,
    code: TieProblem["code"] = "DISPLAY_TIE_UNRESOLVED",
  ) => problems.push({ note, code, message });
  for (const note of yield* sortSteps(
    notes,
    (a, b) => a.start - b.start || String(a.id).localeCompare(String(b.id)),
  )) {
    yield;
    if (note.rest || (note.pitch === null && !note.tablature)) continue;
    const explicit = note.visualTies !== undefined;
    const ties: readonly VisualTie[] =
      note.visualTies ??
      (note.ties ?? []).map((type) => ({ type: type as "start" | "stop" }));
    if (explicit) {
      const start = ties.some((t) => ["start", "continue"].includes(t.type));
      const stop = ties.some((t) => ["stop", "continue"].includes(t.type));
      if (
        start !== Boolean(note.ties?.includes("start")) ||
        stop !== Boolean(note.ties?.includes("stop"))
      )
        problem(
          note,
          "表示タイと演奏タイの指定が異なります。演奏の指定を維持します。",
          "TIE_DISPLAY_MISMATCH",
        );
    }
    for (const tie of ties.toSorted(
      (a, b) => Number(a.type === "start") - Number(b.type === "start"),
    )) {
      const key = `${note.trackId}:${note.staveId ?? 0}:${note.voice ?? 1}:${note.tablature ? `tab-${note.tablature.string}-${note.tablature.fret}` : note.pitch}:${tie.number ?? ""}`;
      if (tie.type === "stop" || tie.type === "continue") {
        const previous = pending.get(key) ?? [];
        if (
          previous.length === 1 &&
          Math.abs(
            previous[0].note.start + previous[0].note.duration - note.start,
          ) < 1e-9
        ) {
          const first = previous[0];
          relations.push({
            id: `${tieIdentity(first.note)}-${tieIdentity(note)}:${tie.number ?? ""}`,
            startNote: first.note,
            endNote: note,
            origin:
              explicit || first.origin === "visual"
                ? "visual"
                : "musical-fallback",
            placement:
              first.tie.placement ??
              (first.tie.orientation
                ? first.tie.orientation === "over"
                  ? "above"
                  : "below"
                : undefined),
          });
        } else
          problem(
            note,
            previous.length > 1
              ? "表示タイの接続先が複数あります。音と番号を確認してください。"
              : "表示タイの始点が見つかりません。対象音と時刻を確認してください。",
          );
        pending.delete(key);
      }
      if (tie.type === "start" || tie.type === "continue") {
        const list = pending.get(key) ?? [];
        if (list.length > 0)
          problem(note, "同音の表示タイ始点が重複しています。");
        list.push({
          note,
          tie,
          origin: explicit ? "visual" : "musical-fallback",
        });
        pending.set(key, list);
      }
    }
  }
  for (const list of pending.values())
    for (const { note } of list)
      problem(note, "表示タイの終点が見つかりません。");
  return { relations, problems };
}
